import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, writeFile, rm, chmod } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

const execute = promisify(execFile);
export function createIsolatedRunner({ exec = execute, image = process.env.RUNNER_IMAGE || 'localhost/rezero-runner:1', binary = process.env.RUNNER_BINARY || 'podman', temporaryRoot = process.env.RUNNER_TEMP_DIR || tmpdir() } = {}) {
  let active = 0;
  let checkedAt = 0;
  let readiness;
  async function ready() {
    if (readiness && Date.now() - checkedAt < 10000) return readiness;
    checkedAt = Date.now();
    readiness = (async () => {
      const name = `rezero-ready-${randomUUID()}`;
      try {
        await exec(binary, ['run', '--rm', '--pull=never', '--name', name, '--network=none', '--read-only', '--user', '65534:65534', '--cap-drop=ALL', '--security-opt=no-new-privileges', '--cpus=1', '--memory=384m', '--pids-limit=64', '--entrypoint', '/usr/bin/python3', image, '-I', '-c', 'print("ready")'], { timeout: 5000, maxBuffer: 2048 });
        return true;
      } catch { return false; }
      finally { await exec(binary, ['rm', '--force', name], { timeout: 5000, maxBuffer: 2048 }).catch(() => undefined); }
    })();
    return readiness;
  }
  return {
    ready,
    async run({ code, language }) {
      if (!['JAVA', 'CPP', 'PYTHON'].includes(language) || typeof code !== 'string' || Buffer.byteLength(code) > 32000) {
        return { success: false, status: 'INVALID_SOURCE', output: '', error: '소스 코드 또는 언어가 올바르지 않습니다.', executionTime: 0 };
      }
      if (!await ready()) return { success: false, status: 'UNAVAILABLE', output: '', error: '실행 환경이 준비되지 않았습니다.', executionTime: 0 };
      if (active >= 2) return { success: false, status: 'BUSY', output: '', error: '실행 요청이 많습니다. 잠시 후 다시 시도해 주세요.', executionTime: 0 };
      active++;
      const started = Date.now();
      const name = `rezero-run-${randomUUID()}`;
      let directory;
      try {
        directory = await mkdtemp(path.join(temporaryRoot, 'rezero-run-'));
        await chmod(directory, 0o755);
        const file = language === 'JAVA' ? 'Main.java' : language === 'CPP' ? 'main.cpp' : 'main.py';
        await writeFile(path.join(directory, file), code, { mode: 0o644 });
        // The server may use umask 077. The container's non-root UID must read this file.
        await chmod(path.join(directory, file), 0o644);
        const args = ['run', '--rm', '--pull=never', '--name', name, '--network=none', '--read-only', '--cap-drop=ALL', '--security-opt=no-new-privileges',
          '--user', '65534:65534', '--cpus=1', '--memory=384m', '--memory-swap=384m', '--pids-limit=64', '--ulimit', 'fsize=16777216:16777216', '--ulimit', 'nofile=128:128',
          '--tmpfs', '/tmp:rw,noexec,nosuid,size=64m', '--tmpfs', '/work:rw,exec,nosuid,size=64m,mode=1777', '--volume', `${directory}:/source:ro,Z`, image, language];
        let result;
        try {
          const value = await exec(binary, args, { timeout: 18000, maxBuffer: 32768, killSignal: 'SIGKILL' });
          result = { success: true, status: 'SUCCESS', output: value.stdout, stdout: value.stdout, stderr: value.stderr, error: null };
        } catch (error) {
          const status = error.code === 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER' ? 'OUTPUT_LIMIT'
            : error.killed || error.signal || [124, 137].includes(error.code) ? 'TIMEOUT'
              : error.code === 10 ? 'COMPILE_ERROR' : error.code === 11 ? 'RUNTIME_ERROR' : 'UNAVAILABLE';
          const stderr = String(error.stderr || '').slice(0, 32768);
          result = { success: false, status, output: String(error.stdout || '').slice(0, 32768), stderr,
            error: status === 'UNAVAILABLE' ? '실행 환경에 연결할 수 없습니다.' : stderr || ({ OUTPUT_LIMIT: '출력 크기 제한을 초과했습니다.', TIMEOUT: '실행 시간 또는 자원 제한을 초과했습니다.' })[status] || '코드를 실행하지 못했습니다.' };
        }
        return { ...result, executionTime: Date.now() - started };
      } finally {
        // A killed Podman client can leave its container alive. Remove only our random name.
        await exec(binary, ['rm', '--force', name], { timeout: 5000, maxBuffer: 2048 }).catch(() => undefined);
        if (directory) await rm(directory, { recursive: true, force: true });
        active--;
      }
    },
  };
}

export const isolatedRunner = createIsolatedRunner();
