import { io, type Socket } from 'socket.io-client';
import { getAccessToken } from './apiClient';

export const ROOM_SOCKET_EVENTS = {
  JOIN_ROOM: 'join_room',
  USER_JOINED: 'user_joined',
  USER_LEFT: 'user_left',
  SEND_MESSAGE: 'send_message',
  RECEIVE_MESSAGE: 'receive_message',
  CHAT_ERROR: 'chat_error',
  TOGGLE_READY: 'toggle_ready',
  READY_CHANGED: 'ready_changed',
  REQUEST_GAME_START: 'request_game_start',
  GAME_START_NOTICE: 'game_start_notice',
  GAME_STARTED: 'game_started',
  USE_ITEM: 'use_item',
  ITEM_USED: 'item_used',
  GAME_ENDED: 'game_ended',
  GAME_STATE_UPDATE: 'game_state_update',
  USER_RECONNECTED: 'user_reconnected',
  SUBMIT_CODE: 'submit_code',
  EXEC_RESULT: 'exec_result',
  REQUEST_NEXT_QUESTION: 'request_next_question',
  NEXT_QUESTION_STARTED: 'next_question_started',
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

export interface ChatMessagePayload {
  roomId?: string;
  sender?: { id?: string; displayName?: string; username?: string };
  message?: string;
  timestamp?: string;
}

export interface GameStartedPayload {
  matchId: string;
  roomId: number | string;
  status?: string;
  language?: string;
  difficulty?: string;
  problemCount?: number;
  maxPlayers?: number;
  roomMode?: string;
  gameMode?: string;
  roundSeconds?: number;
  startedAt?: string;
  problems?: unknown[];
  message?: string;
  participants?: string[];
}

export interface UserLeftPayload {
  roomId: string;
  userId: string;
  roomClosed?: boolean;
  newHostUserId?: string | null;
}

export interface GameStateUpdatePayload {
  roomId?: string;
  question?: unknown;
  remainingTime?: number | null;
  scores?: Array<{ userId: string; score: number }>;
  submitStatuses?: Array<{
    userId: string;
    problemIndex?: number;
    isSubmitted?: boolean;
    isCorrect?: boolean;
  }>;
}

export interface UserReconnectedPayload {
  roomId?: string;
  matchId?: string;
  status?: string;
  currentProblemIndex?: string | number;
  timeLimit?: string | number;
  language?: string;
  difficulty?: string;
  problemId?: string;
}

let socket: Socket | null = null;
let intentionalDisconnect = false;

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
    intentionalDisconnect = false;
    socket.connect();
    return socket;
  }

  intentionalDisconnect = false;
  socket = io({
    path: '/socket.io',
    auth: { token: `Bearer ${token}` },
    transports: ['websocket', 'polling'],
    autoConnect: true,
  });

  return socket;
}

/** Room→Battle 이동 시에는 disconnect 하지 않음 */
export function disconnectRoomSocket(force = false): void {
  if (!socket) return;
  if (!force) return;
  intentionalDisconnect = true;
  socket.removeAllListeners();
  socket.disconnect();
  socket = null;
}

export function joinRoomSocket(
  roomId: string | number,
): Promise<{ success: boolean; message?: string; recentMessages?: ChatMessagePayload[] }> {
  const client = getRoomSocket();
  return new Promise((resolve) => {
    client.emit(
      ROOM_SOCKET_EVENTS.JOIN_ROOM,
      { roomId: String(roomId) },
      (response?: {
        success?: boolean;
        message?: string;
        recentMessages?: ChatMessagePayload[];
      }) => {
        resolve({
          success: Boolean(response?.success),
          message: response?.message,
          recentMessages: response?.recentMessages || [],
        });
      },
    );
  });
}

export function sendRoomMessage(
  roomId: string | number,
  message: string,
): Promise<{ success: boolean; message?: string }> {
  const client = getRoomSocket();
  return new Promise((resolve) => {
    client.emit(
      ROOM_SOCKET_EVENTS.SEND_MESSAGE,
      { roomId: String(roomId), message },
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

export function isSocketIntentionallyDisconnected(): boolean {
  return intentionalDisconnect;
}
