import { Platform, Share } from 'react-native';

/**
 * 링크 공유. 웹 서비스에서는 링크(또는 그 QR)가 주요 입장 경로다.
 * - 모바일 브라우저: OS 공유 시트 (navigator.share)
 * - 데스크톱 브라우저: 클립보드 복사
 * - 앱: 네이티브 공유 시트
 * 반환값: 사용자에게 보여줄 결과 문구 (취소·공유 시트 사용 시 null)
 */
export async function shareLink(path: string, text: string): Promise<string | null> {
  const title = 'WiFi Graffiti';

  if (Platform.OS === 'web') {
    const url = `${window.location.origin}${path}`;
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ title, text, url });
        return null;
      } catch (e) {
        if (e instanceof Error && e.name === 'AbortError') return null;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      return '링크를 복사했어요';
    } catch {
      return url; // 클립보드 권한이 없으면 주소를 그대로 보여준다
    }
  }

  await Share.share({ title, message: text });
  return null;
}

export function shareBoard(boardKey: string): Promise<string | null> {
  return shareLink(
    `/board/${encodeURIComponent(boardKey)}`,
    `지금 #${boardKey} 에 있는 사람들과 익명 낙서 (24시간 뒤 사라져요)`,
  );
}
