import { pool as dbPool } from "#config/dbConfig.js";
import { redisClient } from "#config/redisConfig.js";
import { prepareInfoService } from "#docker/service/prepareInfoService.js";
import { saveInfoService } from "#docker/service/saveInfoService.js";
import { gameWorker } from "#docker/worker/gameWorker.js";

async function runBattleFlowTest() {
  console.log("==================================================");
  console.log("[TEST START] 배틀 통합 플로우 테스트를 시작합니다.");
  console.log("==================================================");

  try {
    if (!redisClient.isOpen) {
      await redisClient.connect();
      console.log("[REDIS] Valkey/Redis 클라이언트 연결 완료");
    }

    console.log("\n[STEP 1] DB에서 테스트 대상 방(room) 조회 중...");
    const roomRows = await dbPool.query(
      "SELECT id, host_user_id, language FROM rooms WHERE status = 'WAITING' LIMIT 1",
    );

    if (!roomRows?.length) {
      throw new Error("테스트할 WAITING 상태의 방이 DB에 존재하지 않습니다.");
    }

    const testRoom = roomRows[0];
    const roomId = testRoom.id;
    console.log(
      `[STEP 1 완료] 대상 방 ID: ${roomId} (호스트: ${testRoom.host_user_id})`,
    );

    console.log(
      "\n[STEP 2] prepareInfoService.getGameStartPayload() 호출 및 연산 결과 수신",
    );

    const fakeIo = {
      to: (roomName) => ({
        emit: (eventName, payload) => {
          console.log(`\n--------------------------------------------------`);
          console.log(
            `[FAKE SOCKET RCV] 타겟 룸: ${roomName} | 이벤트: ${eventName}`,
          );

          if (eventName === "game_start_notice") {
            console.log(` - 안내 메시지: "${payload.message}"`);
          } else if (eventName === "game_started") {
            console.log(` - Match ID : ${payload.matchId}`);
            console.log(
              ` - 수신 참가자: [ ${payload.participants?.join(", ")} ]`,
            );
            console.log(` - 문제 ID    : ${payload.problem?.id}`);
            console.log(` - 문제 제목  : ${payload.problem?.title}`);
            console.log(` - 제한 시간  : ${payload.timeLimit}초`);
          } else if (eventName === "game_ended") {
            console.log(` - 우승자 ID  : ${payload.winnerId}`);
            console.log(` - 최종 점수  : ${payload.score}`);
          }
          console.log(`--------------------------------------------------`);
        },
      }),
    };

    const startPayload = await prepareInfoService.getGameStartPayload(
      roomId,
      fakeIo,
    );

    console.log("\n==================================================");
    console.log("[testGame] prepareInfoService로부터 반환받은 데이터:");
    console.log(` - 매치 ID       : ${startPayload.matchId}`);
    console.log(` - 방 ID         : ${startPayload.roomId}`);
    console.log(
      ` - 참가자 명단   : [ ${startPayload.participants.join(", ")} ]`,
    );
    console.log(
      ` - 문제 ID/제목  : [${startPayload.problem.id}] ${startPayload.problem.title}`,
    );
    console.log(` - 문제 제한시간 : ${startPayload.timeLimit}초`);
    console.log("==================================================");

    const participantIds =
      startPayload.participants.length > 0
        ? startPayload.participants
        : [String(testRoom.host_user_id)];

    console.log("\n[STEP 3] gameWorker를 통한 답안 제출 및 검증");

    const submissionResults = [];
    for (const [idx, currentUserId] of participantIds.entries()) {
      const sampleCode = `print('Hello Battle ${currentUserId}')`;
      console.log(
        `[STEP 3-${idx + 1}] 유저 ${currentUserId} 의 코드 실행 요청...`,
      );

      const submission = {
        submissionId: `sub_${Date.now()}_${idx}`,
        userId: currentUserId,
        roomId,
        language: "python",
        code: sampleCode,
      };

      const compileResult = await gameWorker.processSubmission(submission);
      console.log(
        `[STEP 3-${idx + 1} 완료] 실행 성공: ${compileResult.success} | 소요시간: ${compileResult.executionTime}ms`,
      );

      submissionResults.push({
        userId: currentUserId,
        code: sampleCode,
        result: compileResult,
      });
    }

    console.log("\n[STEP 4] 참가자별 최후 코드 DB(match_code_history) 저장");

    for (const item of submissionResults) {
      const now = new Date();
      const historyId = `${roomId}::${now.toISOString()}`;
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
        `[STEP 4 완료] 유저 ${item.userId} 최후 코드 저장 완료 (History ID: ${historyId})`,
      );
    }

    console.log("\n[STEP 5] saveInfoService.saveGameResult() 실행");

    const gameResultData = {
      matchId: startPayload.matchId,
      roomId,
      winnerId: participantIds[0],
      score: 100,
    };

    const saveResult = await saveInfoService.saveGameResult(
      gameResultData,
      fakeIo,
    );
    console.log(
      `[STEP 5 완료] 매치 ${saveResult.matchId} 결과 저장 완료 (우승자: ${saveResult.winnerId})`,
    );

    console.log("\n==================================================");
    console.log(
      "[TEST SUCCESS] 모든 배틀 기능의 통합 테스트 시나리오가 정상 종료되었습니다.",
    );
    console.log("==================================================");
  } catch (error) {
    console.error("\n[TEST FAILED] 테스트 진행 중 오류 발생:", error);
  } finally {
    if (redisClient?.isOpen) {
      await redisClient.quit();
    }
    process.exit(0);
  }
}

runBattleFlowTest();
