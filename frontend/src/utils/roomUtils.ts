import type { Room } from '../types/lobby';
import { getKickedCount } from '../services/roomStore';
import { normalizeRoomEntry, normalizeRoomList } from './roomNormalize';

export const DEFAULT_ROOMS: Room[] = [];

export { normalizeRoomEntry, normalizeRoomList };

export function parseRoomOccupancy(room: Room): { current: number; max: number } {
  const raw = room?.players || '1/N';
  const [, maxRaw] = String(raw).split('/');
  const max = Math.max(1, parseInt(maxRaw, 10) || 8);
  const kicked = getKickedCount(String(room.id));
  const current = Math.max(1, max - kicked);
  return { current, max };
}

export { loadDynamicRooms, persistDynamicRooms } from '../services/roomStore';
