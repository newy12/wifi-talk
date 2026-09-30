import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'wg:recent-tags';
const MAX = 8;

/** 이 기기에서 최근 입장한 장소 태그 (서버에 저장하지 않음) */
export function useRecentTags() {
  const [tags, setTags] = useState<string[]>([]);

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((raw) => raw && setTags(JSON.parse(raw)))
      .catch(() => {});
  }, []);

  const remember = useCallback((tag: string) => {
    setTags((prev) => {
      const next = [tag, ...prev.filter((t) => t !== tag)].slice(0, MAX);
      AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const forget = useCallback((tag: string) => {
    setTags((prev) => {
      const next = prev.filter((t) => t !== tag);
      AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  return { tags, remember, forget };
}
