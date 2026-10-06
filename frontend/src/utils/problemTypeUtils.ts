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

const CODE_BUILD_BODY_PATTERN =
  /(?:\b(?:int|void|class|def|for|while|if|else|return|import|public|private|static|function|console|System|String|boolean|using|namespace|#include|cout|print)\b)/i;

function looksLikeMarkupOrStyle(question: string): boolean {
  if (/<\/?[a-z][^>]*>/i.test(question) && !/print\s*\(|cout\s*<<|System\.out|console\.log/.test(question)) {
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

/** 빌드 시스템 대상 — 실행 결과를 알 수 있는 코드 빈칸만. CSS/HTML 은 제외 */
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

  return CODE_BUILD_BODY_PATTERN.test(question);
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

export function problemSupportsLang(answer: Record<string, string[]> | undefined, langKey: string): boolean {
  return getProblemAnswersForLang(answer, langKey).length > 0;
}
