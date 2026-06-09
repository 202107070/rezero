import type { Room } from '../types/lobby';
import type { RoomFilterState } from '../types/roomFilter';
import { EMPTY_ROOM_FILTER } from '../types/roomFilter';

export function isRoomFilterActive(filter: RoomFilterState): boolean {
  return (
    filter.playerModes.length > 0 ||
    filter.difficulties.length > 0 ||
    filter.languages.length > 0 ||
    filter.problemCounts.length > 0 ||
    filter.gameModes.length > 0 ||
    filter.visibility.length > 0
  );
}

export function matchesRoomFilter(room: Room, filter: RoomFilterState): boolean {
  if (!isRoomFilterActive(filter)) return true;

  if (filter.playerModes.length > 0 && !filter.playerModes.includes(room.mode)) return false;
  if (filter.difficulties.length > 0 && !filter.difficulties.includes(room.diff)) return false;
  if (filter.languages.length > 0 && !filter.languages.includes(room.lang)) return false;

  if (filter.problemCounts.length > 0) {
    const count = room.count || '5';
    if (!filter.problemCounts.includes(count)) return false;
  }

  if (filter.gameModes.length > 0) {
    const gameMode = room.gameMode || 'item';
    if (!filter.gameModes.includes(gameMode)) return false;
  }

  if (filter.visibility.length > 0) {
    const visibility = room.pwd ? 'private' : 'public';
    if (!filter.visibility.includes(visibility)) return false;
  }

  return true;
}

export function toggleFilterValue<T extends string>(selected: T[], value: T): T[] {
  return selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value];
}

export function getRoomFilterSummary(filter: RoomFilterState): string {
  if (!isRoomFilterActive(filter)) return '전체';

  const parts: string[] = [];
  if (filter.playerModes.length > 0) parts.push(filter.playerModes.join('/'));
  if (filter.difficulties.length > 0) parts.push(filter.difficulties.join('/'));
  if (filter.languages.length > 0) parts.push(filter.languages.join('/'));
  if (filter.problemCounts.length > 0) parts.push(`${filter.problemCounts.join('/')}문제`);
  if (filter.gameModes.length > 0) {
    parts.push(
      filter.gameModes.map((m) => (m === 'item' ? '아이템' : '일반')).join('/'),
    );
  }
  if (filter.visibility.length > 0) {
    parts.push(
      filter.visibility.map((v) => (v === 'public' ? '공개' : '비공개')).join('/'),
    );
  }

  const summary = parts.join(' · ');
  return summary.length > 36 ? `${summary.slice(0, 34)}…` : summary;
}

export function cloneRoomFilter(filter: RoomFilterState): RoomFilterState {
  return {
    playerModes: [...filter.playerModes],
    difficulties: [...filter.difficulties],
    languages: [...filter.languages],
    problemCounts: [...filter.problemCounts],
    gameModes: [...filter.gameModes],
    visibility: [...filter.visibility],
  };
}

export { EMPTY_ROOM_FILTER };
