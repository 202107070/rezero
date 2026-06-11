import { STORAGE_KEYS } from '../constants/storageKeys';
import type { BattleProblem, RoomUser } from '../types/battle';
import type { DemoBot } from '../utils/battle/demoBots';
import type { FinalRankingSnapshot } from '../utils/battle/rankUtils';

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
    localStorage.setItem(
      `battleDraft_${params.sessionId}`,
      JSON.stringify({
        roomId: params.roomId,
        sessionId: params.sessionId,
        lang: params.langKey,
        currentIndex: params.currentIndex,
        remaining: params.remaining,
        answers: params.answers,
        problems: params.problems,
        snapshot,
        updatedAt: new Date().toISOString(),
      }),
    );
    localStorage.setItem(`battleDraftCode_${params.sessionId}`, JSON.stringify(params.answers));
    localStorage.setItem(
      `battleDraftMeta_${params.sessionId}`,
      JSON.stringify({
        roomId: params.roomId,
        sessionId: params.sessionId,
        lang: params.langKey,
        currentIndex: params.currentIndex,
        remaining: params.remaining,
        updatedAt: new Date().toISOString(),
      }),
    );

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
    const storedDraft = localStorage.getItem(`battleDraft_${params.sessionId}`);
    if (!storedDraft) return { restored: false };

    const draft = JSON.parse(storedDraft);
    const storedCodes = localStorage.getItem(`battleDraftCode_${params.sessionId}`);
    const parsedCodes = storedCodes ? JSON.parse(storedCodes) : draft.answers;
    const nextAnswers = Array.isArray(parsedCodes) ? parsedCodes : [];
    const nextProblems = Array.isArray(draft.problems) && draft.problems.length > 0 ? draft.problems : params.baseProblems;

    let currentIndex = 0;
    let remaining = params.defaultRemainingSeconds;
    const storedMeta = localStorage.getItem(`battleDraftMeta_${params.sessionId}`);
    if (storedMeta) {
      const meta = JSON.parse(storedMeta);
      if (meta?.currentIndex !== undefined) {
        currentIndex = Math.min(Math.max(parseInt(meta.currentIndex, 10) || 0, 0), Math.max((nextProblems.length || params.baseProblems.length) - 1, 0));
      }
      if (meta?.remaining !== undefined) {
        remaining = Math.max(0, parseInt(meta.remaining, 10) || params.defaultRemainingSeconds);
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
  localStorage.setItem(
    'battleSubmission',
    JSON.stringify({
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
    }),
  );
  localStorage.setItem('myBattleCode', currentCode);
  localStorage.setItem('battleProblemTitle', params.problems[params.currentIndex]?.title || params.problems[0]?.title || '');
  const p = params.problems[params.currentIndex] || params.problems[0];
  localStorage.setItem(
    'battleProblemData',
    JSON.stringify({
      title: p?.title || '',
      question: p?.question || '',
      explanation: p?.explanation || '',
      answer: p?.answer || {},
      options: p?.options || null,
      type: p?.type || '',
    }),
  );
  localStorage.setItem('opponentBattleCode', params.selectedDemoBotCode);
  localStorage.setItem(
    `battleDemoState_${params.sessionId}`,
    JSON.stringify({
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
    }),
  );
}

export function syncBattleDemoState(sessionId: string, state: Record<string, unknown>): void {
  try {
    localStorage.setItem(`battleDemoState_${sessionId}`, JSON.stringify({ ...state, updatedAt: new Date().toISOString() }));
  } catch (e) {
    console.error('데모 상태 저장 실패:', e);
  }
}

export function markProblemSubmitted(sessionId: string, indices: number[]): void {
  localStorage.setItem(`battleSubmittedProblems_${sessionId}`, JSON.stringify(indices));
}

export function clearBattleAndLeave(sessionId: string, roomId: string): void {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.DYNAMIC_ROOMS);
    if (stored && roomId) {
      const rooms = JSON.parse(stored);
      const updated = rooms.filter((r: { id: string | number }) => String(r.id) !== String(roomId));
      localStorage.setItem(STORAGE_KEYS.DYNAMIC_ROOMS, JSON.stringify(updated));
    }
  } catch (e) {
    console.error('방 삭제 실패:', e);
  }
  try {
    [
      'battleProblems',
      'battleSettings',
      'battleSubmission',
      'battleProblemData',
      'battleProblemTitle',
      'myBattleCode',
      'opponentBattleCode',
      'roomUsers',
      `battleSubmittedProblems_${sessionId}`,
      `battleDraft_${sessionId}`,
      `battleDraftCode_${sessionId}`,
      `battleDraftMeta_${sessionId}`,
      `battleDemoState_${sessionId}`,
      `battleFinalRankings_${sessionId}`,
      `${STORAGE_KEYS.ROOM_KICKED_PREFIX}${roomId}`,
    ].forEach((key) => localStorage.removeItem(key));
    if (shouldSyncBackend()) {
      fetch(`/api/v1/build/session/${encodeURIComponent(sessionId)}`, { method: 'DELETE' }).catch(() => {});
    }
  } catch (e) {
    console.error('세션 삭제 실패:', e);
  }
}

export function saveFinalRankingSnapshot(snapshot: FinalRankingSnapshot): void {
  localStorage.setItem(`battleFinalRankings_${snapshot.sessionId}`, JSON.stringify(snapshot));
}

export function readFinalRankingSnapshot(sessionId: string): FinalRankingSnapshot | null {
  try {
    const raw = localStorage.getItem(`battleFinalRankings_${sessionId}`);
    return raw ? (JSON.parse(raw) as FinalRankingSnapshot) : null;
  } catch {
    return null;
  }
}

export function saveRoomUsers(users: RoomUser[]): void {
  localStorage.setItem('roomUsers', JSON.stringify(users));
}
