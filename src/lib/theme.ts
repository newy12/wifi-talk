import { Platform } from 'react-native';

export const colors = {
  bg: '#0E0E12',
  surface: '#1A1A21',
  surfaceHigh: '#24242D',
  border: '#2E2E38',
  text: '#F2F2F5',
  textDim: '#9A9AA8',
  accent: '#C6FF3D',
  accentText: '#0E0E12',
  danger: '#FF6B6B',
};

/**
 * 글꼴 (웹: public/index.html 에서 웹폰트를 불러온다)
 * - ui: 화면 전반 — Pretendard
 * - brand: 로고·큰 제목 — Black Han Sans (굵은 간판 글씨, 굵기 하나뿐이라 fontWeight 를 주지 않는다)
 * - post: 담벼락에 남기는 글 — Gaegu (손글씨)
 * 앱(iOS/Android)은 아직 웹폰트를 번들하지 않아 시스템 글꼴을 쓴다.
 */
export const fonts = Platform.select<{ ui?: string; brand?: string; post?: string }>({
  web: {
    ui: '"Pretendard Variable", Pretendard, -apple-system, BlinkMacSystemFont, system-ui, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif',
    brand: '"Black Han Sans", "Pretendard Variable", sans-serif',
    post: 'Gaegu, "Pretendard Variable", sans-serif',
  },
  default: {},
});
