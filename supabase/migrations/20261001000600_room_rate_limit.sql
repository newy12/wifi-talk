-- =====================================================================
-- 방 만들기 제한 완화: 네트워크당 10분에 5개 → 20개
-- 카페·학교 와이파이는 수십 명이 같은 공인 IP 를 쓰므로 5개는 금방 찬다.
-- =====================================================================

-- 방 만들기: 서버가 코드를 뽑는다 (한 네트워크에서 10분에 20개까지)
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
  ) >= 20 then
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
