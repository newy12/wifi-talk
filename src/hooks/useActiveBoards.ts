import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { supabase, type ActiveBoard } from '@/lib/supabase';

/** 지금 글이 살아있는 보드 목록 — 홈 화면에 올 때마다, 그리고 당겨서 새로고침할 때 새로 불러온다. */
export function useActiveBoards() {
  const [boards, setBoards] = useState<ActiveBoard[]>([]);

  const reload = useCallback(async () => {
    if (!supabase) return;
    const { data } = await supabase.from('active_boards').select('board_key, post_count, last_post_at');
    if (data) setBoards(data);
  }, []);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );

  return { boards, reload };
}
