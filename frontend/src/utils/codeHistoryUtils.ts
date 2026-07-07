import type { CodeHistoryEntry } from '../types/lobby';
import { persistUserCodeHistory, readUserCodeHistory } from '../services/userService';
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
