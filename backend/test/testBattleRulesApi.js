import { pool } from "#config/dbConfig.js";
import { connectRedis, redisClient } from "#config/redisConfig.js";

const BASE_URL = process.env.TEST_BASE_URL || "http://127.0.0.1:8081";
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
      username: "rules_" + suffix,
      password: "password123!",
      displayName: "규칙테스트" + label,
    },
  });

  assert(result.response.status === 201, label + " 회원가입에 실패했습니다.");
  createdUserIds.push(result.data.user.id);
  return { id: result.data.user.id, token: result.data.token };
}

async function createTestProblems() {
  const prefix = "R" + Date.now();

  for (let index = 0; index < 3; index += 1) {
    const problemId = prefix + index;
    createdProblemIds.push(problemId);
    await pool.query(
      `INSERT INTO problems (
         id, type, difficulty, title, question, answer, explanation
       )
       VALUES (?, 'short_answer', 'easy', ?, ?, ?, ?)`,
      [
        problemId,
        "규칙 테스트 문제 " + (index + 1),
        "정답을 입력하세요.",
        JSON.stringify({ JAVA: ["answer" + index] }),
        "배틀 규칙 API 테스트용 문제입니다.",
      ],
    );
  }
}

async function cleanup() {
  if (createdMatchId) {
    await pool.query("DELETE FROM matches WHERE id = ?", [createdMatchId]);
    await redisClient.del([
      "battle:scores:" + createdMatchId,
      "battle:submitted:" + createdMatchId + ":0",
    ]);
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
    await pool.query(
      "DELETE FROM problems WHERE id IN (" + placeholders + ")",
      createdProblemIds,
    );
  }

  if (createdUserIds.length > 0) {
    const placeholders = createdUserIds.map(function () { return "?"; }).join(", ");
    await pool.query(
      "DELETE FROM users WHERE id IN (" + placeholders + ")",
      createdUserIds,
    );
  }

  if (redisClient.isOpen) {
    await redisClient.quit();
  }
  await pool.end();
}

async function runTest() {
  console.log("--- 배틀 규칙 API 통합 테스트 시작 ---");
  await connectRedis();
  await createTestProblems();

  const host = await signup("host");
  const guest = await signup("guest");

  const roomResult = await request("/api/v1/rooms", {
    method: "POST",
    token: host.token,
    body: {
      roomTitle: "배틀 규칙 테스트방",
      playerMode: "1/1",
      gameMode: "item",
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
    body: { roomId: createdRoomId },
  });
  assert(matchResult.response.status === 201, "경기 생성에 실패했습니다.");
  createdMatchId = matchResult.data.matchId;

  const problemId = matchResult.data.problems[0].id;
  const answerIndex = createdProblemIds.indexOf(problemId);
  assert(answerIndex >= 0, "테스트 문제를 찾을 수 없습니다.");

  const answerResult = await request(
    "/api/v1/matches/" + encodeURIComponent(createdMatchId) + "/answers",
    {
      method: "POST",
      token: guest.token,
      body: { problemIndex: 0, answers: ["answer" + answerIndex] },
    },
  );
  assert(answerResult.response.status === 200, "정답 제출에 실패했습니다.");
  assert(answerResult.data.isCorrect === true, "정답 판정에 실패했습니다.");
  assert(answerResult.data.score === 100, "점수 계산에 실패했습니다.");
  console.log("PASS: 정답 제출과 점수 저장");

  const duplicateResult = await request(
    "/api/v1/matches/" + encodeURIComponent(createdMatchId) + "/answers",
    {
      method: "POST",
      token: guest.token,
      body: { problemIndex: 0, answers: ["answer" + answerIndex] },
    },
  );
  assert(duplicateResult.response.status === 409, "중복 제출이 차단되지 않았습니다.");
  console.log("PASS: 중복 제출 차단");

  await pool.query(
    "INSERT INTO user_items (user_id, item_key, quantity) VALUES (?, 'paint', 1)",
    [guest.id],
  );

  const itemResult = await request(
    "/api/v1/matches/" + encodeURIComponent(createdMatchId) + "/items/use",
    {
      method: "POST",
      token: guest.token,
      body: { problemIndex: 1, itemKey: "paint", targetUserId: host.id },
    },
  );
  assert(itemResult.response.status === 200, "아이템 사용에 실패했습니다.");

  const itemRows = await pool.query(
    "SELECT quantity FROM user_items WHERE user_id = ? AND item_key = 'paint'",
    [guest.id],
  );
  assert(Number(itemRows[0].quantity) === 0, "아이템 수량 차감에 실패했습니다.");
  console.log("PASS: 아이템 사용과 수량 차감");

  console.log("--- 배틀 규칙 API 통합 테스트 완료 ---");
}

runTest()
  .catch(function (error) {
    console.error("배틀 규칙 API 통합 테스트에 실패했습니다:", error.message);
    process.exitCode = 1;
  })
  .finally(cleanup);
