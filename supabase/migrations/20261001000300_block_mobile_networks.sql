-- =====================================================================
-- WiFi Graffiti: 휴대폰 데이터(LTE/5G)로는 "이 와이파이" 보드에 못 들어오게 막기
--
-- 통신사 데이터망은 수많은 가입자가 같은 공인 IP 를 나눠 쓰므로(CGNAT) 모르는 사람끼리 섞인다.
-- iOS 브라우저는 연결 종류를 알려주지 않아서 클라이언트만으로는 막을 수 없으므로,
-- 서버가 요청 IP 가 국내 이동통신사 데이터망 대역인지 확인한다.
--
-- 대역 출처 (2026-10-01 확인)
--   - 위키백과:이동통신사 IP 주소 (https://ko.wikipedia.org/wiki/위키백과:통신사_IP, 2024-01-15 갱신)
--   - RIPEstat 라우팅/WHOIS 교차 확인:
--       SKT 대역은 SK텔레콤 망(AS9644) 소속. 가정용 인터넷은 SK브로드밴드(AS9318)로 별도.
--       KT 2001:e60::/32 는 가정용 IPv6(2400:...)와 별도. LG U+ 2001:4430::/32(LGTELECOM)는
--       가정용 IPv6(2001:270::, LG DACOM)와 별도.
--   - KT·LG U+ 의 IPv4 는 가정용과 같은 망(AS)에 있어 대역 단위로만 구분 가능하다.
--
-- 한계: 목록에 없는 새 대역·알뜰폰 일부·해외 통신사는 못 막는다. 통신사가 대역을 바꾸면 갱신 필요.
--   insert into private.mobile_networks (network, carrier) values ('x.x.0.0/16', 'KT');
-- =====================================================================

create table if not exists private.mobile_networks (
  network cidr primary key,
  carrier text not null
);

insert into private.mobile_networks (network, carrier) values
  -- SKT
  ('27.160.0.0/12',  'SKT'),
  ('27.176.0.0/13',  'SKT'),
  ('223.32.0.0/11',  'SKT'),
  ('203.226.0.0/16', 'SKT'),
  ('211.234.0.0/16', 'SKT/LG U+'),
  ('2001:2d8::/32',  'SKT'),
  ('2001:f28::/32',  'SKT'),
  -- KT
  ('39.7.0.0/16',    'KT'),
  ('110.70.0.0/16',  'KT'),
  ('175.223.0.0/16', 'KT'),
  ('211.246.0.0/16', 'KT'),
  ('118.235.0.0/16', 'KT'),
  ('2001:e60::/32',  'KT'),
  -- LG U+
  ('61.43.0.0/16',   'LG U+'),
  ('117.111.0.0/16', 'LG U+'),
  ('211.36.0.0/16',  'LG U+'),
  ('106.101.0.0/16', 'LG U+'),
  ('106.102.0.0/16', 'LG U+'),
  ('2001:4430::/32', 'LG U+')
on conflict (network) do nothing;

-- 지금 요청이 이동통신 데이터망에서 왔는지
create or replace function private.is_mobile_network()
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  net text := private.client_network();
begin
  if net is null then
    return false;
  end if;
  return exists (
    select 1 from private.mobile_networks m
    where net::inet <<= m.network
  );
end;
$$;

-- 데이터망이면 와이파이 보드 키를 주지 않는다.
-- → 쓰기 트리거(posts_wifi_guard)와 읽기 RLS(can_read_board)도 자동으로 막힌다.
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
  if net is null or private.is_mobile_network() then
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

-- 클라이언트용: 데이터망이면 {"cellular": true}, 아니면 보드 키와 글 개수
create or replace function public.my_wifi_board()
returns json
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  k text;
begin
  if private.is_mobile_network() then
    return json_build_object('cellular', true);
  end if;
  k := public.wifi_board_key();
  if k is null then
    return null;
  end if;
  return json_build_object(
    'cellular', false,
    'board_key', k,
    'post_count', (
      select count(*)::int from public.posts
      where board_key = k and expires_at > now() and report_count < 3
    )
  );
end;
$$;
