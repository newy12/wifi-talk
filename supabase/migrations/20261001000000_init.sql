-- =====================================================================
-- WiFi Graffiti: 휘발성 익명 장소 보드 스키마
--
-- 서버비 0원 유지 전략 (Supabase Free: DB 500MB)
--   1) 모든 글은 작성 후 24시간 뒤 만료 (expires_at, 서버에서 강제)
--   2) 보드(장소 태그)당 최신 100개만 유지, 초과분은 insert 시 즉시 삭제
--   3) pg_cron 이 10분마다 만료된 글을 물리 삭제
--   4) 만료된 글은 RLS 로 조회 자체가 안 됨 (cron 지연과 무관)
--   => DB 크기 상한 ≈ (활성 보드 수 × 100 × 행 크기) 로 고정됨
--
-- 실행: Supabase 대시보드 > SQL Editor 에 전체 붙여넣고 Run
--       (여러 번 실행해도 안전하도록 작성됨)
-- =====================================================================

create extension if not exists pg_cron with schema pg_catalog;

-- ---------------------------------------------------------------------
-- 테이블
-- ---------------------------------------------------------------------
create table if not exists public.posts (
  id          bigint generated always as identity primary key,
  board_key   text        not null,
  body        text        not null,
  author_tag  text        not null,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null default now() + interval '24 hours',

  constraint board_key_format check (
    char_length(board_key) between 1 and 40
    and board_key = lower(btrim(board_key))
    and board_key !~ '[,.()''"`;:=&?#%\\/<>\[\]{}|*+!@$^~]'
  ),
  constraint body_length check (char_length(btrim(body)) between 1 and 140),
  constraint author_tag_format check (author_tag ~ '^익명-[0-9A-F]{4}$')
);

create index if not exists posts_board_created_idx
  on public.posts (board_key, created_at desc);
create index if not exists posts_expires_idx
  on public.posts (expires_at);

-- ---------------------------------------------------------------------
-- INSERT 전: 시간값 서버 강제 + 도배 방지
--   클라이언트가 보낸 created_at / expires_at 은 무시한다.
-- ---------------------------------------------------------------------
create or replace function public.posts_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.created_at := now();
  new.expires_at := now() + interval '24 hours';
  new.body       := btrim(new.body);

  -- 같은 익명 태그는 같은 보드에 10초에 1번만
  if exists (
    select 1 from public.posts
    where board_key = new.board_key
      and author_tag = new.author_tag
      and created_at > now() - interval '10 seconds'
  ) then
    raise exception 'RATE_LIMIT_AUTHOR' using errcode = 'P0001';
  end if;

  -- 보드 전체 기준 1분에 30개 초과 금지 (봇 도배 방어)
  if (
    select count(*) from public.posts
    where board_key = new.board_key
      and created_at > now() - interval '1 minute'
  ) >= 30 then
    raise exception 'RATE_LIMIT_BOARD' using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists posts_before_insert on public.posts;
create trigger posts_before_insert
  before insert on public.posts
  for each row execute function public.posts_before_insert();

-- ---------------------------------------------------------------------
-- INSERT 후: 보드당 최신 100개만 남기고 삭제
-- ---------------------------------------------------------------------
create or replace function public.posts_prune_board()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.posts
  where board_key = new.board_key
    and id < (
      select id from public.posts
      where board_key = new.board_key
      order by id desc
      offset 99 limit 1
    );
  return null;
end;
$$;

drop trigger if exists posts_prune_board on public.posts;
create trigger posts_prune_board
  after insert on public.posts
  for each row execute function public.posts_prune_board();

-- ---------------------------------------------------------------------
-- 권한 / RLS : 익명(anon)은 "살아있는 글 읽기" + "쓰기"만 가능
-- ---------------------------------------------------------------------
alter table public.posts enable row level security;

revoke all on public.posts from anon, authenticated;
grant select, insert on public.posts to anon, authenticated;

drop policy if exists "read live posts" on public.posts;
create policy "read live posts" on public.posts
  for select to anon, authenticated
  using (expires_at > now());

drop policy if exists "anyone can write" on public.posts;
create policy "anyone can write" on public.posts
  for insert to anon, authenticated
  with check (true); -- 검증은 CHECK 제약 + before insert 트리거가 담당

-- ---------------------------------------------------------------------
-- 지금 활발한 보드 목록 (홈 화면 추천용)
-- ---------------------------------------------------------------------
create or replace view public.active_boards
with (security_invoker = true) as
  select board_key,
         count(*)::int   as post_count,
         max(created_at) as last_post_at
  from public.posts
  where expires_at > now()
  group by board_key
  order by max(created_at) desc
  limit 20;

revoke all on public.active_boards from anon, authenticated;
grant select on public.active_boards to anon, authenticated;

-- ---------------------------------------------------------------------
-- Realtime: posts 의 INSERT 를 브로드캐스트
-- ---------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'posts'
  ) then
    alter publication supabase_realtime add table public.posts;
  end if;
end;
$$;

-- ---------------------------------------------------------------------
-- 10분마다 만료 글 물리 삭제 (같은 이름이면 덮어씀)
-- ---------------------------------------------------------------------
select cron.schedule(
  'purge-expired-posts',
  '*/10 * * * *',
  $$delete from public.posts where expires_at < now()$$
);
