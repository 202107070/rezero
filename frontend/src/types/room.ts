export interface RoomPlayer {
  id: number;
  userId?: string;
  name: string;
  rank?: string;
  isHost: boolean;
  isReady: boolean;
  language: string;
  character: string;
  status: string;
}

export interface RoomChatMessage {
  id?: string;
  type: 'sys' | 'user';
  text: string;
  name?: string;
  mode?: string;
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
  /** 텍스트/폴백용 이모지 */
  icon: string;
  label: string;
  /** 초상화 이미지 경로 (public/) */
  imageSrc: string;
}
