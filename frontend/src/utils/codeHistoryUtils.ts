import type { CodeHistoryEntry } from '../types/lobby';
import { persistUserCodeHistory, readUserCodeHistory } from '../services/userService';
import { apiRequest } from '../services/apiClient';
import problems from '../data/problems.js';
import { getLangKey } from './battle/codeUtils';
import { getProblemAnswersForLang } from './problemTypeUtils';

type ProblemRecord = {
  id?: string;
  title?: string;
  question?: string;
  lang?: string;
  answer?: Record<string, string[]>;
};

export function normalizeCodeHistoryEntry(entry: unknown): CodeHistoryEntry | null {
  if (!entry || typeof entry !== 'object') return null;
  const e = entry as Partial<CodeHistoryEntry>;
  const problemList = Array.isArray(e.problems) ? e.problems : [];
  const codes = Array.isArray(e.codes) ? e.codes : [];
  const fallbackCode = typeof e.code === 'string' ? e.code : '';
  const normalizedCodes = codes.length > 0 ? codes : [fallbackCode];

  return {
    historyId: e.historyId || `${e.roomId || 'solo'}::${e.submittedAt || Date.now()}`,
    roomId: e.roomId || '',
    submittedAt: e.submittedAt || new Date().toISOString(),
    lang: e.lang || 'UNKNOWN',
    problems: problemList,
    codes: normalizedCodes,
    code: fallbackCode || normalizedCodes[0] || '',
    mode: e.mode,
  };
}

export function readCodeHistory(): CodeHistoryEntry[] {
  return readUserCodeHistory()
    .map(normalizeCodeHistoryEntry)
    .filter((entry): entry is CodeHistoryEntry => Boolean(entry))
    .filter((entry) => entry.mode !== 'PRACTICE' && entry.roomId !== 'PRACTICE')
    .sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());
}

export function persistCodeHistory(nextHistory: CodeHistoryEntry[]): void {
  persistUserCodeHistory(nextHistory);
}

export async function fetchMatchHistory(): Promise<CodeHistoryEntry[]> {
  try {
    const result = await apiRequest<{ entries?: unknown[] }>('/users/me/match-history');
    const entries = Array.isArray(result.entries)
      ? result.entries
          .map(normalizeCodeHistoryEntry)
          .filter((entry): entry is CodeHistoryEntry => Boolean(entry))
      : [];
    persistCodeHistory(entries);
    return readCodeHistory();
  } catch {
    return readCodeHistory();
  }
}

export async function saveMatchHistoryEntry(entry: CodeHistoryEntry): Promise<void> {
  const history = readCodeHistory().filter((item) => item.historyId !== entry.historyId);
  persistCodeHistory([entry, ...history].slice(0, 100));
  try {
    await apiRequest('/users/me/match-history', {
      method: 'POST',
      body: JSON.stringify(entry),
    });
  } catch (error) {
    console.error('매치 히스토리 서버 저장 실패:', error);
  }
}

export async function deleteMatchHistoryEntries(historyIds: string[]): Promise<CodeHistoryEntry[]> {
  const idSet = new Set(historyIds);
  const next = readCodeHistory().filter((entry) => !idSet.has(entry.historyId));
  persistCodeHistory(next);
  try {
    await apiRequest('/users/me/match-history', {
      method: 'DELETE',
      body: JSON.stringify({ historyIds }),
    });
  } catch (error) {
    console.error('매치 히스토리 삭제 실패:', error);
  }
  return next;
}

/** 이전에 풀어본 문제 식별자(id/title) 집합 */
export function collectSolvedProblemKeys(history: CodeHistoryEntry[] = readCodeHistory()): Set<string> {
  const keys = new Set<string>();
  for (const entry of history) {
    for (const problem of entry.problems || []) {
      if (problem.id) keys.add(`id:${problem.id}`);
      if (problem.title) keys.add(`title:${String(problem.title).trim()}`);
      const q = String(problem.question || '').trim();
      if (q) keys.add(`q:${q.slice(0, 120)}`);
    }
  }
  return keys;
}

export function isPreviouslySolvedProblem(
  problem: { id?: string; title?: string; question?: string } | null | undefined,
  solvedKeys: Set<string> = collectSolvedProblemKeys(),
): boolean {
  if (!problem) return false;
  if (problem.id && solvedKeys.has(`id:${problem.id}`)) return true;
  if (problem.title && solvedKeys.has(`title:${String(problem.title).trim()}`)) return true;
  const q = String(problem.question || '').trim();
  if (q && solvedKeys.has(`q:${q.slice(0, 120)}`)) return true;
  return false;
}

export function getSolution(problem: CodeHistoryEntry['problems'][0] | null | undefined): string {
  if (!problem) return '// 정답이 준비되지 않았습니다.';
  const lang = getLangKey(problem.lang || 'JAVA');

  const fromProblem = getProblemAnswersForLang(problem.answer, lang);
  if (fromProblem.length > 0) return fromProblem.join('\n');

  const bank = problems as ProblemRecord[];
  const match =
    (problem.id ? bank.find((entry) => entry.id === problem.id) : undefined) ||
    bank.find(
      (entry) =>
        entry.title === problem.title &&
        String(entry.question || '').trim() === String(problem.question || '').trim(),
    ) ||
    bank.find((entry) => entry.title === problem.title);

  const fromBank = getProblemAnswersForLang(match?.answer, lang);
  if (fromBank.length > 0) return fromBank.join('\n');

  return '// 정답이 준비되지 않았습니다.';
}
