import { TAG_MAX_LENGTH } from './config';

/** 서버 CHECK 제약(board_key_format)과 동일한 금지 문자 */
const FORBIDDEN = /[,.()'"`;:=&?#%\\/<>\[\]{}|*+!@$^~]/g;

/**
 * 사용자가 입력한 장소 이름 → 보드 키.
 * "스타벅스  강남역점" / "스타벅스 강남역점 " 이 같은 보드로 모이도록 정규화한다.
 */
export function normalizeTag(input: string): string {
  return input
    .replace(FORBIDDEN, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
    .slice(0, TAG_MAX_LENGTH)
    .trim();
}

export function isValidTag(tag: string): boolean {
  return tag.length >= 2 && tag.length <= TAG_MAX_LENGTH;
}

/** 장소 이름 앞에 붙일 수 있는 빠른 선택 카테고리 */
export const PLACE_CATEGORIES = ['카페', '대학교', '도서관', '학원', '회사', '지하철역', '공항', '공원'];

/**
 * 공유기 기본 SSID 는 전국에 수천 개라 그대로 보드 키로 쓰면 엉뚱한 사람들과 섞인다.
 * 이런 SSID 는 추천하되 "장소 이름을 덧붙이라"는 경고를 띄운다.
 */
const GENERIC_SSID = /^(iptime|kt_|sk_|u\+|olleh|tp-link|netgear|asus|linksys|dlink|android|iphone|galaxy|default|wifi|free)/i;

export function isGenericSsid(ssid: string): boolean {
  return GENERIC_SSID.test(ssid.trim());
}
