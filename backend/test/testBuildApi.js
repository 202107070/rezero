import assert from 'node:assert/strict';
import { pool } from '../src/config/dbConfig.js';
import { redisClient } from '../src/config/redisConfig.js';
import { readProblemFixture } from './problemFixture.js';
import { applyLanguageVariant } from '../src/api/problem/variants.js';

const base = new URL(process.env.TEST_BASE_URL || 'http://127.0.0.1:18082');
if (!String(process.env.DB_NAME).startsWith('rezero_stability_') || base.hostname !== '127.0.0.1' || base.port !== '18082' || process.env.REDIS_PORT !== '16379') {
  await pool.end(); throw new Error('Only isolated stability DB/Valkey/18082 are allowed');
}
async function request(path, token, body) {
  const response = await fetch(new URL('/api/v1' + path, base), { method: body === undefined ? 'GET' : 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
  return { status: response.status, data: await response.json() };
}
try {
  await redisClient.connect();
  const suffix = Date.now();
  const people = [];
  for (const name of ['h', 'g', 'o']) {
    const response = await request('/auth/signup', null, { username: `b_${name}_${suffix}`, displayName: `빌드${name}${suffix}`, password: 'BuildTestOnly123!' });
    assert.equal(response.status, 201); people.push(response.data);
  }
  const [host, guest, outsider] = people;
  const room = await request('/rooms', host.token, { roomTitle: '빌드 격리 검증', playerMode: '1/1', gameMode: 'item', difficulty: '보통', language: 'PYTHON', roomPwd: '', problemCount: 3 });
  assert.equal(room.status, 201);
  const roomId = room.data.id;
  assert.equal((await request(`/rooms/${roomId}/join`, guest.token, { language: 'PYTHON', character: 'char2' })).status, 200);
  await redisClient.sAdd(`room:${roomId}:ready`, guest.user.id);
  assert.equal((await request(`/rooms/${roomId}/start`, host.token, {})).status, 200);
  const started = await request('/matches/start', host.token, { roomId, roundSeconds: 600 });
  assert.equal(started.status, 201);
  const matchId = started.data.matchId;
  const problem = applyLanguageVariant(readProblemFixture().find(p => p.id === 'V07'), 'PYTHON');
  await pool.query('UPDATE match_problems SET problem_id=?, problem_snapshot=? WHERE match_id=? AND problem_index=0', [problem.id, JSON.stringify(problem), matchId]);
  const input = { matchId, problemIndex: 0, language: 'PYTHON', code: 'print("actual-python")', requestId: 'first' };
  assert.equal((await request('/build/execute', null, input)).status, 401);
  assert.equal((await request('/build/execute', outsider.token, input)).status, 403);
  const responses = await Promise.all([1, 2].map(() => request('/build/execute', host.token, input)));
  assert.deepEqual(responses[0], responses[1]);
  assert.equal(responses[0].status, 200); assert.equal(responses[0].data.status, 'SUCCESS');
  assert.equal(responses[0].data.output, 'actual-python\n'); assert.equal(responses[0].data.buildsUsed, 1);
  assert.equal((await request('/build/execute', host.token, { ...input, code: 'print(2)' })).status, 409);
  const syntax = await request('/build/execute', host.token, { ...input, requestId: 'syntax', code: 'print(' });
  assert.equal(syntax.data.status, 'COMPILE_ERROR'); assert.equal(syntax.data.success, false);
  const runtime = await request('/build/execute', host.token, { ...input, requestId: 'runtime', code: 'raise RuntimeError("fixture")' });
  assert.equal(runtime.data.status, 'RUNTIME_ERROR'); assert.equal(runtime.data.buildsUsed, 3);
  assert.equal((await request('/build/execute', host.token, { ...input, requestId: 'over' })).data.error.code, 'BUILD_LIMIT_REACHED');
  const bonus = await request(`/matches/${matchId}/items/use`, host.token, { problemIndex: 0, itemKey: 'buildCharge' });
  assert.equal(bonus.status, 200);
  const charged = await request('/build/execute', host.token, { ...input, requestId: 'charged' });
  assert.equal(charged.data.success, true); assert.equal(charged.data.buildsUsed, 4); assert.equal(charged.data.buildsAllowed, 4);
  const restored = await request(`/build/session/${matchId}`, host.token);
  assert.equal(Number(restored.data.buildState.used[0]), 4); assert.equal(Number(restored.data.buildState.bonus[0]), 1);
  const own = await request('/build/execute', guest.token, { ...input, requestId: 'guest' });
  assert.equal(own.data.buildsUsed, 1);
  await pool.query("UPDATE matches SET status='FINISHED', finished_at=CURRENT_TIMESTAMP WHERE id=?", [matchId]);
  assert.equal((await request('/build/execute', host.token, { ...input, requestId: 'finished' })).status, 409);
  for (const [language, key, problemId, expected] of [['JAVA', 'j', 'LJ01', 'hello'], ['C++', 'c', 'LC01', 'hi']]) {
    const pair = [];
    for (const label of ['h', 'g']) {
      const person = await request('/auth/signup', null, { username: `b_${key}${label}_${suffix}`, displayName: `빌드${key}${label}${suffix}`, password: 'BuildTestOnly123!' });
      assert.equal(person.status, 201); pair.push(person.data);
    }
    const [a, b] = pair;
    const nextRoom = await request('/rooms', a.token, { roomTitle: '언어 실행 검증', playerMode: '1/1', gameMode: 'normal', difficulty: '쉬움', language, roomPwd: '', problemCount: 3 });
    assert.equal(nextRoom.status, 201);
    const id = nextRoom.data.id;
    assert.equal((await request(`/rooms/${id}/join`, b.token, { language, character: 'char2' })).status, 200);
    await redisClient.sAdd(`room:${id}:ready`, b.user.id);
    assert.equal((await request(`/rooms/${id}/start`, a.token, {})).status, 200);
    const created = await request('/matches/start', a.token, { roomId: id, roundSeconds: 600 });
    assert.equal(created.status, 201);
    const variant = applyLanguageVariant(readProblemFixture().find(p => p.id === problemId), language === 'C++' ? 'CPP' : language);
    await pool.query('UPDATE match_problems SET problem_id=?, problem_snapshot=? WHERE match_id=? AND problem_index=0', [variant.id, JSON.stringify(variant), created.data.matchId]);
    let blank = 0;
    const source = variant.question.replace(/_{5,}/g, () => variant.answer[variant.language][blank++]);
    const result = await request('/build/execute', a.token, { matchId: created.data.matchId, problemIndex: 0, language, code: source, requestId: 'language-smoke' });
    assert.equal(result.status, 200); assert.equal(result.data.status, 'SUCCESS', result.data.error);
    assert.equal(result.data.output.trim(), expected);
    await pool.query("UPDATE matches SET status='FINISHED', finished_at=CURRENT_TIMESTAMP WHERE id=?", [created.data.matchId]);
  }
  console.log('PASS build API: real DB/Valkey/Podman, auth, source execution, concurrent retry, conflict, errors, quota, item bonus, restore, player isolation, finished-match guard');
} finally {
  if (redisClient.isOpen) await redisClient.quit();
  await pool.end();
}
