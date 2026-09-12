import problems from '../data/problems.js';
import type { ItemKey } from '../constants/itemTypes';
import { DIFF_TO_KOREAN } from '../constants/roomConstants';
import type { GameMode } from '../types/lobby';
import type { RoomPlayer } from '../types/room';
import type { ProblemVisual } from '../types/battle';
import { getLangKey } from '../utils/battle/codeUtils';
import { problemSupportsLang } from '../utils/problemTypeUtils';
import { normalizeBattleProblem } from '../utils/battle/problemResultUtils';
import { normalizeProblemVisual } from '../utils/problemVisualUtils';
import type { MatchStartResponse } from './matchService';
import { clearKickedCount } from './roomStore';
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
    visual: normalizeProblemVisual(p.visual ?? null),
  });
}

export function applyMatchStart(params: {
  match: MatchStartResponse;
  settingsDiff: string;
  myLanguage: string;
  selectedItems?: ItemKey[];
  roomRoster?: RoomPlayer[];
}): void {
  const selectedProblems = params.match.problems.map((problem) =>
    mapProblem({
      id: String(problem.id || ''),
      type: String(problem.type || 'fill_blank'),
      difficulty: String(problem.difficulty || ''),
      title: String(problem.title || ''),
      question: String(problem.question || ''),
      answer: problem.answer || {},
      options: problem.options ?? null,
      correctIndex: problem.correctIndex ?? null,
      explanation: String(problem.explanation || ''),
      visual: problem.visual ?? null,
    }),
  );

  const sessionKey = params.match.roomId ? `battle-${params.match.roomId}` : 'battle-solo';

  try {
    clearBattleSessionForLeave(sessionKey);
    setBattleProblems(selectedProblems);
    setBattleSettings({
      matchId: params.match.matchId,
      roomId: String(params.match.roomId),
      lang: params.myLanguage,
      diff: params.settingsDiff,
      count: String(selectedProblems.length || params.match.problemCount),
      maxPlayers: String(params.match.maxPlayers),
      roomMode: params.match.roomMode,
      gameMode: params.match.gameMode || 'item',
      roundSeconds: params.match.roundSeconds,
      selectedItems: params.selectedItems || [],
      roomRoster: (params.roomRoster || []).map((player) => ({
        id: player.id,
        name: player.name,
        character: player.character,
        isHost: player.isHost,
        userId: player.userId,
      })),
    });
  } catch (e) {
    console.error('매치 시작 상태 저장 실패:', e);
  }
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
