import type { CodeHistoryEntry } from '../types/lobby';
import { STORAGE_KEYS } from '../constants/storageKeys';
import problems from '../data/problems.js';

type ProblemRecord = {
  title?: string;
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
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.CODE_HISTORY);
    const parsed = stored ? JSON.parse(stored) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map(normalizeCodeHistoryEntry)
      .filter((entry): entry is CodeHistoryEntry => Boolean(entry))
      .filter((entry) => entry.mode !== 'PRACTICE' && entry.roomId !== 'PRACTICE')
      .sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());
  } catch {
    return [];
  }
}

export function persistCodeHistory(nextHistory: CodeHistoryEntry[]): void {
  localStorage.setItem(STORAGE_KEYS.CODE_HISTORY, JSON.stringify(nextHistory));
}

export function getSolution(problem: CodeHistoryEntry['problems'][0] | null | undefined): string {
  if (!problem?.title) return '// 정답이 준비되지 않았습니다.';
  const lang = problem.lang || 'JAVA';
  const answer = problem.answer?.[lang];
  if (answer && Array.isArray(answer)) return answer.join('\n');
  const match = (problems as ProblemRecord[]).find((p) => p.title === problem.title);
  if (match?.answer?.[lang]) return match.answer[lang].join('\n');
  return '// 정답이 준비되지 않았습니다.';
}
