-- =====================================================================
-- pg_cron 실행 기록 정리
-- 만료 글 정리 작업(10분마다)의 실행 기록(cron.job_run_details)은 자동으로 지워지지 않아
-- 1년에 약 5만 줄씩 쌓인다. 매일 새벽 4시(KST)에 7일 지난 기록을 지운다.
-- (pg_cron 스케줄은 UTC 기준: 19:00 UTC = 04:00 KST)
-- =====================================================================

select cron.schedule(
  'purge-cron-history',
  '0 19 * * *',
  $$delete from cron.job_run_details where end_time < now() - interval '7 days'$$
);
