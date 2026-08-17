import { prepareInfoService } from "#docker/service/prepareInfoService.js";
import { pool } from "#config/dbConfig.js";
import { redisClient } from "#config/redisConfig.js";
import { GameStartDto } from "#dto/manageGameDto.js";
import { ROOM_STATUS } from "#config/manageRoomConfig.js";
import { lockService } from "#infra/redis/lockService.js";

class GameStartService {
  async checkCanStart(roomId, io) {
    const roomQuery =
      "SELECT id, status, mode, host_user_id FROM rooms WHERE id = ?";
    const roomRows = await pool.query(roomQuery, [roomId]);

    if (!roomRows || roomRows.length === 0) {
      return new GameStartDto({
        roomId: roomId,
        canStart: false,
        reason: "DB에 해당 방(id: " + roomId + ") 데이터가 존재하지 않습니다.",
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
        reason:
          "대기(WAITING) 상태의 방만 게임을 시작할 수 있습니다. (현재 상태: " +
          room.status +
          ")",
        totalPlayers: 0,
        nonHostPlayers: 0,
        readyNonHostPlayers: 0,
      }).toJSON();
    }

    const participants = await redisClient.sMembers(
      "room:" + roomId + ":participants",
    );
    const readyPlayers = await redisClient.sMembers(
      "room:" + roomId + ":ready",
    );
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

    let minimumPlayers = 3;
    if (room.mode === "1/1") {
      minimumPlayers = 2;
    }

    if (totalPlayers < minimumPlayers) {
      return new GameStartDto({
        roomId: roomId,
        canStart: false,
        reason:
          "게임 시작을 위한 최소 인원(" +
          minimumPlayers +
          "명)이 부족합니다. (현재: " +
          totalPlayers +
          "명)",
        totalPlayers: totalPlayers,
        nonHostPlayers: nonHostPlayersCount,
        readyNonHostPlayers: readyNonHostPlayersCount,
      }).toJSON();
    }

    let allNonHostReady = false;
    if (
      nonHostPlayersCount > 0 &&
      nonHostPlayersCount === readyNonHostPlayersCount
    ) {
      allNonHostReady = true;
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

    const lockKey = "room:" + roomId + ":container:start";
    const acquiredLock = await lockService.acquireLock(lockKey, 30);

    if (!acquiredLock) {
      return new GameStartDto({
        roomId: roomId,
        canStart: false,
        reason:
          "이미 게임룸 컨테이너 생성 요청이 진행 중이거나 처리되었습니다.",
        totalPlayers: totalPlayers,
        nonHostPlayers: nonHostPlayersCount,
        readyNonHostPlayers: readyNonHostPlayersCount,
      }).toJSON();
    }

    try {
      await prepareInfoService.getGameStartPayload(roomId, io);

      await pool.query("UPDATE rooms SET status = ? WHERE id = ?", [
        ROOM_STATUS.STARTED,
        roomId,
      ]);
      await redisClient.hSet(
        "room:" + roomId + ":state",
        "status",
        ROOM_STATUS.STARTED,
      );
    } catch (containerError) {
      await lockService.releaseLock(lockKey);
      throw containerError;
    }

    return new GameStartDto({
      roomId: roomId,
      canStart: true,
      reason:
        "모든 참가자가 준비 완료되어 게임 컨테이너를 실행하고 게임을 시작합니다.",
      totalPlayers: totalPlayers,
      nonHostPlayers: nonHostPlayersCount,
      readyNonHostPlayers: readyNonHostPlayersCount,
    }).toJSON();
  }
}

export default new GameStartService();
