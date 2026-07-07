import type { BattleProblem } from '../types/battle';
import { assembleCode, getLangKey } from './battle/codeUtils';
import { getBotSpectatorAnswers, getBotSpectatorMcIndex, type DemoBot } from './battle/demoBots';
import { normalizeBattleProblem } from './battle/problemResultUtils';
import { getProblemAnswersForLang } from './problemTypeUtils';
import problems from '../data/problems.js';

type ProblemLike = Pick<
  BattleProblem,
  'id' | 'type' | 'title' | 'question' | 'answer' | 'options' | 'correctIndex' | 'visual'
>;

function lookupAnswerBlanks(problem: ProblemLike, langKey: string): string[] {
  const fromProblem = getProblemAnswersForLang(problem.answer, langKey);
  if (fromProblem.length) return fromProblem;

  const bank = problems as ProblemLike[];
  const match =
    (problem.id ? bank.find((entry) => entry.id === problem.id) : undefined) ||
    bank.find(
      (entry) =>
        entry.title === problem.title &&
        String(entry.question || '').trim() === String(problem.question || '').trim(),
    ) ||
    bank.find((entry) => entry.title === problem.title);

  if (!match) return [];
  return getProblemAnswersForLang(match.answer, langKey);
}

export function formatCorrectAnswer(problem: ProblemLike, langKey: string): string {
  const normalized = normalizeBattleProblem(problem as BattleProblem);
  const resolvedLangKey = getLangKey(langKey);

  if (normalized.type === 'multiple_choice') {
    const idx = normalized.correctIndex;
    if (idx != null && idx >= 0 && normalized.options?.[idx]) {
      return `${String.fromCharCode(65 + idx)}. ${normalized.options[idx]}`;
    }

    const fromAnswer = lookupAnswerBlanks(normalized, resolvedLangKey)[0];
    if (fromAnswer && normalized.options?.length) {
      const parsedIdx = Number.parseInt(fromAnswer, 10);
      if (!Number.isNaN(parsedIdx) && parsedIdx >= 0 && parsedIdx < normalized.options.length) {
        return `${String.fromCharCode(65 + parsedIdx)}. ${normalized.options[parsedIdx]}`;
      }
      const textIdx = normalized.options.findIndex((opt) => opt === fromAnswer);
      if (textIdx >= 0) return `${String.fromCharCode(65 + textIdx)}. ${normalized.options[textIdx]}`;
      return fromAnswer;
    }

    if (idx != null && idx >= 0) return String(idx);
    return fromAnswer || '';
  }

  if (normalized.type === 'short_answer') {
    return lookupAnswerBlanks(normalized, resolvedLangKey)[0] || '';
  }

  const blanks = lookupAnswerBlanks(normalized, resolvedLangKey);
  if (!blanks.length) return '';

  const markerCount = (normalized.question || '').match(/_____/g)?.length || 0;
  if (markerCount > 0) {
    return assembleCode(normalized.question || '', blanks);
  }

  return blanks.join(', ');
}

export function formatSubmittedAnswer(params: {
  problem: ProblemLike;
  langKey: string;
  blankAnswers?: string[];
  selectedOption?: number | null;
  assembledCode?: string;
}): string {
  const normalized = normalizeBattleProblem(params.problem as BattleProblem);
  const emptyLabel = '(미입력)';

  if (normalized.type === 'multiple_choice') {
    const idx = params.selectedOption;
    if (idx == null || idx < 0) return emptyLabel;
    const opt = normalized.options?.[idx];
    return opt ? `${String.fromCharCode(65 + idx)}. ${opt}` : String(idx);
  }

  if (normalized.type === 'short_answer') {
    const ans = String(params.blankAnswers?.[0] || '').trim();
    return ans || emptyLabel;
  }

  const blanks = params.blankAnswers || [];
  const markerCount = (normalized.question || '').match(/_____/g)?.length || 0;
  if (markerCount > 0) {
    if (blanks.some((b) => String(b || '').trim())) {
      return assembleCode(normalized.question || '', blanks);
    }
    const assembled = String(params.assembledCode || '').trim();
    if (assembled && assembled !== normalized.question) return assembled;
    return emptyLabel;
  }

  const joined = blanks.map((b) => String(b || '').trim()).filter(Boolean).join(', ');
  return joined || emptyLabel;
}

export function getResultPlayerAnswer(params: {
  playerId: string;
  problemIndex: number;
  problem: ProblemLike;
  langKey: string;
  myUserId: string;
  mySubmissionCodes: string[];
  myBlankAnswers?: string[][];
  mySelectedOptions?: Record<number, number>;
  demoBots: DemoBot[];
}): string {
  const {
    playerId,
    problemIndex,
    problem,
    langKey,
    myUserId,
    mySubmissionCodes,
    myBlankAnswers,
    mySelectedOptions,
    demoBots,
  } = params;

  const isMe = playerId === myUserId || playerId === 'me';

  if (isMe) {
    return formatSubmittedAnswer({
      problem,
      langKey,
      blankAnswers: myBlankAnswers?.[problemIndex],
      selectedOption: mySelectedOptions?.[problemIndex] ?? null,
      assembledCode: mySubmissionCodes[problemIndex],
    });
  }

  const bot = demoBots.find((b) => b.id === playerId);
  if (bot) {
    const blanks = getBotSpectatorAnswers(bot, problemIndex, problem, langKey);
    const mcIndex = getBotSpectatorMcIndex(bot, problem, problemIndex);
    return formatSubmittedAnswer({
      problem,
      langKey,
      blankAnswers: blanks,
      selectedOption: mcIndex,
      assembledCode: bot.codeByProblem?.[problemIndex],
    });
  }

  const fallback = mySubmissionCodes[problemIndex];
  return fallback?.trim() ? fallback : '(답안 없음)';
}
