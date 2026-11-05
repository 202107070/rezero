import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createIsolatedRunner } from '../src/infra/docker/worker/isolatedRunner.js';

test('user source is passed only through a read-only file and runtime has resource/network limits', async () => {
  const commands = [];
  const source = 'print("literal $(not-a-shell-command)")';
  const runner = createIsolatedRunner({ exec: async (_binary, args) => {
    commands.push(args);
    if (args[0] === 'run' && args.includes('--volume')) {
      const mount = args[args.indexOf('--volume') + 1];
      assert.ok(mount.endsWith(':/source:ro,Z'));
      assert.equal(await readFile(mount.slice(0, -':/source:ro,Z'.length) + '/main.py', 'utf8'), source);
      for (const required of ['--network=none', '--read-only', '--cap-drop=ALL', '--security-opt=no-new-privileges', '--memory=384m', '--pids-limit=64', '--cpus=1', '/work:rw,exec,nosuid,size=64m,mode=1777']) assert.ok(args.includes(required));
      assert.equal(args[args.indexOf('--user') + 1], '65534:65534');
      assert.ok(!args.includes(source));
    }
    return { stdout: 'actual\n', stderr: '' };
  } });
  const result = await runner.run({ code: source, language: 'PYTHON' });
  assert.equal(result.status, 'SUCCESS'); assert.equal(result.output, 'actual\n');
  assert.ok(commands.some(args => args[0] === 'rm' && args[1] === '--force'));
});
test('compiler, runtime, time and output failures remain distinct and cleanup always runs', async () => {
  for (const [code, expected] of [[10, 'COMPILE_ERROR'], [11, 'RUNTIME_ERROR'], [124, 'TIMEOUT'], ['ERR_CHILD_PROCESS_STDIO_MAXBUFFER', 'OUTPUT_LIMIT'], [125, 'UNAVAILABLE']]) {
    let cleaned = false;
    const runner = createIsolatedRunner({ exec: async (_binary, args) => {
      if (args[0] === 'rm') { cleaned = true; return {}; }
      if (args.includes('--volume')) throw Object.assign(new Error('fixture'), { code, stderr: 'diagnostic' });
      return {};
    } });
    const result = await runner.run({ code: 'bad', language: 'PYTHON' });
    assert.equal(result.status, expected); assert.equal(result.success, false); assert.equal(cleaned, true);
  }
});
