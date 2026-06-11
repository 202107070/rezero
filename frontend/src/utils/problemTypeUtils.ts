export const PROBLEM_TYPES = {
  FILL_BLANK: 'fill_blank',
  VISUAL_FILL_BLANK: 'visual_fill_blank',
  MULTIPLE_CHOICE: 'multiple_choice',
  SHORT_ANSWER: 'short_answer',
} as const;

export type ProblemType = (typeof PROBLEM_TYPES)[keyof typeof PROBLEM_TYPES] | string;

export function isBlankBasedType(type: string | undefined): boolean {
  return type === PROBLEM_TYPES.FILL_BLANK || type === PROBLEM_TYPES.VISUAL_FILL_BLANK;
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

export function problemSupportsLang(answer: Record<string, string[]> | undefined, langKey: string): boolean {
  if (!answer) return false;
  return Array.isArray(answer[langKey]) && answer[langKey].length > 0;
}
