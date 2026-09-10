import type { Room } from '../types/lobby';
import { getKickedCount } from '../services/roomStore';

export function parseRoomOccupancy(room: Room): { current: number; max: number } {
  if (typeof room.currentPlayers === 'number' && typeof room.maxPlayers === 'number') {
    return {
      current: Math.max(0, room.currentPlayers),
      max: Math.max(1, room.maxPlayers),
    };
  }

  const raw = room?.players || '0/8';
  const [currentRaw, maxRaw] = String(raw).split('/');
  const max = Math.max(1, parseInt(maxRaw, 10) || 8);
  const parsedCurrent = parseInt(currentRaw, 10);
  if (Number.isFinite(parsedCurrent)) {
    return { current: Math.max(0, parsedCurrent), max };
  }

  const kicked = getKickedCount(String(room.id));
  return { current: Math.max(1, max - kicked), max };
}
