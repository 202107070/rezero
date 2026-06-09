import problems from '../data/problems.js';

export interface PracticeExercise {
  id: string;
  type: string;
  difficulty: string;
  title: string;
  question: string;
  answer: Record<string, string[]>;
  options: string[] | null;
  correctIndex: number | null;
  explanation: string;
}

const DIFF_MAP: Record<string, string> = {
  쉬움: 'easy',
  보통: 'medium',
  어려움: 'hard',
  easy: 'easy',
  medium: 'medium',
  hard: 'hard',
};

export function shuffleArray<T>(items: T[]): T[] {
  return [...items].sort(() => Math.random() - 0.5);
}

export function createExercisePool(count: number, diff: string, type: string): PracticeExercise[] {
  const bank = (problems as PracticeExercise[]) || [];
  let filtered = bank;
  const mappedDiff = DIFF_MAP[diff] || diff;
  if (mappedDiff && mappedDiff !== 'mixed') {
    filtered = filtered.filter((p) => p.difficulty === mappedDiff);
  }
  if (type && type !== 'mixed') {
    filtered = filtered.filter((p) => p.type === type);
  }
  const shuffled = shuffleArray(filtered);
  return shuffled.slice(0, Math.max(3, Math.min(90, count)));
}

export const PRACTICE_STATE_KEY = 'practiceState_rocky_user';

export function isExerciseCorrect(
  ex: PracticeExercise,
  idx: number,
  lang: string,
  userAnswers: number[],
  blankAnswers: string[][],
): boolean {
  if (ex.type === 'multiple_choice') return userAnswers[idx] === ex.correctIndex;
  if (ex.type === 'fill_blank') {
    const blanks = blankAnswers[idx] || [];
    const correct = ex.answer?.[lang] || [];
    return (
      blanks.length === correct.length &&
      blanks.every((b, i) => (b || '').trim().toLowerCase() === (correct[i] || '').trim().toLowerCase())
    );
  }
  if (ex.type === 'short_answer') {
    const ans = (blankAnswers[idx]?.[0] || '').trim().toLowerCase();
    return ans === (ex.answer?.[lang]?.[0] || '').trim().toLowerCase();
  }
  return false;
}
