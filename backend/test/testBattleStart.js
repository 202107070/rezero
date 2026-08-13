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

  let body;
  if (options.body !== undefined) {
    body = JSON.stringify(options.body);
  }

  const response = await fetch(BASE_URL + path, {
    method: options.method || "GET",
    headers,
    body,
  });
  const data = await response.json();

  return { response, data };
}

async function signup(label) {
  const suffix = Date.now() + "_" + label;
  const result = await request("/api/v1/auth/signup", {
    method: "POST",
    body: {
      username: "battle_" + suffix,
      password: "password123!",
      displayName: "배틀테스트" + label,
    },
  });

  assert(result.response.status === 201, label + " 회원가입에 실패했습니다.");
  createdUserIds.push(result.data.user.id);

  return {
    id: result.data.user.id,
    token: result.data.token,
  };
}

async function createTestProblems() {
  const prefix = "T" + Date.now();

  for (let index = 0; index < 3; index += 1) {
    const problemId = prefix + index;
    createdProblemIds.push(problemId);

    await pool.query(
      `INSERT INTO problems (
         id,
         type,
         difficulty,
         title,
         question,
         answer,
         explanation
       )
       VALUES (?, 'short_answer', 'easy', ?, ?, ?, ?)`,
      [
        problemId,
        "테스트 문제 " + (index + 1),
        "테스트 정답을 입력하세요.",
        JSON.stringify({ JAVA: ["answer" + index] }),
        "경기 시작 API 테스트용 문제입니다.",
      ],
    );
  }
}

async function cleanup() {
  try {
    if (createdMatchId) {
      await pool.query("DELETE FROM matches WHERE id = ?", [createdMatchId]);
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
      const placeholders = createdProblemIds
        .map(function () {
          return "?";
        })
        .join(", ");
      await pool.query(
        "DELETE FROM problems WHERE id IN (" + placeholders + ")",
        createdProblemIds,
      );
    }

    if (createdUserIds.length > 0) {
      const placeholders = createdUserIds
        .map(function () {
          return "?";
        })
        .join(", ");
      await pool.query(
        "DELETE FROM users WHERE id IN (" + placeholders + ")",
        createdUserIds,
      );
    }
  } finally {
    if (redisClient.isOpen) {
      await redisClient.quit();
    }
    await pool.end();
  }
}

async function runTest() {
  console.log("--- 경기 시작 API 통합 테스트 시작 ---");
  await connectRedis();
  await createTestProblems();

  const host = await signup("host");
  const guest = await signup("guest");

  const createRoomResult = await request("/api/v1/rooms", {
    method: "POST",
    token: host.token,
    body: {
      roomTitle: "경기 시작 테스트방",
      playerMode: "1/1",
      gameMode: "normal",
      difficulty: "쉬움",
      language: "JAVA",
      roomPwd: "",
      problemCount: 3,
    },
  });
  assert(createRoomResult.response.status === 201, "방 생성에 실패했습니다.");
  createdRoomId = createRoomResult.data.id;

  const joinResult = await request(
    "/api/v1/rooms/" + createdRoomId + "/join",
    {
      method: "POST",
      token: guest.token,
      body: { language: "JAVA", character: "char2" },
    },
  );
  assert(joinResult.response.status === 200, "참가자 입장에 실패했습니다.");

  await redisClient.sAdd(
    "room:" + createdRoomId + ":ready",
    String(guest.id),
  );

  const startRoomResult = await request(
    "/api/v1/rooms/" + createdRoomId + "/start",
    {
      method: "POST",
      token: host.token,
    },
  );
  assert(
    startRoomResult.response.status === 200,
    "방 시작 조건 처리에 실패했습니다.",
  );

  const unauthorizedResult = await request("/api/v1/matches/start", {
    method: "POST",
    body: { roomId: createdRoomId },
  });
  assert(
    unauthorizedResult.response.status === 401,
    "JWT가 없는 경기 시작 요청이 차단되지 않았습니다.",
  );
  console.log("PASS: JWT 없는 요청 차단");

  const guestResult = await request("/api/v1/matches/start", {
    method: "POST",
    token: guest.token,
    body: { roomId: createdRoomId },
  });
  assert(
    guestResult.response.status === 403,
    "방장이 아닌 사용자의 경기 생성이 차단되지 않았습니다.",
  );
  console.log("PASS: 방장 권한 확인");

  const matchResult = await request("/api/v1/matches/start", {
    method: "POST",
    token: host.token,
    body: { roomId: createdRoomId, roundSeconds: 2700 },
  });
  assert(matchResult.response.status === 201, "경기 생성에 실패했습니다.");
  assert(matchResult.data.matchId, "경기 ID가 반환되지 않았습니다.");
  assert(
    matchResult.data.problems.length === 3,
    "요청한 문제 수와 선택된 문제 수가 다릅니다.",
  );

  for (const problem of matchResult.data.problems) {
    assert(
      !Object.prototype.hasOwnProperty.call(problem, "answer"),
      "프론트 응답에 문제 정답이 포함됐습니다.",
    );
  }
  createdMatchId = matchResult.data.matchId;
  console.log("PASS: 경기 생성과 정답 제외 응답");

  const matchRows = await pool.query(
    "SELECT id FROM matches WHERE id = ?",
    [createdMatchId],
  );
  const problemRows = await pool.query(
    `SELECT problem_index AS problemIndex
     FROM match_problems
     WHERE match_id = ?
     ORDER BY problem_index ASC`,
    [createdMatchId],
  );

  assert(matchRows.length === 1, "matches에 경기 기록이 저장되지 않았습니다.");
  assert(
    problemRows.length === 3 && Number(problemRows[0].problemIndex) === 0,
    "match_problems에 문제 순서가 저장되지 않았습니다.",
  );
  console.log("PASS: MariaDB 경기와 문제 저장");
  console.log("--- 경기 시작 API 통합 테스트 완료 ---");
}

runTest()
  .catch(function (error) {
    console.error("경기 시작 API 통합 테스트에 실패했습니다:", error.message);
    process.exitCode = 1;
  })
  .finally(cleanup);
