import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, View } from 'react-native';
import { Text } from '@/components/Typography';
import { router, Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Composer } from './Composer';
import { PostActionSheet } from './PostActionSheet';
import { PostItem } from './PostItem';
import { SetupNotice } from './SetupNotice';
import { useBoardPosts, WRONG_NETWORK_MESSAGE } from '@/hooks/useBoardPosts';
import { useHiddenContent } from '@/hooks/useHiddenContent';
import { usePresenceCount } from '@/hooks/usePresence';
import type { ReportReason } from '@/lib/config';
import { getAuthorTag } from '@/lib/identity';
import { isSupabaseConfigured, type Post } from '@/lib/supabase';
import { colors } from '@/lib/theme';

const STATUS_LABEL = {
  loading: '연결 중…',
  live: '● 실시간',
  offline: '○ 연결 끊김 — 재시도 중',
  error: '오류',
} as const;

type Props = {
  boardKey: string;
  title: string;
  /** 헤더 오른쪽 버튼 (링크 공유 / 초대) */
  shareLabel: string;
  onShare: () => Promise<string | null>;
  /** 목록 위에 띄울 안내 (예: 네트워크가 바뀌어 보드를 옮김) */
  banner?: string | null;
  /** 이 보드 글쓰기가 WRONG_NETWORK 로 거부됐을 때 */
  onWrongNetwork?: () => void;
};

/** 보드 화면 공통: 실시간 글 목록 + 작성 + 신고/차단. 장소 태그 보드와 와이파이 보드가 함께 쓴다. */
export function BoardView({ boardKey, title, shareLabel, onShare, banner, onWrongNetwork }: Props) {
  const { posts, status, error, submit, report } = useBoardPosts(boardKey);
  const { isHidden, hidePost, blockAuthor } = useHiddenContent();
  const visiblePosts = useMemo(() => posts.filter((p) => !isHidden(p)), [posts, isHidden]);
  const [menuPost, setMenuPost] = useState<Post | null>(null);
  const [shareNote, setShareNote] = useState<string | null>(null);
  const [me, setMe] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const insets = useSafeAreaInsets();
  const viewers = usePresenceCount(`board:${boardKey}`);

  useEffect(() => {
    getAuthorTag().then(setMe);
    const t = setInterval(() => setNow(Date.now()), 60_000); // "n분 전" 갱신
    return () => clearInterval(t);
  }, []);

  const onReport = useCallback(
    async (post: Post, reason: ReportReason) => {
      const err = await report(post.id, reason);
      if (!err) hidePost(post.id);
      return err;
    },
    [report, hidePost],
  );

  const share = async () => {
    const note = await onShare();
    setShareNote(note);
    if (note) setTimeout(() => setShareNote(null), 2500);
  };

  const send = async (body: string) => {
    const err = await submit(body);
    if (err === WRONG_NETWORK_MESSAGE) onWrongNetwork?.();
    return err;
  };

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <Stack.Screen
        options={{
          title,
          // 공유 링크로 바로 들어오면 뒤로 갈 화면이 없으므로 홈 버튼을 대신 보여준다
          headerLeft: router.canGoBack()
            ? undefined
            : () => (
                <Pressable onPress={() => router.replace('/')} hitSlop={10} style={styles.home}>
                  <Text style={styles.homeText}>← 장소 선택</Text>
                </Pressable>
              ),
          headerRight: () => (
            <Pressable onPress={share} hitSlop={10} style={styles.share}>
              <Text style={styles.shareText}>{shareLabel}</Text>
            </Pressable>
          ),
        }}
      />

      <View style={styles.statusBar}>
        <Text style={[styles.status, status === 'live' && styles.statusLive]}>{STATUS_LABEL[status]}
          {status === 'live' && viewers ? ` · ${viewers}명 보는 중` : ''}
        </Text>
        <Text style={styles.status} numberOfLines={1}>
          {shareNote ?? (me ? `나: ${me}` : '')}
        </Text>
      </View>

      {banner ? <Text style={styles.banner}>{banner}</Text> : null}

      {!isSupabaseConfigured ? (
        <View style={styles.center}>
          <SetupNotice />
        </View>
      ) : status === 'loading' && posts.length === 0 ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.accent} />
        </View>
      ) : (
        <FlatList
          data={visiblePosts}
          keyExtractor={(p) => String(p.id)}
          renderItem={({ item }) => <PostItem post={item} mine={item.author_tag === me} now={now} onMenu={setMenuPost} />}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <Text style={styles.empty}>
              {error ?? '아직 아무도 낙서하지 않았어요.\n첫 번째 흔적을 남겨보세요!'}
            </Text>
          }
        />
      )}

      <View style={{ paddingBottom: Math.max(insets.bottom, 8) }}>
        <Composer onSubmit={send} />
      </View>

      <PostActionSheet
        post={menuPost}
        mine={menuPost?.author_tag === me}
        onClose={() => setMenuPost(null)}
        onReport={onReport}
        onBlock={(p) => blockAuthor(p.author_tag)}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  statusBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  status: { color: colors.textDim, fontSize: 12 },
  statusLive: { color: colors.accent },
  banner: {
    color: colors.accentText,
    backgroundColor: colors.accent,
    fontSize: 13,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  home: { marginLeft: 12, paddingRight: 12, paddingVertical: 6 },
  homeText: { color: colors.textDim, fontSize: 14 },
  share: {
    marginRight: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  shareText: { color: colors.accent, fontWeight: '600', fontSize: 13 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  list: { padding: 12, gap: 10, flexGrow: 1, width: '100%', maxWidth: 640, alignSelf: 'center' },
  empty: { color: colors.textDim, textAlign: 'center', marginTop: 80, lineHeight: 22 },
});
