import { io } from "socket.io-client";

const BASE_URL = "http://localhost:8080";

async function runSocketTest() {
  console.log("--- Socket.io 채팅 기능 통합 테스트 시작 ---");

  const uniqueId = Date.now();
  const testUser = {
    username: "user_" + uniqueId,
    password: "password123!",
    displayName: "소켓테스터",
  };

  let accessToken = "";

  try {
    console.log("0. 테스트용 계정 회원가입 중...");
    const signupRes = await fetch(BASE_URL + "/api/v1/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(testUser),
    });

    const signupData = await signupRes.json();

    if (!signupRes.ok) {
      if (signupRes.status !== 201) {
        console.log("FAIL: 회원가입 실패 -", signupData);
        return;
      }
    }
    console.log("PASS: 회원가입 성공");

    console.log("1. 테스트용 로그인 요청 중...");
    const loginRes = await fetch(BASE_URL + "/api/v1/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: testUser.username,
        password: testUser.password,
      }),
    });

    const loginData = await loginRes.json();

    if (loginData.token) {
      accessToken = loginData.token;
    } else {
      if (loginData.result) {
        if (loginData.result.token) {
          accessToken = loginData.result.token;
        }
      }
    }

    let isLoginSuccessful = false;
    if (loginRes.status === 200) {
      if (accessToken) {
        isLoginSuccessful = true;
      }
    }

    if (isLoginSuccessful) {
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
      token: "Bearer " + accessToken,
    },
    transports: ["websocket"],
  });

  socket.on("connect", function () {
    console.log("PASS: 소켓 연결 성공! (Socket ID: " + socket.id + ")");

    const testRoomId = "room_lobby";

    console.log("\n3. [" + testRoomId + "] 방 입장 요청 중...");
    socket.emit("join_room", { roomId: testRoomId }, function (response) {
      let isJoinSuccess = false;
      if (response) {
        if (response.success) {
          isJoinSuccess = true;
        }
      }

      if (isJoinSuccess) {
        let recentMessagesLength = 0;
        if (response.recentMessages) {
          recentMessagesLength = response.recentMessages.length;
        }

        console.log(
          "PASS: [" +
            testRoomId +
            "] 방 입장 성공! (이전 대화 개수: " +
            recentMessagesLength +
            ")",
        );

        console.log("\n4. 테스트 메시지 전송 중...");
        socket.emit(
          "send_message",
          {
            roomId: testRoomId,
            message: "안녕하세요! 소켓 테스트 메시지입니다.",
          },
          function (sendAck) {
            let isSendSuccess = false;
            if (sendAck) {
              if (sendAck.success) {
                isSendSuccess = true;
              }
            }

            if (isSendSuccess) {
              console.log("PASS: 메시지 서버 전달 확인(Ack) 완료");
            } else {
              let errorMessage = "";
              if (sendAck) {
                errorMessage = sendAck.message;
              }
              console.log("FAIL: 메시지 서버 전달 실패 -", errorMessage);
            }
          },
        );
      } else {
        let errorMessage = "";
        if (response) {
          errorMessage = response.message;
        }
        console.log("FAIL: 방 입장 실패 -", errorMessage);
      }
    });
  });

  socket.on("receive_message", function (data) {
    console.log("\n5. PASS: 실시간 메시지 수신 성공!");
    console.log("-----------------------------------------");
    console.log("[방]: " + data.roomId);
    console.log(
      "[보낸사람]: " +
        data.senderDisplayName +
        " (" +
        data.senderUsername +
        ")",
    );
    console.log("[내용]: " + data.message);
    console.log("[시간]: " + data.createdAt);
    console.log("-----------------------------------------");

    console.log("\n--- Socket.io 모든 테스트 통과 완료 ---");
    socket.disconnect();
    process.exit(0);
  });

  socket.on("connect_error", function (err) {
    console.log("FAIL: 소켓 연결 실패 -", err.message);
    socket.disconnect();
    process.exit(1);
  });

  socket.on("chat_error", function (errData) {
    console.log("WARN: 채팅 처리 중 에러 발생 -", errData.message);
  });
}

runSocketTest();
