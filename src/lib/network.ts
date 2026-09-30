import { Platform } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { supabase } from './supabase';

export type WifiBoard = { cellular: false; board_key: string; post_count: number };
export type WifiBoardResult = WifiBoard | { cellular: true } | null;

/**
 * 지금 연결된 네트워크의 와이파이 보드.
 * 서버가 요청의 공인 IP 로 키를 만들어 주므로, 같은 공유기에 붙은 사람끼리 같은 키를 받는다.
 * (IP 원본은 저장하지 않으며 키에서 IP 를 되돌릴 수 없다)
 * IP 가 국내 이동통신 데이터망 대역이면 서버가 { cellular: true } 를 돌려준다 (iOS 처럼 기기가 알려주지 않아도 막힘).
 * 네트워크를 알 수 없거나 오류면 null.
 */
export async function fetchWifiBoard(): Promise<WifiBoardResult> {
  if (!supabase) return null;
  const { data, error } = await supabase.rpc('my_wifi_board');
  if (error || !data) return null;
  return data as WifiBoardResult;
}

/**
 * 휴대폰 데이터(LTE/5G)로 접속 중인지.
 * 통신사는 수많은 사용자에게 같은 공인 IP 를 나눠 주므로, 이때는 모르는 사람끼리 섞인다.
 * - 앱: NetInfo 로 정확히 판단
 * - 웹: Android Chrome 만 navigator.connection.type 을 알려준다. iOS Safari 등은 알 수 없음(null)
 */
export async function isOnCellular(): Promise<boolean | null> {
  if (Platform.OS === 'web') {
    const type = (navigator as Navigator & { connection?: { type?: string } }).connection?.type;
    if (!type || type === 'unknown') return null;
    return type === 'cellular';
  }
  const state = await NetInfo.fetch();
  if (state.type === 'unknown') return null;
  return state.type === 'cellular';
}
