import { resolveProblemStyle } from './problemCapabilities';

export const PROBLEM_TYPES = {
  FILL_BLANK: 'fill_blank',
  VISUAL_FILL_BLANK: 'visual_fill_blank',
  MULTIPLE_CHOICE: 'multiple_choice',
  SHORT_ANSWER: 'short_answer',
} as const;

export type ProblemType = (typeof PROBLEM_TYPES)[keyof typeof PROBLEM_TYPES] | string;

export function isBlankBasedType(type: string | undefined): boolean {
  return resolveProblemStyle(type) === 'code';
}

function looksLikeMarkupOrStyle(question: string): boolean {
  const htmlTag =
    /<\/[a-z][^>]*>/i.test(question) ||
    /<(div|span|p|h[1-6]|ul|ol|li|a|img|table|head|body|html|br|input|title|button)\b/i.test(question);
  if (htmlTag && !/print\s*\(|cout\s*<<|System\.out|console\.log|#include\b/.test(question)) {
    return true;
  }
  if (
    /[{;][^}]*:\s*[^;]+;/.test(question) &&
    /\b(color|font|margin|padding|display|background|width|height)\b/i.test(question) &&
    !/print\s*\(|cout\s*<<|System\.out/.test(question)
  ) {
    return true;
  }
  return false;
}

function hasRunnablePreview(question: string): boolean {
  const hasOutput = /System\.out\.print|print\s*\(|cout\s*<</.test(question);
  const hasLoop = /\bfor\s*\(|\bfor\s+[A-Za-z_]\w*\s+in\s+range\s*\(/.test(question);
  return hasOutput && hasLoop;
}

/** 반복 출력으로 정답을 시험할 수 있는 코드 빈칸만 빌드 시스템을 붙인다. */
export function isCodeBlankBuildProblem(
  problem?: {
    type?: string;
    question?: string;
  } | null,
  langKey?: string,
): boolean {
  if (!problem || !isBlankBasedType(problem.type)) return false;

  const lang = String(langKey || '').toUpperCase();
  if (lang === 'CSS' || lang === 'HTML') return false;

  const question = problem.question || '';
  if (!/_____/.test(question)) return false;
  if (looksLikeMarkupOrStyle(question)) return false;
  return hasRunnablePreview(question);
}

export function getProblemTypeLabel(type: string): string {
  switch (type) {
    case PROBLEM_TYPES.FILL_BLANK:
      return '빈칸채우기';
    case PROBLEM_TYPES.VISUAL_FILL_BLANK:
      return '그림 맞추기';
    case PROBLEM_TYPES.MULTIPLE_CHOICE:
      return '객관식';
    case PROBLEM_TYPES.SHORT_ANSWER:
      return '주관식';
    default:
      return type;
  }
}

const ANSWER_LANG_FALLBACK_ORDER = ['JAVA', 'PYTHON', 'CPP', 'HTML', 'CSS'] as const;

export function getProblemAnswersForLang(
  answer: Record<string, string[]> | undefined,
  langKey: string,
): string[] {
  if (!answer) return [];

  const preferred = [langKey, ...ANSWER_LANG_FALLBACK_ORDER].filter(
    (key, index, arr) => arr.indexOf(key) === index,
  );

  for (const key of preferred) {
    const vals = answer[key];
    if (Array.isArray(vals) && vals.length > 0) return vals;
  }

  for (const vals of Object.values(answer)) {
    if (Array.isArray(vals) && vals.length > 0) return vals;
  }

  return [];
}

/** 공백·대소문자를 무시하고 정답을 비교한다. "stack overflow"와 "StackOverflow"는 같은 답이다. */
export function looseAnswerEqual(user: unknown, expected: unknown): boolean {
  const normalize = (value: unknown) =>
    String(value ?? '')
      .replace(/\u00a0/g, ' ')
      .replace(/\s+/g, '')
      .toLowerCase();
  const left = normalize(user);
  const right = normalize(expected);
  return left.length > 0 && left === right;
}

export function problemSupportsLang(answer: Record<string, string[]> | undefined, langKey: string): boolean {
  if (!answer) return false;
  const key = String(langKey || '').toUpperCase();
  const vals = answer[key];
  return Array.isArray(vals) && vals.length > 0;
}
