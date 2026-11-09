import assert from 'node:assert/strict';
import test from 'node:test';
import { fetchReconnectMatch } from '../src/services/matchService.ts';

test('retries a lost response with a new timeout and returns the confirmed match', async (t) => {
  const signals: AbortSignal[] = [];
  const match = { matchId: 'match-1', status: 'IN_PROGRESS' };
  t.mock.method(globalThis, 'fetch', async (_url: string, options: RequestInit) => {
    signals.push(options.signal!);
    if (signals.length === 1) throw new TypeError('connection closed');
    return Response.json({ match });
  });

  assert.deepEqual(await fetchReconnectMatch(new AbortController().signal), { match });
  assert.equal(signals.length, 2);
  assert.notEqual(signals[0], signals[1]);
});

test('retries invalid and temporary error responses but stops after three attempts', async (t) => {
  const fetch = t.mock.method(globalThis, 'fetch', async () => {
    if (fetch.mock.callCount() === 1) return new Response('invalid JSON');
    return new Response(null, { status: 503 });
  });

  await assert.rejects(fetchReconnectMatch(new AbortController().signal), { status: 503 });
  assert.equal(fetch.mock.callCount(), 3);
});

test('does not retry an authentication rejection or a cancelled lookup', async (t) => {
  const controller = new AbortController();
  const fetch = t.mock.method(globalThis, 'fetch', async () => new Response(null, { status: 401 }));
  await assert.rejects(fetchReconnectMatch(controller.signal), { status: 401 });

  controller.abort();
  await assert.rejects(fetchReconnectMatch(controller.signal), { name: 'AbortError' });
  assert.equal(fetch.mock.callCount(), 1);
});
