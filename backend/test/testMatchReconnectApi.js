import assert from 'node:assert/strict';
import { io } from 'socket.io-client';
import { setTimeout as delay } from 'node:timers/promises';
import { pool } from '../src/config/dbConfig.js';
import { findMatchProblems } from '../src/api/battle/model.js';
import '../src/config/envConfig.js';
import { assertIsolatedTestTarget } from './isolatedTestGuard.js';

const base = process.env.TEST_BASE_URL || 'http://127.0.0.1:18082';
assertIsolatedTestTarget(base);
const sockets = [];
const password = 'ReconnectTest123!';
const suffix = Date.now().toString(36);

async function request(path, token, body) {
  const response = await fetch(base + '/api/v1' + path, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(5000),
  });
  return { status: response.status, data: response.status === 204 ? null : await response.json() };
}

async function expect(status, path, token, body) {
  const result = await request(path, token, body);
  assert.equal(result.status, status, path + ': ' + (result.data?.error?.code || ''));
  return result.data;
}

async function signup(label) {
  const username = 're_' + suffix + label;
  const user = await expect(201, '/auth/signup', null, { username, password, displayName: '복귀테스트' + suffix + label });
  return { ...user, username };
}

async function connect(token) {
  const socket = io(base, { auth: { token: 'Bearer ' + token }, transports: ['websocket'], reconnection: false, timeout: 5000 });
  sockets.push(socket);
  await new Promise((resolve, reject) => {
    socket.once('connect', resolve);
    socket.once('connect_error', reject);
  });
  return socket;
}

async function enterSocketRoom(socket, roomId) {
  assert.equal((await socket.timeout(5000).emitWithAck('join_room', { roomId: String(roomId) })).success, true);
}

async function start(host, guest, roundSeconds = 60, gameMode = 'normal') {
  const { id: roomId } = await expect(201, '/rooms', host.token, {
    roomTitle: '재접속 회귀 검증', playerMode: '1/1', gameMode,
    difficulty: '쉬움', language: 'PYTHON', roomPwd: '', problemCount: 3,
  });
  await expect(200, `/rooms/${roomId}/join`, guest.token, { language: 'PYTHON', character: 'char2' });
  const [hostSocket, guestSocket] = await Promise.all([connect(host.token), connect(guest.token)]);
  await Promise.all([enterSocketRoom(hostSocket, roomId), enterSocketRoom(guestSocket, roomId)]);
  assert.equal((await guestSocket.timeout(5000).emitWithAck('toggle_ready', { roomId, isReady: true })).success, true);
  await expect(200, `/rooms/${roomId}/start`, host.token, {});
  const { matchId } = await expect(201, '/matches/start', host.token, { roomId, roundSeconds });
  return { matchId, roomId, hostSocket, guestSocket };
}

async function until(action, label) {
  for (let attempt = 0; attempt < 32; attempt++) {
    const value = await action();
    if (value) return value;
    await delay(250);
  }
  assert.fail(label);
}

const target = async (token) => (await expect(200, '/matches/reconnect', token)).match;

try {
  const [host, guest, outsider] = await Promise.all([signup('a'), signup('b'), signup('c')]);
  await expect(401, '/matches/reconnect');
  const { matchId, roomId, hostSocket } = await start(host, guest);
  assert.equal(await target(outsider.token), null);
  await expect(403, `/build/session/${matchId}`, outsider.token);

  const draft = { matchId, version: 1, currentIndex: 1, codes: ['', 'draft', ''], blankAnswers: [[], ['draft'], []], selectedOptions: {} };
  await expect(200, '/build/session/save', host.token, draft);
  hostSocket.disconnect();
  const signedIn = await expect(200, '/auth/login', null, { username: host.username, password });
  const resumed = await target(signedIn.token);
  assert.equal(resumed.matchId, matchId);
  assert.equal(resumed.status, 'IN_PROGRESS');
  const socket = await connect(signedIn.token);
  await enterSocketRoom(socket, 'lobby');
  assert.equal((await expect(200, `/rooms/${roomId}`, signedIn.token)).status, 'STARTED');
  assert.deepEqual((await expect(200, `/build/session/${matchId}`, signedIn.token)).draft.codes, draft.codes);
  await enterSocketRoom(socket, roomId);

  await expect(200, `/matches/${matchId}/submit`, signedIn.token, { codes: draft.codes });
  assert.equal((await expect(200, `/build/session/${matchId}`, signedIn.token)).progress.finished, true);
  socket.disconnect();
  const finished = await expect(200, `/matches/${matchId}/submit`, guest.token, {});
  assert.equal(finished.resultReady, true);
  const again = await expect(200, '/auth/login', null, { username: host.username, password });
  assert.equal((await target(again.token)).status, 'FINISHED');
  const result = await expect(200, `/matches/${matchId}/ranking`, again.token);
  assert.equal(result.match.language, 'PYTHON');
  assert.equal(result.match.problems.length, 3);
  assert.deepEqual(result.players.find(player => player.id === host.user.id).codes, draft.codes);
  await expect(403, `/matches/${matchId}/ranking`, outsider.token);
  await expect(403, `/matches/${matchId}/submit`, outsider.token, {});
  await expect(204, `/matches/${matchId}/result-seen`, again.token, {});
  await expect(204, `/matches/${matchId}/result-seen`, again.token, {});
  assert.equal(await target(again.token), null);
  assert.equal((await target(guest.token)).matchId, matchId);
  console.log('PASS reconnect: active draft, roster, spectator, offline result, access, per-player acknowledgement');

  const [timedHost, timedGuest] = await Promise.all([signup('ta'), signup('tb')]);
  const timed = await start(timedHost, timedGuest, 4);
  const [problem] = await findMatchProblems(timed.matchId);
  const correctOption = problem.type === 'multiple_choice' ? problem.correctIndex : null;
  const blankAnswers = correctOption == null ? problem.answer.PYTHON : [];
  await expect(200, '/build/session/save', timedHost.token, {
    ...draft,
    matchId: timed.matchId,
    currentIndex: 0,
    codes: ['saved', '', ''],
    blankAnswers: [blankAnswers, [], []],
    selectedOptions: correctOption == null ? {} : { 0: correctOption },
  });
  timed.hostSocket.disconnect();
  timed.guestSocket.disconnect();

  const rankingPath = `/matches/${timed.matchId}/ranking`;
  const timedRanking = await until(async () => {
    const result = await request(rankingPath, timedHost.token);
    assert.ok([200, 409].includes(result.status));
    return result.status === 200 ? result.data : null;
  }, 'deadline worker did not finalize a fully disconnected match');
  assert.equal(timedRanking.players.find(player => player.id === timedHost.user.id).ingameScore, 100);
  assert.equal(timedRanking.players.find(player => player.id === timedGuest.user.id).ingameScore, 0);
  const balance = (await expect(200, '/users/me', timedHost.token)).gold;
  await Promise.all([timedHost, timedGuest].map(player => expect(200, `/matches/${timed.matchId}/submit`, player.token, { ingameScore: 999 })));
  assert.equal((await expect(200, '/users/me', timedHost.token)).gold, balance);
  assert.equal((await target(timedHost.token)).status, 'FINISHED');
  console.log('PASS deadline: both disconnected, saved answer graded, ranking persisted, retry without duplicate reward');

  const [itemHost, itemGuest] = await Promise.all([signup('ia'), signup('ib')]);
  const item = await start(itemHost, itemGuest, 25, 'item');
  await pool.query(`INSERT INTO user_items (user_id, item_key, quantity) VALUES (?, 'timeReduce', 1)
    ON DUPLICATE KEY UPDATE quantity = 1`, [itemHost.user.id]);
  item.guestSocket.disconnect();
  await expect(200, `/matches/${item.matchId}/items/use`, itemHost.token, {
    problemIndex: 0, itemKey: 'timeReduce', targetUserId: itemGuest.user.id,
  });
  await until(async () => (await expect(200, `/matches/${item.matchId}/pending`, itemGuest.token)).submitted, 'individual deadline not applied');
  const recovered = await expect(200, `/build/session/${item.matchId}`, itemGuest.token);
  assert.equal(recovered.remainingSeconds, 0);
  assert.equal(recovered.progress.finished, true);
  assert.equal((await target(itemGuest.token)).status, 'IN_PROGRESS');
  await expect(409, `/matches/${item.matchId}/answers`, itemGuest.token, { problemIndex: 0, answers: ['late'] });
  await expect(200, `/matches/${item.matchId}/submit`, itemHost.token, {});
  assert.equal((await target(itemGuest.token)).status, 'FINISHED');
  console.log('PASS item deadline: applied during disconnect, individual spectator recovery, late answer rejected');
} finally {
  for (const socket of sockets) socket.disconnect();
  await pool.end();
}
