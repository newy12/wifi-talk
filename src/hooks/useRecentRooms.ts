import { useCallback, useSyncExternalStore } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'wg:recent-rooms';
const MAX = 6;

export type RecentRoom = { code: string; mine: boolean; visitedAt: number };

/**
 * 내가 만들었거나 들어갔던 초대 코드 방 (이 기기에만 저장).
 * 방 코드는 서버에서 다시 알려주지 않으므로, 나갔다가 다시 들어오려면 여기에 기억해 둬야 한다.
 * 앱 전체가 공유하는 저장소라 방에서 나오면 첫 화면 목록에 바로 반영된다.
 */
let rooms: RecentRoom[] = [];
const listeners = new Set<() => void>();
let loaded = false;

function setRooms(next: RecentRoom[]) {
  rooms = next;
  AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => {});
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (!loaded) {
    loaded = true;
    AsyncStorage.getItem(KEY)
      .then((raw) => {
        if (raw) {
          rooms = JSON.parse(raw);
          listeners.forEach((l) => l());
        }
      })
      .catch(() => {});
  }
  return () => listeners.delete(listener);
}

const getSnapshot = () => rooms;

export function useRecentRooms() {
  const list = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  /** 방에 들어갈 때 기록. 한 번 "내가 만든 방"이면 계속 그렇게 표시한다 */
  const rememberRoom = useCallback((code: string, mine = false) => {
    const prev = rooms.find((r) => r.code === code);
    const entry: RecentRoom = { code, mine: mine || !!prev?.mine, visitedAt: Date.now() };
    setRooms([entry, ...rooms.filter((r) => r.code !== code)].slice(0, MAX));
  }, []);

  const forgetRoom = useCallback((code: string) => {
    setRooms(rooms.filter((r) => r.code !== code));
  }, []);

  return { rooms: list, rememberRoom, forgetRoom };
}
