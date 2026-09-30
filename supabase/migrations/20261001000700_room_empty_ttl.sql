-- =====================================================================
-- 초대 코드 방 수명
--   - 글이 하나도 없는 방: 만든 지 30분 뒤 삭제
--   - 글이 있는 방: 마지막 글 24시간 뒤 삭제 (그때면 글도 모두 만료됨)
-- 글이 한 번이라도 올라오면 last_active_at 이 created_at 보다 뒤로 갱신된다 (posts_wifi_guard 트리거).
-- 30분을 크게 넘기지 않도록 5분마다 정리한다. (같은 이름의 cron 은 덮어씀)
-- =====================================================================

select cron.schedule(
  'purge-idle-rooms',
  '*/5 * * * *',
  $$delete from private.rooms
    where last_active_at < now() - interval '24 hours'
       or (last_active_at = created_at and created_at < now() - interval '30 minutes')$$
);
