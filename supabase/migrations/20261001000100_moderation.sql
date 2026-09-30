-- =====================================================================
-- WiFi Graffiti: 운영(모더레이션) 기능
--   - 신고: 서로 다른 익명 태그 3명이 신고하면 자동 숨김
--   - 금칙어 필터: 공백·특수문자로 우회한 욕설도 차단
--   - 개인정보 필터: 전화번호 형태 차단
-- (App Store 가이드라인 1.2 / Google Play UGC 정책 대응)
-- =====================================================================

-- ---------------------------------------------------------------------
-- 신고 누적 → 숨김
-- ---------------------------------------------------------------------
alter table public.posts
  add column if not exists report_count int not null default 0;

drop policy if exists "read live posts" on public.posts;
create policy "read live posts" on public.posts
  for select to anon, authenticated
  using (expires_at > now() and report_count < 3);

create table if not exists public.reports (
  post_id      bigint      not null references public.posts (id) on delete cascade,
  reporter_tag text        not null,
  reason       text        not null,
  created_at   timestamptz not null default now(),
  primary key (post_id, reporter_tag),
  constraint reporter_tag_format check (reporter_tag ~ '^익명-[0-9A-F]{4}$'),
  constraint reason_value check (reason in ('spam', 'abuse', 'privacy', 'sexual', 'other'))
);

-- 신고 내역은 앱에서 직접 읽거나 쓸 수 없고, 아래 함수로만 기록된다.
alter table public.reports enable row level security;
revoke all on public.reports from anon, authenticated;

create or replace function public.report_post(p_post_id bigint, p_reporter_tag text, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.posts where id = p_post_id and expires_at > now()) then
    return; -- 이미 사라진 글
  end if;

  insert into public.reports (post_id, reporter_tag, reason)
  values (p_post_id, p_reporter_tag, p_reason)
  on conflict do nothing;

  update public.posts
  set report_count = (select count(*) from public.reports where post_id = p_post_id)
  where id = p_post_id;
end;
$$;

revoke all on function public.report_post(bigint, text, text) from public;
grant execute on function public.report_post(bigint, text, text) to anon, authenticated;

-- 클라이언트가 report_count 를 직접 넣어 숨김을 피하거나 남의 글처럼 보이게 하지 못하도록
create or replace function public.posts_reset_report_count()
returns trigger
language plpgsql
as $$
begin
  new.report_count := 0;
  return new;
end;
$$;

drop trigger if exists posts_reset_report_count on public.posts;
create trigger posts_reset_report_count
  before insert on public.posts
  for each row execute function public.posts_reset_report_count();

-- ---------------------------------------------------------------------
-- 금칙어 / 개인정보 필터
-- 운영 중 추가: insert into public.banned_words (word) values ('단어');
-- ---------------------------------------------------------------------
create table if not exists public.banned_words (
  word text primary key check (word = lower(word) and word !~ '\s')
);

alter table public.banned_words enable row level security;
revoke all on public.banned_words from anon, authenticated;

insert into public.banned_words (word) values
  ('시발'), ('씨발'), ('ㅅㅂ'), ('ㅆㅂ'), ('씨바'), ('시바ㄹ'),
  ('병신'), ('ㅂㅅ'), ('븅신'),
  ('개새끼'), ('개새기'), ('ㄱㅅㄲ'), ('새끼야'),
  ('좆'), ('ㅈ같'), ('존나'), ('ㅈㄴ'),
  ('지랄'), ('ㅈㄹ'),
  ('니애미'), ('느금마'), ('니미'), ('애미뒤'),
  ('fuck'), ('shit'), ('bitch')
on conflict do nothing;

create or replace function public.posts_moderate()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  squashed text;
begin
  -- "시 발", "씨.발", "ㅅ ㅂ" 처럼 사이에 끼운 문자를 제거한 뒤 검사
  squashed := regexp_replace(lower(new.body), '[^0-9a-z가-힣ㄱ-ㅎㅏ-ㅣ]', '', 'g');

  if exists (
    select 1 from public.banned_words
    where position(word in squashed) > 0
  ) then
    raise exception 'BANNED_WORD' using errcode = 'P0001';
  end if;

  -- 휴대폰/유선 전화번호 (010-1234-5678, 01012345678, 02 123 4567 등)
  if new.body ~ '0\d{1,2}[\s.\-]?\d{3,4}[\s.\-]?\d{4}' then
    raise exception 'PERSONAL_INFO' using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists posts_moderate on public.posts;
create trigger posts_moderate
  before insert on public.posts
  for each row execute function public.posts_moderate();
