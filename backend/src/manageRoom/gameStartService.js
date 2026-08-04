// src/manageRoom/gameStartService.js
import { pool } from "../config/dbConfig.js";
import { redisClient } from "../config/redisConfig.js";
import { GameStartDto } from "./gameStartDto.js";
import { ROOM_STATUS } from "./manageRoomConfig.js";

class GameStartService {
  async checkCanStart(roomId) {
    // 1. 방 상태 및 방장 조회 (mariadb 호환: 대괄호 없이 바로 받아옴)
    const roomQuery = `SELECT id, status, mode, host_user_id FROM rooms WHERE id = ?`;
    const roomRows = await pool.query(roomQuery, [roomId]);

    if (!roomRows || roomRows.length === 0) {
      return new GameStartDto({
        roomId,
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
        roomId,
        canStart: false,
        reason: `대기(WAITING) 상태의 방만 게임을 시작할 수 있습니다. (현재 상태: ${room.status})`,
        totalPlayers: 0,
        nonHostPlayers: 0,
        readyNonHostPlayers: 0,
      }).toJSON();
    }

    // 2. 현재 참가자와 READY 상태는 Valkey에서 조회
    const participants = await redisClient.sMembers(
      `room:${roomId}:participants`,
    );
    const readyPlayers = await redisClient.sMembers(`room:${roomId}:ready`);
    const totalPlayers = participants.length;

    // 방장 제외 인원 및 준비 상태 계산
    const nonHostParticipants = participants.filter(
      (userId) => String(userId) !== String(room.host_user_id),
    );
    const nonHostPlayersCount = nonHostParticipants.length;

    const readyPlayerSet = new Set(readyPlayers.map(String));
    const readyNonHostPlayersCount = nonHostParticipants.filter((userId) =>
      readyPlayerSet.has(String(userId)),
    ).length;

    // 3. 조건 검사
    const minimumPlayers = room.mode === "1/1" ? 2 : 3;
    if (totalPlayers < minimumPlayers) {
      return new GameStartDto({
        roomId,
        canStart: false,
        reason: `게임 시작을 위한 최소 인원(${minimumPlayers}명)이 부족합니다. (현재: ${totalPlayers}명)`,
        totalPlayers,
        nonHostPlayers: nonHostPlayersCount,
        readyNonHostPlayers: readyNonHostPlayersCount,
      }).toJSON();
    }

    const allNonHostReady =
      nonHostPlayersCount > 0 &&
      nonHostPlayersCount === readyNonHostPlayersCount;

    if (!allNonHostReady) {
      return new GameStartDto({
        roomId,
        canStart: false,
        reason: "방장을 제외한 모든 참가자가 Ready 상태여야 합니다.",
        totalPlayers,
        nonHostPlayers: nonHostPlayersCount,
        readyNonHostPlayers: readyNonHostPlayersCount,
      }).toJSON();
    }

    return new GameStartDto({
      roomId,
      canStart: true,
      reason: "모든 참가자가 준비 완료되어 게임을 시작할 수 있습니다.",
      totalPlayers,
      nonHostPlayers: nonHostPlayersCount,
      readyNonHostPlayers: readyNonHostPlayersCount,
    }).toJSON();
  }
}

export default new GameStartService();
