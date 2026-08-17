import { pool as dbPool } from "#config/dbConfig.js";
import { redisClient } from "#config/redisConfig.js";
import { lockService } from "#infra/redis/lockService.js";
import { ROOM_CONFIG } from "#docker/config/roomConfig.js";

function toSafeHashObject(obj) {
  const result = {};
  for (const [key, val] of Object.entries(obj)) {
    result[key] = val ?? "";
  }
  return result;
}

class PrepareInfoService {
  async getGameStartPayload(roomId, io) {
    const lockKey = `lock:prepare_game:${roomId}`;

    return await lockService.executeWithLock(lockKey, 10, async () => {
      console.log(
        `\n[PrepareInfoService] 방(${roomId})의 게임 시작 정보 연산 시작...`,
      );

      const roomStateKey = ROOM_CONFIG.valkey.keys.state(roomId);
      const participantsKey = ROOM_CONFIG.valkey.keys.participants(roomId);

      const existingState = (await redisClient.hGetAll(roomStateKey)) ?? {};
      const participants = (await redisClient.sMembers(participantsKey)) ?? [];

      const roomRows = await dbPool.query(
        "SELECT id, title, language, difficulty FROM rooms WHERE id = ?",
        [roomId],
      );
      if (!roomRows?.length) {
        throw new Error(`존재하지 않는 방입니다. (roomId: ${roomId})`);
      }
      const roomInfo = roomRows[0];

      const language = existingState.language || roomInfo.language || "python";
      const difficulty =
        existingState.difficulty || roomInfo.difficulty || "easy";

      const problemRows = await dbPool.query(
        "SELECT id, type, difficulty, title, question, description, answer, options, explanation FROM problems ORDER BY RAND() LIMIT 1",
      );
      if (!problemRows?.length) {
        throw new Error("게임에 사용할 수 있는 문제가 DB에 존재하지 않습니다.");
      }

      const rawProblem = problemRows[0];
      const defaultRoundSeconds = 60;
      const matchId = `battle-${roomId}`;

      await redisClient.hSet(
        roomStateKey,
        toSafeHashObject({
          matchId,
          currentProblemIndex: "1",
          timeLimit: defaultRoundSeconds,
          status: ROOM_CONFIG.roomStatus?.IN_GAME ?? "IN_GAME",
          problemId: rawProblem.id,
          language,
          difficulty,
        }),
      );

      const safeProblem = {
        id: rawProblem.id ?? "",
        type: rawProblem.type ?? "",
        difficulty: rawProblem.difficulty ?? "",
        title: rawProblem.title ?? "",
        question: rawProblem.question ?? "",
        description: rawProblem.description ?? "",
        options: rawProblem.options ?? null,
        timeLimit: defaultRoundSeconds,
      };

      const socketPayload = {
        matchId,
        roomId: String(roomId),
        message: "배틀이 곧 시작됩니다! 준비하세요.",
        status: ROOM_CONFIG.roomStatus?.IN_GAME ?? "IN_GAME",
        currentProblemIndex: 1,
        timeLimit: defaultRoundSeconds,
        participants,
        problem: safeProblem,
      };

      if (io) {
        const targetRoom = String(roomId);

        io.to(targetRoom).emit("game_start_notice", {
          message: "배틀이 곧 시작됩니다! 준비하세요.",
          roomId: targetRoom,
        });

        io.to(targetRoom).emit("game_started", socketPayload);
      }

      console.log(`[PrepareInfoService] 연산 완료 (Match ID: ${matchId})`);
      return socketPayload;
    });
  }
}

export const prepareInfoService = new PrepareInfoService();
