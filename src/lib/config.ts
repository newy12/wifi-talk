/** 서버(0001_init.sql)와 반드시 맞춰야 하는 값들 */
export const POST_MAX_LENGTH = 140;
export const POST_TTL_HOURS = 24;
export const BOARD_MAX_POSTS = 100;
export const TAG_MAX_LENGTH = 40;

/** 서로 다른 사람 N명이 신고하면 서버에서 자동 숨김 (moderation.sql 의 RLS 와 동일) */
export const REPORT_HIDE_THRESHOLD = 3;

export const REPORT_REASONS = [
  { value: 'spam', label: '스팸 / 도배' },
  { value: 'abuse', label: '욕설 / 혐오 / 괴롭힘' },
  { value: 'privacy', label: '개인정보 노출' },
  { value: 'sexual', label: '음란 / 불쾌한 내용' },
  { value: 'other', label: '기타' },
] as const;

export type ReportReason = (typeof REPORT_REASONS)[number]['value'];

/** 스토어 제출 전 실제 운영자 연락처로 교체하세요 (App Store 1.2 필수 항목) */
export const CONTACT_EMAIL = 'contact@example.com';
