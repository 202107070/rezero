import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import { env } from "./envConfig.js";
import {
  validateJoinRoom,
  validateReadyChange,
  validateSendMessage,
} from "../sockets/socketDto.js";
import {
  saveAndFormatMessage,
  getRecentMessages,
  saveReadyState,
} from "../sockets/socketService.js";

// socketDto.js 등에서 참조하는 socketConfig 설정 객체 추가
export const socketConfig = {
  maxMessageLength: 500,
  recentMessageLimit: 50,
  defaultRoom: "room_lobby",
};

export function socketAuthMiddleware(socket, next) {
  let token =
    socket.handshake.auth?.token || socket.handshake.headers?.authorization;

  if (!token) {
    return next(new Error("소켓 인증 실패 : 토큰이 존재하지 않습니다."));
  }

  try {
    let actualToken;
    if (token.startsWith("Bearer ")) {
      actualToken = token.split(" ")[1];
    } else {
      actualToken = token;
    }

    const secret = env.jwtSecret || process.env.JWT_SECRET;
    const decoded = jwt.verify(actualToken, secret);

    socket.user = {
      id: decoded.sub || decoded.id,
      username: decoded.username,
      displayName: decoded.displayName,
    };

    next();
  } catch (err) {
    return next(
      new Error("소켓 인증 실패 : 유효하지 않거나 만료된 토큰입니다."),
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

  socket.on("disconnect", function () {
    console.log("[Socket 연결 종료] " + socket.user.displayName);
  });
}

export function initSocket(server) {
  const io = new Server(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
  });

  io.use(socketAuthMiddleware);

  io.on("connection", (socket) => {
    registerChatHandlers(io, socket);
  });

  return io;
}
