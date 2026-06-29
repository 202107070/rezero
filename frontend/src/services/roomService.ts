import type { GameMode, Room } from '../types/lobby';
import { clearKickedCount, loadDynamicRooms, persistDynamicRooms } from './roomStore';

export interface CreateRoomParams {
  roomTitle: string;
  playerMode: string;
  gameMode: GameMode;
  difficulty: string;
  language: string;
  roomPwd: string;
  problemCount: string;
}

export function createRoom(params: CreateRoomParams): Room {
  const currentDynamic = loadDynamicRooms();
  const maxDynamicId = currentDynamic.reduce((max, r) => Math.max(max, parseInt(String(r.id)) || 0), 0);
  const newId = Math.max(4, maxDynamicId) + 1;
  clearKickedCount(String(newId));

  const finalMax = '8';
  const finalCount = params.problemCount;

  const newRoom: Room = {
    id: newId,
    title: params.roomTitle,
    status: 'WAITING',
    players: params.playerMode === '1/1' ? '1/1' : `1/${finalMax}`,
    mode: params.playerMode,
    gameMode: params.gameMode,
    diff: params.difficulty,
    lang: params.language,
    pwd: params.roomPwd,
    count: finalCount,
    createdAt: Date.now(),
  };

  const updated = [...currentDynamic, newRoom];
  persistDynamicRooms(updated);
  return newRoom;
}

export function buildRoomSearchParams(room: Room): URLSearchParams {
  return new URLSearchParams({
    id: String(room.id),
    title: room.title,
    mode: room.mode || '1/1',
    diff: room.diff || '보통',
    lang: room.lang || 'JAVA',
    pwd: room.pwd || '',
    count: room.count || '5',
    maxPlayers: room.players ? String(room.players).split('/')[1] || '8' : '8',
    gameMode: room.gameMode || 'item',
  });
}
