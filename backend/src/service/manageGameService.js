import { pool } from "#config/dbConfig.js";
import { redisClient } from "#config/redisConfig.js";
import { GameStartDto } from "#dto/manageGameDto.js";
import { ROOM_STATUS } from "#config/manageRoomConfig.js";

class GameStartService {
  async checkCanStart(roomId) {
    const roomQuery = `SELECT id, status, mode, host_user_id FROM rooms WHERE id = ?`;
    const roomRows = await pool.query(roomQuery, [roomId]);

    if (!roomRows) {
      return new GameStartDto({
        roomId: roomId,
        canStart: false,
        reason: `DB에 해당 방(id: ${roomId}) 데이터가 존재하지 않습니다.`,
        totalPlayers: 0,
        nonHostPlayers: 0,
        readyNonHostPlayers: 0,
      }).toJSON();
    }

    if (roomRows.length === 0) {
      return new GameStartDto({
        roomId: roomId,
        canStart: false,
        reason: `DB에 해당 방(id: ${roomId}) 데이터가 존재하지 않습니다.`,
        totalPlayers: 0,
        nonHostPlayers: 0,
        readyNonHostPlayers: 0,
      }).toJSON();
    }

    const room = roomRows[0];

    if (room.status !== ROOM_STATUS.WAITING) {
      return new GameStartDto({
        roomId: roomId,
        canStart: false,
        reason: `대기(WAITING) 상태의 방만 게임을 시작할 수 있습니다. (현재 상태: ${room.status})`,
        totalPlayers: 0,
        nonHostPlayers: 0,
        readyNonHostPlayers: 0,
      }).toJSON();
    }

    const participants = await redisClient.sMembers(
      `room:${roomId}:participants`,
    );
    const readyPlayers = await redisClient.sMembers(`room:${roomId}:ready`);
    const totalPlayers = participants.length;

    const nonHostParticipants = participants.filter(function (userId) {
      return String(userId) !== String(room.host_user_id);
    });
    const nonHostPlayersCount = nonHostParticipants.length;

    const readyPlayerSet = new Set(
      readyPlayers.map(function (item) {
        return String(item);
      }),
    );

    const readyNonHostPlayersCount = nonHostParticipants.filter(
      function (userId) {
        return readyPlayerSet.has(String(userId));
      },
    ).length;

    let minimumPlayers;
    if (room.mode === "1/1") {
      minimumPlayers = 2;
    } else {
      minimumPlayers = 3;
    }

    if (totalPlayers < minimumPlayers) {
      return new GameStartDto({
        roomId: roomId,
        canStart: false,
        reason: `게임 시작을 위한 최소 인원(${minimumPlayers}명)이 부족합니다. (현재: ${totalPlayers}명)`,
        totalPlayers: totalPlayers,
        nonHostPlayers: nonHostPlayersCount,
        readyNonHostPlayers: readyNonHostPlayersCount,
      }).toJSON();
    }

    let allNonHostReady = false;
    if (nonHostPlayersCount > 0) {
      if (nonHostPlayersCount === readyNonHostPlayersCount) {
        allNonHostReady = true;
      }
    }

    if (!allNonHostReady) {
      return new GameStartDto({
        roomId: roomId,
        canStart: false,
        reason: "방장을 제외한 모든 참가자가 Ready 상태여야 합니다.",
        totalPlayers: totalPlayers,
        nonHostPlayers: nonHostPlayersCount,
        readyNonHostPlayers: readyNonHostPlayersCount,
      }).toJSON();
    }

    return new GameStartDto({
      roomId: roomId,
      canStart: true,
      reason: "모든 참가자가 준비 완료되어 게임을 시작할 수 있습니다.",
      totalPlayers: totalPlayers,
      nonHostPlayers: nonHostPlayersCount,
      readyNonHostPlayers: readyNonHostPlayersCount,
    }).toJSON();
  }
}

export default new GameStartService();
