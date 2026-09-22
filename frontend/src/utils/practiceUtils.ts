import problems from '../data/problems.js';
import type { ProblemVisual } from '../types/battle';
import { isBlankBasedType, problemSupportsLang } from './problemTypeUtils';

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
  visual?: ProblemVisual | null;
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

/** Normalize blank markers and coerce fill_blank ↔ short_answer like battle problems. */
export function normalizePracticeExercise(exercise: PracticeExercise): PracticeExercise {
  let question = exercise.question || '';
  // 4 underscores (and 3+) → canonical _____ for blank detection / rendering
  question = question.replace(/_{3,}/g, '_____');

  const hasBlanks = (question.match(/_____/g) || []).length > 0;
  const rawType = String(exercise.type || '')
    .trim()
    .toLowerCase()
    .replace(/-/g, '_');

  let type = exercise.type;

  if (
    rawType === 'multiple_choice' ||
    rawType === 'multiplechoice' ||
    (Array.isArray(exercise.options) && exercise.options.length > 0 && exercise.correctIndex != null)
  ) {
    type = 'multiple_choice';
  } else if (rawType === 'short_answer' || rawType === 'shortanswer' || rawType === '주관식') {
    type = hasBlanks ? 'fill_blank' : 'short_answer';
  } else if (rawType === 'fill_blank' || rawType === 'fillblank' || rawType === '빈칸') {
    type = hasBlanks ? 'fill_blank' : 'short_answer';
  } else if (!rawType) {
    type = hasBlanks ? 'fill_blank' : 'short_answer';
  } else if (hasBlanks) {
    type = 'fill_blank';
  } else {
    type = 'short_answer';
  }

  return { ...exercise, question, type };
}

export function createExercisePool(count: number, diff: string, type: string, langKey?: string): PracticeExercise[] {
  const bank = (problems as PracticeExercise[]) || [];
  let filtered = bank;
  const mappedDiff = DIFF_MAP[diff] || diff;
  if (mappedDiff && mappedDiff !== 'mixed') {
    filtered = filtered.filter((p) => p.difficulty === mappedDiff);
  }
  if (type && type !== 'mixed') {
    filtered = filtered.filter((p) => p.type === type);
  }
  if (langKey) {
    filtered = filtered.filter((p) => problemSupportsLang(p.answer, langKey));
  }
  const shuffled = shuffleArray(filtered);
  return shuffled.slice(0, Math.max(3, Math.min(90, count))).map(normalizePracticeExercise);
}

export function isExerciseCorrect(
  ex: PracticeExercise,
  idx: number,
  lang: string,
  userAnswers: number[],
  blankAnswers: string[][],
): boolean {
  if (ex.type === 'multiple_choice') return userAnswers[idx] === ex.correctIndex;
  const blankCount = (ex.question?.match(/_____/g) || []).length;
  if (isBlankBasedType(ex.type) || (ex.type === 'short_answer' && blankCount > 0)) {
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
