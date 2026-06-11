import type { BattleProblem } from '../../types/battle';

export type ProblemResultsMap = Record<number, boolean>;

export function normalizeBattleProblem(problem: BattleProblem): BattleProblem {
  const question = problem.question || '';
  const hasBlanks = /_____/.test(question);
  const rawType = String(problem.type || '')
    .trim()
    .toLowerCase()
    .replace(/-/g, '_');

  let type: BattleProblem['type'] = 'fill_blank';

  if (
    rawType === 'multiple_choice' ||
    rawType === 'multiplechoice' ||
    (Array.isArray(problem.options) && problem.options.length > 0 && problem.correctIndex != null)
  ) {
    type = 'multiple_choice';
  } else if (rawType === 'short_answer' || rawType === 'shortanswer' || rawType === '주관식') {
    type = 'short_answer';
  } else if (rawType === 'fill_blank' || rawType === 'fillblank' || rawType === '빈칸') {
    type = hasBlanks ? 'fill_blank' : 'short_answer';
  } else if (!rawType) {
    type = hasBlanks ? 'fill_blank' : 'short_answer';
  } else if (hasBlanks) {
    type = 'fill_blank';
  } else {
    type = 'short_answer';
  }

  return { ...problem, type };
}

export function normalizeBattleProblems(problems: BattleProblem[]): BattleProblem[] {
  return problems.map(normalizeBattleProblem);
}

export function isProblemAnswerCorrect(params: {
  problem: BattleProblem;
  problemIndex: number;
  langKey: string;
  blankAnswers: string[][];
  correctBlanks: Record<number, Record<number, boolean>>;
  selectedOption: number | null;
}): boolean {
  const problem = normalizeBattleProblem(params.problem);
  const { problemIndex, langKey, blankAnswers, correctBlanks, selectedOption } = params;

  if (problem.type === 'fill_blank') {
    const correct = problem.answer?.[langKey] || [];
    const saved = correctBlanks[problemIndex] || {};
    if (correct.length === 0) return false;
    for (let i = 0; i < correct.length; i++) {
      if (!saved[i]) return false;
    }
    return true;
  }

  if (problem.type === 'short_answer') {
    const u = String(blankAnswers[problemIndex]?.[0] || '').trim().toLowerCase();
    const c = String(problem.answer?.[langKey]?.[0] || '').trim().toLowerCase();
    return u !== '' && u === c;
  }

  if (problem.type === 'multiple_choice') {
    return selectedOption !== null && selectedOption === problem.correctIndex;
  }

  return false;
}

export function finalizeProblemResults(
  results: ProblemResultsMap,
  totalProblems: number,
): boolean[] {
  return Array.from({ length: totalProblems }, (_, index) => results[index] === true);
}

export function buildBotProblemResults(solvedProblems: number[], totalProblems: number): boolean[] {
  return Array.from({ length: totalProblems }, (_, index) => solvedProblems.includes(index));
}
