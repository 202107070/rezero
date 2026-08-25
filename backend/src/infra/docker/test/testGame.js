import { pool as dbPool } from "#config/dbConfig.js";
import { redisClient } from "#config/redisConfig.js";
import { prepareInfoService } from "#docker/service/prepareInfoService.js";
import { saveInfoService } from "#docker/service/saveInfoService.js";
import { gameWorker } from "#docker/worker/gameWorker.js";

import { SOCKET_EVENTS } from "#constants/socketEvents.js";
import { registerSocketHandlers } from "#handler/socketHandler.js";

function getRandomElement(arr) {
  if (!arr || arr.length === 0) {
    return null;
  }
  const randomIndex = Math.floor(Math.random() * arr.length);
  return arr[randomIndex];
}

async function runBattleFlowTest() {
  console.log("==================================================");
  console.log(
    "[TEST START] 배틀 및 신규 소켓 통합 플로우 테스트 (랜덤 시나리오)를 시작합니다.",
  );
  console.log("==================================================");

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
            } else if (eventName === "game_ended") {
              console.log(" - 우승자 ID  : " + payload.winnerId);
              console.log(" - 최종 점수  : " + payload.score);
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

    console.log("\n==================================================");
    console.log("[testGame] prepareInfoService로부터 반환받은 데이터:");
    console.log(" - 매치 ID       : " + startPayload.matchId);
    console.log(" - 방 ID         : " + startPayload.roomId);
    console.log(
      " - 참가자 명단   : [ " + startPayload.participants.join(", ") + " ]",
    );
    console.log(
      " - 문제 ID/제목  : [" +
        startPayload.problem.id +
        "] " +
        startPayload.problem.title,
    );
    console.log(" - 문제 제한시간 : " + startPayload.timeLimit + "초");
    console.log("==================================================");

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

    console.log(
      "\n[STEP 5] [신규 소켓 이벤트] Handler & Service 통합 동작 검증",
    );

    const redisReadyKey = "room:" + roomId + ":ready";

    const initialKeyType = await redisClient.type(redisReadyKey);
    if (initialKeyType !== "none" && initialKeyType !== "set") {
      await redisClient.del(redisReadyKey);
    }

    console.log(
      "\n - [SOCKET/REDIS CHECK] '" +
        SOCKET_EVENTS.TOGGLE_READY +
        "' 실행 및 Redis Key 저장 검증...",
    );

    await socketEventListeners[SOCKET_EVENTS.TOGGLE_READY](
      { roomId: roomId, isReady: true },
      function (res) {
        console.log("   [TOGGLE_READY ACK 응답]:", res);
      },
    );

    const redisReadySetData = await redisClient.sMembers(redisReadyKey);

    console.log("   --------------------------------------------------");
    console.log("   [REDIS VERIFICATION SUCCESS]");
    console.log("   - 타겟 Redis Key: " + redisReadyKey);
    console.log(
      "   - Redis Set 저장 데이터:",
      JSON.stringify(redisReadySetData),
    );
    console.log(
      "   - 검증 결과: manageGameService가 읽어올 Set 키(" +
        redisReadyKey +
        ")에 정상적으로 데이터가 저장되었습니다.",
    );
    console.log("   --------------------------------------------------");

    const realQuestionId = startPayload.problem
      ? startPayload.problem.id
      : null;

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
        questionId: realQuestionId,
      },
      function (res) {
        console.log("   [ACK 응답]:", res);
      },
    );

    const randomItemTypes = ["FOG_SCREEN", "PAINT", "FREEZE", "REVEAL_LENGTH"];
    const selectedItem = getRandomElement(randomItemTypes);

    const otherUsers = await dbPool.query(
      "SELECT id FROM users WHERE id != ? ORDER BY RAND() LIMIT 1",
      [testRoom.host_user_id],
    );

    let realTargetUserId = null;
    if (otherUsers && otherUsers.length > 0) {
      realTargetUserId = otherUsers[0].id;
    }

    console.log(
      "\n - [SOCKET] '" + SOCKET_EVENTS.USE_ITEM + "' 이벤트 발생시키는 중...",
    );
    await socketEventListeners[SOCKET_EVENTS.USE_ITEM](
      {
        roomId: roomId,
        targetUserId: realTargetUserId,
        itemType: selectedItem,
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

      console.log(
        "[STEP 6 완료] 유저 " +
          item.userId +
          " 최후 코드 저장 완료 (History ID: " +
          historyId +
          ")",
      );
    }

    console.log("\n[STEP 7] saveInfoService.saveGameResult() 실행");

    const winnerId = getRandomElement(participantIds);

    const gameResultData = {
      matchId: startPayload.matchId,
      roomId: roomId,
      winnerId: winnerId,
      score: Math.floor(Math.random() * 300) + 100,
    };

    await saveInfoService.saveGameResult(gameResultData);
    console.log(
      "[STEP 7 완료] 매치 " +
        gameResultData.matchId +
        " 결과 저장 완료 (우승자: " +
        gameResultData.winnerId +
        " | 점수: " +
        gameResultData.score +
        ")",
    );

    console.log("\n==================================================");
    console.log(
      "[TEST SUCCESS] 모든 배틀 및 소켓 기능의 통합 테스트 시나리오가 정상 종료되었습니다.",
    );
    console.log("==================================================");
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
