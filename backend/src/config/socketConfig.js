import { Server } from "socket.io";
import { socketAuthMiddleware } from "#controller/socketController.js";
import { registerSocketHandlers } from "#handler/socketHandler.js";

let socketServer;

export const socketConfig = {
  maxMessageLength: 500,
  recentMessageLimit: 50,
  defaultRoom: "room_lobby",
};

export function initSocket(server) {
  socketServer = new Server(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
  });

  socketServer.use(socketAuthMiddleware);

  socketServer.on("connection", function (socket) {
    registerSocketHandlers(socketServer, socket);
  });

  return socketServer;
}

export function getSocket() {
  return socketServer;
}
