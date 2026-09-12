import { io, type Socket } from 'socket.io-client';
import { getAccessToken } from './apiClient';

export const ROOM_SOCKET_EVENTS = {
  JOIN_ROOM: 'join_room',
  USER_JOINED: 'user_joined',
  TOGGLE_READY: 'toggle_ready',
  READY_CHANGED: 'ready_changed',
  USE_ITEM: 'use_item',
  ITEM_USED: 'item_used',
  GAME_ENDED: 'game_ended',
} as const;

export interface BattleItemUsedPayload {
  fromUserId: string;
  targetUserId?: string | null;
  itemType: string;
  success?: boolean;
  effectDetails?: string;
}

export interface BattleGameEndedPayload {
  roomId?: number | string;
  matchId?: string;
  ranking?: unknown;
  rewards?: unknown;
}

export interface RoomReadyStatePayload {
  userId: string;
  isReady: boolean;
  roomReadyStates?: Array<{ userId: string; isReady: boolean }>;
}

let socket: Socket | null = null;

export function getRoomSocket(): Socket {
  const token = getAccessToken();
  if (!token) {
    throw new Error('로그인이 필요합니다.');
  }

  if (socket && socket.connected) {
    return socket;
  }

  if (socket) {
    socket.auth = { token: `Bearer ${token}` };
    socket.connect();
    return socket;
  }

  socket = io({
    path: '/socket.io',
    auth: { token: `Bearer ${token}` },
    transports: ['websocket', 'polling'],
    autoConnect: true,
  });

  return socket;
}

export function disconnectRoomSocket(): void {
  if (!socket) return;
  socket.removeAllListeners();
  socket.disconnect();
  socket = null;
}

export function joinRoomSocket(
  roomId: string | number,
): Promise<{ success: boolean; message?: string }> {
  const client = getRoomSocket();
  return new Promise((resolve) => {
    client.emit(
      ROOM_SOCKET_EVENTS.JOIN_ROOM,
      { roomId: String(roomId) },
      (response?: { success?: boolean; message?: string }) => {
        resolve({
          success: Boolean(response?.success),
          message: response?.message,
        });
      },
    );
  });
}

export function emitBattleItemUsed(
  roomId: string | number,
  params: { itemType: string; targetUserId?: string },
): Promise<{ success: boolean; message?: string }> {
  const client = getRoomSocket();
  return new Promise((resolve) => {
    client.emit(
      ROOM_SOCKET_EVENTS.USE_ITEM,
      {
        roomId: String(roomId),
        itemType: params.itemType,
        targetUserId: params.targetUserId || undefined,
      },
      (response?: { success?: boolean; message?: string }) => {
        resolve({
          success: Boolean(response?.success),
          message: response?.message,
        });
      },
    );
  });
}

export function toggleReadySocket(
  roomId: string | number,
  isReady: boolean,
): Promise<{ success: boolean; message?: string; readyState?: RoomReadyStatePayload }> {
  const client = getRoomSocket();
  return new Promise((resolve) => {
    client.emit(
      ROOM_SOCKET_EVENTS.TOGGLE_READY,
      { roomId: String(roomId), isReady },
      (response?: {
        success?: boolean;
        message?: string;
        readyState?: RoomReadyStatePayload;
      }) => {
        resolve({
          success: Boolean(response?.success),
          message: response?.message,
          readyState: response?.readyState,
        });
      },
    );
  });
}
