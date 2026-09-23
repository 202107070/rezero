export type FriendPresenceStatus =
  | 'lobby'
  | 'room'
  | 'battle'
  | 'practice'
  | 'build'
  | 'result'
  | 'offline';

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
  userId?: string;
  addedAt: number;
}
