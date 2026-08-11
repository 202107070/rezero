import { pool } from "#config/dbConfig.js";
import { redisClient } from "#config/redisConfig.js";
import { ROOM_CONFIG } from "#docker/config/roomConfig.js";

export const roomService = {
  createRoom: async function (data) {
    const title = data.title;
    const mode = data.mode;
    const hostId = data.hostId;

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      const query =
        "INSERT INTO rooms (title, mode, host_user_id, status) VALUES (?, ?, ?, ?)";
      const [result] = await connection.query(query, [
        title,
        mode,
        hostId,
        ROOM_CONFIG.roomStatus.WAITING,
      ]);
      const roomId = result.insertId;

      const stateKey = ROOM_CONFIG.valkey.keys.state(roomId);
      const participantsKey = ROOM_CONFIG.valkey.keys.participants(roomId);

      await redisClient.hSet(stateKey, {
        hostUserId: String(hostId),
        status: ROOM_CONFIG.roomStatus.WAITING,
        mode: mode,
      });

      await redisClient.sAdd(participantsKey, String(hostId));

      await connection.commit();
      return { roomId: roomId, title: title, mode: mode, hostId: hostId };
    } catch (error) {
      await connection.rollback();
      throw new Error("Room creation failed: " + error.message);
    } finally {
      connection.release();
    }
  },

  getRoomDetails: async function (roomId) {
    const stateKey = ROOM_CONFIG.valkey.keys.state(roomId);
    const roomState = await redisClient.hGetAll(stateKey);

    if (!roomState || !roomState.hostUserId) {
      const query =
        "SELECT id AS roomId, title, mode, host_user_id AS hostUserId, status FROM rooms WHERE id = ?";
      const [rows] = await pool.query(query, [roomId]);
      if (!rows || rows.length === 0) {
        throw new Error("Room not found.");
      }
      return rows[0];
    }

    const participants = await redisClient.sMembers(
      ROOM_CONFIG.valkey.keys.participants(roomId),
    );
    const readyPlayers = await redisClient.sMembers(
      ROOM_CONFIG.valkey.keys.ready(roomId),
    );

    return Object.assign({ roomId: roomId }, roomState, {
      participants: participants,
      readyPlayers: readyPlayers,
    });
  },

  toggleReady: async function (roomId, userId, isReady) {
    const readyKey = ROOM_CONFIG.valkey.keys.ready(roomId);
    const participantsKey = ROOM_CONFIG.valkey.keys.participants(roomId);

    const isParticipant = await redisClient.sIsMember(
      participantsKey,
      String(userId),
    );
    if (!isParticipant) {
      throw new Error("User is not a participant of this room.");
    }

    if (isReady) {
      await redisClient.sAdd(readyKey, String(userId));
    } else {
      await redisClient.sRem(readyKey, String(userId));
    }

    return { roomId: roomId, userId: userId, isReady: isReady };
  },
};
