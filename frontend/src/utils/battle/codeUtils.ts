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

/** 문제 본문에 언어가 드러나면 방 언어보다 그 언어를 따른다. */
export function detectBuildLang(question: string, roomLang: string): string {
  const text = question || '';
  if (/#include\b|std::cout|\bcout\s*<</.test(text)) return 'CPP';
  if (/System\.out|public\s+class\b/.test(text)) return 'JAVA';
  if (/\bdef\s+\w+\s*\(|\bprint\s*\(/.test(text) && !/System\.out|cout\s*<</.test(text)) return 'PYTHON';
  return getLangKey(roomLang);
}

function hasOutputCall(code: string, lang: string): boolean {
  if (lang === 'PYTHON') return /print\s*\(/.test(code);
  if (lang === 'CPP') return /cout\s*<</.test(code);
  if (lang === 'JAVA') return /System\.out\.println\s*\(/.test(code);
  return false;
}

/** 빈칸은 문제와 같고, 출력문은 언어에 맞게 붙여 준다. */
export function buildPreviewSource(question: string, blanks: string[], lang: string): string {
  const key = detectBuildLang(question, lang);
  const filled = assembleCode(question || '', blanks);
  if (key === 'CSS' || key === 'HTML') return filled;
  if (hasOutputCall(filled, key)) return filled;
  const values = (blanks || []).map((blank) => String(blank || '').trim()).filter(Boolean);
  const printed = values.length > 0 ? values.join(' ') : filled.trim();
  const literal = JSON.stringify(printed);
  if (key === 'PYTHON') return `${filled}\nprint(${literal})`;
  if (key === 'CPP') return `${filled}\ncout << ${literal};`;
  return `${filled}\nSystem.out.println(${literal});`;
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
