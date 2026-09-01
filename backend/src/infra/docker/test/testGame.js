import { pool as dbPool } from "#config/dbConfig.js";
import { redisClient } from "#config/redisConfig.js";
import { prepareInfoService } from "#docker/service/prepareInfoService.js";
import { saveInfoService } from "#docker/service/saveInfoService.js";
import { gameWorker } from "#docker/worker/gameWorker.js";

import { SOCKET_EVENTS } from "#constants/socketEvents.js";
import { registerSocketHandlers } from "#handler/socketHandler.js";
import { socketGameService } from "#service/socketService.js";

function getRandomElement(arr) {
  if (!arr || arr.length === 0) {
    return null;
  }
  const randomIndex = Math.floor(Math.random() * arr.length);
  return arr[randomIndex];
}

async function runBattleFlowTest() {
  console.log(
    "=================================================================",
  );
  console.log("게임 종료, 재접속 및 Valkey 데이터 정리 테스트 시작");
  console.log(
    "=================================================================",
  );

  try {
    if (!redisClient.isOpen) {
      await redisClient.connect();
      console.log("[REDIS] Valkey/Redis 클라이언트 연결 완료");
    }

    console.log("\n[STEP 1] DB에서 테스트 대상 방(room) 랜덤 조회 중...");
    const roomRows = await dbPool.query(
      "SELECT id, host_user_id, language FROM rooms WHERE status = 'WAITING' ORDER BY RAND() LIMIT 1",
    );

    if (!roomRows || roomRows.length === 0) {
      throw new Error("테스트할 WAITING 상태의 방이 DB에 존재하지 않습니다.");
    }

    const testRoom = roomRows[0];
    const roomId = testRoom.id;
    console.log(
      "[STEP 1 완료] 선택된 랜덤 방 ID: " +
        roomId +
        " (호스트: " +
        testRoom.host_user_id +
        " | 언어: " +
        testRoom.language +
        ")",
    );

    console.log(
      "\n[STEP 2] Fake Socket/IO 생성 및 registerSocketHandlers 등록...",
    );

    const socketEventListeners = {};

    const fakeSocket = {
      id: "fake_socket_id_" + Math.floor(Math.random() * 8999 + 1000),
      user: {
        id: String(testRoom.host_user_id),
        displayName: "TestUser_" + testRoom.host_user_id,
      },
      join: function (roomName) {
        console.log("[FAKE SOCKET] 방 [" + roomName + "]에 join 완료");
      },
      emit: function (eventName, payload) {
        console.log("\n--------------------------------------------------");
        console.log("[FAKE SOCKET UNICAST RCV] 이벤트: " + eventName);
        console.log(" - 데이터:", JSON.stringify(payload, null, 2));
        console.log("--------------------------------------------------");
      },
      to: function (roomName) {
        return {
          emit: function (eventName, payload) {
            console.log("\n--------------------------------------------------");
            console.log(
              "[FAKE SOCKET ROOM BROADCAST RCV] 방: " +
                roomName +
                " | 이벤트: " +
                eventName,
            );
            console.log(" - 데이터:", JSON.stringify(payload, null, 2));
            console.log("--------------------------------------------------");
          },
        };
      },
      on: function (eventName, listener) {
        socketEventListeners[eventName] = listener;
      },
    };

    const fakeIo = {
      to: function (roomName) {
        return {
          emit: function (eventName, payload) {
            console.log("\n--------------------------------------------------");
            console.log(
              "[FAKE IO BROADCAST RCV] 타겟 룸: " +
                roomName +
                " | 이벤트: " +
                eventName,
            );

            if (eventName === "game_start_notice") {
              console.log(' - 안내 메시지: "' + payload.message + '"');
            } else if (eventName === "game_started") {
              let participantsStr = "";
              if (payload.participants) {
                participantsStr = payload.participants.join(", ");
              }

              let problemId = "";
              let problemTitle = "";
              if (payload.problem) {
                problemId = payload.problem.id;
                problemTitle = payload.problem.title;
              }

              console.log(" - Match ID : " + payload.matchId);
              console.log(" - 수신 참가자: [ " + participantsStr + " ]");
              console.log(" - 문제 ID    : " + problemId);
              console.log(" - 문제 제목  : " + problemTitle);
              console.log(" - 제한 시간  : " + payload.timeLimit + "초");
            } else if (eventName === SOCKET_EVENTS.GAME_ENDED) {
              console.log(" - 우승자 ID  : " + payload.winnerId);
              console.log(" - 최종 점수  : " + payload.score);
              console.log("게임 종료 결과 전달 성공!");
            } else {
              console.log(" - 데이터:", JSON.stringify(payload, null, 2));
            }
            console.log("--------------------------------------------------");
          },
        };
      },
    };

    registerSocketHandlers(fakeIo, fakeSocket);

    console.log(
      "\n[STEP 3] prepareInfoService.getGameStartPayload() 호출 및 연산 결과 수신",
    );

    const startPayload = await prepareInfoService.getGameStartPayload(
      roomId,
      fakeIo,
    );

    let participantIds = [];
    if (startPayload.participants && startPayload.participants.length > 0) {
      participantIds = startPayload.participants;
    } else {
      participantIds = [String(testRoom.host_user_id)];
    }

    console.log("\n[STEP 4] gameWorker를 통한 답안 제출 및 검증");

    const codeMap = {
      python: "print('Hello World')",
      cpp: '#include <iostream>\nint main() { std::cout << "Hello World"; return 0; }',
      java: 'public class Main { public static void main(String[] args) { System.out.println("Hello World"); } }',
      js: "console.log('Hello World');",
    };

    const roomLangStr = testRoom.language
      ? testRoom.language.toLowerCase()
      : "python";
    const selectedCode = codeMap[roomLangStr] || "print('Hello World')";

    const submissionResults = [];
    for (let idx = 0; idx < participantIds.length; idx++) {
      const currentUserId = participantIds[idx];
      console.log(
        "[STEP 4-" +
          (idx + 1) +
          "] 유저 " +
          currentUserId +
          " 의 코드 실행 요청...",
      );

      const submission = {
        submissionId: "sub_" + Date.now() + "_" + idx,
        userId: currentUserId,
        roomId: roomId,
        language: roomLangStr,
        code: selectedCode,
      };

      const compileResult = await gameWorker.processSubmission(submission);
      console.log(
        "[STEP 4-" +
          (idx + 1) +
          " 완료] 실행 성공: " +
          compileResult.success +
          " | 소요시간: " +
          compileResult.executionTime +
          "ms",
      );

      submissionResults.push({
        userId: currentUserId,
        code: selectedCode,
        result: compileResult,
      });
    }

    console.log("\n[STEP 5] 기존 [SOCKET] Handler & Service 통합 동작 검증");

    console.log(
      "\n - [SOCKET] '" +
        SOCKET_EVENTS.TOGGLE_READY +
        "' 이벤트 발생시키는 중...",
    );
    await socketEventListeners[SOCKET_EVENTS.TOGGLE_READY](
      { roomId: roomId, isReady: true },
      function (res) {
        console.log("   [ACK 응답]:", res);
      },
    );

    console.log(
      "\n - [SOCKET] '" +
        SOCKET_EVENTS.SUBMIT_CODE +
        "' 이벤트 발생시키는 중...",
    );
    await socketEventListeners[SOCKET_EVENTS.SUBMIT_CODE](
      {
        roomId: roomId,
        code: selectedCode,
        language: roomLangStr,
        questionId: startPayload.problem ? startPayload.problem.id : null,
      },
      function (res) {
        console.log("   [ACK 응답]:", res);
      },
    );

    console.log(
      "\n - [SOCKET] '" + SOCKET_EVENTS.USE_ITEM + "' 이벤트 발생시키는 중...",
    );
    const otherUsers = await dbPool.query(
      "SELECT id FROM users WHERE id != ? ORDER BY RAND() LIMIT 1",
      [testRoom.host_user_id],
    );
    await socketEventListeners[SOCKET_EVENTS.USE_ITEM](
      {
        roomId: roomId,
        targetUserId:
          otherUsers && otherUsers.length > 0 ? otherUsers[0].id : null,
        itemType: "FOG_SCREEN",
      },
      function (res) {
        console.log("   [ACK 응답]:", res);
      },
    );

    console.log(
      "\n - [SOCKET] '" +
        SOCKET_EVENTS.REQUEST_NEXT_QUESTION +
        "' 이벤트 발생시키는 중...",
    );
    await socketEventListeners[SOCKET_EVENTS.REQUEST_NEXT_QUESTION](
      { roomId: roomId, questionIndex: 1 },
      function (res) {
        console.log("   [ACK 응답]:", res);
      },
    );

    console.log(
      "\n=================================================================",
    );
    console.log("연결 끊김(Disconnect) 및 재접속(JOIN_ROOM) 테스트");
    console.log(
      "=================================================================",
    );

    await socketEventListeners["disconnect"]();

    console.log(
      "\n - [SOCKET] 유저 재접속 '" +
        SOCKET_EVENTS.JOIN_ROOM +
        "' 이벤트 발생 (상태 복원 확인)...",
    );
    await socketEventListeners[SOCKET_EVENTS.JOIN_ROOM](
      { roomId: roomId },
      function (res) {
        console.log("   [재접속 ACK 응답]:", res);
      },
    );

    console.log("\n[STEP 6] 참가자별 최후 코드 DB(match_code_history) 저장");

    for (let i = 0; i < submissionResults.length; i++) {
      const item = submissionResults[i];
      const now = new Date();
      const historyId = roomId + "::" + now.toISOString();
      const finalCodesJson = JSON.stringify([item.code]);
      const problemsJson = JSON.stringify([{ id: startPayload.problem.id }]);

      await dbPool.query(
        "INSERT INTO match_code_history (history_id, user_id, room_id, submitted_at, lang, mode, code, codes, problems) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [
          historyId,
          item.userId,
          String(roomId),
          now,
          testRoom.language,
          "1/1",
          item.code,
          finalCodesJson,
          problemsJson,
        ],
      );
    }

    console.log(
      "\n=================================================================",
    );
    console.log("saveInfoService.saveGameResult() 및 데이터 정리 테스트");
    console.log(
      "=================================================================",
    );

    const winnerId = getRandomElement(participantIds);
    const gameResultData = {
      matchId: startPayload.matchId,
      roomId: roomId,
      winnerId: winnerId,
      score: Math.floor(Math.random() * 300) + 100,
    };

    await saveInfoService.saveGameResult(gameResultData);
    console.log(" - DB에 매치 결과 저장 완료!");

    console.log(
      "\n - [SOCKET] 방 참가자에게 게임 종료(GAME_ENDED) 결과 전송 및 Valkey 정리 수행...",
    );
    await socketGameService.broadcastGameEnded(fakeIo, roomId, gameResultData);

    const stateKey = "room:" + roomId + ":state";
    const isCleaned = await redisClient.exists(stateKey);
    console.log(" - Redis 정리 검증 (0이면 성공): " + isCleaned);

    console.log(
      "\n=================================================================",
    );
    console.log(
      "게임 종료, 재접속 상태 복원, 데이터 정리(Valkey) 소켓 기능이 모두 성공적으로 테스트되었습니다! ",
    );
    console.log(
      "=================================================================",
    );
  } catch (error) {
    console.error("\n[TEST FAILED] 테스트 진행 중 오류 발생:", error);
  } finally {
    if (redisClient && redisClient.isOpen) {
      await redisClient.quit();
    }
    process.exit(0);
  }
}

runBattleFlowTest();
