import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const POSTS_KEY = 'wg:hidden-posts';
const AUTHORS_KEY = 'wg:blocked-authors';
const MAX_HIDDEN_POSTS = 500; // 글은 24시간이면 사라지므로 오래된 것부터 버려도 된다

async function load(key: string): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function save(key: string, values: string[]) {
  AsyncStorage.setItem(key, JSON.stringify(values)).catch(() => {});
}

/**
 * 이 기기에서만 적용되는 숨김 목록.
 * - 신고한 글: 신고 즉시 내 화면에서 사라짐
 * - 차단한 작성자: 그 익명 태그의 글이 모든 보드에서 안 보임
 */
export function useHiddenContent() {
  const [hiddenPosts, setHiddenPosts] = useState<string[]>([]);
  const [blockedAuthors, setBlockedAuthors] = useState<string[]>([]);

  useEffect(() => {
    load(POSTS_KEY).then(setHiddenPosts);
    load(AUTHORS_KEY).then(setBlockedAuthors);
  }, []);

  const hidePost = useCallback((id: number) => {
    setHiddenPosts((prev) => {
      const next = [...prev.filter((p) => p !== String(id)), String(id)].slice(-MAX_HIDDEN_POSTS);
      save(POSTS_KEY, next);
      return next;
    });
  }, []);

  const blockAuthor = useCallback((tag: string) => {
    setBlockedAuthors((prev) => {
      if (prev.includes(tag)) return prev;
      const next = [...prev, tag];
      save(AUTHORS_KEY, next);
      return next;
    });
  }, []);

  const clearBlocked = useCallback(() => {
    setBlockedAuthors([]);
    save(AUTHORS_KEY, []);
  }, []);

  const isHidden = useCallback(
    (post: { id: number; author_tag: string }) =>
      hiddenPosts.includes(String(post.id)) || blockedAuthors.includes(post.author_tag),
    [hiddenPosts, blockedAuthors],
  );

  return { isHidden, hidePost, blockAuthor, blockedAuthors, clearBlocked };
}
