import {
  validateJoinRoom,
  validateSendMessage,
  validateReadyChange,
} from "#dto/socketDto.js";
import {
  saveAndFormatMessage,
  getRecentMessages,
  saveReadyState,
} from "#service/socketService.js";
import gameStartService from "#service/manageGameService.js";
import { redisClient } from "#config/redisConfig.js";
import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

export function registerSocketHandlers(io, socket) {
  console.log(
    "[Socket 연결 완료] " + socket.user.displayName + " (" + socket.id + ")",
  );

  socket.on("join_room", async function (data, callback) {
    try {
      const validatedRoom = validateJoinRoom(data);
      const roomId = validatedRoom.roomId;

      socket.join(roomId);
      console.log(
        socket.user.displayName + " 님이 [" + roomId + "] 방에 입장함",
      );

      const recentMessages = await getRecentMessages(roomId);

      socket.to(roomId).emit("user_joined", {
        message: socket.user.displayName + " 님이 입장하셨습니다.",
        user: socket.user,
      });

      if (typeof callback === "function") {
        callback({ success: true, recentMessages: recentMessages });
      }
    } catch (error) {
      if (typeof callback === "function") {
        callback({ success: false, message: error.message });
      }
    }
  });

  socket.on("send_message", async function (data, callback) {
    try {
      const validatedData = validateSendMessage(data);

      const chatMessage = await saveAndFormatMessage({
        roomId: validatedData.roomId,
        sender: socket.user,
        message: validatedData.message,
      });

      io.to(validatedData.roomId).emit("receive_message", chatMessage);

      if (typeof callback === "function") {
        callback({ success: true });
      }
    } catch (error) {
      socket.emit("chat_error", { message: error.message });
      if (typeof callback === "function") {
        callback({ success: false, message: error.message });
      }
    }
  });

  socket.on("toggle_ready", async function (data, callback) {
    try {
      const validatedData = validateReadyChange(data);
      const readyState = await saveReadyState({
        roomId: validatedData.roomId,
        userId: socket.user.id,
        isReady: validatedData.isReady,
      });

      io.to(validatedData.roomId).emit("ready_changed", readyState);

      if (typeof callback === "function") {
        callback({ success: true, readyState: readyState });
      }
    } catch (error) {
      if (typeof callback === "function") {
        callback({ success: false, message: error.message });
      }
    }
  });

  socket.on("request_game_start", async function (data, callback) {
    const lockKey = `room:${data?.roomId}:container:lock`;
    
    try {
      const roomId = data && data.roomId ? String(data.roomId) : null;
      if (!roomId) {
        throw new Error("유효한 roomId가 필요합니다.");
      }

      const checkResult = await gameStartService.checkCanStart(roomId);

      if (!checkResult.canStart) {
        if (typeof callback === "function") {
          callback({ success: false, message: checkResult.reason, data: checkResult });
        }
        return;
      }

      const acquiredLock = await redisClient.set(lockKey, "locked", {
        NX: true,
        EX: 30,
      });

      if (!acquiredLock) {
        if (typeof callback === "function") {
          callback({ 
            success: false, 
            message: "이미 게임룸 컨테이너 생성 요청이 진행 중이거나 실행되었습니다." 
          });
        }
        return;
      }

      let containerStarted = false;

      try {
        const containerName = `gameroom_${roomId}`;
        const imageName = "gameroom:latest";

        try {
          await execFileAsync("podman", ["rm", "-f", containerName]);
        } catch (e) {}

        await execFileAsync("podman", [
          "run",
          "-d",
          "--name",
          containerName,
          "-e",
          `ROOM_ID=${roomId}`,
          imageName,
        ]);

        containerStarted = true;
      } catch (containerError) {
        console.error(`[Podman Error] 방 ID ${roomId} 컨테이너 생성 실패:`, containerError);
        containerStarted = false;
        await redisClient.del(lockKey);
      }

      if (!containerStarted) {
        if (typeof callback === "function") {
          callback({ success: false, message: "게임룸 컨테이너 생성에 실패하였습니다." });
        }
        return;
      }

      io.to(roomId).emit("game_started", {
        roomId: roomId,
        message: "게임이 시작되었습니다. 게임룸으로 접속합니다.",
      });

      if (typeof callback === "function") {
        callback({ success: true, data: checkResult });
      }
    } catch (error) {
      try {
        await redisClient.del(lockKey);
      } catch (e) {}

      if (typeof callback === "function") {
        callback({ success: false, message: error.message });
      }
    }
  });

  socket.on("disconnect", function () {
    console.log("[Socket 연결 종료] " + socket.user.displayName);
  });
}
