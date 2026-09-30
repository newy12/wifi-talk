import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Redirect, router, Stack } from 'expo-router';
import { BoardView } from '@/components/BoardView';
import { useConsent } from '@/hooks/useConsent';
import { fetchWifiBoard, isOnCellular } from '@/lib/network';
import { shareLink } from '@/lib/share';
import { colors } from '@/lib/theme';

type State =
  | { kind: 'checking' }
  | { kind: 'confirm' } // 연결 종류를 알 수 없음 (iOS 등) → 사용자에게 확인
  | { kind: 'cellular' }
  | { kind: 'failed' }
  | { kind: 'ready'; boardKey: string };

const RECHECK_MS = 60_000;

/**
 * iOS 브라우저 등은 와이파이/데이터를 알려주지 않으므로, 입장 전에 한 번 물어본다.
 * 답은 이 탭(세션)이 살아있는 동안만 기억한다.
 */
let confirmedWifiThisSession = false;

/**
 * 같은 와이파이 보드.
 * 들어올 때와 1분마다·앱 복귀 시·네트워크 변경 시 네트워크를 다시 확인해서,
 * 와이파이가 바뀌면 새 네트워크의 보드로 자동으로 옮긴다 (이전 와이파이 글은 더 이상 안 보임).
 */
export default function WifiBoardScreen() {
  const { agreed } = useConsent();
  const [state, setState] = useState<State>({ kind: 'checking' });
  const [banner, setBanner] = useState<string | null>(null);
  const currentKey = useRef<string | null>(null);

  const check = useCallback(async () => {
    // 1) 기기가 데이터라고 알려주면 (Android Chrome, 앱)
    const cellular = await isOnCellular();
    if (cellular === true) {
      currentKey.current = null;
      setState({ kind: 'cellular' });
      return;
    }
    // 2) 서버가 IP 로 이동통신 데이터망을 확인 (iOS 에서 "와이파이예요"를 눌러도 여기서 막힘)
    const board = await fetchWifiBoard();
    if (board?.cellular) {
      currentKey.current = null;
      setState({ kind: 'cellular' });
      return;
    }
    if (!board) {
      if (!currentKey.current) setState({ kind: 'failed' });
      return; // 잠깐 끊긴 경우엔 보던 보드를 유지
    }
    // 3) 목록에 없는 통신사(해외·일부 알뜰폰)까지 줄이기 위해, 기기가 알려주지 않으면 한 번 물어본다
    if (cellular === null && !confirmedWifiThisSession) {
      setState({ kind: 'confirm' });
      return;
    }
    if (currentKey.current && currentKey.current !== board.board_key) {
      setBanner('와이파이가 바뀌어서, 지금 연결된 와이파이의 보드로 옮겼어요.');
      setTimeout(() => setBanner(null), 5000);
    }
    currentKey.current = board.board_key;
    setState({ kind: 'ready', boardKey: board.board_key });
  }, []);

  useEffect(() => {
    // 첫 확인도 타이머 콜백으로 실행한다 (effect 본문에서 바로 setState 하지 않도록)
    const first = setTimeout(check, 0);
    const timer = setInterval(check, RECHECK_MS);
    const appState = AppState.addEventListener('change', (s) => s === 'active' && check());
    const onOnline = () => check();
    if (Platform.OS === 'web') window.addEventListener('online', onOnline);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
      appState.remove();
      if (Platform.OS === 'web') window.removeEventListener('online', onOnline);
    };
  }, [check]);

  if (agreed === false) return <Redirect href={{ pathname: '/', params: { wifi: '1' } }} />;

  if (state.kind === 'ready') {
    return (
      <BoardView
        key={state.boardKey} // 네트워크가 바뀌면 보드를 새로 마운트
        boardKey={state.boardKey}
        title="📶 이 와이파이"
        shareLabel="친구 초대"
        onShare={() => shareLink('/wifi', '같은 와이파이에 있는 사람들과 익명 낙서 (24시간 뒤 사라져요)')}
        banner={banner}
        onWrongNetwork={check}
      />
    );
  }

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ title: '📶 이 와이파이' }} />
      {state.kind === 'checking' ? (
        <>
          <ActivityIndicator color={colors.accent} />
          <Text style={styles.text}>지금 연결된 네트워크를 확인하고 있어요…</Text>
        </>
      ) : state.kind === 'confirm' ? (
        <>
          <Text style={styles.title}>지금 이 장소의 와이파이에{'\n'}연결되어 있나요?</Text>
          <Text style={styles.text}>
            이 보드는 같은 와이파이에 연결된 사람끼리만 보여요. 휴대폰 데이터(LTE/5G)로 들어오면 모르는 사람들과 섞이거나
            혼자만 남게 돼요. 이 브라우저는 연결 종류를 알려주지 않아서 직접 확인이 필요해요.
          </Text>
          <Pressable
            style={styles.button}
            onPress={() => {
              confirmedWifiThisSession = true;
              setState({ kind: 'checking' });
              check();
            }}
          >
            <Text style={styles.buttonText}>네, 와이파이예요</Text>
          </Pressable>
          <Pressable style={styles.secondary} onPress={() => setState({ kind: 'cellular' })}>
            <Text style={styles.secondaryText}>아니요, 데이터예요</Text>
          </Pressable>
        </>
      ) : (
        <>
          <Text style={styles.title}>
            {state.kind === 'cellular' ? '와이파이에 연결해 주세요' : '네트워크를 확인하지 못했어요'}
          </Text>
          <Text style={styles.text}>
            {state.kind === 'cellular'
              ? '휴대폰 데이터(LTE/5G)로 접속한 것으로 확인됐어요. 데이터는 통신사가 여러 사람에게 같은 주소를 나눠 줘서 모르는 사람들과 섞이게 돼요. 이 장소의 와이파이에 연결한 뒤 다시 시도해 주세요.'
              : '인터넷 연결을 확인한 뒤 다시 시도해 주세요.'}
          </Text>
          <Pressable style={styles.button} onPress={() => { setState({ kind: 'checking' }); check(); }}>
            <Text style={styles.buttonText}>다시 확인</Text>
          </Pressable>
          <Pressable onPress={() => router.replace('/')}>
            <Text style={styles.link}>장소 태그로 들어가기</Text>
          </Pressable>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    gap: 14,
  },
  title: { color: colors.text, fontSize: 20, fontWeight: '800', textAlign: 'center' },
  text: { color: colors.textDim, fontSize: 14, lineHeight: 21, textAlign: 'center', maxWidth: 420 },
  button: { backgroundColor: colors.accent, borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12, marginTop: 8 },
  buttonText: { color: colors.accentText, fontWeight: '800', fontSize: 15 },
  secondary: { borderRadius: 12, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 24, paddingVertical: 12 },
  secondaryText: { color: colors.text, fontWeight: '600', fontSize: 15 },
  link: { color: colors.textDim, textDecorationLine: 'underline', fontSize: 13 },
});
