import { renderForRoom } from '../build/previewRuntime';

export function countBlanks(partialCode: string): number {
  if (!partialCode) return 0;
  const matches = partialCode.match(/[a-zA-Z0-9_]*_____/g);
  return matches ? matches.length : 0;
}

export function assembleCode(partialCode: string, blanks: string[]): string {
  const codeStr = typeof partialCode === 'string' ? partialCode : '';
  if (!codeStr) return '';
  let blankIdx = 0;
  return codeStr.replace(/[a-zA-Z0-9_]*_____/g, () => {
    const ans = blanks[blankIdx] || '';
    blankIdx += 1;
    return ans;
  });
}

export function getLangKey(lang: string): string {
  const upper = lang.toUpperCase();
  if (upper === 'PYTHON') return 'PYTHON';
  if (upper === 'CPP' || upper === 'C++') return 'CPP';
  if (upper === 'HTML') return 'HTML';
  if (upper === 'CSS') return 'CSS';
  return 'JAVA';
}

/** 빌드 창은 방 언어로 보여주고, 빈칸을 채운 프로그램 전체 출력을 실행한다. */
export function buildPreviewSource(question: string, blanks: string[], lang: string): string {
  const key = getLangKey(lang);
  const filled = assembleCode(question || '', blanks);
  if (key === 'CSS' || key === 'HTML') return filled;
  return renderForRoom(filled, key);
}

export function getLangLabel(langKey: string): string {
  if (langKey === 'PYTHON') return 'python';
  if (langKey === 'CPP' || langKey === 'C++') return 'cpp';
  if (langKey === 'HTML') return 'html';
  if (langKey === 'CSS') return 'css';
  return 'java';
}

export const DEFAULT_TEMPLATE: Record<string, string> = {
  JAVA: "public class Main {\n    public static void main(String[] args) {\n        // 내 코드 작성\n    }\n}",
  PYTHON: "def solution():\n    # 내 코드 작성\n    pass\n\nif __name__ == '__main__':\n    solution()",
  CPP: "#include <iostream>\nusing namespace std;\n\nint main() {\n    // 내 코드 작성\n    return 0;\n}",
};

export const DIFFICULTY_MAP: Record<string, string> = {
  쉬움: 'easy',
  보통: 'medium',
  어려움: 'hard',
  EASY: 'easy',
  MEDIUM: 'medium',
  HARD: 'hard',
};

export const SECONDS_PER_PROBLEM = 120;

export function getSecondsPerProblem(_diff?: string): number {
  return SECONDS_PER_PROBLEM;
}

export function getTotalBattleSeconds(_diff: string, problemCount: number): number {
  return SECONDS_PER_PROBLEM * Math.max(1, problemCount);
}
