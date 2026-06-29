import problems from '../data/problems.js';
import type { ItemKey } from '../constants/itemTypes';
import { DIFF_TO_KOREAN } from '../constants/roomConstants';
import type { GameMode } from '../types/lobby';
import type { RoomPlayer } from '../types/room';
import type { ProblemVisual } from '../types/battle';
import { getLangKey } from '../utils/battle/codeUtils';
import { problemSupportsLang } from '../utils/problemTypeUtils';
import { normalizeBattleProblem } from '../utils/battle/problemResultUtils';
import {
  clearKickedCount,
  loadDynamicRooms,
  persistDynamicRooms,
  removeRoomById,
  updateRoomStatus,
} from './roomStore';
import { clearBattleSessionForLeave, setBattleProblems, setBattleSettings } from './sessionStore';

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

function mapProblem(p: ProblemRecord) {
  return normalizeBattleProblem({
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
  });
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
    clearBattleSessionForLeave(sessionKey);

    setBattleProblems(selectedProblems);
    setBattleSettings({
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
    });

    if (params.roomId) {
      updateRoomStatus(params.roomId, 'STARTED');
    }
  } catch (e) {
    console.error('이전 전투 상태 정리 실패:', e);
  }
}

export function clearRoomSession(roomId: string): void {
  try {
    clearKickedCount(roomId);
    const sessionKey = roomId ? `battle-${roomId}` : 'battle-solo';
    clearBattleSessionForLeave(sessionKey);
  } catch (e) {
    console.error('세션 정리 실패:', e);
  }
}

export function removeRoomFromLobby(roomId: string): void {
  removeRoomById(roomId);
}

export function updateRoomPlayerCount(roomId: string): void {
  try {
    const rooms = loadDynamicRooms();
    const updated = rooms.map((r) => {
      if (String(r.id) === String(roomId)) {
        const parts = String(r.players).split('/');
        const max = parseInt(parts[1] || '8', 10);
        const current = Math.max(1, (parseInt(parts[0], 10) || 1) - 1);
        return { ...r, players: `${current}/${max}` };
      }
      return r;
    });
    persistDynamicRooms(updated);
  } catch (e) {
    console.error('방 인원 업데이트 실패:', e);
  }
}
