import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'wg:consent-v1';

/** 운영정책 동의 여부 (UGC 앱 스토어 심사 요구사항). 정책이 바뀌면 KEY 버전을 올린다. */
export function useConsent() {
  const [agreed, setAgreed] = useState<boolean | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((v) => setAgreed(v === 'yes'))
      .catch(() => setAgreed(false));
  }, []);

  const agree = useCallback(() => {
    setAgreed(true);
    AsyncStorage.setItem(KEY, 'yes').catch(() => {});
  }, []);

  return { agreed, agree };
}
