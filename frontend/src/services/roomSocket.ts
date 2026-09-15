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
  LOBBY_PRESENCE: 'lobby_presence',
  REVIEW_INVITE: 'review_invite',
  REVIEW_INVITE_RESPONSE: 'review_invite_response',
  UPDATE_CHARACTER: 'update_character',
  CHARACTER_CHANGED: 'character_changed',
  FRIEND_REQUEST: 'friend_request',
  FRIEND_REQUEST_RESULT: 'friend_request_result',
  FRIEND_REMOVE: 'friend_remove',
  USER_KICKED: 'user_kicked',
  UPDATE_TITLE: 'update_title',
  TITLE_CHANGED: 'title_changed',
} as const;

export const LOBBY_ROOM_ID = 'lobby';

export interface LobbyPresenceUser {
  userId: string;
  username?: string;
  displayName?: string;
  equippedTitleId?: string | null;
}

export interface LobbyPresencePayload {
  users: LobbyPresenceUser[];
}

export interface ReviewInviteSocketPayload {
  id: string;
  roomId: string;
  matchId?: string | null;
  sessionId?: string | null;
  fromUserId: string;
  fromUserName: string;
  toUserIds: string[];
  problemIndices: number[];
  problems?: Array<{ index: number; title?: string; question?: string }>;
  createdAt: number;
}

export interface ReviewInviteResponsePayload {
  inviteId?: string;
  roomId: string;
  fromUserId?: string;
  toUserId: string;
  toUserName?: string;
  accepted: boolean;
  problemIndices?: number[];
}

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
  rewards?: Array<{
    userId?: string;
    id?: string;
    earnedGold?: number;
    ratingDelta?: number;
    newTitleIds?: string[];
  }>;
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
  mode?: string;
  targetUserId?: string | null;
  targetUserName?: string;
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

type AnyHandler = (...args: never[]) => void;

let socket: Socket | null = null;
let intentionalDisconnect = false;
let activeRoomId: string | null = null;

const ACTIVE_ROOM_KEY = 'rezero_active_room_id';

export function setActiveRoomId(roomId: string | number | null): void {
  activeRoomId = roomId == null ? null : String(roomId);
  try {
    if (activeRoomId) sessionStorage.setItem(ACTIVE_ROOM_KEY, activeRoomId);
    else sessionStorage.removeItem(ACTIVE_ROOM_KEY);
  } catch {
    // ignore
  }
}

export function getActiveRoomId(): string | null {
  if (activeRoomId) return activeRoomId;
  try {
    activeRoomId = sessionStorage.getItem(ACTIVE_ROOM_KEY);
  } catch {
    activeRoomId = null;
  }
  return activeRoomId;
}

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

/** Room→Battle 이동 시에는 disconnect 하지 않음 (force=true 일 때만 종료) */
export function disconnectRoomSocket(force = false): void {
  if (!socket) return;
  if (!force) return;
  intentionalDisconnect = true;
  socket.removeAllListeners();
  socket.disconnect();
  socket = null;
  setActiveRoomId(null);
}

export function onRoomEvent<T extends AnyHandler>(event: string, handler: T): () => void {
  const client = getRoomSocket();
  client.on(event, handler as AnyHandler);
  return () => {
    client.off(event, handler as AnyHandler);
  };
}

export function joinRoomSocket(
  roomId: string | number,
): Promise<{
  success: boolean;
  message?: string;
  recentMessages?: ChatMessagePayload[];
  onlineUsers?: LobbyPresenceUser[];
}> {
  const client = getRoomSocket();
  const id = String(roomId);
  // 숫자 방만 activeRoom 으로 추적 (lobby 는 leaveRoom 대상 아님)
  if (/^\d+$/.test(id)) setActiveRoomId(id);
  return new Promise((resolve) => {
    client.emit(
      ROOM_SOCKET_EVENTS.JOIN_ROOM,
      { roomId: id },
      (response?: {
        success?: boolean;
        message?: string;
        recentMessages?: ChatMessagePayload[];
        onlineUsers?: LobbyPresenceUser[];
      }) => {
        resolve({
          success: Boolean(response?.success),
          message: response?.message,
          recentMessages: response?.recentMessages || [],
          onlineUsers: response?.onlineUsers || [],
        });
      },
    );
  });
}

export function sendRoomMessage(
  roomId: string | number,
  message: string,
  options?: {
    mode?: 'ALL' | 'FRIEND' | 'WHISPER';
    targetUserId?: string;
    targetUserName?: string;
    friendUserIds?: string[];
  },
): Promise<{ success: boolean; message?: string }> {
  const client = getRoomSocket();
  return new Promise((resolve) => {
    client.emit(
      ROOM_SOCKET_EVENTS.SEND_MESSAGE,
      {
        roomId: String(roomId),
        message,
        mode: options?.mode || 'ALL',
        targetUserId: options?.targetUserId,
        targetUserName: options?.targetUserName,
        friendUserIds: options?.friendUserIds || [],
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

export function emitReviewInvite(
  roomId: string | number,
  params: {
    id: string;
    sessionId?: string;
    matchId?: string;
    toUserIds: string[];
    problemIndices: number[];
    problems?: Array<{ index: number; title?: string; question?: string }>;
  },
): Promise<{ success: boolean; message?: string }> {
  const client = getRoomSocket();
  return new Promise((resolve) => {
    client.emit(
      ROOM_SOCKET_EVENTS.REVIEW_INVITE,
      {
        roomId: String(roomId),
        id: params.id,
        sessionId: params.sessionId,
        matchId: params.matchId,
        toUserIds: params.toUserIds,
        problemIndices: params.problemIndices,
        problems: params.problems || [],
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

export function emitUpdateCharacter(
  roomId: string | number,
  character: string,
): Promise<{ success: boolean; message?: string }> {
  const client = getRoomSocket();
  return new Promise((resolve) => {
    client.emit(
      ROOM_SOCKET_EVENTS.UPDATE_CHARACTER,
      { roomId: String(roomId), character },
      (response?: { success?: boolean; message?: string }) => {
        resolve({
          success: Boolean(response?.success),
          message: response?.message,
        });
      },
    );
  });
}

export function emitFriendRequest(
  toUserId: string,
  toUserName?: string,
): Promise<{ success: boolean; message?: string; autoAccepted?: boolean }> {
  const client = getRoomSocket();
  return new Promise((resolve) => {
    client.emit(
      ROOM_SOCKET_EVENTS.FRIEND_REQUEST,
      { toUserId, toUserName },
      (response?: { success?: boolean; message?: string; autoAccepted?: boolean }) => {
        resolve({
          success: Boolean(response?.success),
          message: response?.message,
          autoAccepted: Boolean(response?.autoAccepted),
        });
      },
    );
  });
}

export function emitFriendRequestResult(
  toUserId: string,
  accepted: boolean,
): Promise<{ success: boolean; message?: string }> {
  const client = getRoomSocket();
  return new Promise((resolve) => {
    client.emit(
      ROOM_SOCKET_EVENTS.FRIEND_REQUEST_RESULT,
      { toUserId, accepted },
      (response?: { success?: boolean; message?: string }) => {
        resolve({
          success: Boolean(response?.success),
          message: response?.message,
        });
      },
    );
  });
}

export function emitFriendRemove(
  toUserId: string,
): Promise<{ success: boolean; message?: string }> {
  const client = getRoomSocket();
  return new Promise((resolve) => {
    client.emit(
      ROOM_SOCKET_EVENTS.FRIEND_REMOVE,
      { toUserId },
      (response?: { success?: boolean; message?: string }) => {
        resolve({
          success: Boolean(response?.success),
          message: response?.message,
        });
      },
    );
  });
}

export function emitUpdateTitle(
  titleId: string | null,
): Promise<{ success: boolean; message?: string }> {
  const client = getRoomSocket();
  return new Promise((resolve) => {
    client.emit(
      ROOM_SOCKET_EVENTS.UPDATE_TITLE,
      { titleId: titleId || '' },
      (response?: { success?: boolean; message?: string }) => {
        resolve({
          success: Boolean(response?.success),
          message: response?.message,
        });
      },
    );
  });
}

export function emitReviewInviteResponse(
  roomId: string | number,
  params: {
    inviteId: string;
    fromUserId?: string;
    accepted: boolean;
    problemIndices?: number[];
  },
): Promise<{ success: boolean; message?: string }> {
  const client = getRoomSocket();
  return new Promise((resolve) => {
    client.emit(
      ROOM_SOCKET_EVENTS.REVIEW_INVITE_RESPONSE,
      {
        roomId: String(roomId),
        inviteId: params.inviteId,
        fromUserId: params.fromUserId,
        accepted: params.accepted,
        problemIndices: params.problemIndices,
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

export function isSocketIntentionallyDisconnected(): boolean {
  return intentionalDisconnect;
}
