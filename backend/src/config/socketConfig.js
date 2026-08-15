import { Server } from "socket.io";
import { socketAuthMiddleware } from "#controller/socketController.js";
import { registerSocketHandlers } from "#handler/socketHandler.js";

export const socketConfig = {
  maxMessageLength: 500,
  recentMessageLimit: 50,
  defaultRoom: "room_lobby",
};

export function initSocket(server) {
  const io = new Server(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
  });

  io.use(socketAuthMiddleware);

  io.on("connection", function (socket) {
    registerSocketHandlers(io, socket);
  });

  return io;
}
