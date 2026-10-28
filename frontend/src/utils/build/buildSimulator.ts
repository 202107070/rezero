import { runPreviewProgram } from './previewRuntime';

export type BuildLogLevel = 'info' | 'success' | 'warn' | 'error' | 'stdout';

export interface BuildLogLine {
  level: BuildLogLevel;
  text: string;
}

const LANG_LABEL: Record<string, string> = {
  JAVA: 'Java',
  PYTHON: 'Python',
  CPP: 'C++',
  HTML: 'HTML',
  CSS: 'CSS',
};

function extractProgramOutput(code: string, lang: string): string[] {
  return runPreviewProgram(code, lang);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function countChar(text: string, ch: string) {
  return [...text].filter((c) => c === ch).length;
}

function detectIssues(code: string, lang: string): string[] {
  const issues: string[] = [];
  const trimmed = code.trim();

  if (!trimmed) {
    issues.push('소스 코드가 비어 있습니다.');
    return issues;
  }

  if (lang === 'JAVA' || lang === 'CPP') {
    const open = countChar(code, '{');
    const close = countChar(code, '}');
    if (open !== close) issues.push(`중괄호 불일치: '{' ${open}개, '}' ${close}개`);
  }

  if (lang === 'PYTHON') {
    const lines = code.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (/:\s*$/.test(line) && lines[i + 1] !== undefined && lines[i + 1].trim() && !/^\s+/.test(lines[i + 1])) {
        issues.push(`들여쓰기 오류 가능성 (line ${i + 1})`);
        break;
      }
    }
  }

  if (lang === 'HTML') {
    if (!/<html[\s>]/i.test(code)) issues.push('<html> 태그가 없습니다.');
    if (!/<\/html>/i.test(code)) issues.push('</html> 닫는 태그가 없습니다.');
  }

  if (lang === 'CSS') {
    const open = countChar(code, '{');
    const close = countChar(code, '}');
    if (open !== close) issues.push(`중괄호 불일치: '{' ${open}개, '}' ${close}개`);
  }

  return issues;
}

export async function runBuildSimulation(
  code: string,
  lang: string,
  onLine: (line: BuildLogLine) => void,
  signal?: { cancelled: () => boolean },
): Promise<'success' | 'error'> {
  const label = LANG_LABEL[lang] || lang;
  const startedAt = Date.now();
  const lines = code.split('\n');

  const emit = async (line: BuildLogLine, delayMs = 45) => {
    if (signal?.cancelled()) return;
    onLine(line);
    await sleep(delayMs);
  };

  await emit({ level: 'info', text: `[build] ${label} 빌드 시작...` });
  await emit({ level: 'info', text: `[build] 소스 ${lines.length}줄 분석 중` });
  await emit({ level: 'info', text: '[build] 의존성 확인... OK' });
  await emit({ level: 'info', text: `[build] 컴파일러: ${label} (preview)` });

  const issues = detectIssues(code, lang);
  if (issues.length > 0) {
    for (const issue of issues) {
      await emit({ level: 'error', text: `[error] ${issue}` }, 60);
    }
    const elapsed = ((Date.now() - startedAt) / 1000).toFixed(2);
    await emit({ level: 'error', text: `[build] FAILED (${elapsed}s)` }, 30);
    return 'error';
  }

  await emit({ level: 'info', text: '[build] 구문 검사 통과' });

  if (lang === 'HTML' || lang === 'CSS') {
    await emit({ level: 'info', text: `[build] ${label} 마크업/스타일 검사 완료` });
    const elapsed = ((Date.now() - startedAt) / 1000).toFixed(2);
    await emit({ level: 'success', text: `[build] SUCCESS (${elapsed}s)` }, 30);
    return 'success';
  }

  await emit({ level: 'stdout', text: '--- program output (preview) ---' }, 30);

  let outputs: string[] = [];
  let previewError = '';
  try {
    outputs = extractProgramOutput(code, lang);
  } catch (error) {
    previewError = error instanceof Error ? error.message : '출력 미리보기에 실패했습니다.';
  }
  if (previewError) {
    await emit({ level: 'warn', text: `[warn] 미리보기: ${previewError}` }, 40);
    await emit({ level: 'stdout', text: '(미리보기 생략 — 구문 검사는 통과)' }, 30);
  } else if (outputs.length === 0) {
    await emit({ level: 'stdout', text: '(실행 출력 없음)' }, 40);
  } else {
    for (const line of outputs) {
      await emit({ level: 'stdout', text: line.length > 0 ? line : ' ' }, 40);
    }
  }

  const elapsed = ((Date.now() - startedAt) / 1000).toFixed(2);
  await emit({ level: 'success', text: `[build] SUCCESS (${elapsed}s)` }, 30);
  return 'success';
}
