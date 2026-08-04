// testGameStart.js
import { pool } from "./src/config/dbConfig.js";
import gameStartService from "./src/manageRoom/gameStartService.js";
import gameStartController from "./src/manageRoom/gameStartController.js";

async function runGameStartTest() {
  console.log("==================================================");
  console.log("게임 시작 가능 여부 테스트");
  console.log("==================================================\n");

  try {
    // 1번 방 검사 (방장 외 미준비자 존재 -> 시작 불가)
    console.log("1번 방 검사 (방장 외 미준비자 존재)");
    const room1Result = await gameStartService.checkCanStart(1);
    console.dir(room1Result, { depth: null, colors: true });

    console.log("\n--------------------------------------------------\n");

    // 2번 방 검사 (방장 외 전원 준비 완료 -> 시작 가능)
    console.log("2번 방 검사 (방장 외 전원 준비 완료)");
    const room2Result = await gameStartController.checkRoomCanStart(2);
    console.dir(room2Result, { depth: null, colors: true });

    console.log("\n==================================================");
    console.log("모든 테스트가 완벽하게 통과했습니다!");
    console.log("==================================================");
  } catch (error) {
    console.error("\n테스트 진행 중 오류 발생 :", error);
  } finally {
    if (pool && typeof pool.end === "function") {
      await pool.end();
    }
    process.exit(0);
  }
}

runGameStartTest();
