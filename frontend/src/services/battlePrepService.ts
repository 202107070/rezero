import problems from '../data/problems.js';
import type { ItemKey } from '../constants/itemTypes';
import { STORAGE_KEYS } from '../constants/storageKeys';
import { DIFF_TO_KOREAN } from '../constants/roomConstants';
import type { GameMode } from '../types/lobby';
import type { RoomPlayer } from '../types/room';
import type { ProblemVisual } from '../types/battle';
import { getLangKey } from '../utils/battle/codeUtils';
import { problemSupportsLang } from '../utils/problemTypeUtils';

type ProblemRecord = {
  id: string;
  type: string;
  difficulty: string;
  title: string;
  question: string;
  answer: Record<string, string[]>;
  options: string[] | null;
  correctIndex: number | null;
  explanation: string;
  visual?: ProblemVisual | null;
};

const SESSION_KEYS_TO_CLEAR = (sessionKey: string) => [
  `battleDraft_${sessionKey}`,
  `battleDraftCode_${sessionKey}`,
  `battleDraftMeta_${sessionKey}`,
  `battleSubmittedProblems_${sessionKey}`,
  `battleDemoState_${sessionKey}`,
  'battleSubmission',
  'battleProblemData',
  'battleProblemTitle',
  'myBattleCode',
  'opponentBattleCode',
  'roomUsers',
  'battleProblems',
  'battleSettings',
];

function mapProblem(p: ProblemRecord) {
  return {
    id: p.id,
    type: p.type,
    difficulty: p.difficulty,
    title: p.title,
    question: p.question,
    answer: p.answer,
    options: p.options,
    correctIndex: p.correctIndex,
    explanation: p.explanation,
    visual: p.visual ?? null,
  };
}

export function prepareBattleStart(params: {
  roomId: string;
  settingsDiff: string;
  settingsCount: string;
  settingsMaxPlayers: number;
  myLanguage: string;
  roomMode: string;
  gameMode?: GameMode;
  selectedItems?: ItemKey[];
  roomRoster?: RoomPlayer[];
}): void {
  const diffKor = DIFF_TO_KOREAN[String(params.settingsDiff || '').toUpperCase()] || '보통';
  const langKey = getLangKey(params.myLanguage);
  const isRandomLang = String(params.myLanguage || '').toLowerCase() === 'random';
  const pool = (problems as ProblemRecord[]).filter((p) => {
    const diffMap: Record<string, string> = { 쉬움: 'easy', 보통: 'medium', 어려움: 'hard' };
    const diffOk = p.difficulty === diffMap[diffKor];
    const langOk = isRandomLang || problemSupportsLang(p.answer, langKey);
    return diffOk && langOk;
  });

  const count = Math.max(1, Math.min(10, parseInt(params.settingsCount, 10) || 5));
  const selectedProblems: ReturnType<typeof mapProblem>[] = [];
  const poolCopy = [...pool];

  for (let i = 0; i < count; i += 1) {
    if (poolCopy.length === 0) poolCopy.push(...pool);
    if (poolCopy.length === 0) break;
    const idx = Math.floor(Math.random() * poolCopy.length);
    selectedProblems.push(mapProblem(poolCopy.splice(idx, 1)[0]));
  }

  const sessionKey = params.roomId ? `battle-${params.roomId}` : 'battle-solo';

  try {
    SESSION_KEYS_TO_CLEAR(sessionKey).forEach((key) => localStorage.removeItem(key));

    localStorage.setItem('battleProblems', JSON.stringify(selectedProblems));
    localStorage.setItem(
      'battleSettings',
      JSON.stringify({
        roomId: params.roomId,
        lang: params.myLanguage,
        diff: params.settingsDiff,
        count: String(selectedProblems.length || count),
        maxPlayers: String(params.settingsMaxPlayers),
        roomMode: params.roomMode,
        gameMode: params.gameMode || 'item',
        selectedItems: params.selectedItems || [],
        roomRoster: (params.roomRoster || []).map((player) => ({
          id: player.id,
          name: player.name,
          character: player.character,
          isHost: player.isHost,
        })),
      }),
    );

    const storedRooms = localStorage.getItem(STORAGE_KEYS.DYNAMIC_ROOMS);
    if (storedRooms) {
      const dynamicRooms = JSON.parse(storedRooms);
      const updatedRooms = Array.isArray(dynamicRooms)
        ? dynamicRooms.map((r: { id: string | number; status: string }) =>
            String(r.id) === String(params.roomId) ? { ...r, status: 'STARTED' } : r,
          )
        : dynamicRooms;
      localStorage.setItem(STORAGE_KEYS.DYNAMIC_ROOMS, JSON.stringify(updatedRooms));
    }
  } catch (e) {
    console.error('이전 전투 상태 정리 실패:', e);
  }
}

export function clearRoomSession(roomId: string): void {
  try {
    localStorage.removeItem(`${STORAGE_KEYS.ROOM_KICKED_PREFIX}${roomId}`);
    const sessionKey = roomId ? `battle-${roomId}` : 'battle-solo';
    SESSION_KEYS_TO_CLEAR(sessionKey).forEach((key) => localStorage.removeItem(key));
  } catch (e) {
    console.error('세션 정리 실패:', e);
  }
}

export function removeRoomFromLobby(roomId: string): void {
  try {
    const storedRooms = localStorage.getItem(STORAGE_KEYS.DYNAMIC_ROOMS);
    const dynamicRooms = storedRooms ? JSON.parse(storedRooms) : [];
    if (Array.isArray(dynamicRooms)) {
      const updatedRooms = dynamicRooms.filter((r: { id: string | number }) => String(r.id) !== String(roomId));
      localStorage.setItem(STORAGE_KEYS.DYNAMIC_ROOMS, JSON.stringify(updatedRooms));
    }
  } catch {
    // 삭제 실패해도 로비 이동은 유지
  }
}

export function updateRoomPlayerCount(roomId: string): void {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.DYNAMIC_ROOMS);
    if (!stored) return;
    const rooms = JSON.parse(stored);
    const updated = rooms.map((r: { id: string | number; players: string }) => {
      if (String(r.id) === String(roomId)) {
        const parts = String(r.players).split('/');
        const max = parseInt(parts[1] || '8', 10);
        const current = Math.max(1, (parseInt(parts[0], 10) || 1) - 1);
        return { ...r, players: `${current}/${max}` };
      }
      return r;
    });
    localStorage.setItem(STORAGE_KEYS.DYNAMIC_ROOMS, JSON.stringify(updated));
  } catch (e) {
    console.error('방 인원 업데이트 실패:', e);
  }
}
