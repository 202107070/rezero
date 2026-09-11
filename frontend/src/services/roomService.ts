import { CHARACTERS } from '../constants/roomConstants';
import type { GameMode, Room, RoomParticipant } from '../types/lobby';
import type { RoomPlayer } from '../types/room';
import { getTierByUserName } from '../utils/tierUtils';
import { normalizeRoomEntry, normalizeRoomList } from '../utils/roomNormalize';
import { ApiError, apiRequest } from './apiClient';

export interface CreateRoomParams {
  roomTitle: string;
  playerMode: string;
  gameMode: GameMode;
  difficulty: string;
  language: string;
  roomPwd: string;
  problemCount: string;
}

export interface JoinRoomParams {
  password?: string;
  language?: string;
  character?: string;
}

export interface LeaveRoomResult {
  roomId?: number;
  roomClosed: boolean;
  newHostUserId: string | null;
  room?: Room;
}

export interface StartRoomResult {
  roomId: number;
  status: string;
  totalPlayers: number;
  readyPlayers: number;
}

let pendingJoinPassword = '';

export function setPendingJoinPassword(password: string): void {
  pendingJoinPassword = password;
}

export function takePendingJoinPassword(): string {
  const password = pendingJoinPassword;
  pendingJoinPassword = '';
  return password;
}

function isGameMode(value: unknown): value is GameMode {
  return value === 'item' || value === 'normal';
}

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

function normalizeParticipant(raw: unknown): RoomParticipant {
  const participant = asRecord(raw);
  return {
    id: Number(participant.id) || 0,
    userId: String(participant.userId ?? ''),
    name: String(participant.name || ''),
    slotIndex: Number(participant.slotIndex) || 0,
    isHost: Boolean(participant.isHost),
    isReady: Boolean(participant.isReady),
    language: String(participant.language || ''),
    character: String(participant.character || 'char1'),
    status: String(participant.status || 'WAITING'),
    joinedAt: typeof participant.joinedAt === 'number' ? participant.joinedAt : null,
  };
}

export function normalizeRoom(raw: unknown): Room {
  const room = asRecord(raw);
  const currentPlayers = Number(room.currentPlayers ?? 0);
  const maxPlayers = Number(room.maxPlayers ?? (String(room.mode) === '1/1' ? 2 : 8));
  const isPrivate = Boolean(room.isPrivate) || Boolean(room.pwd);
  const participants = Array.isArray(room.participants)
    ? room.participants.map(normalizeParticipant)
    : undefined;

  return normalizeRoomEntry({
    id: Number(room.id),
    title: String(room.title || ''),
    status: room.status === 'STARTED' ? 'STARTED' : 'WAITING',
    players: String(room.players || `${currentPlayers}/${maxPlayers}`),
    currentPlayers,
    maxPlayers,
    mode: String(room.mode || '1/1'),
    gameMode: isGameMode(room.gameMode) ? room.gameMode : 'item',
    diff: String(room.diff || '보통'),
    lang: String(room.lang || 'JAVA'),
    pwd: isPrivate ? 'protected' : '',
    isPrivate,
    count: String(room.count ?? '5'),
    hostUserId: room.hostUserId == null ? undefined : String(room.hostUserId),
    createdAt: typeof room.createdAt === 'number' ? room.createdAt : undefined,
    participants,
  });
}

export async function fetchRooms(): Promise<Room[]> {
  const result = await apiRequest<{ rooms?: unknown[] }>('/rooms');
  return normalizeRoomList((result.rooms || []).map(normalizeRoom)).filter(
    (room) => Boolean(room.hostUserId) && Number(room.currentPlayers) > 0,
  );
}

export async function fetchRoom(roomId: number | string): Promise<Room> {
  const result = await apiRequest<unknown>(`/rooms/${roomId}`);
  return normalizeRoom(result);
}

export async function createRoom(params: CreateRoomParams): Promise<Room> {
  const result = await apiRequest<unknown>('/rooms', {
    method: 'POST',
    body: JSON.stringify({
      roomTitle: params.roomTitle,
      playerMode: params.playerMode,
      gameMode: params.gameMode,
      difficulty: params.difficulty,
      language: params.language,
      roomPwd: params.roomPwd,
      problemCount: Number(params.problemCount),
    }),
  });
  return normalizeRoom(result);
}

export async function joinRoom(roomId: number | string, params: JoinRoomParams = {}): Promise<Room> {
  const result = await apiRequest<unknown>(`/rooms/${roomId}/join`, {
    method: 'POST',
    body: JSON.stringify({
      password: params.password || '',
      language: params.language || '',
      character: params.character || '',
    }),
  });
  return normalizeRoom(result);
}

export async function leaveRoom(roomId: number | string): Promise<LeaveRoomResult> {
  return apiRequest<LeaveRoomResult>(`/rooms/${roomId}/leave`, { method: 'POST' });
}

export async function startRoom(roomId: number | string): Promise<StartRoomResult> {
  return apiRequest<StartRoomResult>(`/rooms/${roomId}/start`, { method: 'POST' });
}

export async function deleteRoom(roomId: number | string): Promise<{ roomId: number; deleted: boolean }> {
  return apiRequest<{ roomId: number; deleted: boolean }>(`/rooms/${roomId}`, { method: 'DELETE' });
}

export async function fetchRoomCanStart(roomId: number | string): Promise<unknown> {
  return apiRequest(`/rooms/${roomId}/can-start`);
}

export function isAlreadyJoinedError(error: unknown): boolean {
  return error instanceof ApiError && error.code === 'ROOM_ALREADY_JOINED';
}

export function getRoomErrorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  return '요청을 처리하지 못했습니다.';
}

export function buildRoomSearchParams(room: Pick<Room, 'id'>): URLSearchParams {
  return new URLSearchParams({
    id: String(room.id),
  });
}

export function emptyPlayerSlots(): (RoomPlayer | null)[] {
  return Array.from({ length: 8 }, () => null);
}

function toRoomPlayer(participant: RoomParticipant): RoomPlayer {
  const character =
    CHARACTERS.find((item) => item.id === participant.character)?.icon || participant.character || '🤺';

  return {
    id: participant.id,
    userId: participant.userId,
    name: participant.name,
    rank: getTierByUserName(participant.name),
    isHost: participant.isHost,
    isReady: participant.isReady,
    language: participant.language,
    character,
    status: participant.isHost ? 'HOST' : participant.isReady ? 'READY' : participant.status || 'WAITING',
  };
}

export function mapParticipantsToPlayers(room: Room): (RoomPlayer | null)[] {
  const slots = emptyPlayerSlots();
  const participants = [...(room.participants || [])].sort((a, b) => a.slotIndex - b.slotIndex);
  const host = participants.find((participant) => participant.isHost);
  const others = participants.filter((participant) => !participant.isHost);

  if (host) {
    slots[0] = toRoomPlayer(host);
  }

  others.forEach((participant) => {
    let index = participant.slotIndex;
    if (index <= 0 || slots[index]) {
      index = slots.findIndex((slot) => slot === null);
    }
    if (index >= 0 && index < slots.length) {
      slots[index] = toRoomPlayer(participant);
    }
  });

  return slots;
}
