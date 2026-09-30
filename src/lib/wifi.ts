import { Platform } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import * as Location from 'expo-location';

export type SsidResult =
  | { status: 'ok'; ssid: string }
  | { status: 'unsupported' } // 웹 브라우저 등 OS 가 아예 제공하지 않음
  | { status: 'denied' } // 위치 권한 거부
  | { status: 'not-wifi' } // 셀룰러 / 오프라인
  | { status: 'unavailable' }; // 권한은 있지만 OS 가 SSID 를 숨김 (Expo Go on iOS, 엔타이틀먼트 누락 등)

/**
 * 현재 와이파이 SSID 를 "최선을 다해" 읽는다. 실패해도 앱은 수동 태그 입력으로 동작해야 한다.
 *
 * - Android 8.1+: ACCESS_FINE_LOCATION 권한 + 기기 위치(GPS) 켜짐 필요
 * - iOS 13+: 위치 권한 + "Access WiFi Information" 엔타이틀먼트 필요 → 개발/배포 빌드에서만 동작
 * - Web: 불가
 */
export async function detectSsid(): Promise<SsidResult> {
  if (Platform.OS === 'web') return { status: 'unsupported' };

  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') return { status: 'denied' };

  const state = await NetInfo.fetch();
  if (state.type !== 'wifi') return { status: 'not-wifi' };

  const ssid = state.details?.ssid?.trim();
  if (!ssid || ssid === '<unknown ssid>') return { status: 'unavailable' };
  return { status: 'ok', ssid: ssid.replace(/^"|"$/g, '') };
}

export function describeSsidFailure(result: Exclude<SsidResult, { status: 'ok' }>): string {
  switch (result.status) {
    case 'unsupported':
      return '이 환경에서는 와이파이 이름을 읽을 수 없어요. 장소를 직접 입력해 주세요.';
    case 'denied':
      return '위치 권한이 없어 와이파이 이름을 읽지 못했어요. 장소를 직접 입력해 주세요.';
    case 'not-wifi':
      return '와이파이에 연결되어 있지 않아요. 장소를 직접 입력해 주세요.';
    case 'unavailable':
      return '기기가 와이파이 이름을 공개하지 않았어요. 장소를 직접 입력해 주세요.';
  }
}
