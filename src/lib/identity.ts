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
