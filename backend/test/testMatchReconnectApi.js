import assert from 'node:assert/strict';
import { io } from 'socket.io-client';
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

async function start(host, guest, roundSeconds = 60) {
  const { id: roomId } = await expect(201, '/rooms', host.token, {
    roomTitle: '재접속 회귀 검증', playerMode: '1/1', gameMode: 'normal',
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
} finally {
  for (const socket of sockets) socket.disconnect();
}
