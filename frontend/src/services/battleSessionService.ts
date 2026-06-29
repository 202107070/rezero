import type { BattleProblem, RoomUser } from '../types/battle';
import type { DemoBot } from '../utils/battle/demoBots';
import type { FinalRankingSnapshot } from '../utils/battle/rankUtils';
import { removeRoomById } from './roomStore';
import {
  clearBattleSessionForLeave,
  getBattleDraft,
  getBattleDraftCodes,
  getBattleDraftMeta,
  mergeBattleDemoState,
  setBattleDraft,
  setBattleDraftCodes,
  setBattleDraftMeta,
  setBattleDemoState,
  setBattleProblemMeta,
  setBattleSubmission,
  setBattleSubmittedProblems,
  setFinalRankingSnapshot,
  setMyBattleCode,
  setOpponentBattleCode,
  setRoomUsers,
  getFinalRankingSnapshot,
} from './sessionStore';

function shouldSyncBackend(): boolean {
  return !import.meta.env.DEV || import.meta.env.VITE_SYNC_BACKEND === 'true';
}

export function getSessionId(roomId: string): string {
  return roomId ? `battle-${roomId}` : 'battle-solo';
}

export async function persistBattleSession(params: {
  sessionId: string;
  roomId: string;
  langKey: string;
  currentIndex: number;
  remaining: number;
  answers: string[];
  problems: BattleProblem[];
  sessionSavedSnapshot: string;
  shouldCommit: boolean;
  onStatus: (status: 'saving' | 'saved' | 'unsaved') => void;
  onSnapshotUpdate?: (snapshot: string) => void;
}): Promise<void> {
  const snapshot = (params.answers || []).join('||');
  try {
    params.onStatus('saving');
    setBattleDraft(params.sessionId, {
      roomId: params.roomId,
      sessionId: params.sessionId,
      lang: params.langKey,
      currentIndex: params.currentIndex,
      remaining: params.remaining,
      answers: params.answers,
      problems: params.problems,
      snapshot,
      updatedAt: new Date().toISOString(),
    });
    setBattleDraftCodes(params.sessionId, params.answers);
    setBattleDraftMeta(params.sessionId, {
      roomId: params.roomId,
      sessionId: params.sessionId,
      lang: params.langKey,
      currentIndex: params.currentIndex,
      remaining: params.remaining,
      updatedAt: new Date().toISOString(),
    });

    if (shouldSyncBackend()) {
      await fetch('/api/v1/build/session/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: params.sessionId,
          userId: 'rocky_user',
          language: params.langKey,
          roomId: params.roomId,
          status: 'BATTLE',
          currentIndex: String(params.currentIndex),
          remaining: String(params.remaining),
          problems: params.problems.map((problem, index) => ({
            title: problem?.title || '',
            description: problem?.description || '',
            input: problem?.input || '',
            output: problem?.output || '',
            code: params.answers[index] || '',
          })),
        }),
      });
    }

    if (params.shouldCommit) {
      params.onSnapshotUpdate?.(snapshot);
      params.onStatus('saved');
    } else {
      params.onStatus(snapshot === params.sessionSavedSnapshot ? 'saved' : 'unsaved');
    }
  } catch (e) {
    console.error('세션 저장 실패:', e);
    params.onStatus('unsaved');
  }
}

export function restoreBattleSession(params: {
  sessionId: string;
  defaultRemainingSeconds: number;
  baseProblems: BattleProblem[];
  baseAnswers: string[];
}): {
  restored: boolean;
  problems?: BattleProblem[];
  answers?: string[];
  currentIndex?: number;
  remaining?: number;
  snapshot?: string;
} {
  try {
    const draft = getBattleDraft(params.sessionId);
    if (!draft) return { restored: false };

    const parsedCodes = getBattleDraftCodes(params.sessionId) ?? (draft.answers as string[] | undefined);
    const nextAnswers = Array.isArray(parsedCodes) ? parsedCodes : [];
    const draftProblems = draft.problems;
    const nextProblems =
      Array.isArray(draftProblems) && draftProblems.length > 0
        ? (draftProblems as BattleProblem[])
        : params.baseProblems;

    let currentIndex = 0;
    let remaining = params.defaultRemainingSeconds;
    const meta = getBattleDraftMeta(params.sessionId);
    if (meta) {
      if (meta.currentIndex !== undefined) {
        currentIndex = Math.min(
          Math.max(parseInt(String(meta.currentIndex), 10) || 0, 0),
          Math.max((nextProblems.length || params.baseProblems.length) - 1, 0),
        );
      }
      if (meta.remaining !== undefined) {
        remaining = Math.max(0, parseInt(String(meta.remaining), 10) || params.defaultRemainingSeconds);
      }
    }

    const snapshot = (nextAnswers.length > 0 ? nextAnswers : params.baseAnswers).join('||');
    return {
      restored: true,
      problems: nextProblems,
      answers: nextAnswers.length > 0 ? nextAnswers : params.baseAnswers,
      currentIndex,
      remaining,
      snapshot,
    };
  } catch (e) {
    console.error('세션 복원 실패:', e);
    return { restored: false };
  }
}

export function persistBattleSubmission(params: {
  roomId: string;
  sessionId: string;
  problems: BattleProblem[];
  answers: string[];
  langKey: string;
  battleMode: string;
  maxPlayersParam: string;
  currentIndex: number;
  ingameScore: number;
  solveTimes: Record<number, number>;
  myRatingScore: number;
  remaining: number;
  roundSeconds: number;
  localSolvedProblems: number[];
  problemResults?: boolean[];
  finishedAtElapsedSec: number;
  demoSpectating: boolean;
  spectatorLocked: boolean;
  battleBots: DemoBot[];
  selectedDemoBotCode: string;
}): void {
  const currentCode = params.answers[params.currentIndex] || params.answers[0] || '';
  setBattleSubmission({
    historyId: `${params.roomId || 'solo'}::${Date.now()}`,
    roomId: params.roomId,
    problems: params.problems,
    answers: params.answers,
    lang: params.langKey,
    submittedAt: new Date().toISOString(),
    codes: params.answers.slice(),
    code: currentCode,
    mode: params.battleMode,
    maxPlayers: params.maxPlayersParam,
    currentIndex: params.currentIndex,
    ingameScore: params.ingameScore,
    solveTimes: params.solveTimes,
    problemResults: params.problemResults,
    myRatingScore: params.myRatingScore,
  });
  setMyBattleCode(currentCode);
  const p = params.problems[params.currentIndex] || params.problems[0];
  setBattleProblemMeta(p?.title || '', {
    title: p?.title || '',
    question: p?.question || '',
    explanation: p?.explanation || '',
    answer: p?.answer || {},
    options: p?.options || null,
    type: p?.type || '',
  });
  setOpponentBattleCode(params.selectedDemoBotCode);
  setBattleDemoState(params.sessionId, {
    roomId: params.roomId,
    sessionId: params.sessionId,
    mode: params.battleMode,
    maxPlayers: params.maxPlayersParam,
    lang: params.langKey,
    currentIndex: params.currentIndex,
    remaining: params.remaining,
    roundSeconds: params.roundSeconds,
    answers: params.answers,
    localSolvedProblems: params.localSolvedProblems,
    finishedAtElapsedSec: params.finishedAtElapsedSec,
    demoSpectating: params.demoSpectating,
    spectatorLocked: params.spectatorLocked,
    battleBots: params.battleBots,
    ingameScore: params.ingameScore,
    solveTimes: params.solveTimes,
    problemResults: params.problemResults,
    myRatingScore: params.myRatingScore,
    updatedAt: new Date().toISOString(),
  });
}

export function syncBattleDemoState(sessionId: string, state: Record<string, unknown>): void {
  try {
    mergeBattleDemoState(sessionId, state);
  } catch (e) {
    console.error('데모 상태 저장 실패:', e);
  }
}

export function markProblemSubmitted(sessionId: string, indices: number[]): void {
  setBattleSubmittedProblems(sessionId, indices);
}

export function clearBattleAndLeave(sessionId: string, roomId: string): void {
  if (roomId) {
    removeRoomById(roomId);
  }
  clearBattleSessionForLeave(sessionId);
  if (shouldSyncBackend()) {
    fetch(`/api/v1/build/session/${encodeURIComponent(sessionId)}`, { method: 'DELETE' }).catch(() => {});
  }
}

export function saveFinalRankingSnapshot(snapshot: FinalRankingSnapshot): void {
  setFinalRankingSnapshot(snapshot);
}

export function readFinalRankingSnapshot(sessionId: string): FinalRankingSnapshot | null {
  return getFinalRankingSnapshot(sessionId);
}

export function saveRoomUsers(users: RoomUser[]): void {
  setRoomUsers(users);
}
