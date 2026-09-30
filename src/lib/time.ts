export function timeAgo(iso: string, now = Date.now()): string {
  const sec = Math.max(0, Math.floor((now - new Date(iso).getTime()) / 1000));
  if (sec < 60) return '방금';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}분 전`;
  return `${Math.floor(min / 60)}시간 전`;
}

export function timeLeft(iso: string, now = Date.now()): string {
  const min = Math.max(0, Math.floor((new Date(iso).getTime() - now) / 60000));
  if (min < 60) return `${min}분 후 사라짐`;
  return `${Math.floor(min / 60)}시간 후 사라짐`;
}
