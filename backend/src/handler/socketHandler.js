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
    try {
      let roomId = null;
      if (data && data.roomId) {
        roomId = String(data.roomId);
      }

      if (!roomId) {
        throw new Error("유효한 roomId가 필요합니다.");
      }

      const startResult = await gameStartService.checkCanStart(roomId, io);

      if (!startResult.canStart) {
        if (typeof callback === "function") {
          callback({
            success: false,
            message: startResult.reason,
            data: startResult,
          });
        }
        return;
      }

      if (typeof callback === "function") {
        callback({ success: true, data: startResult });
      }
    } catch (error) {
      if (typeof callback === "function") {
        callback({ success: false, message: error.message });
      }
    }
  });

  socket.on("disconnect", function () {
    console.log("[Socket 연결 종료] " + socket.user.displayName);
  });
}
