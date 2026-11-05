import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { createBuildRouter } from '../src/api/build/router.js';
import { createSessionService } from '../src/api/build/sessionService.js';
import { errorHandler, notFoundHandler } from '../src/handler/errorHandler.js';

process.env.JWT_SECRET = 'isolated-session-route-test-only';
const { authenticate } = await import('../src/middleware/authMiddleware.js');
const { createAccessToken } = await import('../src/utils/cryptoUtils.js');

test('authenticated session HTTP API saves, restores, hides answers, and checks membership', async () => {
  const values = new Map();
  const sessions = createSessionService({
    matches: {
      findMatchById: async () => ({ id: 'match-test', status: 'IN_PROGRESS', startedAt: Date.now(), roundSeconds: 120, problemCount: 1 }),
      isMatchParticipant: async (_, userId) => userId === 'alice',
      findMatchProblems: async () => [{ id: 'p1', question: 'secret _____', answer: { PYTHON: ['solution'] }, correctIndex: 2 }],
    },
    redis: {
      eval: async (_, { keys: [key], arguments: [json] }) => { values.set(key, json); return 1; },
      get: async key => values.get(key) || null, hGetAll: async () => ({}), hGet: async () => null,
    },
  });
  const app = express();
  app.use(express.json());
  app.use('/api/v1', createBuildRouter({ sessions, authenticate }));
  app.use(notFoundHandler); app.use(errorHandler);
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve, reject) => { server.once('listening', resolve); server.once('error', reject); });
  const url = `http://127.0.0.1:${server.address().port}/api/v1/build/session`;
  const draft = { matchId: 'match-test', version: 1, currentIndex: 0, codes: ['code'], blankAnswers: [['my answer']], selectedOptions: {} };
  const headers = userId => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${createAccessToken(userId)}` });
  try {
    assert.equal((await fetch(url + '/save', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(draft) })).status, 401);
    assert.equal((await fetch(url + '/save', { method: 'POST', headers: headers('bob'), body: JSON.stringify(draft) })).status, 403);
    assert.equal((await fetch(url + '/save', { method: 'POST', headers: headers('alice'), body: JSON.stringify(draft) })).status, 200);
    const loaded = await fetch(url + '/match-test', { headers: headers('alice') });
    assert.equal(loaded.status, 200);
    const result = await loaded.json();
    assert.deepEqual(result.draft.blankAnswers, [['my answer']]);
    assert.equal(result.match.problems[0].answer, undefined);
    assert.equal(result.match.problems[0].correctIndex, undefined);
  } finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
});
