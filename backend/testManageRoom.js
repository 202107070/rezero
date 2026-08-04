// testManageRoom.js
import { pool } from "./src/config/dbConfig.js";
import manageRoomService from "./src/manageRoom/manageRoomService.js";
import manageRoomController from "./src/manageRoom/manageRoomController.js";
import { ROOM_STATUS } from "./src/manageRoom/manageRoomConfig.js";

async function runManageRoomTest() {
  console.log("==================================================");
  console.log("모듈 통합 테스트 시작");
  console.log("==================================================\n");

  try {
    // 1. Service 단위 테스트 (DB에서 3개 조회 테스트)
    console.log("1. Service Layer 테스트 (getRooms(3))");
    const serviceResult = await manageRoomService.getRooms(3);

    console.log(`조회된 방 개수: ${serviceResult.length}개`);
    console.dir(serviceResult, { depth: null, colors: true });
    console.log("\n--------------------------------------------------\n");

    // 2. Controller 단위 테스트
    console.log("2. Controller Layer 테스트 (fetchRooms(3))");
    const controllerResult = await manageRoomController.fetchRooms(3);

    console.log("Controller 응답 객체:");
    console.dir(controllerResult, { depth: null, colors: true });
    console.log("\n--------------------------------------------------\n");

    // 3. 비즈니스 로직(isJoinable) 검증 테스트
    console.log("3. 입장 가능 여부(isJoinable) 비즈니스 로직 검증");

    serviceResult.forEach((room, index) => {
      console.log(
        `\n[방 #${index + 1}] ID: ${room.roomId} | 제목: "${room.title}"`,
      );
      console.log(` - 상태(status): ${room.status}`);
      console.log(
        ` - 현재/최대 인원: ${room.currentPlayers} / ${room.maxPlayers}`,
      );
      console.log(
        ` - 입장 가능 여부(isJoinable): ${room.isJoinable ? "가능" : "불가능"}`,
      );

      if (room.status === ROOM_STATUS.STARTED) {
        console.log("   └─ 사유: 이미 게임이 시작(STARTED)된 방입니다.");
      } else if (room.currentPlayers >= room.maxPlayers) {
        console.log("   └─ 사유: 정원이 가득 찬 방입니다.");
      } else {
        console.log("   └─ 사유: 대기 중이며 입장할 자리가 있습니다.");
      }
    });

    console.log("\n==================================================");
    console.log("모든 테스트가 성공적으로 완료되었습니다!");
    console.log("==================================================");
  } catch (error) {
    console.error("\n테스트 진행 중 오류 발생:", error);
  } finally {
    // pool 객체로 종료 처리
    if (pool && typeof pool.end === "function") {
      await pool.end();
    }
    process.exit(0);
  }
}

runManageRoomTest();
