import { useRef, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
  type GestureResponderEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ScrollViewProps,
} from 'react-native';
import { colors } from '@/lib/theme';
import { Text } from './Typography';

type Props = ScrollViewProps & {
  onRefresh: () => Promise<unknown>;
  children: ReactNode;
};

const TRIGGER = 64; // 이만큼 당기면 놓았을 때 새로고침
const MAX_PULL = 96;
const MIN_SPIN_MS = 600; // 너무 빨리 끝나도 새로고침된 걸 알 수 있게

/** 웹의 DOM TouchEvent 는 pageY 가 touches[0] 안에 있다 (앱은 nativeEvent.pageY) */
function touchY(e: GestureResponderEvent): number {
  const native = e.nativeEvent as GestureResponderEvent['nativeEvent'] & {
    touches?: ArrayLike<{ pageY: number }>;
  };
  return native.touches?.[0]?.pageY ?? native.pageY;
}

/**
 * 맨 위에서 아래로 당기면 새로고침되는 ScrollView.
 * - 앱: RefreshControl (OS 기본)
 * - 웹: react-native-web 은 RefreshControl 을 지원하지 않고, 화면 안쪽 스크롤이라 브라우저 기본
 *   당겨서 새로고침도 동작하지 않으므로 터치 이벤트로 직접 구현한다.
 */
export function PullToRefreshScrollView({ onRefresh, children, onScroll, ...rest }: Props) {
  const [refreshing, setRefreshing] = useState(false);
  const [pull, setPull] = useState(0);
  const scrollY = useRef(0);
  const startY = useRef<number | null>(null);

  const refresh = async () => {
    setRefreshing(true);
    const started = Date.now();
    try {
      await onRefresh();
    } finally {
      const wait = Math.max(0, MIN_SPIN_MS - (Date.now() - started));
      setTimeout(() => setRefreshing(false), wait);
    }
  };

  const handleScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    scrollY.current = e.nativeEvent.contentOffset.y;
    onScroll?.(e);
  };

  if (Platform.OS !== 'web') {
    return (
      <ScrollView
        {...rest}
        onScroll={handleScroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.accent} />}
      >
        {children}
      </ScrollView>
    );
  }

  const onTouchStart = (e: GestureResponderEvent) => {
    startY.current = scrollY.current <= 0 && !refreshing ? touchY(e) : null;
  };
  const onTouchMove = (e: GestureResponderEvent) => {
    if (startY.current === null) return;
    const dy = touchY(e) - startY.current;
    // 위로 스크롤하려는 동작이면 당기기 취소
    if (dy <= 0 || scrollY.current > 0) {
      startY.current = null;
      setPull(0);
      return;
    }
    setPull(Math.min(MAX_PULL, dy * 0.5));
  };
  const onTouchEnd = () => {
    if (startY.current !== null && pull >= TRIGGER) refresh();
    startY.current = null;
    setPull(0);
  };

  const indicatorHeight = refreshing ? 48 : pull;

  return (
    <ScrollView
      {...rest}
      onScroll={handleScroll}
      scrollEventThrottle={16}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onTouchCancel={onTouchEnd}
    >
      {indicatorHeight > 0 && (
        <View style={[styles.indicator, { height: indicatorHeight }]}>
          {refreshing ? (
            <ActivityIndicator color={colors.accent} />
          ) : (
            <Text style={styles.hint}>{pull >= TRIGGER ? '놓으면 새로고침' : '당겨서 새로고침'}</Text>
          )}
        </View>
      )}
      {children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  indicator: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  hint: { color: colors.textDim, fontSize: 12 },
});
