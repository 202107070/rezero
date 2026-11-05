import test from 'node:test';
import assert from 'node:assert/strict';
import { preserveDraft, readLocalDraft, saveDraft, closeDraftWriter } from '../src/services/battleDraftClient';
import { setAccessToken } from '../src/services/apiClient';

const storage = new Map<string, string>();
Object.defineProperty(globalThis, 'sessionStorage', { value: { getItem: (k: string) => storage.get(k) || null, setItem: (k: string, v: string) => storage.set(k, v) }, configurable: true });
setAccessToken('test-token');
const makeDraft = (matchId: string) => preserveDraft('alice', { matchId, currentIndex: 0, codes: ['answer'], blankAnswers: [['a']], selectedOptions: { 0: 2 }, remaining: 60 });

test('sends bearer token and all draft fields, waits for acknowledged version', async () => {
  const original = globalThis.fetch;
  const draft = makeDraft('client-success');
  let calls = 0;
  globalThis.fetch = async (url, options) => {
    calls++;
    assert.equal(url, '/api/v1/build/session/save');
    assert.equal(new Headers(options?.headers).get('Authorization'), 'Bearer test-token');
    assert.deepEqual(JSON.parse(String(options?.body)).selectedOptions, { 0: 2 });
    return new Response(JSON.stringify({ saved: true, version: draft.version }), { status: 200 });
  };
  try {
    assert.equal(await saveDraft('alice', draft), true);
    assert.equal(await saveDraft('alice', draft), true);
    assert.equal(calls, 1);
    assert.equal(readLocalDraft('bob', draft.matchId), null);
  } finally { globalThis.fetch = original; }
});

test('401 is not successful and does not cause an infinite retry loop', async () => {
  const original = globalThis.fetch;
  const draft = makeDraft('client-unauthorized');
  let calls = 0;
  globalThis.fetch = async () => { calls++; return new Response(JSON.stringify({ error: { code: 'TOKEN_REQUIRED' } }), { status: 401 }); };
  try {
    assert.equal(await saveDraft('alice', draft), false);
    assert.equal(await saveDraft('alice', draft), false);
    assert.equal(calls, 1);
    assert.deepEqual(readLocalDraft('alice', draft.matchId)?.codes, ['answer']);
  } finally { globalThis.fetch = original; }
});

test('transient storage failure retries and closed matches make no requests', async () => {
  const original = globalThis.fetch;
  const draft = makeDraft('client-retry');
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    return calls < 2 ? new Response('{}', { status: 503 }) : new Response(JSON.stringify({ saved: true, version: draft.version }));
  };
  try {
    assert.equal(await saveDraft('alice', draft), true);
    assert.equal(calls, 2);
    closeDraftWriter('alice', draft.matchId);
    assert.equal(await saveDraft('alice', draft), false);
    assert.equal(calls, 2);
  } finally { globalThis.fetch = original; }
});

test('local storage distinguishes matches and preserves selection after memory is lost', () => {
  const draft = makeDraft('client-reload');
  const copy = JSON.parse(storage.get(`rezero:draft:v1:alice:${draft.matchId}`)!);
  assert.deepEqual(copy.blankAnswers, [['a']]);
  assert.deepEqual(copy.selectedOptions, { 0: 2 });
  assert.equal(readLocalDraft('alice', 'other-match'), null);
});
