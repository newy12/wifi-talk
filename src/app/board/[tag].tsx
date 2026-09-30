import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Redirect, router, Stack, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Composer } from '@/components/Composer';
import { PostActionSheet } from '@/components/PostActionSheet';
import { PostItem } from '@/components/PostItem';
import { SetupNotice } from '@/components/SetupNotice';
import { useBoardPosts } from '@/hooks/useBoardPosts';
import { useConsent } from '@/hooks/useConsent';
import { useHiddenContent } from '@/hooks/useHiddenContent';
import type { ReportReason } from '@/lib/config';
import { getAuthorTag } from '@/lib/identity';
import { isSupabaseConfigured, type Post } from '@/lib/supabase';
import { shareBoard } from '@/lib/share';
import { normalizeTag } from '@/lib/tags';
import { colors } from '@/lib/theme';

const STATUS_LABEL = {
  loading: '연결 중…',
  live: '● 실시간',
  offline: '○ 연결 끊김 — 재시도 중',
  error: '오류',
} as const;

/** 메인 화면: 장소 보드. 실시간 글 목록 + 작성 */
export default function BoardScreen() {
  const params = useLocalSearchParams<{ tag: string }>();
  const boardKey = normalizeTag(params.tag ?? ''); // 딥링크로 들어온 값도 정규화
  const { posts, status, error, submit, report } = useBoardPosts(boardKey);
  const { isHidden, hidePost, blockAuthor } = useHiddenContent();
  const visiblePosts = useMemo(() => posts.filter((p) => !isHidden(p)), [posts, isHidden]);
  const [menuPost, setMenuPost] = useState<Post | null>(null);
  const [shareNote, setShareNote] = useState<string | null>(null);
  const [me, setMe] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const insets = useSafeAreaInsets();
  const { agreed } = useConsent();

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

  // 딥링크로 바로 들어와도 운영정책 동의 전에는 글을 보거나 쓸 수 없다
  // 공유 링크로 들어온 사람은 동의 후 이 보드로 돌아오도록 next 를 넘긴다
  if (agreed === false) return <Redirect href={{ pathname: '/', params: { next: boardKey } }} />;

  const onShare = async () => {
    const note = await shareBoard(boardKey);
    setShareNote(note);
    if (note) setTimeout(() => setShareNote(null), 2500);
  };

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <Stack.Screen
        options={{
          title: `#${boardKey}`,
          // 공유 링크로 바로 들어오면 뒤로 갈 화면이 없으므로 홈 버튼을 대신 보여준다
          headerLeft: router.canGoBack()
            ? undefined
            : () => (
                <Pressable onPress={() => router.replace('/')} hitSlop={10} style={styles.home}>
                  <Text style={styles.homeText}>← 장소 선택</Text>
                </Pressable>
              ),
          headerRight: () => (
            <Pressable onPress={onShare} hitSlop={10} style={styles.share}>
              <Text style={styles.shareText}>링크 공유</Text>
            </Pressable>
          ),
        }}
      />

      <View style={styles.statusBar}>
        <Text style={[styles.status, status === 'live' && styles.statusLive]}>{STATUS_LABEL[status]}</Text>
        <Text style={styles.status} numberOfLines={1}>
          {shareNote ?? (me ? `나: ${me}` : '')}
        </Text>
      </View>

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
        <Composer onSubmit={submit} />
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
  home: { paddingRight: 12, paddingVertical: 6 },
  homeText: { color: colors.textDim, fontSize: 14 },
  share: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: colors.border },
  shareText: { color: colors.accent, fontWeight: '600', fontSize: 13 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  list: { padding: 12, gap: 10, flexGrow: 1, width: '100%', maxWidth: 640, alignSelf: 'center' },
  empty: { color: colors.textDim, textAlign: 'center', marginTop: 80, lineHeight: 22 },
});
