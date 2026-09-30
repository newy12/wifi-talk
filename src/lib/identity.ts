import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'wg:author-tag';
let cached: string | null = null;

/**
 * 계정 없이 쓰는 익명 태그 (예: "익명-3F2A").
 * 기기에만 저장되며, 같은 사람이 쓴 글끼리 구분하는 용도로만 쓴다.
 */
export async function getAuthorTag(): Promise<string> {
  if (cached) return cached;
  try {
    const stored = await AsyncStorage.getItem(KEY);
    if (stored) return (cached = stored);
  } catch {}
  const hex = Math.floor(Math.random() * 0x10000).toString(16).toUpperCase().padStart(4, '0');
  cached = `익명-${hex}`;
  AsyncStorage.setItem(KEY, cached).catch(() => {});
  return cached;
}

const VISITOR_KEY = 'wg:visitor-id';
let cachedVisitor: string | null = null;

/**
 * "오늘 다녀간 사람 수"를 세기 위한 기기별 무작위 ID (32자리 hex).
 * 익명 태그는 6만5천 가지뿐이라 서로 다른 사람이 겹칠 수 있어서 따로 둔다.
 * 서버에는 해시로만 저장되고, 글이나 익명 태그와 연결되지 않는다.
 */
export async function getVisitorId(): Promise<string> {
  if (cachedVisitor) return cachedVisitor;
  try {
    const stored = await AsyncStorage.getItem(VISITOR_KEY);
    if (stored && /^[0-9a-f]{32}$/.test(stored)) return (cachedVisitor = stored);
  } catch {}
  const bytes = new Uint8Array(16);
  if (globalThis.crypto?.getRandomValues) globalThis.crypto.getRandomValues(bytes);
  else for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  cachedVisitor = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  AsyncStorage.setItem(VISITOR_KEY, cachedVisitor).catch(() => {});
  return cachedVisitor;
}
