import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { getAuthorTag } from '@/lib/identity';
import { supabase } from '@/lib/supabase';

/**
 * 지금 같은 topic 에 접속해 있는 사람 수 (Supabase Realtime Presence).
 * - 사람 단위로 세도록 presence key 를 기기의 익명 태그로 쓴다 (같은 기기의 탭 여러 개 = 1명)
 * - 글 실시간 구독과 같은 웹소켓 연결을 공유하므로 동시 접속 한도(200)를 추가로 쓰지 않는다
 * - 서버에 아무것도 저장하지 않는다 (연결이 끊기면 자동으로 빠짐)
 */
export function usePresenceCount(topic: string | null): number | null {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    if (!supabase || !topic) return;
    const client = supabase;
    let channel: RealtimeChannel | null = null;
    let active = true;

    getAuthorTag().then((tag) => {
      if (!active) return;
      const ch = client.channel(`presence:${topic}`, { config: { presence: { key: tag } } });
      channel = ch;
      ch.on('presence', { event: 'sync' }, () => setCount(Object.keys(ch.presenceState()).length)).subscribe(
        (status) => {
          if (status === 'SUBSCRIBED') ch.track({});
        },
      );
    });

    return () => {
      active = false;
      if (channel) client.removeChannel(channel);
    };
  }, [topic]);

  return count;
}

const SiteOnlineContext = createContext<number | null>(null);

/** 앱 전체에서 한 번만 사이트 접속자에 참여한다 (어느 화면에 있든 1명으로 셈) */
export function SiteOnlineProvider({ children }: { children: ReactNode }) {
  const count = usePresenceCount('site');
  return <SiteOnlineContext.Provider value={count}>{children}</SiteOnlineContext.Provider>;
}

export function useSiteOnlineCount(): number | null {
  return useContext(SiteOnlineContext);
}
