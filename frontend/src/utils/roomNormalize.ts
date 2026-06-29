import type { Room } from '../types/lobby';

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
