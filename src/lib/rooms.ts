import { supabase } from './supabase';

/** 초대 코드: 6자리, 헷갈리는 0/O/1/I 제외 (서버 room_board_key 와 같은 규칙) */
export function normalizeRoomCode(input: string): string {
  return input.replace(/[^0-9A-Za-z]/g, '').toUpperCase().slice(0, 6);
}

export function isValidRoomCode(code: string): boolean {
  return /^[2-9A-HJ-NP-Z]{6}$/.test(code);
}

/** 보여줄 때는 3자리씩 끊어서: K7P 2QX */
export function formatRoomCode(code: string): string {
  return `${code.slice(0, 3)} ${code.slice(3)}`;
}

export async function createRoom(): Promise<{ code: string } | { error: string }> {
  if (!supabase) return { error: 'Supabase 설정이 필요합니다.' };
  const { data, error } = await supabase.rpc('create_room');
  if (error) {
    return {
      error: error.message.includes('RATE_LIMIT_ROOM')
        ? '방을 너무 많이 만들었어요. 10분 뒤에 다시 시도해 주세요.'
        : `방을 만들지 못했어요: ${error.message}`,
    };
  }
  return { code: (data as { code: string }).code };
}

/** 코드로 방 찾기. 없거나 사라진 방이면 null */
export async function joinRoom(code: string): Promise<string | null> {
  if (!supabase || !isValidRoomCode(code)) return null;
  const { data, error } = await supabase.rpc('join_room', { p_code: code });
  if (error || !data) return null;
  return (data as { board_key: string }).board_key;
}
