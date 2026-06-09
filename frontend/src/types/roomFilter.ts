import type { GameMode } from './lobby';

export interface RoomFilterState {
  playerModes: string[];
  difficulties: string[];
  languages: string[];
  problemCounts: string[];
  gameModes: GameMode[];
  visibility: Array<'public' | 'private'>;
}

export const EMPTY_ROOM_FILTER: RoomFilterState = {
  playerModes: [],
  difficulties: [],
  languages: [],
  problemCounts: [],
  gameModes: [],
  visibility: [],
};
