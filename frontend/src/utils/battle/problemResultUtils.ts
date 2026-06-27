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
  selectedOption: number | null;
}): boolean {
  const problem = normalizeBattleProblem(params.problem);
  const { problemIndex, langKey, blankAnswers, selectedOption } = params;

  if (problem.type === 'fill_blank' || problem.type === 'visual_fill_blank') {
    const correct = problem.answer?.[langKey] || [];
    const user = blankAnswers[problemIndex] || [];
    if (correct.length === 0) return false;
    for (let i = 0; i < correct.length; i++) {
      const u = String(user[i] || '').trim().toLowerCase();
      const c = String(correct[i] || '').trim().toLowerCase();
      if (u !== c) return false;
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

export function hasProblemAnswerAttempted(params: {
  problem: BattleProblem;
  problemIndex: number;
  langKey: string;
  blankAnswers: string[][];
  selectedOption: number | null;
}): boolean {
  const problem = normalizeBattleProblem(params.problem);
  const { problemIndex, langKey, blankAnswers, selectedOption } = params;

  if (problem.type === 'multiple_choice') {
    return selectedOption !== null;
  }

  if (problem.type === 'short_answer') {
    return String(blankAnswers[problemIndex]?.[0] || '').trim() !== '';
  }

  if (problem.type === 'fill_blank' || problem.type === 'visual_fill_blank') {
    const question = problem.question || '';
    const correct = problem.answer?.[langKey] || [];
    const blankCount = Math.max(correct.length, (question.match(/_____/g) || []).length);
    if (blankCount === 0) return false;
    const user = blankAnswers[problemIndex] || [];
    for (let i = 0; i < blankCount; i++) {
      if (String(user[i] || '').trim() === '') return false;
    }
    return true;
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
