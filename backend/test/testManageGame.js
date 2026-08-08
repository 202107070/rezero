import { pool } from "#config/dbConfig.js";
import { connectRedis, redisClient } from "#config/redisConfig.js";
import gameStartService from "#service/manageGameService.js";
import gameStartController from "#controller/manageGameController.js";

async function runGameStartTest() {
  console.log("==================================================");
  console.log("게임 시작 가능 여부 테스트");
  console.log("==================================================\n");

  try {
    await connectRedis();

    console.log("1번 방 검사 (방장 외 미준비자 존재)");
    const room1Result = await gameStartService.checkCanStart(1);
    console.dir(room1Result, { depth: null, colors: true });

    console.log("\n--------------------------------------------------\n");

    console.log("2번 방 검사 (방장 외 전원 준비 완료)");
    const room2Result = await gameStartController.checkRoomCanStart(2);
    console.dir(room2Result, { depth: null, colors: true });

    console.log("\n==================================================");
    console.log("모든 테스트가 완벽하게 통과했습니다!");
    console.log("==================================================");
  } catch (error) {
    console.error("\n테스트 진행 중 오류 발생 :", error);
    process.exitCode = 1;
  } finally {
    if (redisClient.isOpen) {
      await redisClient.quit();
    }
    if (pool) {
      if (typeof pool.end === "function") {
        await pool.end();
      }
    }
  }
}

runGameStartTest();
