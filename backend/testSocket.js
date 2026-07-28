import { io } from "socket.io-client";

const BASE_URL = "http://localhost:8080";

async function runSocketTest() {
  console.log("--- Socket.io 채팅 기능 통합 테스트 시작 ---");

  // 유효성 검사 규칙(영문 소문자, 숫자, 밑줄, 3자 이상)을 만족하는 고유 계정 생성[cite: 2]
  const uniqueId = Date.now();
  const testUser = {
    username: `user_${uniqueId}`,
    password: "password123!",
    displayName: "소켓테스터",
  };

  let accessToken = "";

  try {
    // 0. 테스트를 위한 사전 회원가입 진행 (/api/v1/auth/signup)
    console.log("0. 테스트용 계정 회원가입 중...");
    const signupRes = await fetch(`${BASE_URL}/api/v1/auth/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(testUser),
    });

    const signupData = await signupRes.json();

    if (!signupRes.ok && signupRes.status !== 201) {
      console.log("FAIL: 회원가입 실패 -", signupData);
      return;
    }
    console.log("PASS: 회원가입 성공");

    // 1. 로그인 요청 (/api/v1/auth/login)
    console.log("1. 테스트용 로그인 요청 중...");
    const loginRes = await fetch(`${BASE_URL}/api/v1/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: testUser.username,
        password: testUser.password,
      }),
    });

    const loginData = await loginRes.json();

    // 응답 헬퍼 구조에 맞춰 token 추출 (result.token 또는 직접 token)[cite: 4]
    accessToken = loginData.token || loginData.result?.token;

    if (loginRes.status === 200 && accessToken) {
      console.log("PASS: 로그인 성공, 소켓 연결용 토큰 확보 완료");
    } else {
      console.log("FAIL: 로그인 실패 -", loginData);
      return;
    }
  } catch (err) {
    console.error("FAIL: 로그인 서버 접속 불가 -", err.message);
    return;
  }

  console.log("\n2. Socket.io 서버에 JWT 토큰과 함께 연결 시도 중...");
  const socket = io(BASE_URL, {
    auth: {
      token: `Bearer ${accessToken}`,
    },
    // polling 전송 방식을 포함하여 안정적인 소켓 연결 핸드셰이크 보장
    transports: ["polling", "websocket"],
  });

  socket.on("connect", () => {
    console.log(`PASS: 소켓 연결 성공! (Socket ID: ${socket.id})`);

    const testRoomId = "room_lobby";

    console.log(`\n3. [${testRoomId}] 방 입장 요청 중...`);
    socket.emit("join_room", { roomId: testRoomId }, (response) => {
      if (response && response.success) {
        console.log(
          `PASS: [${testRoomId}] 방 입장 성공! (이전 대화 개수: ${response.recentMessages?.length || 0})`,
        );

        console.log("\n4. 테스트 메시지 전송 중...");
        socket.emit(
          "send_message",
          {
            roomId: testRoomId,
            message: "안녕하세요! 소켓 테스트 메시지입니다.",
          },
          (sendAck) => {
            if (sendAck && sendAck.success) {
              console.log("PASS: 메시지 서버 전달 확인(Ack) 완료");
            } else {
              console.log("FAIL: 메시지 서버 전달 실패 -", sendAck?.message);
            }
          },
        );
      } else {
        console.log("FAIL: 방 입장 실패 -", response?.message);
      }
    });
  });

  socket.on("receive_message", (data) => {
    console.log("\n5. PASS: 실시간 메시지 수신 성공!");
    console.log("-----------------------------------------");
    console.log(`[방]: ${data.roomId}`);
    console.log(
      `[보낸사람]: ${data.senderDisplayName} (${data.senderUsername})`,
    );
    console.log(`[내용]: ${data.message}`);
    console.log(`[시간]: ${data.createdAt}`);
    console.log("-----------------------------------------");

    console.log("\n--- Socket.io 모든 테스트 통과 완료 ---");
    socket.disconnect();
    process.exit(0);
  });

  socket.on("connect_error", (err) => {
    console.log("FAIL: 소켓 연결 실패 -", err.message);
    socket.disconnect();
    process.exit(1);
  });

  socket.on("chat_error", (errData) => {
    console.log("WARN: 채팅 처리 중 에러 발생 -", errData.message);
  });
}

runSocketTest();