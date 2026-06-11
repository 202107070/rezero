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
  HTML: "<!DOCTYPE html>\n<html>\n<head>\n  <title>Document</title>\n</head>\n<body>\n  <!-- 내 마크업 작성 -->\n</body>\n</html>",
  CSS: "/* 내 스타일 작성 */\n.container {\n  \n}",
};

export const DIFFICULTY_MAP: Record<string, string> = {
  쉬움: 'easy',
  보통: 'medium',
  어려움: 'hard',
  EASY: 'easy',
  MEDIUM: 'medium',
  HARD: 'hard',
};

export function getSecondsPerProblem(diff: string): number {
  const upper = String(diff || '').toUpperCase();
  if (upper === 'EASY' || diff === '쉬움' || diff === 'easy') return 60;
  if (upper === 'HARD' || diff === '어려움' || diff === 'hard') return 180;
  return 120;
}

export function getTotalBattleSeconds(diff: string, problemCount: number): number {
  return getSecondsPerProblem(diff) * Math.max(1, problemCount);
}
