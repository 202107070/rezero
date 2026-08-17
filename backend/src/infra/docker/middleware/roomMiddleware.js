import { redisClient } from "#config/redisConfig.js";
import { ROOM_CONFIG } from "#docker/config/roomConfig.js";

export const roomMiddleware = {
  validateRoomExists: async function (req, res, next) {
    try {
      let roomId = req.params.roomId;
      if (!roomId && req.body) {
        roomId = req.body.roomId;
      }

      if (!roomId) {
        return res.status(400).json({
          success: false,
          message: "Room ID is required.",
        });
      }

      const stateKey = ROOM_CONFIG.valkey.keys.state(roomId);
      const roomState = await redisClient.hGetAll(stateKey);

      if (!roomState || !roomState.hostUserId) {
        return res.status(404).json({
          success: false,
          message: "Room not found or expired: " + roomId,
        });
      }

      req.roomState = roomState;
      next();
    } catch (error) {
      console.error("[RoomMiddleware] Room validation error:", error.message);
      return res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  },

  verifyHostPermission: function (req, res, next) {
    try {
      const roomState = req.roomState;
      const user = req.user;

      if (!roomState) {
        return res.status(400).json({
          success: false,
          message:
            "Room state not loaded. Ensure validateRoomExists middleware is executed first.",
        });
      }

      if (!user || !user.id) {
        return res.status(401).json({
          success: false,
          message: "Authenticated user information is missing.",
        });
      }

      const hostUserId = String(roomState.hostUserId);
      const currentUserId = String(user.id);

      if (hostUserId !== currentUserId) {
        return res.status(403).json({
          success: false,
          message: "Only the room host can perform this action.",
        });
      }

      next();
    } catch (error) {
      console.error("[RoomMiddleware] Host verification error:", error.message);
      return res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  },

  verifyRoomWaitingStatus: function (req, res, next) {
    try {
      const roomState = req.roomState;

      if (!roomState) {
        return res.status(400).json({
          success: false,
          message: "Room state not loaded.",
        });
      }

      if (roomState.status !== ROOM_CONFIG.roomStatus.WAITING) {
        return res.status(400).json({
          success: false,
          message:
            "Room is not in WAITING status. Current status: " +
            roomState.status,
        });
      }

      next();
    } catch (error) {
      console.error(
        "[RoomMiddleware] Room status verification error:",
        error.message,
      );
      return res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  },
};
