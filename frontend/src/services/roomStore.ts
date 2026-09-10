const kickedCountByRoom = new Map<string, number>();

export function getKickedCount(roomId: string): number {
  return kickedCountByRoom.get(String(roomId)) ?? 0;
}

export function setKickedCount(roomId: string, count: number): void {
  kickedCountByRoom.set(String(roomId), count);
}

export function clearKickedCount(roomId: string): void {
  kickedCountByRoom.delete(String(roomId));
}
