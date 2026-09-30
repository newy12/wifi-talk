-- =====================================================================
-- 담벼락: 초대 코드 방
--
-- 핫스팟 모임처럼 "지금 여기 있는 몇 명"끼리만 쓰는 비공개 보드.
-- 방을 만들면 6자리 코드(예: K7P2QX)가 나오고, 코드(또는 링크·QR)를 아는 사람만 들어온다.
--
--   보드 키 = 'room-' + HMAC(서버 비밀키, 코드) 앞 16자  → 키에서 코드를 알아낼 수 없음
--   코드 공간 = 32^6 ≈ 10억 (헷갈리는 0/O/1/I 제외) → 무작위 대입으로 찾기 어려움
--
--   접근 제어
--     - REST 읽기: 요청 헤더 x-board-key 가 그 방의 키와 같을 때만 (RLS)
--       → board_key=like.room-* 같은 목록 조회로 남의 방 글을 훔쳐볼 수 없다
--     - Realtime: 요청 헤더가 없는 환경이라 추측 불가능한 키로 보호 (와이파이 보드와 같은 방식)
--     - 쓰기: 실제로 만들어진 방에만 (트리거)
--     - "지금 활발한 보드" 목록에 나오지 않음
--   방은 마지막 글 이후 24시간 동안 아무 글도 없으면 사라진다 (글은 원래 24시간 뒤 사라짐)
-- =====================================================================

create table if not exists private.rooms (
  board_key      text primary key,
  creator_net    text,          -- 만든 네트워크의 해시 (도배 방지용, IP 원본 아님)
  created_at     timestamptz not null default now(),
  last_active_at timestamptz not null default now()
);

create index if not exists rooms_creator_idx on private.rooms (creator_net, created_at);

-- 코드 → 보드 키 (코드는 대소문자·공백·하이픈 무시)
create or replace function private.room_board_key(p_code text)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  code text := upper(regexp_replace(coalesce(p_code, ''), '[^0-9A-Za-z]', '', 'g'));
  secret text;
begin
  if code !~ '^[2-9A-HJ-NP-Z]{6}$' then
    return null;
  end if;
  select value into secret from private.secrets where name = 'network_hmac';
  return 'room-' || left(encode(extensions.hmac('room|' || code, secret, 'sha256'), 'hex'), 16);
end;
$$;

-- 방 만들기: 서버가 코드를 뽑는다 (한 네트워크에서 10분에 5개까지)
create or replace function public.create_room()
returns json
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  alphabet constant text := '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'; -- 32자
  net text := private.client_network();
  net_hash text;
  secret text;
  code text;
  key text;
  bytes bytea;
  i int;
begin
  select value into secret from private.secrets where name = 'network_hmac';
  net_hash := case when net is null then null
                   else encode(extensions.hmac('creator|' || net, secret, 'sha256'), 'hex') end;

  if net_hash is not null and (
    select count(*) from private.rooms
    where creator_net = net_hash and created_at > now() - interval '10 minutes'
  ) >= 5 then
    raise exception 'RATE_LIMIT_ROOM' using errcode = 'P0001';
  end if;

  for attempt in 1..5 loop
    bytes := extensions.gen_random_bytes(6);
    code := '';
    for i in 0..5 loop
      code := code || substr(alphabet, (get_byte(bytes, i) % 32) + 1, 1);
    end loop;
    key := private.room_board_key(code);
    insert into private.rooms (board_key, creator_net) values (key, net_hash)
    on conflict (board_key) do nothing;
    if found then
      return json_build_object('code', code, 'board_key', key);
    end if;
  end loop;

  raise exception 'ROOM_CREATE_FAILED' using errcode = 'P0001';
end;
$$;

-- 코드로 입장: 방이 있으면 보드 키, 없으면 null
create or replace function public.join_room(p_code text)
returns json
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  key text := private.room_board_key(p_code);
begin
  if key is null or not exists (select 1 from private.rooms where board_key = key) then
    return null;
  end if;
  return json_build_object('board_key', key);
end;
$$;

revoke all on function public.create_room() from public;
revoke all on function public.join_room(text) from public;
grant execute on function public.create_room() to anon, authenticated;
grant execute on function public.join_room(text) to anon, authenticated;

-- 읽기 권한: 와이파이 보드 + 초대 코드 방
create or replace function private.can_read_board(p_board_key text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  headers json := nullif(current_setting('request.headers', true), '')::json;
begin
  if p_board_key not like 'wifi-%' and p_board_key not like 'room-%' then
    return true;
  end if;
  if headers is null then
    return true; -- Realtime: 추측 불가능한 키로 보호
  end if;
  if p_board_key like 'wifi-%' then
    return p_board_key = public.wifi_board_key();
  end if;
  return p_board_key = headers->>'x-board-key';
end;
$$;

-- 쓰기: 와이파이 보드는 같은 네트워크만, 방은 실제로 있는 방에만
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
  if new.board_key like 'room-%' then
    update private.rooms set last_active_at = now() where board_key = new.board_key;
    if not found then
      raise exception 'ROOM_NOT_FOUND' using errcode = 'P0001';
    end if;
  end if;
  return new;
end;
$$;

-- 공개 목록에서 방 제외
create or replace view public.active_boards
with (security_invoker = true) as
  select board_key,
         count(*)::int   as post_count,
         max(created_at) as last_post_at
  from public.posts
  where expires_at > now()
    and board_key not like 'wifi-%'
    and board_key not like 'room-%'
  group by board_key
  order by max(created_at) desc
  limit 20;

-- 24시간 동안 글이 없는 방 정리 (매시 정각)
select cron.schedule(
  'purge-idle-rooms',
  '0 * * * *',
  $$delete from private.rooms where last_active_at < now() - interval '24 hours'$$
);
