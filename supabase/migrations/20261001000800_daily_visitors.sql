-- =====================================================================
-- 담벼락: 오늘 다녀간 사람 수 ("오늘 N명이 다녀갔어요")
--
-- - 기기마다 무작위 방문자 ID(32자리 hex)를 만들어 두고, 하루(한국 시간)에 한 번만 센다
-- - ID 원본은 저장하지 않고 HMAC 해시만 저장한다
-- - 도배 방지: 한 네트워크에서 하루에 새로 셀 수 있는 방문자는 300명까지
-- - 어제 이전 기록은 매일 새벽 지운다 → 테이블이 커지지 않는다
-- =====================================================================

create table if not exists private.daily_visitors (
  day          date not null,
  visitor_hash text not null,
  net_hash     text,
  primary key (day, visitor_hash)
);

create index if not exists daily_visitors_net_idx on private.daily_visitors (day, net_hash);

create or replace function private.kst_today()
returns date
language sql
stable
as $$ select (now() at time zone 'Asia/Seoul')::date $$;

-- 방문 기록 + 오늘 방문자 수 반환 (같은 기기가 여러 번 불러도 한 번만 셈)
create or replace function public.record_visit(p_visitor_id text)
returns int
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  today date := private.kst_today();
  secret text;
  net text := private.client_network();
  v_hash text;
  n_hash text;
begin
  if p_visitor_id ~ '^[0-9a-f]{32}$' then
    select value into secret from private.secrets where name = 'network_hmac';
    v_hash := left(encode(extensions.hmac('visit|' || p_visitor_id, secret, 'sha256'), 'hex'), 32);
    n_hash := case when net is null then null
                   else left(encode(extensions.hmac('visit-net|' || net, secret, 'sha256'), 'hex'), 32) end;

    if n_hash is null or (
      select count(*) from private.daily_visitors where day = today and net_hash = n_hash
    ) < 300 then
      insert into private.daily_visitors (day, visitor_hash, net_hash)
      values (today, v_hash, n_hash)
      on conflict do nothing;
    end if;
  end if;

  return (select count(*)::int from private.daily_visitors where day = today);
end;
$$;

revoke all on function public.record_visit(text) from public;
grant execute on function public.record_visit(text) to anon, authenticated;

-- 어제 이전 기록 삭제: 매일 04:05 KST (19:05 UTC)
select cron.schedule(
  'purge-daily-visitors',
  '5 19 * * *',
  $$delete from private.daily_visitors where day < private.kst_today()$$
);
