import type { Room } from '../types/lobby';
import { normalizeRoomList } from '../utils/roomNormalize';

let dynamicRooms: Room[] = [];
const kickedCountByRoom = new Map<string, number>();

export function loadDynamicRooms(): Room[] {
  return [...dynamicRooms];
}

export function persistDynamicRooms(rooms: Room[]): void {
  dynamicRooms = normalizeRoomList(rooms);
}

export function getKickedCount(roomId: string): number {
  return kickedCountByRoom.get(String(roomId)) ?? 0;
}

export function setKickedCount(roomId: string, count: number): void {
  kickedCountByRoom.set(String(roomId), count);
}

export function clearKickedCount(roomId: string): void {
  kickedCountByRoom.delete(String(roomId));
}

export function removeRoomById(roomId: string): void {
  if (!roomId) return;
  persistDynamicRooms(loadDynamicRooms().filter((r) => String(r.id) !== String(roomId)));
}

export function updateRoomStatus(roomId: string, status: Room['status']): void {
  persistDynamicRooms(
    loadDynamicRooms().map((r) => (String(r.id) === String(roomId) ? { ...r, status } : r)),
  );
}
