export type FriendPresenceStatus = 'lobby' | 'room' | 'offline';

export interface FriendPresence {
  userName: string;
  status: FriendPresenceStatus;
  roomId?: string;
  roomTitle?: string;
  roomQuery?: string;
  updatedAt: number;
}

export interface FriendEntry {
  name: string;
  addedAt: number;
}
