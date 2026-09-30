import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { supabase, type ActiveBoard } from '@/lib/supabase';

/** 지금 글이 살아있는 보드 목록 — 홈 화면에 올 때마다 새로 불러온다. */
export function useActiveBoards() {
  const [boards, setBoards] = useState<ActiveBoard[]>([]);

  useFocusEffect(
    useCallback(() => {
      if (!supabase) return;
      let cancelled = false;
      supabase
        .from('active_boards')
        .select('board_key, post_count, last_post_at')
        .then(({ data }) => {
          if (!cancelled && data) setBoards(data);
        });
      return () => {
        cancelled = true;
      };
    }, []),
  );

  return boards;
}
