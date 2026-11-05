import test from 'node:test';
import assert from 'node:assert/strict';
import { createSessionService } from '../src/api/build/sessionService.js';

function fixture() {
  const values = new Map();
  const match = { id: 'match-1', status: 'IN_PROGRESS', startedAt: 1000, roundSeconds: 120, problemCount: 2 };
  let time = 11000;
  const matches = {
    findMatchById: async id => id === match.id ? match : null,
    isMatchParticipant: async (_, id) => ['alice', 'bob'].includes(id),
    findMatchProblems: async () => [{ id: 'p1' }, { id: 'p2' }],
  };
  const redis = {
    get: async k => values.get(k) || null,
    hGetAll: async () => ({}), hGet: async () => null,
    eval: async (_, { keys: [k], arguments: [json, version] }) => {
      if (values.has(k) && JSON.parse(values.get(k)).version >= Number(version)) return 0;
      values.set(k, json); return 1;
    },
  };
  const service = createSessionService({ matches, redis, now: () => time });
  const draft = { matchId: 'match-1', version: 10, currentIndex: 1, codes: ['one', 'two'], blankAnswers: [['one'], ['two']], selectedOptions: { 1: 2 } };
  return { service, draft, match, matches, redis, advance: milliseconds => { time += milliseconds; } };
}

test('saves complete draft, isolates players, and derives remaining time from server', async () => {
  const { service, draft } = fixture();
  await service.save({ ...draft, userId: 'bob', remaining: 99999 }, 'alice');
  assert.deepEqual((await service.load('match-1', 'alice')).draft.codes, ['one', 'two']);
  assert.deepEqual((await service.load('match-1', 'alice')).draft.selectedOptions, { 1: 2 });
  assert.equal((await service.load('match-1', 'alice')).remainingSeconds, 110);
  assert.equal((await service.load('match-1', 'bob')).draft, null);
});

test('denies outsiders, missing matches and finished matches without storing', async () => {
  const { service, draft, match } = fixture();
  await assert.rejects(service.save(draft, 'outsider'), { status: 403 });
  await assert.rejects(service.save({ ...draft, matchId: 'missing' }, 'alice'), { status: 404 });
  match.status = 'FINISHED';
  await assert.rejects(service.save(draft, 'alice'), { code: 'MATCH_NOT_IN_PROGRESS' });
});

test('late writes cannot overwrite newer answers', async () => {
  const { service, draft } = fixture();
  await service.save({ ...draft, version: 11, codes: ['new', 'answer'] }, 'alice');
  await assert.rejects(service.save(draft, 'alice'), { code: 'DRAFT_VERSION_CONFLICT' });
  assert.deepEqual((await service.load(draft.matchId, 'alice')).draft.codes, ['new', 'answer']);
});

test('validates indices and payloads and reports storage failure', async () => {
  const { service, draft, redis } = fixture();
  for (const patch of [{ currentIndex: 2 }, { codes: ['x'] }, { selectedOptions: { 9: 0 } }, { version: Infinity }]) {
    await assert.rejects(service.save({ ...draft, ...patch }, 'alice'), { code: 'INVALID_DRAFT' });
  }
  redis.eval = async () => { throw new Error('offline'); };
  await assert.rejects(service.save(draft, 'alice'), { status: 503, code: 'DRAFT_STORAGE_UNAVAILABLE' });
});

test('reconnect cannot refill reduced time and finalized players cannot edit drafts', async () => {
  const { service, draft, advance, matches } = fixture();
  await service.save({ ...draft, remaining: 20 }, 'alice');
  advance(5000);
  assert.equal((await service.load(draft.matchId, 'alice')).remainingSeconds, 15);
  matches.findMatchSubmissions = async () => [{ userId: 'alice' }];
  await assert.rejects(service.save({ ...draft, version: 11 }, 'alice'), { code: 'MATCH_NOT_IN_PROGRESS' });
});
