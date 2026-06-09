export interface RoomPlayer {
  id: number;
  name: string;
  isHost: boolean;
  isReady: boolean;
  language: string;
  character: string;
  status: string;
}

export interface RoomChatMessage {
  type: 'sys' | 'user';
  text: string;
  name?: string;
}

export interface RoomSettings {
  time: string;
  diff: string;
  theme: string;
  count: string;
  maxPlayers: number;
}

export interface LanguageOption {
  id: string;
  icon: string;
  label: string;
}

export interface CharacterOption {
  id: string;
  icon: string;
  label: string;
}
