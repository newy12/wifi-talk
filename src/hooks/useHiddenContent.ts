import { useCallback, useSyncExternalStore } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const POSTS_KEY = 'wg:hidden-posts';
const AUTHORS_KEY = 'wg:blocked-authors';
const MAX_HIDDEN_POSTS = 500; // 글은 24시간이면 사라지므로 오래된 것부터 버려도 된다

type HiddenState = { hiddenPosts: string[]; blockedAuthors: string[] };

/**
 * 이 기기에서만 적용되는 숨김 목록 (앱 전체가 공유하는 저장소).
 * 보드 화면과 운영정책 화면이 같은 상태를 보므로, 한쪽에서 해제하면 다른 쪽에도 바로 반영된다.
 * - 신고한 글: 신고 즉시 내 화면에서 사라짐 (되돌리지 않음)
 * - 차단한 작성자: 그 익명 태그의 글이 모든 보드에서 안 보임 (한 명씩 또는 모두 해제 가능)
 */
let state: HiddenState = { hiddenPosts: [], blockedAuthors: [] };
const listeners = new Set<() => void>();
let loaded = false;

function setState(next: HiddenState) {
  state = next;
  listeners.forEach((l) => l());
}

function save(key: string, values: string[]) {
  AsyncStorage.setItem(key, JSON.stringify(values)).catch(() => {});
}

async function load(key: string): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (!loaded) {
    loaded = true;
    Promise.all([load(POSTS_KEY), load(AUTHORS_KEY)]).then(([hiddenPosts, blockedAuthors]) =>
      setState({ hiddenPosts, blockedAuthors }),
    );
  }
  return () => listeners.delete(listener);
}

const getSnapshot = () => state;

export function useHiddenContent() {
  const { hiddenPosts, blockedAuthors } = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  const hidePost = useCallback((id: number) => {
    const next = [...state.hiddenPosts.filter((p) => p !== String(id)), String(id)].slice(-MAX_HIDDEN_POSTS);
    save(POSTS_KEY, next);
    setState({ ...state, hiddenPosts: next });
  }, []);

  const blockAuthor = useCallback((tag: string) => {
    if (state.blockedAuthors.includes(tag)) return;
    const next = [...state.blockedAuthors, tag];
    save(AUTHORS_KEY, next);
    setState({ ...state, blockedAuthors: next });
  }, []);

  const unblockAuthor = useCallback((tag: string) => {
    const next = state.blockedAuthors.filter((t) => t !== tag);
    save(AUTHORS_KEY, next);
    setState({ ...state, blockedAuthors: next });
  }, []);

  const clearBlocked = useCallback(() => {
    save(AUTHORS_KEY, []);
    setState({ ...state, blockedAuthors: [] });
  }, []);

  const isHidden = useCallback(
    (post: { id: number; author_tag: string }) =>
      hiddenPosts.includes(String(post.id)) || blockedAuthors.includes(post.author_tag),
    [hiddenPosts, blockedAuthors],
  );

  return { isHidden, hidePost, blockAuthor, unblockAuthor, blockedAuthors, clearBlocked };
}
