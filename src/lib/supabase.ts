import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(url && anonKey);

/**
 * 로그인 없는 완전 익명 앱이므로 세션을 저장하지 않는다.
 * 환경변수가 없으면 null — 화면에서 설정 안내를 보여준다.
 */
export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(url!, anonKey!, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      realtime: { params: { eventsPerSecond: 5 } },
    })
  : null;

export type Post = {
  id: number;
  board_key: string;
  body: string;
  author_tag: string;
  created_at: string;
  expires_at: string;
};

export type ActiveBoard = {
  board_key: string;
  post_count: number;
  last_post_at: string;
};
