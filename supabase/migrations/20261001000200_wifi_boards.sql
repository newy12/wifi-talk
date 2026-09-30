-- =====================================================================
-- WiFi Graffiti: "같은 와이파이" 보드
--
-- 같은 공유기(와이파이)에 붙은 기기들은 인터넷에 나갈 때 같은 공인 IP 를 쓴다.
-- 서버가 요청의 IP 로 보드 키를 만들어서, 같은 네트워크 사람끼리만 묶는다.
--
--   보드 키 = 'wifi-' + HMAC(서버 비밀키, 네트워크 || ISO 주차) 앞 16자
--     - 네트워크: IPv4 는 주소 그대로, IPv6 는 /64 대역 (한 공유기 안의 기기들이 공유)
--     - IP 원본은 어디에도 저장하지 않는다. 키에서 IP 를 되돌릴 수 없다.
--     - 키는 매주 바뀐다 (한 번 알아낸 키로 계속 엿보는 것 방지)
--
--   접근 제어
--     - 쓰기: 지금 내 네트워크의 키인 보드에만 (트리거)
--     - REST 읽기: 지금 내 네트워크의 키인 보드만 (RLS)
--     - Realtime: 요청 헤더가 없는 환경이라 IP 확인이 불가 → 추측 불가능한 키로 보호
--
-- IP 출처: Supabase 앞단 Cloudflare 가 넣는 cf-connecting-ip.
--   클라이언트가 이 헤더를 위조해 보내면 Cloudflare 가 403 으로 거부한다.
-- =====================================================================

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists private.secrets (
  name  text primary key,
  value text not null
);

insert into private.secrets (name, value)
values ('network_hmac', encode(extensions.gen_random_bytes(32), 'hex'))
on conflict (name) do nothing;

-- 요청을 보낸 네트워크 (IPv4 주소 또는 IPv6 /64). 요청 헤더가 없으면 null.
create or replace function private.client_network()
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  headers json;
  raw text;
  ip inet;
begin
  headers := nullif(current_setting('request.headers', true), '')::json;
  if headers is null then
    return null;
  end if;

  -- 운영: Cloudflare 가 넣는 값(위조 불가). 로컬 개발: Kong 이 넣는 x-forwarded-for.
  raw := coalesce(headers->>'cf-connecting-ip', split_part(headers->>'x-forwarded-for', ',', 1));
  raw := nullif(btrim(raw), '');
  if raw is null then
    return null;
  end if;

  begin
    ip := raw::inet;
  exception when others then
    return null;
  end;

  if family(ip) = 6 then
    return network(set_masklen(ip, 64))::text;
  end if;
  return host(ip);
end;
$$;

-- 지금 내 와이파이의 보드 키. 네트워크를 알 수 없으면 null.
create or replace function public.wifi_board_key()
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  net text := private.client_network();
  secret text;
begin
  if net is null then
    return null;
  end if;
  select value into secret from private.secrets where name = 'network_hmac';
  return 'wifi-' || left(
    encode(
      extensions.hmac(net || '|' || to_char(now() at time zone 'Asia/Seoul', 'IYYY-IW'), secret, 'sha256'),
      'hex'
    ),
    16
  );
end;
$$;

revoke all on function public.wifi_board_key() from public;
grant execute on function public.wifi_board_key() to anon, authenticated;

-- 와이파이 보드 읽기 권한: REST 는 같은 네트워크만, Realtime(헤더 없음)은 키를 아는 경우만
create or replace function private.can_read_board(p_board_key text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_board_key not like 'wifi-%' then
    return true;
  end if;
  if nullif(current_setting('request.headers', true), '') is null then
    return true;
  end if;
  return p_board_key = public.wifi_board_key();
end;
$$;

grant usage on schema private to anon, authenticated;
revoke all on all functions in schema private from public;
grant execute on function private.can_read_board(text) to anon, authenticated;
-- private 스키마는 API 에 노출되지 않으므로(config: schemas = public) 직접 호출은 불가하다.

drop policy if exists "read live posts" on public.posts;
create policy "read live posts" on public.posts
  for select to anon, authenticated
  using (
    expires_at > now()
    and report_count < 3
    and private.can_read_board(board_key)
  );

-- 쓰기: 와이파이 보드에는 지금 그 네트워크에 있는 사람만
create or replace function public.posts_wifi_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.board_key like 'wifi-%' and new.board_key is distinct from public.wifi_board_key() then
    raise exception 'WRONG_NETWORK' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists posts_wifi_guard on public.posts;
create trigger posts_wifi_guard
  before insert on public.posts
  for each row execute function public.posts_wifi_guard();

-- 신고도 같은 규칙: 지금 볼 수 있는 글만 신고 가능
create or replace function public.report_post(p_post_id bigint, p_reporter_tag text, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.posts
    where id = p_post_id
      and expires_at > now()
      and private.can_read_board(board_key)
  ) then
    return;
  end if;

  insert into public.reports (post_id, reporter_tag, reason)
  values (p_post_id, p_reporter_tag, p_reason)
  on conflict do nothing;

  update public.posts
  set report_count = (select count(*) from public.reports where post_id = p_post_id)
  where id = p_post_id;
end;
$$;

-- "지금 활발한 보드" 추천에 와이파이 보드(키)가 노출되면 안 된다
create or replace view public.active_boards
with (security_invoker = true) as
  select board_key,
         count(*)::int   as post_count,
         max(created_at) as last_post_at
  from public.posts
  where expires_at > now()
    and board_key not like 'wifi-%'
  group by board_key
  order by max(created_at) desc
  limit 20;

-- 와이파이 보드의 "지금 이 와이파이에 글이 몇 개" 표시용 (키를 노출하지 않음)
create or replace function public.my_wifi_board()
returns json
language sql
stable
security definer
set search_path = ''
as $$
  select json_build_object(
    'board_key', k.key,
    'post_count', (
      select count(*)::int from public.posts
      where board_key = k.key and expires_at > now() and report_count < 3
    )
  )
  from (select public.wifi_board_key() as key) k
  where k.key is not null;
$$;

revoke all on function public.my_wifi_board() from public;
grant execute on function public.my_wifi_board() to anon, authenticated;
