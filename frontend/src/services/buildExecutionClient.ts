import { ApiError, apiRequest } from './apiClient';
export type BuildLogLevel = 'info' | 'success' | 'warn' | 'error' | 'stdout';
export interface BuildLogLine { level: BuildLogLevel; text: string }
export interface BuildResult {
  success: boolean;
  status: string;
  output: string;
  stderr?: string;
  error: string | null;
  executionTime: number;
  buildsUsed: number;
  buildsAllowed: number;
}
export async function runCodeBuild(code: string, language: string, onLine: (line: BuildLogLine) => void,
  signal?: { cancelled: () => boolean }, context?: { matchId: string; problemIndex: number }): Promise<BuildResult | null> {
  const emit = (level: BuildLogLevel, text: string) => { if (!signal?.cancelled()) onLine({ level, text }); };
  const requestId = crypto.randomUUID();
  emit('info', `[build] ${language} 실행 중...`);
  let result: BuildResult;
  try {
    for (let attempt = 0; ; attempt++) {
      try {
        result = await apiRequest<BuildResult>('/build/execute', { method: 'POST', body: JSON.stringify({ code, language, requestId, ...context }), signal: AbortSignal.timeout(25000) }, { background: true });
        break;
      } catch (error) {
        if (attempt < 1 && error instanceof ApiError && (error.status === 0 || error.code === 'BUILD_IN_PROGRESS')) {
          await new Promise(resolve => setTimeout(resolve, 750));
          continue;
        }
        throw error;
      }
    }
    if (result.output) result.output.trimEnd().split('\n').forEach(line => emit('stdout', line));
    if (result.stderr && result.success) emit('warn', result.stderr);
    if (result.success) emit('success', `[build] SUCCESS (${(result.executionTime / 1000).toFixed(2)}s)`);
    else emit('error', `[${result.status}] ${result.error || '실행 결과를 확인해 주세요.'}`);
    return result;
  } catch (error) {
    emit('error', error instanceof Error ? error.message : '실행 결과를 받지 못했습니다.');
    return null;
  }
}
