import assert from 'node:assert/strict';
import { pool } from '../src/config/dbConfig.js';
import { redisClient } from '../src/config/redisConfig.js';

const base = new URL(process.env.TEST_BASE_URL || 'http://127.0.0.1:18082');
if (!String(process.env.DB_NAME).startsWith('rezero_stability_') ||
    base.hostname !== '127.0.0.1' || base.port !== '18082' || process.env.REDIS_PORT !== '16379') {
  await pool.end();
  throw new Error('분리된 stability 테스트 DB·Valkey·18082 포트에서만 실행할 수 있습니다.');
}

async function request(path, token, body) {
  const result = await fetch(new URL('/api/v1' + path, base), {
    method: body === undefined ? 'GET' : 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: result.status, data: await result.json() };
}

try {
  await redisClient.connect();
  const suffix = Date.now();
  async function signup(label) {
    const response = await request('/auth/signup', null, {
      username: `d_${label}_${suffix}`, displayName: `초안${label}${suffix}`, password: 'DraftTestOnly123!',
    });
    assert.equal(response.status, 201);
    return response.data;
  }
  const host = await signup('h'); const guest = await signup('g');
  const room = await request('/rooms', host.token, { roomTitle: '초안 격리 검증', playerMode: '1/1', gameMode: 'normal', difficulty: '쉬움', language: 'JAVA', roomPwd: '', problemCount: 3 });
  assert.equal(room.status, 201);
  const roomId = room.data.id;
  assert.equal((await request(`/rooms/${roomId}/join`, guest.token, { language: 'JAVA', character: 'char2' })).status, 200);
  await redisClient.sAdd(`room:${roomId}:ready`, guest.user.id);
  assert.equal((await request(`/rooms/${roomId}/start`, host.token, {})).status, 200);
  const started = await request('/matches/start', host.token, { roomId, roundSeconds: 300 });
  assert.equal(started.status, 201);
  const matchId = started.data.matchId;
  const draft = { matchId, version: 10, currentIndex: 1, codes: ['first', 'second', 'third'], blankAnswers: [['answer'], [], []], selectedOptions: { 1: 2 }, remaining: 99999 };
  assert.equal((await request('/build/session/save', null, draft)).status, 401);
  assert.equal((await request('/build/session/save', host.token, { ...draft, userId: guest.user.id })).status, 200);
  const restored = await request(`/build/session/${matchId}`, host.token);
  assert.equal(restored.status, 200);
  assert.deepEqual(restored.data.draft.codes, draft.codes);
  assert.deepEqual(restored.data.draft.selectedOptions, { 1: 2 });
  assert.ok(restored.data.remainingSeconds <= 300);
  assert.equal(restored.data.match.problems[0].answer, undefined);
  assert.equal((await request(`/build/session/${matchId}`, guest.token)).data.draft, null);
  const concurrent = await Promise.all([20, 21].map(version => request('/build/session/save', host.token, { ...draft, version })));
  assert.ok(concurrent.every(r => [200, 409].includes(r.status)));
  assert.equal((await request(`/build/session/${matchId}`, host.token)).data.draft.version, 21);
  assert.equal((await request('/build/session/save', host.token, draft)).status, 409);
  assert.equal((await request(`/matches/${matchId}/answers`, host.token, { problemIndex: 0, answers: ['int'] })).status, 200);
  const progress = (await request(`/build/session/${matchId}`, host.token)).data.progress;
  assert.equal(progress.submissions[0].index, 0);
  assert.deepEqual(progress.submissions[0].answers, ['int']);
  await pool.query("UPDATE matches SET status='FINISHED', finished_at=CURRENT_TIMESTAMP WHERE id=?", [matchId]);
  assert.equal((await request('/build/session/save', host.token, { ...draft, version: 22 })).status, 409);
  console.log('PASS session API: actual DB/Valkey, authentication, player isolation, atomic revisions, public snapshots, submitted progress, finished-match guard');
  console.log('TEST_MATCH_ID', matchId);
} finally {
  if (redisClient.isOpen) await redisClient.quit();
  await pool.end();
}
