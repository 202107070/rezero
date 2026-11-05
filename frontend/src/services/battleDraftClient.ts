import { ApiError, apiRequest, getAccessToken } from './apiClient';
import type { MatchStartResponse } from './matchService';

export interface BattleDraft {
  matchId: string;
  version: number;
  currentIndex: number;
  codes: string[];
  blankAnswers: string[][];
  selectedOptions: Record<number, number>;
  localSavedAt: number;
  remaining: number;
  solveTimes?: Record<number, number>;
  buildsUsed?: Record<number, number>;
}

export interface DraftResponse {
  buildState: { used: Record<number, string>; bonus: Record<number, string> };
  roomRoster: Array<{ id: number; userId: string; name: string; character: string; isHost: boolean; ratingScore: number }>;
  match: MatchStartResponse;
  draft: BattleDraft | null;
  remainingSeconds: number;
  serverTime: number;
  progress: { score: number; finished: boolean; submissions: Array<{ index: number; answers: string[]; selectedOption: number | null; isCorrect: boolean }> };
}

const memory = new Map<string, BattleDraft>();
const writers = new Map<string, { tail: Promise<boolean>; acknowledged: number; blockedToken?: string | null; closed?: boolean }>();
const keyFor = (userId: string, matchId: string) => `rezero:draft:v1:${userId}:${matchId}`;

export function rememberDraft(userId: string, draft: BattleDraft): void {
  const key = keyFor(userId, draft.matchId);
  memory.set(key, draft);
  try { sessionStorage.setItem(key, JSON.stringify(draft)); } catch { /* 메모리 보존 */ }
}

export function readLocalDraft(userId: string, matchId: string): BattleDraft | null {
  const key = keyFor(userId, matchId);
  try {
    const parsed = JSON.parse(sessionStorage.getItem(key) || 'null') as BattleDraft | null;
    if (parsed?.matchId === matchId && Number.isSafeInteger(parsed.version) && Array.isArray(parsed.codes) && Array.isArray(parsed.blankAnswers)) return parsed;
  } catch { /* 메모리 초안으로 계속 진행 */ }
  return memory.get(key) || null;
}

export function preserveDraft(userId: string, input: Omit<BattleDraft, 'version' | 'localSavedAt'>): BattleDraft {
  const previous = readLocalDraft(userId, input.matchId);
  const signature = (draft: typeof input) => JSON.stringify([draft.currentIndex, draft.codes, draft.blankAnswers, draft.selectedOptions, draft.solveTimes, draft.buildsUsed]);
  const timeReduced = previous && input.remaining < previous.remaining - Math.floor((Date.now() - previous.localSavedAt) / 1000) - 1;
  if (previous && signature(previous) === signature(input) && !timeReduced) return previous;
  const draft = { ...input, version: Math.max(Date.now(), (previous?.version || 0) + 1), localSavedAt: Date.now() };
  rememberDraft(userId, draft);
  return draft;
}

export function isCurrentDraft(userId: string, draft: BattleDraft): boolean {
  return readLocalDraft(userId, draft.matchId)?.version === draft.version;
}

export function closeDraftWriter(userId: string, matchId: string): void {
  const writer = writers.get(keyFor(userId, matchId));
  if (writer) writer.closed = true;
}

export async function saveDraft(userId: string, draft: BattleDraft): Promise<boolean> {
  const key = keyFor(userId, draft.matchId);
  let writer = writers.get(key);
  if (!writer) {
    writer = { tail: Promise.resolve(false), acknowledged: 0 };
    writers.set(key, writer);
  }
  const state = writer;
  const send = async () => {
    if (state.closed) return false;
    if (state.blockedToken !== undefined && state.blockedToken === getAccessToken()) return false;
    if (draft.version <= state.acknowledged) return true;
    if (!isCurrentDraft(userId, draft)) return false;
    for (let attempt = 0; attempt < 3; attempt++) {
      if (state.closed || !isCurrentDraft(userId, draft)) return false;
      try {
        const result = await apiRequest<{ saved: boolean; version: number }>('/build/session/save', {
          method: 'POST', body: JSON.stringify(draft), signal: AbortSignal.timeout(5000),
        }, { background: true });
        if (result.saved !== true || result.version !== draft.version) return false;
        state.acknowledged = draft.version;
        return true;
      } catch (error) {
        if (error instanceof ApiError && [401, 403, 404].includes(error.status)) state.blockedToken = getAccessToken();
        if (error instanceof ApiError && error.code === 'MATCH_NOT_IN_PROGRESS') state.closed = true;
        const retryable = error instanceof ApiError && (error.status === 0 || error.status >= 500);
        if (!retryable || attempt === 2) return false;
        await new Promise(resolve => setTimeout(resolve, 250 * (attempt + 1)));
      }
    }
    return false;
  };
  const result = state.tail.then(send, send);
  state.tail = result;
  return result;
}

export function loadServerDraft(matchId: string): Promise<DraftResponse> {
  return apiRequest<DraftResponse>(`/build/session/${encodeURIComponent(matchId)}`, {
    signal: AbortSignal.timeout(5000),
  }, { background: true });
}
