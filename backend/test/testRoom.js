import { pool } from "#config/dbConfig.js";
import { connectRedis, redisClient } from "#config/redisConfig.js";
import { io } from "socket.io-client";

const BASE_URL = process.env.TEST_BASE_URL || "http://127.0.0.1:8080";
const createdUserIds = [];
const createdRoomIds = [];

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function connectSocket(token) {
  const socket = io(BASE_URL, {
    auth: { token: "Bearer " + token },
    transports: ["polling", "websocket"],
  });

  return new Promise(function (resolve, reject) {
    const timeout = setTimeout(function () {
      socket.disconnect();
      reject(new Error("Socket 연결 시간이 초과됐습니다."));
    }, 5000);

    socket.once("connect", function () {
      clearTimeout(timeout);
      resolve(socket);
    });
    socket.once("connect_error", function (error) {
      clearTimeout(timeout);
      reject(error);
    });
  });
}

function emitWithAck(socket, eventName, data) {
  return new Promise(function (resolve, reject) {
    const timeout = setTimeout(function () {
      reject(new Error(eventName + " 응답 시간이 초과됐습니다."));
    }, 5000);

    socket.emit(eventName, data, function (response) {
      clearTimeout(timeout);
      resolve(response);
    });
  });
}

function waitForEvent(socket, eventName) {
  return new Promise(function (resolve, reject) {
    const timeout = setTimeout(function () {
      socket.off(eventName, listener);
      reject(new Error(eventName + " 수신 시간이 초과됐습니다."));
    }, 5000);

    function listener(data) {
      clearTimeout(timeout);
      resolve(data);
    }

    socket.once(eventName, listener);
  });
}

async function request(path, options = {}) {
  const headers = { "Content-Type": "application/json" };

  if (options.token) {
    headers.Authorization = "Bearer " + options.token;
  }

  let bodyValue;
  if (options.body === undefined) {
    bodyValue = undefined;
  } else {
    bodyValue = JSON.stringify(options.body);
  }

  let methodValue = "GET";
  if (options.method) {
    methodValue = options.method;
  }

  const response = await fetch(BASE_URL + path, {
    method: methodValue,
    headers: headers,
    body: bodyValue,
  });
  const data = await response.json();

  return { response: response, data: data };
}

async function signup(label) {
  const suffix = Date.now() + "_" + label;
  const result = await request("/api/v1/auth/signup", {
    method: "POST",
    body: {
      username: "room_" + suffix,
      password: "password123!",
      displayName: "방테스트" + label,
    },
  });

  assert(result.response.status === 201, label + " 회원가입에 실패했습니다.");
  assert(result.data.token, label + " JWT 발급 결과를 확인해 주세요.");

  createdUserIds.push(result.data.user.id);
  return {
    id: result.data.user.id,
    token: result.data.token,
  };
}

async function cleanup() {
  if (createdRoomIds.length > 0) {
    const roomPlaceholders = createdRoomIds
      .map(function () {
        return "?";
      })
      .join(", ");

    await pool.query(
      "DELETE FROM rooms WHERE id IN (" + roomPlaceholders + ")",
      createdRoomIds,
    );
  }

  if (createdUserIds.length > 0) {
    const userPlaceholders = createdUserIds
      .map(function () {
        return "?";
      })
      .join(", ");

    await pool.query(
      "DELETE FROM users WHERE id IN (" + userPlaceholders + ")",
      createdUserIds,
    );
  }

  if (createdRoomIds.length > 0) {
    await connectRedis();

    for (const roomId of createdRoomIds) {
      await redisClient.del([
        "room:" + roomId + ":state",
        "room:" + roomId + ":participants",
        "room:" + roomId + ":ready",
        "chat:room:" + roomId + ":recent",
        "room:kicked:" + roomId,
      ]);
    }
  }

  if (redisClient.isOpen) {
    await redisClient.quit();
  }

  await pool.end();
}

async function runTest() {
  console.log("--- 방 API 통합 테스트 시작 ---");

  const host = await signup("host");
  const guest = await signup("guest");
  const extra = await signup("extra");

  const unauthorized = await request("/api/v1/rooms");
  assert(
    unauthorized.response.status === 401,
    "JWT 없는 요청이 차단되지 않았습니다.",
  );
  console.log("PASS: JWT 없는 방 요청 차단");

  const invalidRoom = await request("/api/v1/rooms", {
    method: "POST",
    token: host.token,
    body: {
      roomTitle: " ",
      playerMode: "1/1",
      gameMode: "normal",
      difficulty: "보통",
      language: "JAVA",
      roomPwd: "",
      problemCount: "5",
    },
  });
  assert(
    invalidRoom.response.status === 400,
    "빈 방 제목이 차단되지 않았습니다.",
  );
  console.log("PASS: 잘못된 방 생성 입력 차단");

  const createResult = await request("/api/v1/rooms", {
    method: "POST",
    token: host.token,
    body: {
      roomTitle: "1대1 테스트방",
      playerMode: "1/1",
      gameMode: "normal",
      difficulty: "보통",
      language: "JAVA",
      roomPwd: "",
      problemCount: "5",
    },
  });
  assert(createResult.response.status === 201, "방 생성에 실패했습니다.");
  assert(
    createResult.data.maxPlayers === 2,
    "1/1 최대 인원은 2명이어야 합니다.",
  );
  assert(
    createResult.data.players === "1/2",
    "방 생성 후 인원 표시가 올바르지 않습니다.",
  );

  const roomId = createResult.data.id;
  createdRoomIds.push(roomId);
  console.log("PASS: 방 생성");

  const listResult = await request("/api/v1/rooms", { token: host.token });
  let hasCreatedRoom = false;
  for (const room of listResult.data.rooms) {
    if (room.id === roomId) {
      hasCreatedRoom = true;
    }
  }
  assert(
    listResult.response.status === 200 && hasCreatedRoom,
    "방 목록에서 생성한 방을 찾을 수 없습니다.",
  );
  console.log("PASS: 방 목록 조회");

  const detailResult = await request("/api/v1/rooms/" + roomId, {
    token: host.token,
  });
  assert(detailResult.response.status === 200, "방 상세 조회에 실패했습니다.");
  assert(
    detailResult.data.participants.length === 1 &&
      detailResult.data.participants[0].isHost,
    "방장이 첫 참가자로 등록되지 않았습니다.",
  );
  console.log("PASS: 방 상세 조회와 방장 자동 등록");

  const joinResult = await request("/api/v1/rooms/" + roomId + "/join", {
    method: "POST",
    token: guest.token,
    body: { language: "JAVA", character: "char2" },
  });
  assert(joinResult.response.status === 200, "방 입장에 실패했습니다.");
  assert(
    joinResult.data.players === "2/2",
    "방 입장 후 인원이 올바르지 않습니다.",
  );
  console.log("PASS: 방 입장");

  let hostSocket;
  let guestSocket;

  try {
    hostSocket = await connectSocket(host.token);
    guestSocket = await connectSocket(guest.token);
    await emitWithAck(hostSocket, "join_room", { roomId: String(roomId) });
    await emitWithAck(guestSocket, "join_room", { roomId: String(roomId) });

    const readyChanged = waitForEvent(hostSocket, "ready_changed");
    const readyAck = await emitWithAck(guestSocket, "toggle_ready", {
      roomId: String(roomId),
      isReady: true,
    });
    const readyEvent = await readyChanged;

    assert(readyAck.success, "READY 저장 응답을 확인해 주세요.");
    assert(
      readyEvent.userId === guest.id && readyEvent.isReady,
      "READY 변경 상태가 방 참가자에게 전달되지 않았습니다.",
    );

    const canStartResult = await request(
      "/api/v1/rooms/" + roomId + "/can-start",
      {
        token: host.token,
      },
    );
    assert(
      canStartResult.response.status === 200,
      "게임 시작 조건 조회에 실패했습니다.",
    );
    assert(
      canStartResult.data.data.canStart,
      "1/1 방의 게임 시작 조건을 확인해 주세요.",
    );

    await emitWithAck(guestSocket, "toggle_ready", {
      roomId: String(roomId),
      isReady: false,
    });
    console.log("PASS: READY Valkey 저장, Socket 전달, 게임 시작 조건 확인");
  } finally {
    if (hostSocket) {
      hostSocket.disconnect();
    }
    if (guestSocket) {
      guestSocket.disconnect();
    }
  }

  const duplicateJoin = await request("/api/v1/rooms/" + roomId + "/join", {
    method: "POST",
    token: guest.token,
    body: {},
  });
  assert(
    duplicateJoin.response.status === 409,
    "중복 입장이 차단되지 않았습니다.",
  );
  console.log("PASS: 중복 입장 차단");

  const fullRoomJoin = await request("/api/v1/rooms/" + roomId + "/join", {
    method: "POST",
    token: extra.token,
    body: {},
  });
  assert(
    fullRoomJoin.response.status === 409,
    "정원 초과 입장이 차단되지 않았습니다.",
  );
  console.log("PASS: 정원 초과 차단");

  const forbiddenDelete = await request("/api/v1/rooms/" + roomId, {
    method: "DELETE",
    token: guest.token,
  });
  assert(
    forbiddenDelete.response.status === 403,
    "일반 사용자의 방 삭제가 차단되지 않았습니다.",
  );
  console.log("PASS: 방 삭제 권한 확인");

  const hostLeave = await request("/api/v1/rooms/" + roomId + "/leave", {
    method: "POST",
    token: host.token,
  });
  assert(hostLeave.response.status === 200, "방장 퇴장에 실패했습니다.");
  assert(
    hostLeave.data.newHostUserId === guest.id,
    "남은 참가자가 새 방장으로 지정되지 않았습니다.",
  );
  console.log("PASS: 방장 퇴장 후 새 방장 지정");

  const deleteResult = await request("/api/v1/rooms/" + roomId, {
    method: "DELETE",
    token: guest.token,
  });
  assert(
    deleteResult.response.status === 200,
    "새 방장의 방 삭제에 실패했습니다.",
  );

  const closedRoomRows = await pool.query(
    "SELECT status FROM rooms WHERE id = ?",
    [roomId],
  );
  assert(
    closedRoomRows.length === 1 && closedRoomRows[0].status === "CLOSED",
    "종료한 방이 MariaDB에 CLOSED 상태로 남지 않았습니다.",
  );

  const closedRoomList = await request("/api/v1/rooms", { token: guest.token });
  let hasClosedRoom = false;
  for (const room of closedRoomList.data.rooms) {
    if (room.id === roomId) {
      hasClosedRoom = true;
    }
  }
  assert(!hasClosedRoom, "CLOSED 상태의 방이 방 목록에 표시됩니다.");

  const closedRoomDetail = await request("/api/v1/rooms/" + roomId, {
    token: guest.token,
  });
  assert(
    closedRoomDetail.response.status === 404,
    "CLOSED 상태의 방을 상세 조회할 수 있습니다.",
  );
  console.log("PASS: 방 종료 기록 유지와 목록 제외");

  const privateRoom = await request("/api/v1/rooms", {
    method: "POST",
    token: host.token,
    body: {
      roomTitle: "비공개 테스트방",
      playerMode: "1/N",
      gameMode: "item",
      difficulty: "어려움",
      language: "PYTHON",
      roomPwd: "secret123",
      problemCount: 10,
    },
  });
  assert(privateRoom.response.status === 201, "비공개 방 생성에 실패했습니다.");
  assert(privateRoom.data.isPrivate, "비공개 방 표시를 확인해 주세요.");
  assert(
    privateRoom.data.pwd === "protected",
    "비밀번호 원문이 응답에 포함되면 안 됩니다.",
  );

  const privateRoomId = privateRoom.data.id;
  createdRoomIds.push(privateRoomId);
  console.log("PASS: 비공개 방 생성과 비밀번호 숨김");

  const wrongPassword = await request(
    "/api/v1/rooms/" + privateRoomId + "/join",
    {
      method: "POST",
      token: guest.token,
      body: { password: "wrong-password" },
    },
  );
  assert(
    wrongPassword.response.status === 403,
    "잘못된 비밀번호가 차단되지 않았습니다.",
  );
  console.log("PASS: 잘못된 방 비밀번호 차단");

  const correctPassword = await request(
    "/api/v1/rooms/" + privateRoomId + "/join",
    {
      method: "POST",
      token: guest.token,
      body: { password: "secret123" },
    },
  );
  assert(
    correctPassword.response.status === 200,
    "비공개 방 입장에 실패했습니다.",
  );
  console.log("PASS: 비공개 방 입장");

  const privateDelete = await request("/api/v1/rooms/" + privateRoomId, {
    method: "DELETE",
    token: host.token,
  });
  assert(
    privateDelete.response.status === 200,
    "비공개 방 삭제에 실패했습니다.",
  );

  const emptyRoom = await request("/api/v1/rooms", {
    method: "POST",
    token: extra.token,
    body: {
      roomTitle: "빈 방 종료 테스트",
      playerMode: "1/1",
      gameMode: "normal",
      difficulty: "쉬움",
      language: "C++",
      roomPwd: "",
      problemCount: 3,
    },
  });
  assert(
    emptyRoom.response.status === 201,
    "빈 방 종료 테스트용 방 생성에 실패했습니다.",
  );

  const emptyRoomId = emptyRoom.data.id;
  createdRoomIds.push(emptyRoomId);

  const emptyRoomLeave = await request(
    "/api/v1/rooms/" + emptyRoomId + "/leave",
    {
      method: "POST",
      token: extra.token,
    },
  );
  assert(
    emptyRoomLeave.response.status === 200,
    "마지막 참가자의 퇴장에 실패했습니다.",
  );
  assert(
    emptyRoomLeave.data.roomClosed,
    "빈 방이 종료 상태로 처리되지 않았습니다.",
  );

  const emptyRoomRows = await pool.query(
    "SELECT status FROM rooms WHERE id = ?",
    [emptyRoomId],
  );
  assert(
    emptyRoomRows.length === 1 && emptyRoomRows[0].status === "CLOSED",
    "마지막 참가자가 나간 방이 CLOSED 상태로 남지 않았습니다.",
  );
  console.log("PASS: 마지막 참가자 퇴장 시 방 종료");

  const startRoomResult = await request("/api/v1/rooms", {
    method: "POST",
    token: host.token,
    body: {
      roomTitle: "게임 시작 API 테스트방",
      playerMode: "1/1",
      gameMode: "normal",
      difficulty: "보통",
      language: "JAVA",
      roomPwd: "",
      problemCount: 5,
    },
  });
  assert(
    startRoomResult.response.status === 201,
    "게임 시작 테스트용 방 생성에 실패했습니다.",
  );

  const startRoomId = startRoomResult.data.id;
  createdRoomIds.push(startRoomId);

  const insufficientPlayers = await request(
    "/api/v1/rooms/" + startRoomId + "/start",
    {
      method: "POST",
      token: host.token,
    },
  );
  assert(
    insufficientPlayers.response.status === 409 &&
      insufficientPlayers.data.error.code === "ROOM_MINIMUM_PLAYERS_REQUIRED",
    "최소 인원 미달 상태에서 게임 시작이 차단되지 않았습니다.",
  );
  console.log("PASS: 게임 시작 최소 인원 확인");

  const startRoomJoin = await request(
    "/api/v1/rooms/" + startRoomId + "/join",
    {
      method: "POST",
      token: guest.token,
      body: { language: "JAVA", character: "char2" },
    },
  );
  assert(
    startRoomJoin.response.status === 200,
    "게임 시작 테스트방 입장에 실패했습니다.",
  );

  const nonHostStart = await request(
    "/api/v1/rooms/" + startRoomId + "/start",
    {
      method: "POST",
      token: guest.token,
    },
  );
  assert(
    nonHostStart.response.status === 403 &&
      nonHostStart.data.error.code === "ROOM_START_FORBIDDEN",
    "방장이 아닌 사용자의 게임 시작이 차단되지 않았습니다.",
  );
  console.log("PASS: 게임 시작 방장 권한 확인");

  const notReadyStart = await request(
    "/api/v1/rooms/" + startRoomId + "/start",
    {
      method: "POST",
      token: host.token,
    },
  );
  assert(
    notReadyStart.response.status === 409 &&
      notReadyStart.data.error.code === "ROOM_PARTICIPANTS_NOT_READY",
    "READY하지 않은 참가자가 있는데 게임이 시작됐습니다.",
  );
  console.log("PASS: 게임 시작 READY 상태 확인");

  await connectRedis();
  await redisClient.sAdd("room:" + startRoomId + ":ready", String(guest.id));

  const startSuccess = await request(
    "/api/v1/rooms/" + startRoomId + "/start",
    {
      method: "POST",
      token: host.token,
    },
  );
  assert(
    startSuccess.response.status === 200,
    "정상적인 게임 시작 요청에 실패했습니다.",
  );
  assert(
    startSuccess.data.roomId === startRoomId &&
      startSuccess.data.status === "STARTED",
    "게임 시작 응답값을 확인해 주세요.",
  );

  const startedRoomRows = await pool.query(
    "SELECT status FROM rooms WHERE id = ?",
    [startRoomId],
  );
  assert(
    startedRoomRows.length === 1 && startedRoomRows[0].status === "STARTED",
    "MariaDB의 방 상태가 STARTED로 변경되지 않았습니다.",
  );

  const valkeyRoomStatus = await redisClient.hGet(
    "room:" + startRoomId + ":state",
    "status",
  );
  assert(
    valkeyRoomStatus === "STARTED",
    "Valkey의 방 상태가 STARTED로 변경되지 않았습니다.",
  );
  console.log("PASS: 게임 시작과 MariaDB/Valkey 상태 변경");

  const duplicateStart = await request(
    "/api/v1/rooms/" + startRoomId + "/start",
    {
      method: "POST",
      token: host.token,
    },
  );
  assert(
    duplicateStart.response.status === 409 &&
      duplicateStart.data.error.code === "ROOM_ALREADY_STARTED",
    "이미 시작한 방의 중복 시작이 차단되지 않았습니다.",
  );
  console.log("PASS: 게임 중복 시작 차단");

  const missingRoom = await request("/api/v1/rooms/999999999", {
    token: host.token,
  });
  assert(
    missingRoom.response.status === 404,
    "존재하지 않는 방 요청이 차단되지 않았습니다.",
  );
  console.log("PASS: 존재하지 않는 방 요청 차단");

  console.log("--- 방 API 통합 테스트 완료 ---");
}

runTest()
  .catch(function (error) {
    console.error("방 API 통합 테스트에 실패했습니다:", error.message);
    process.exitCode = 1;
  })
  .finally(cleanup);
