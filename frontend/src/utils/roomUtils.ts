import type { Room } from '../types/lobby';
import { STORAGE_KEYS } from '../constants/storageKeys';

export const DEFAULT_ROOMS: Room[] = [
  { id: 2, title: '3대3 알고리즘 팀전', status: 'WAITING', players: '1/8', mode: '1/N', gameMode: 'item', diff: '어려움', lang: 'PYTHON', count: '7', time: '60분', pwd: '' },
  { id: 3, title: '보스 레이드 (내가 보스임)', status: 'WAITING', players: '1/8', mode: '1/N', gameMode: 'item', diff: '어려움', lang: 'JAVA', count: '10', time: '45분', pwd: 'boss123' },
  { id: 4, title: 'C++ 장인 구함 빠른 진행', status: 'STARTED', players: '1/8', mode: '1/N', gameMode: 'normal', diff: '보통', lang: 'C++', count: '5', time: '15분', pwd: '' },
];

export function normalizeRoomEntry(room: Room): Room {
  const next = { ...room };
  if (next.mode === 'N/N') next.mode = '1/N';
  if (next.players === 'N/N') next.players = '1/8';
  if (next.mode === '1/N') {
    const playersText = String(next.players || '1/8');
    if (!playersText.includes('/') || playersText === '1/N') next.players = '1/8';
  }
  return next;
}

export function normalizeRoomList(list: Room[]): Room[] {
  return Array.isArray(list) ? list.map(normalizeRoomEntry) : [];
}

export function parseRoomOccupancy(room: Room): { current: number; max: number } {
  const raw = room?.players || '1/N';
  const [, maxRaw] = String(raw).split('/');
  const max = Math.max(1, parseInt(maxRaw, 10) || 8);
  const kicked = parseInt(localStorage.getItem(`${STORAGE_KEYS.ROOM_KICKED_PREFIX}${room.id}`) || '0', 10);
  const current = Math.max(1, max - kicked);
  return { current, max };
}

export function loadDynamicRooms(): Room[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.DYNAMIC_ROOMS);
    const dynamicRooms = stored ? (JSON.parse(stored) as Room[]) : [];
    const normalized = normalizeRoomList(dynamicRooms);
    if (JSON.stringify(normalized) !== JSON.stringify(dynamicRooms)) {
      localStorage.setItem(STORAGE_KEYS.DYNAMIC_ROOMS, JSON.stringify(normalized));
    }
    return normalized;
  } catch {
    return [];
  }
}

export function persistDynamicRooms(rooms: Room[]): void {
  localStorage.setItem(STORAGE_KEYS.DYNAMIC_ROOMS, JSON.stringify(rooms));
}
