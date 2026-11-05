import test from 'node:test';
import assert from 'node:assert/strict';
import { createExecutionService } from '../src/api/build/executionService.js';

function fixture() {
  const values = new Map(), hashes = new Map();
  const hash = key => { if (!hashes.has(key)) hashes.set(key, {}); return hashes.get(key); };
  const state = { calls: 0, ready: true, result: { success: true, status: 'SUCCESS', output: '1', error: null }, status: 'IN_PROGRESS', finished: false };
  const redis = {
    hGetAll: async key => ({ ...hash(key) }), get: async key => values.get(key),
    set: async (key, value) => values.set(key, value), incr: async key => { const n = Number(values.get(key) || 0) + 1; values.set(key, n); return n; }, expire: async () => 1,
    eval: async (script, { keys, arguments: args }) => {
      const [requestKey, usedKey, bonusKey] = keys;
      const [index, payload, mode] = args;
      const used = hash(usedKey);
      if (script.includes("return 'RESERVED'")) {
        if (values.has(requestKey)) return values.get(requestKey);
        if (Number(used[index] || 0) >= 3 + Number(hash(bonusKey)[index] || 0)) return 'LIMIT';
        used[index] = Number(used[index] || 0) + 1;
        values.set(requestKey, JSON.stringify({ state: 'PENDING', hash: payload }));
        return 'RESERVED';
      }
      if (mode === 'refund') used[index]--;
      values.set(requestKey, payload);
      return 1;
    },
  };
  const service = createExecutionService({ redis, now: () => 1000,
    matches: {
      findMatchById: async id => id === 'missing' ? null : ({ id, status: state.status, language: 'PYTHON', startedAt: 0, roundSeconds: 120 }),
      isMatchParticipant: async (_, user) => user === 'alice',
      findMatchSubmissions: async () => state.finished ? [{ userId: 'alice' }] : [],
      findMatchProblems: async () => [{ executionKind: 'body' }, {}],
    },
    runner: { ready: async () => state.ready, run: async () => { state.calls++; return state.result; } },
  });
  const input = { matchId: 'match', problemIndex: 0, language: 'PYTHON', code: 'print(1)', requestId: 'request-1' };
  return { service, state, input, hashes };
}
test('membership, match state, valid source and server language are checked before execution', async () => {
  const { service, state, input } = fixture();
  for (const [data, user, code] of [
    [input, 'bob', 'MATCH_PARTICIPANT_REQUIRED'], [{ ...input, matchId: 'missing' }, 'alice', 'MATCH_NOT_FOUND'],
    [{ ...input, language: 'JAVA' }, 'alice', 'PROBLEM_BUILD_UNSUPPORTED'], [{ ...input, problemIndex: 1 }, 'alice', 'PROBLEM_BUILD_UNSUPPORTED'],
    [{ ...input, code: '' }, 'alice', 'INVALID_BUILD_REQUEST'],
  ]) await assert.rejects(service.execute(data, user), { code });
  state.status = 'FINISHED';
  await assert.rejects(service.execute(input, 'alice'), { code: 'MATCH_NOT_IN_PROGRESS' });
  state.status = 'IN_PROGRESS'; state.finished = true;
  await assert.rejects(service.execute(input, 'alice'), { code: 'MATCH_ALREADY_SUBMITTED' });
  assert.equal(state.calls, 0);
});
test('concurrent retries execute once, completed requests are cached, and changed code conflicts', async () => {
  const { service, state, input } = fixture();
  const [a, b] = await Promise.all([service.execute(input, 'alice'), service.execute(input, 'alice')]);
  assert.deepEqual(a, b); assert.equal(state.calls, 1);
  assert.deepEqual(await service.execute(input, 'alice'), a);
  assert.equal(state.calls, 1);
  await assert.rejects(service.execute({ ...input, code: 'print(2)' }, 'alice'), { code: 'BUILD_REQUEST_CONFLICT' });
});
test('three builds plus server-granted bonus; environment failures refund the reserved count', async () => {
  const { service, state, input, hashes } = fixture();
  state.result = { success: false, status: 'BUSY', output: '', error: 'busy' };
  assert.equal((await service.execute(input, 'alice')).buildsUsed, 0);
  state.result = { success: false, status: 'COMPILE_ERROR', output: '', error: 'syntax' };
  for (let i = 1; i <= 3; i++) assert.equal((await service.execute({ ...input, requestId: `try-${i}` }, 'alice')).buildsUsed, i);
  await assert.rejects(service.execute({ ...input, requestId: 'over' }, 'alice'), { code: 'BUILD_LIMIT_REACHED' });
  hashes.set('battle:buildBonus:match:alice', { 0: '1' });
  assert.equal((await service.execute({ ...input, requestId: 'bonus' }, 'alice')).buildsAllowed, 4);
});
