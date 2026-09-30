import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { supabase, type Post } from '@/lib/supabase';
import { BOARD_MAX_POSTS, POST_MAX_LENGTH, type ReportReason } from '@/lib/config';
import { getAuthorTag } from '@/lib/identity';

type Status = 'loading' | 'live' | 'offline' | 'error';

const POST_COLUMNS = 'id, board_key, body, author_tag, created_at, expires_at';

/**
 * 초대 코드 방의 글은 "그 방의 키를 안다"는 증명(x-board-key 헤더)이 있어야 서버가 보여준다.
 * (board_key=like.room-* 같은 목록 조회로 남의 방을 훔쳐보지 못하게)
 */
function withBoardHeader<T extends { setHeader(name: string, value: string): T }>(builder: T, boardKey: string): T {
  return boardKey.startsWith('room-') ? builder.setHeader('x-board-key', boardKey) : builder;
}

function liveNewestFirst(posts: Iterable<Post>): Post[] {
  const now = Date.now();
  return [...posts]
    .filter((p) => new Date(p.expires_at).getTime() > now)
    .sort((a, b) => b.id - a.id)
    .slice(0, BOARD_MAX_POSTS);
}

function mergeNewestFirst(prev: Post[], incoming: Post[]): Post[] {
  const byId = new Map<number, Post>();
  for (const p of [...incoming, ...prev]) byId.set(p.id, p);
  return liveNewestFirst(byId.values());
}

export const WRONG_NETWORK_MESSAGE = '와이파이가 바뀌었어요. 지금 연결된 와이파이의 보드로 옮길게요.';

const ERROR_MESSAGES: Record<string, string> = {
  WRONG_NETWORK: WRONG_NETWORK_MESSAGE,
  ROOM_NOT_FOUND: '이 방이 사라졌어요. 24시간 동안 글이 없으면 방이 없어져요.',
  RATE_LIMIT_AUTHOR: '너무 빨라요! 10초 뒤에 다시 남겨주세요.',
  RATE_LIMIT_BOARD: '지금 이 보드에 글이 너무 몰리고 있어요. 잠시 후 다시 시도해 주세요.',
  BANNED_WORD: '욕설이나 비속어가 포함되어 있어요. 표현을 바꿔주세요.',
  PERSONAL_INFO: '전화번호 같은 개인정보는 남길 수 없어요.',
};

/**
 * 한 장소 보드의 글 목록을 불러오고 Realtime 으로 새 글을 실시간 반영한다.
 * - 만료된 글은 서버(RLS)에서도 안 보이고, 클라이언트에서도 30초마다 걸러낸다.
 * - 재연결·포그라운드 복귀·1분 주기로 다시 불러와서, 놓친 글은 채우고
 *   다른 사람의 신고로 숨겨진 글은 목록에서 뺀다.
 * - 보드마다 화면이 새로 마운트되므로(board/[tag]) boardKey 가 바뀔 때 상태를 초기화하지 않는다.
 */
export function useBoardPosts(boardKey: string) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [status, setStatus] = useState<Status>('loading');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!supabase) return;
    const client = supabase;
    let active = true;

    const refetch = async () => {
      const { data, error } = await withBoardHeader(
        client
          .from('posts')
          .select(POST_COLUMNS)
          .eq('board_key', boardKey)
          .order('id', { ascending: false })
          .limit(BOARD_MAX_POSTS),
        boardKey,
      );
      if (!active) return;
      if (error) {
        setStatus('error');
        setError(error.message);
        return;
      }
      setError(null);
      const fetched = data ?? [];
      const newestFetched = fetched[0]?.id ?? 0;
      // 서버 목록이 기준. 단, 조회 도중 Realtime 으로 들어온 더 새 글은 유지한다.
      setPosts((prev) => mergeNewestFirst(prev.filter((p) => p.id > newestFetched), fetched));
    };

    const channel = client
      .channel(`board:${boardKey}`)
      .on<Post>(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'posts', filter: `board_key=eq.${boardKey}` },
        (payload) => setPosts((prev) => mergeNewestFirst(prev, [payload.new])),
      )
      .subscribe((s) => {
        if (s === 'SUBSCRIBED') {
          setStatus('live');
          refetch(); // 최초 로드 + 재연결 시 놓친 글 보충
        } else if (s === 'CHANNEL_ERROR' || s === 'TIMED_OUT' || s === 'CLOSED') {
          setStatus('offline');
        }
      });

    const sweep = setInterval(() => setPosts((prev) => liveNewestFirst(prev)), 30_000);
    const poll = setInterval(refetch, 60_000);
    const appState = AppState.addEventListener('change', (next) => {
      if (next === 'active') refetch();
    });

    return () => {
      active = false;
      clearInterval(sweep);
      clearInterval(poll);
      appState.remove();
      client.removeChannel(channel);
    };
  }, [boardKey]);

  const submit = useCallback(
    async (rawBody: string): Promise<string | null> => {
      if (!supabase) return 'Supabase 설정이 필요합니다.';
      const body = rawBody.trim();
      if (!body) return '내용을 입력해 주세요.';
      if (body.length > POST_MAX_LENGTH) return `${POST_MAX_LENGTH}자 이내로 적어주세요.`;

      const { data, error } = await withBoardHeader(
        supabase
          .from('posts')
          .insert({ board_key: boardKey, body, author_tag: await getAuthorTag() })
          .select(POST_COLUMNS)
          .single(),
        boardKey,
      );
      if (error) {
        const code = Object.keys(ERROR_MESSAGES).find((k) => error.message.includes(k));
        return code ? ERROR_MESSAGES[code] : `전송 실패: ${error.message}`;
      }
      // Realtime 이 늦거나 끊겨 있어도 내 글은 바로 보이게
      setPosts((prev) => mergeNewestFirst(prev, [data]));
      return null;
    },
    [boardKey],
  );

  /** 서버에 신고를 기록한다. 누적 신고 시 모두에게 숨겨진다. (내 화면에서 숨기는 건 useHiddenContent) */
  const report = useCallback(
    async (postId: number, reason: ReportReason): Promise<string | null> => {
      if (!supabase) return 'Supabase 설정이 필요합니다.';
      const { error } = await withBoardHeader(
        supabase.rpc('report_post', {
          p_post_id: postId,
          p_reporter_tag: await getAuthorTag(),
          p_reason: reason,
        }),
        boardKey,
      );
      return error ? `신고 실패: ${error.message}` : null;
    },
    [boardKey],
  );

  return { posts, status, error, submit, report };
}
