import { assertIsolatedTestTarget } from "./isolatedTestGuard.js";
import { once } from "node:events";
import { pool } from "#config/dbConfig.js";
import { connectRedis, redisClient } from "#config/redisConfig.js";
import { io } from "socket.io-client";

const BASE_URL = process.env.TEST_BASE_URL || "http://127.0.0.1:18082";
assertIsolatedTestTarget(BASE_URL);
const createdUserIds = [];
const createdProblemIds = [];
let createdRoomId;
let createdMatchId;
const connectedSockets = [];

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function request(path, options = {}) {
  const headers = { "Content-Type": "application/json" };

  if (options.token) {
    headers.Authorization = "Bearer " + options.token;
  }

  const response = await fetch(BASE_URL + path, {
    method: options.method || "GET",
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });

  return { response, data: await response.json() };
}

function connectSocket(token) {
  return new Promise(function (resolve, reject) {
    const socket = io(BASE_URL, {
      auth: { token: "Bearer " + token },
      transports: ["websocket"],
    });
    connectedSockets.push(socket);

    const timer = setTimeout(function () {
      socket.disconnect();
      reject(new Error("Socket 연결 시간이 초과되었습니다."));
    }, 5000);

    socket.once("connect", function () {
      clearTimeout(timer);
      resolve(socket);
    });

    socket.once("connect_error", function (error) {
      clearTimeout(timer);
      socket.disconnect();
      reject(error);
    });
  });
}

function joinSocketRoom(socket, roomId) {
  return new Promise(function (resolve, reject) {
    socket.emit("join_room", { roomId: String(roomId) }, function (result) {
      if (result?.success === true) {
        resolve();
        return;
      }
      reject(new Error(result?.message || "Socket 방 입장에 실패했습니다."));
    });
  });
}

function waitForGameEnded(socket) {
  return new Promise(function (resolve, reject) {
    const timer = setTimeout(function () {
      reject(new Error("game_ended 이벤트를 받지 못했습니다."));
    }, 5000);

    socket.once("game_ended", function (data) {
      clearTimeout(timer);
      resolve(data);
    });
  });
}

async function signup(label) {
  const suffix = Date.now().toString(36) + "_" + label;
  const result = await request("/api/v1/auth/signup", {
    method: "POST",
    body: {
      username: "res_" + suffix,
      password: "password123!",
      displayName: "결과테스트" + label,
    },
  });

  assert(result.response.status === 201, label + " 회원가입에 실패했습니다.");
  createdUserIds.push(result.data.user.id);
  return { id: result.data.user.id, token: result.data.token };
}

async function createTestProblems() {
  const prefix = "F" + Date.now();

  for (let index = 0; index < 3; index += 1) {
    const problemId = prefix + index;
    createdProblemIds.push(problemId);
    await pool.query(
      `INSERT INTO problems (
         id, type, difficulty, title, question, answer, explanation
       ) VALUES (?, 'short_answer', 'easy', ?, ?, ?, ?)`,
      [
        problemId,
        "결과 테스트 문제 " + (index + 1),
        "정답을 입력하세요.",
        JSON.stringify({ JAVA: ["answer" + index] }),
        "경기 결과 API 테스트용 문제입니다.",
      ],
    );
  }
}

async function createStartedMatch(host, guest) {
  const roomResult = await request("/api/v1/rooms", {
    method: "POST",
    token: host.token,
    body: {
      roomTitle: "경기 결과 테스트방",
      playerMode: "1/1",
      gameMode: "normal",
      difficulty: "쉬움",
      language: "JAVA",
      roomPwd: "",
      problemCount: 3,
    },
  });
  assert(roomResult.response.status === 201, "방 생성에 실패했습니다.");
  createdRoomId = roomResult.data.id;

  const joinResult = await request("/api/v1/rooms/" + createdRoomId + "/join", {
    method: "POST",
    token: guest.token,
    body: { language: "JAVA", character: "char2" },
  });
  assert(joinResult.response.status === 200, "참가자 입장에 실패했습니다.");

  await redisClient.sAdd("room:" + createdRoomId + ":ready", String(guest.id));

  const startRoomResult = await request("/api/v1/rooms/" + createdRoomId + "/start", {
    method: "POST",
    token: host.token,
  });
  assert(startRoomResult.response.status === 200, "방 시작에 실패했습니다.");

  const matchResult = await request("/api/v1/matches/start", {
    method: "POST",
    token: host.token,
    body: { roomId: createdRoomId, roundSeconds: 300 },
  });
  assert(matchResult.response.status === 201, "경기 생성에 실패했습니다.");
  createdMatchId = matchResult.data.matchId;
  // Pin only this test match to this test's fixtures; leave the shared question bank intact.
  for (let index = 0; index < createdProblemIds.length; index++) {
    const snapshot = { id: createdProblemIds[index], type: 'short_answer', difficulty: 'easy', question: '정답을 입력하세요.', answer: { JAVA: ['answer' + index] }, language: 'JAVA' };
    await pool.query('UPDATE match_problems SET problem_id=?, problem_snapshot=? WHERE match_id=? AND problem_index=?', [snapshot.id, JSON.stringify(snapshot), createdMatchId, index]);
    matchResult.data.problems[index] = snapshot;
  }
}

function submitBody(score, solvedProblems, completionTime) {
  return {
    ingameScore: score,
    codes: ["int", "for", ""],
    blankAnswers: [["int"], ["for"], []],
    selectedOptions: {},
    solveTimes: { 0: 20, 1: 40 },
    problemResults: [true, true, false],
    localSolvedProblems: solvedProblems,
    totalSolveTime: 60,
    finishedAtElapsedSec: completionTime,
  };
}

async function cleanup() {
  try {
    connectedSockets.forEach(function (socket) {
      socket.disconnect();
    });

    if (createdMatchId) {
      await pool.query("DELETE FROM matches WHERE id = ?", [createdMatchId]);
      await redisClient.del("battle:scores:" + createdMatchId);
    }

    if (createdRoomId) {
      await pool.query("DELETE FROM rooms WHERE id = ?", [createdRoomId]);
      await redisClient.del([
        "room:" + createdRoomId + ":state",
        "room:" + createdRoomId + ":participants",
        "room:" + createdRoomId + ":ready",
      ]);
    }

    if (createdProblemIds.length > 0) {
      const placeholders = createdProblemIds.map(function () { return "?"; }).join(", ");
      await pool.query("DELETE FROM problems WHERE id IN (" + placeholders + ")", createdProblemIds);
    }

    if (createdUserIds.length > 0) {
      const placeholders = createdUserIds.map(function () { return "?"; }).join(", ");
      await pool.query("DELETE FROM users WHERE id IN (" + placeholders + ")", createdUserIds);
    }
  } finally {
    if (redisClient.isOpen) {
      await redisClient.quit();
    }
    await pool.end();
  }
}

async function runTest() {
  console.log("--- 경기 결과 API 통합 테스트 시작 ---");
  await connectRedis();
  await createTestProblems();

  const host = await signup("host");
  const guest = await signup("guest");
  await createStartedMatch(host, guest);

  await redisClient.hSet("battle:scores:" + createdMatchId, String(host.id), "300");
  await redisClient.hSet("battle:scores:" + createdMatchId, String(guest.id), "100");

  const hostSocket = await connectSocket(host.token);
  const guestSocket = await connectSocket(guest.token);
  await joinSocketRoom(hostSocket, createdRoomId);
  await joinSocketRoom(guestSocket, createdRoomId);

  const hostGameEnded = waitForGameEnded(hostSocket);
  const guestGameEnded = waitForGameEnded(guestSocket);

  const guestResult = await request("/api/v1/matches/" + createdMatchId + "/submit", {
    method: "POST",
    token: guest.token,
    body: submitBody(100, [0], 180),
  });
  assert(guestResult.response.status === 200, "참가자 결과 저장에 실패했습니다.");
  assert(guestResult.data.resultReady === false, "다른 참가자 완료 전 결과가 확정됐습니다.");
  console.log("PASS: 참가자 결과 임시 저장");

  const hostResult = await request("/api/v1/matches/" + createdMatchId + "/submit", {
    method: "POST",
    token: host.token,
    body: submitBody(300, [0, 1, 2], 120),
  });
  assert(hostResult.response.status === 200, "최종 결과 저장에 실패했습니다.");
  assert(hostResult.data.resultReady === true, "모든 참가자 완료 후 결과가 확정되지 않았습니다.");
  assert(hostResult.data.earnedGold === 310, "골드 보상 계산에 실패했습니다.");
  assert(hostResult.data.ratingDelta === 35, "레이팅 보상 계산에 실패했습니다.");
  assert(hostResult.data.newTitleIds.includes("rookie"), "첫 승리 칭호가 지급되지 않았습니다.");
  console.log("PASS: 순위, 골드, 레이팅, 칭호 저장");

  const [hostEvent, guestEvent] = await Promise.all([
    hostGameEnded,
    guestGameEnded,
  ]);
  assert(String(hostEvent.roomId) === String(createdRoomId), "방장 결과 이벤트의 방 정보가 다릅니다.");
  assert(hostEvent.matchId === createdMatchId, "방장 결과 이벤트의 경기 정보가 다릅니다.");
  assert(hostEvent.ranking.length === 2, "방장에게 전달된 최종 순위가 올바르지 않습니다.");
  assert(hostEvent.rewards.length === 2, "방장에게 전달된 보상 정보가 올바르지 않습니다.");
  assert(guestEvent.matchId === createdMatchId, "참가자가 결과 이벤트를 받지 못했습니다.");
  console.log("PASS: 두 참가자에게 게임 종료 결과 Socket 전달");

  const rankingResult = await request("/api/v1/matches/" + createdMatchId + "/ranking", {
    token: host.token,
  });
  assert(rankingResult.response.status === 200, "최종 순위 조회에 실패했습니다.");
  assert(rankingResult.data.players.length === 2, "최종 순위 인원이 올바르지 않습니다.");
  assert(rankingResult.data.players[0].id === host.id, "점수 순위가 올바르지 않습니다.");
  const fetchedReward = rankingResult.data.rewards.find(reward => reward.userId === host.id);
  assert(fetchedReward.earnedGold === 310 && fetchedReward.ratingDelta === 35, '결과 재조회에서 서버 보상이 복원되지 않았습니다.');
  console.log("PASS: 최종 순위·확정 보상 재조회");
  const rewardBefore = await pool.query('SELECT id, gold, rating_score FROM users WHERE id IN (?, ?) ORDER BY id', [host.id, guest.id]);
  const retries = await Promise.all([host, guest, host].map(person => request('/api/v1/matches/' + createdMatchId + '/submit', { method: 'POST', token: person.token, body: submitBody(300, [0, 1, 2], 120) })));
  assert(retries.every(result => result.response.status === 200 && result.data.resultReady), '종료 경기 중복 제출이 실패했습니다.');
  const rewardAfter = await pool.query('SELECT id, gold, rating_score FROM users WHERE id IN (?, ?) ORDER BY id', [host.id, guest.id]);
  assert(JSON.stringify(rewardBefore) === JSON.stringify(rewardAfter), '중복 요청으로 보상이 다시 지급됐습니다.');
  const rows = await pool.query('SELECT COUNT(*) AS count FROM match_rankings WHERE match_id=?', [createdMatchId]);
  assert(Number(rows[0].count) === 1, '순위가 중복 저장됐습니다.');
  console.log('PASS: 반복·동시 재제출에도 골드/레이팅/순위 1회 저장');

  hostSocket.disconnect();
  const restored = await request("/api/v1/matches/reconnect", { token: host.token });
  assert(restored.data.match?.matchId === createdMatchId, "재접속할 종료 경기가 복원되지 않았습니다.");
  const reconnected = await connectSocket(host.token);
  const outsider = await signup("outside");
  const outsideSocket = await connectSocket(outsider.token);
  const roomId = String(createdRoomId);
  const emit = (socket, event, data) => socket.timeout(5000).emitWithAck(event, data);
  for (const socket of [reconnected, guestSocket]) {
    const result = await emit(socket, "update_location", { location: "result", roomId });
    assert(result.success, "결과 화면 위치를 등록하지 못했습니다.");
  }
  const invitation = {
    id: "review-" + Date.now(),
    roomId,
    matchId: createdMatchId,
    toUserIds: [guest.id],
    problemIndices: [0],
  };
  assert(!(await emit(outsideSocket, "review_invite", invitation)).success, "외부자가 리뷰 초대를 보냈습니다.");
  const incoming = once(guestSocket, "review_invite", { signal: AbortSignal.timeout(5000) });
  const sent = await emit(reconnected, "review_invite", invitation);
  assert(sent.success, sent.message || "재접속 참가자의 리뷰 초대가 실패했습니다.");
  const [received] = await incoming;
  assert(received.id === invitation.id, "상대에게 리뷰 초대가 전달되지 않았습니다.");
  const response = { roomId, inviteId: received.id, fromUserId: host.id, accepted: true };
  assert(!(await emit(outsideSocket, "review_invite_response", response)).success, "외부자가 리뷰 초대에 응답했습니다.");
  const reply = once(reconnected, "review_invite_response", { signal: AbortSignal.timeout(5000) });
  assert((await emit(guestSocket, "review_invite_response", response)).success, "리뷰 수락에 실패했습니다.");
  const [accepted] = await reply;
  assert(
    accepted.inviteId === invitation.id && accepted.matchId === createdMatchId &&
    accepted.accepted && accepted.toUserId === guest.id && accepted.problemIndices[0] === 0,
    "방 소켓을 아직 구독하지 않은 요청자에게 수락이 전달되지 않았습니다.",
  );
  assert(!(await emit(guestSocket, "review_invite_response", { ...response, accepted: false })).success,
    "이미 수락한 초대를 거절할 수 있었습니다.");
  console.log("PASS: 재접속 뒤 공동 리뷰 및 외부자의 초대·응답 차단");
  console.log("--- 경기 결과 API 통합 테스트 완료 ---");
}

runTest()
  .catch(function (error) {
    console.error("경기 결과 API 통합 테스트에 실패했습니다:", error.message);
    process.exitCode = 1;
  })
  .finally(cleanup);
