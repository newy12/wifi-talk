import { Redirect, useLocalSearchParams } from 'expo-router';
import { BoardView } from '@/components/BoardView';
import { useConsent } from '@/hooks/useConsent';
import { shareBoard } from '@/lib/share';
import { normalizeTag } from '@/lib/tags';

/** 장소 태그 보드: 같은 태그(또는 공유 링크)로 들어온 사람들끼리 */
export default function TagBoardScreen() {
  const params = useLocalSearchParams<{ tag: string }>();
  const boardKey = normalizeTag(params.tag ?? ''); // 딥링크로 들어온 값도 정규화
  const { agreed } = useConsent();

  // 딥링크로 바로 들어와도 운영정책 동의 전에는 글을 보거나 쓸 수 없다.
  // 공유 링크로 들어온 사람은 동의 후 이 보드로 돌아오도록 next 를 넘긴다.
  if (agreed === false) return <Redirect href={{ pathname: '/', params: { next: boardKey } }} />;

  return (
    <BoardView boardKey={boardKey} title={`#${boardKey}`} shareLabel="링크 공유" onShare={() => shareBoard(boardKey)} />
  );
}
