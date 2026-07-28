import jwt from "jsonwebtoken";
import { authConfig } from "../config/authConfig.js";
import { validateJoinRoom, validateSendMessage } from "./socketDto.js";
import {
  saveAndFormatMessage,
  getRecentMessages,
} from "./socketService.js";

export function socketAuthMiddleware(socket, next) {
  let token;
  if (socket.handshake.auth && socket.handshake.auth.token) {
    token = socket.handshake.auth.token;
  } else if (
    socket.handshake.headers &&
    socket.handshake.headers.authorization
  ) {
    token = socket.handshake.headers.authorization;
  }

  if (!token) {
    return next(new Error("소켓 인증 실패: 토큰이 존재하지 않습니다."));
  }

  try {
    let actualToken;
    if (token.indexOf("Bearer ") === 0) {
      actualToken = token.split(" ")[1];
    } else {
      actualToken = token;
    }

    const decoded = jwt.verify(actualToken, authConfig.jwtSecret);

    socket.user = {
      id: decoded.id,
      username: decoded.username,
      displayName: decoded.displayName,
    };

    next();
  } catch (err) {
    return next(
      new Error("소켓 인증 실패: 유효하지 않거나 만료된 토큰입니다."),
    );
  }
}

export function registerChatHandlers(io, socket) {
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

  socket.on("disconnect", function () {
    console.log("[Socket 연결 종료] " + socket.user.displayName);
  });
}