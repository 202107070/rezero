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

function normLookupText(value: unknown): string {
  return String(value || '')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function findBankProblem(problem: ProblemLike | null | undefined): ProblemLike | undefined {
  if (!problem) return undefined;
  const bank = problems as ProblemLike[];
  const id = String(problem.id || '').trim();
  if (id) {
    const byId = bank.find((entry) => String(entry.id || '').trim().toLowerCase() === id.toLowerCase());
    if (byId) return byId;
  }
  const question = normLookupText(problem.question);
  const title = normLookupText(problem.title);
  if (question) {
    const byQuestion = bank.find((entry) => normLookupText(entry.question) === question);
    if (byQuestion) return byQuestion;
  }
  if (title && question) {
    const prefix = question.slice(0, 80);
    const byBoth = bank.find(
      (entry) =>
        normLookupText(entry.title) === title && normLookupText(entry.question).slice(0, 80) === prefix,
    );
    if (byBoth) return byBoth;
  }
  if (title) {
    const sameTitle = bank.filter((entry) => normLookupText(entry.title) === title);
    if (sameTitle.length === 1) return sameTitle[0];
  }
  return undefined;
}

export function hydrateBattleProblem(problem: ProblemLike, langKey?: string): BattleProblem {
  const match = findBankProblem(problem);
  const merged = {
    ...(match || {}),
    ...problem,
    type: problem.type || match?.type,
    options: problem.options?.length ? problem.options : match?.options,
    correctIndex: problem.correctIndex ?? match?.correctIndex ?? null,
    answer:
      problem.answer && Object.keys(problem.answer).length > 0 ? problem.answer : match?.answer,
    question: problem.question || match?.question,
    title: problem.title || match?.title,
    id: problem.id || match?.id,
    explanation:
      (problem as BattleProblem).explanation ||
      (match as BattleProblem | undefined)?.explanation,
  } as BattleProblem;
  void langKey;
  return normalizeBattleProblem(merged);
}

function lookupAnswerBlanks(problem: ProblemLike, langKey: string): string[] {
  const hydrated = hydrateBattleProblem(problem, langKey);
  return getProblemAnswersForLang(hydrated.answer, langKey);
}

export function formatCorrectAnswer(problem: ProblemLike, langKey: string): string {
  const normalized = hydrateBattleProblem(problem, langKey);
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

  const assembled = String(params.assembledCode || '').trim();
  const question = String(normalized.question || '').trim();
  const assembledFallback = assembled && assembled !== question && assembled !== emptyLabel ? assembled : '';

  if (normalized.type === 'multiple_choice') {
    const idx = params.selectedOption;
    if (idx == null || idx < 0) return assembledFallback || emptyLabel;
    const opt = normalized.options?.[idx];
    return opt ? `${String.fromCharCode(65 + idx)}. ${opt}` : String(idx);
  }

  if (normalized.type === 'short_answer') {
    const ans = String(params.blankAnswers?.[0] || '').trim();
    return ans || assembledFallback || emptyLabel;
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
  opponentAnswers?: Record<
    string,
    {
      codes?: string[];
      blankAnswers?: string[][];
      selectedOptions?: Record<number, number | null>;
    }
  >;
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
    opponentAnswers,
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

  const opponent =
    opponentAnswers?.[playerId] ||
    opponentAnswers?.[playerId.replace(/^player-/, '')] ||
    opponentAnswers?.[`player-${playerId}`];
  if (opponent) {
    return formatSubmittedAnswer({
      problem,
      langKey,
      blankAnswers: opponent.blankAnswers?.[problemIndex],
      selectedOption: opponent.selectedOptions?.[problemIndex] ?? null,
      assembledCode: opponent.codes?.[problemIndex],
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

  // 다른 플레이어 답안이 없으면 내 코드를 절대 사용하지 않음
  return '(답안 없음)';
}
