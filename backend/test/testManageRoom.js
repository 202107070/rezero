import { pool } from "#config/dbConfig.js";
import manageRoomService from "#service/manageRoomService.js";
import manageRoomController from "#controller/manageRoomController.js";
import { ROOM_STATUS } from "#config/manageRoomConfig.js";

async function runManageRoomTest() {
  console.log("==================================================");
  console.log("모듈 통합 테스트 시작");
  console.log("==================================================\n");

  try {
    console.log("1. Service Layer 테스트 (getRooms(3))");
    const serviceResult = await manageRoomService.getRooms(3);

    console.log("조회된 방 개수: " + serviceResult.length + "개");
    console.dir(serviceResult, { depth: null, colors: true });
    console.log("\n--------------------------------------------------\n");

    console.log("2. Controller Layer 테스트 (fetchRooms(3))");
    const controllerResult = await manageRoomController.fetchRooms(3);

    console.log("Controller 응답 객체:");
    console.dir(controllerResult, { depth: null, colors: true });
    console.log("\n--------------------------------------------------\n");

    console.log("3. 입장 가능 여부(isJoinable) 비즈니스 로직 검증");

    for (let index = 0; index < serviceResult.length; index++) {
      const room = serviceResult[index];
      const roomNumber = index + 1;

      console.log(
        "\n[방 #" +
          roomNumber +
          "] ID: " +
          room.roomId +
          ' | 제목: "' +
          room.title +
          '"',
      );
      console.log(" - 상태(status): " + room.status);
      console.log(
        " - 현재/최대 인원: " + room.currentPlayers + " / " + room.maxPlayers,
      );

      let joinableText = "불가능";
      if (room.isJoinable) {
        joinableText = "가능";
      }
      console.log(" - 입장 가능 여부(isJoinable): " + joinableText);

      if (room.status === ROOM_STATUS.STARTED) {
        console.log("    └─ 사유: 이미 게임이 시작(STARTED)된 방입니다.");
      } else {
        if (room.currentPlayers >= room.maxPlayers) {
          console.log("    └─ 사유: 정원이 가득 찬 방입니다.");
        } else {
          console.log("    └─ 사유: 대기 중이며 입장할 자리가 있습니다.");
        }
      }
    }

    console.log("\n==================================================");
    console.log("모든 테스트가 성공적으로 완료되었습니다!");
    console.log("==================================================");
  } catch (error) {
    console.error("\n테스트 진행 중 오류 발생:", error);
    process.exitCode = 1;
  } finally {
    if (pool) {
      if (typeof pool.end === "function") {
        await pool.end();
      }
    }
  }
}

runManageRoomTest();
