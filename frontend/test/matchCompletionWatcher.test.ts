import test from 'node:test';
import assert from 'node:assert/strict';
import { watchMatchCompletion } from '../src/services/matchCompletionWatcher.ts';
const flush = () => new Promise(resolve => setImmediate(resolve));
test('a missed socket notification recovers through persisted state after a temporary request failure', async () => {
  const queue: Array<() => void> = [];
  let requests = 0, completed = 0;
  const stop = watchMatchCompletion({
    fetchPending: async () => { requests++; if (requests === 1) throw new Error('temporary'); return { resultReady: requests === 3 }; },
    onReady: () => { completed++; }, schedule: action => { queue.push(action); return () => {}; },
  });
  await flush(); assert.equal(completed, 0); queue.shift()!();
  await flush(); assert.equal(completed, 0); queue.shift()!();
  await flush(); assert.equal(completed, 1); assert.equal(queue.length, 0); stop();
});
test('leaving the match cancels pending completion without late navigation', async () => {
  let resolve!: (value: { resultReady: boolean }) => void;
  let completed = 0;
  const stop = watchMatchCompletion({ fetchPending: () => new Promise(done => { resolve = done; }), onReady: () => { completed++; } });
  stop(); resolve({ resultReady: true }); await flush(); assert.equal(completed, 0);
});
