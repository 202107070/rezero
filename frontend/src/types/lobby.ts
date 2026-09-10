export type GameMode = 'item' | 'normal';

export interface RoomParticipant {
  id: number;
  userId: string;
  name: string;
  slotIndex: number;
  isHost: boolean;
  isReady: boolean;
  language: string;
  character: string;
  status: string;
  joinedAt: number | null;
}

export interface Room {
  id: number;
  title: string;
  status: 'WAITING' | 'STARTED';
  players: string;
  currentPlayers?: number;
  maxPlayers?: number;
  mode: string;
  gameMode?: GameMode;
  diff: string;
  lang: string;
  time?: string;
  pwd: string;
  isPrivate?: boolean;
  count?: string;
  hostUserId?: string;
  createdAt?: number;
  participants?: RoomParticipant[];
}

export interface CodeHistoryEntry {
  historyId: string;
  roomId: string;
  submittedAt: string;
  lang: string;
  problems: Array<{ title?: string; question?: string; explanation?: string; answer?: Record<string, string[]>; lang?: string }>;
  codes: string[];
  code: string;
  mode?: string;
}

export interface ChatMessage {
  sender: string;
  text: string;
  time: string;
  mode: string;
}

export interface LobbyUser {
  name: string;
  rank: string;
  title: string | null;
}
