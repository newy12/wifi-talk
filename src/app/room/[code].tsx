import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { Redirect, router, Stack, useLocalSearchParams } from 'expo-router';
import { BoardView } from '@/components/BoardView';
import { RoomInvite } from '@/components/RoomInvite';
import { Text } from '@/components/Typography';
import { useConsent } from '@/hooks/useConsent';
import { useRecentRooms } from '@/hooks/useRecentRooms';
import { formatRoomCode, joinRoom, normalizeRoomCode } from '@/lib/rooms';
import { shareLink } from '@/lib/share';
import { colors, fonts } from '@/lib/theme';

/** 첫 화면으로: 이미 쌓여 있으면 뒤로 가고(첫 화면이 두 개 쌓이지 않게), 링크로 바로 왔으면 교체 */
const goHome = () => (router.canGoBack() ? router.back() : router.replace('/'));

type State = { kind: 'loading' } | { kind: 'missing' } | { kind: 'ready'; boardKey: string };

/** 초대 코드 방: 코드(또는 링크·QR)를 아는 사람끼리만 쓰는 비공개 보드 */
export default function RoomScreen() {
  const params = useLocalSearchParams<{ code: string }>();
  const code = normalizeRoomCode(params.code ?? '');
  const { agreed } = useConsent();
  const [state, setState] = useState<State>({ kind: 'loading' });
  const { rememberRoom, forgetRoom } = useRecentRooms();

  useEffect(() => {
    let cancelled = false;
    joinRoom(code).then((key) => {
      if (cancelled) return;
      setState(key ? { kind: 'ready', boardKey: key } : { kind: 'missing' });
      // 들어간 방은 "내 방" 목록에 기억하고, 사라진 방은 목록에서 뺀다
      if (key) rememberRoom(code);
      else forgetRoom(code);
    });
    return () => {
      cancelled = true;
    };
  }, [code, rememberRoom, forgetRoom]);

  // 공유 링크·QR 로 들어온 사람도 운영정책 동의 후 이 방으로 돌아오게 한다
  if (agreed === false) return <Redirect href={{ pathname: '/', params: { room: code } }} />;

  if (state.kind === 'ready') {
    return (
      <BoardView
        boardKey={state.boardKey}
        title={`🔒 ${formatRoomCode(code)}`}
        shareLabel="초대하기"
        onShare={() => shareLink(`/room/${code}`, `담벼락 초대 코드 방에 들어와요 (코드 ${formatRoomCode(code)})`)}
        topSlot={<RoomInvite code={code} />}
      />
    );
  }

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ title: '🔒 초대 코드 방' }} />
      {state.kind === 'loading' ? (
        <ActivityIndicator color={colors.accent} />
      ) : (
        <>
          <Text style={styles.title}>방을 찾을 수 없어요</Text>
          <Text style={styles.text}>
            코드({formatRoomCode(code) || '없음'})를 다시 확인해 주세요. 24시간 동안 글이 없던 방은 사라져요.
          </Text>
          <Pressable style={styles.button} onPress={goHome}>
            <Text style={styles.buttonText}>처음으로</Text>
          </Pressable>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg, justifyContent: 'center', alignItems: 'center', padding: 24, gap: 14 },
  title: { color: colors.text, fontSize: 24, fontFamily: fonts?.brand, textAlign: 'center' },
  text: { color: colors.textDim, fontSize: 14, lineHeight: 21, textAlign: 'center', maxWidth: 420 },
  button: { backgroundColor: colors.accent, borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12 },
  buttonText: { color: colors.accentText, fontWeight: '800', fontSize: 15 },
});
