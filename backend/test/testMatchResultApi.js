import { pool } from "#config/dbConfig.js";
import { connectRedis, redisClient } from "#config/redisConfig.js";

const BASE_URL = process.env.TEST_BASE_URL || "http://127.0.0.1:8080";
const createdUserIds = [];
const createdProblemIds = [];
let createdRoomId;
let createdMatchId;

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

async function signup(label) {
  const suffix = Date.now() + "_" + label;
  const result = await request("/api/v1/auth/signup", {
    method: "POST",
    body: {
      username: "result_" + suffix,
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
  assert(hostResult.data.earnedGold === 300, "골드 보상 계산에 실패했습니다.");
  assert(hostResult.data.ratingDelta === 30, "레이팅 보상 계산에 실패했습니다.");
  assert(hostResult.data.newTitleIds.includes("rookie"), "첫 승리 칭호가 지급되지 않았습니다.");
  console.log("PASS: 순위, 골드, 레이팅, 칭호 저장");

  const rankingResult = await request("/api/v1/matches/" + createdMatchId + "/ranking", {
    token: host.token,
  });
  assert(rankingResult.response.status === 200, "최종 순위 조회에 실패했습니다.");
  assert(rankingResult.data.players.length === 2, "최종 순위 인원이 올바르지 않습니다.");
  assert(rankingResult.data.players[0].id === host.id, "점수 순위가 올바르지 않습니다.");
  console.log("PASS: 최종 순위 재조회");
  console.log("--- 경기 결과 API 통합 테스트 완료 ---");
}

runTest()
  .catch(function (error) {
    console.error("경기 결과 API 통합 테스트에 실패했습니다:", error.message);
    process.exitCode = 1;
  })
  .finally(cleanup);
