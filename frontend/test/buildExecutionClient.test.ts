import test from 'node:test';
import assert from 'node:assert/strict';
import { runCodeBuild } from '../src/services/buildExecutionClient.ts';
import { setAccessToken } from '../src/services/apiClient.ts';

test('real build sends authenticated match context and preserves request ID when retrying', async () => {
  setAccessToken('build-test-token');
  const requests: Record<string, unknown>[] = [];
  const logs: string[] = [];
  globalThis.fetch = async (_url, options) => {
    assert.equal(new Headers(options?.headers).get('Authorization'), 'Bearer build-test-token');
    requests.push(JSON.parse(String(options?.body)));
    if (requests.length === 1) throw new Error('network');
    return new Response(JSON.stringify({ success: true, status: 'SUCCESS', output: 'actual output\n', error: null, executionTime: 25, buildsUsed: 1, buildsAllowed: 3 }));
  };
  const result = await runCodeBuild('print(1)', 'PYTHON', line => logs.push(line.text), undefined, { matchId: 'm1', problemIndex: 2 });
  assert.equal(result?.success, true);
  assert.equal(requests[0].requestId, requests[1].requestId);
  assert.equal(requests[0].matchId, 'm1');
  assert.ok(logs.includes('actual output'));
});
test('a compiler error or HTTP failure never produces a success log', async () => {
  const logs: string[] = [];
  globalThis.fetch = async () => new Response(JSON.stringify({ success: false, status: 'COMPILE_ERROR', output: '', error: 'SyntaxError', executionTime: 1, buildsUsed: 1, buildsAllowed: 3 }));
  assert.equal((await runCodeBuild('bad', 'PYTHON', line => logs.push(line.text)))?.success, false);
  globalThis.fetch = async () => new Response(JSON.stringify({ error: { code: 'BUILD_UNAVAILABLE', message: 'unavailable' } }), { status: 503 });
  assert.equal(await runCodeBuild('bad', 'PYTHON', line => logs.push(line.text)), null);
  assert.ok(!logs.some(line => line.includes('SUCCESS')));
});
test('HTTP origins without crypto.randomUUID can still create idempotent build requests', async () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'crypto');
  Object.defineProperty(globalThis, 'crypto', { configurable: true, value: { getRandomValues: (bytes: Uint8Array) => bytes.fill(42) } });
  try {
    globalThis.fetch = async (_url, options) => {
      assert.match(JSON.parse(String(options?.body)).requestId, /^[a-f0-9]{32}$/);
      return new Response(JSON.stringify({ success: true, status: 'SUCCESS', output: '', error: null, executionTime: 1, buildsUsed: 1, buildsAllowed: 3 }));
    };
    assert.equal((await runCodeBuild('print(1)', 'PYTHON', () => {}))?.success, true);
  } finally { if (descriptor) Object.defineProperty(globalThis, 'crypto', descriptor); }
});
