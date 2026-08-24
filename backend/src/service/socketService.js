import { pool as dbPool } from "#config/dbConfig.js";
import { redisClient } from "#config/redisConfig.js";
import { SOCKET_EVENTS } from "#constants/socketEvents.js";
import { socketDto } from "#dto/socketDto.js";

export const saveInfoService = {
  async saveGameResult(params) {
    const matchId = params.matchId;
    const roomId = params.roomId;
    const winnerId = params.winnerId;
    const score = params.score;
    let submissions = params.submissions;

    if (!submissions) {
      submissions = [];
    }

    const connection = await dbPool.getConnection();
    try {
      await connection.beginTransaction();

      await connection.query(
        `UPDATE matches 
         SET status = 'FINISHED', finished_at = CURRENT_TIMESTAMP 
         WHERE id = ?`,
        [matchId],
      );

      if (submissions && submissions.length > 0) {
        for (let i = 0; i < submissions.length; i++) {
          const sub = submissions[i];

          let ingameScore = sub.score;
          if (ingameScore === undefined || ingameScore === null) {
            ingameScore = 0;
          }

          let ratingBefore = sub.ratingBefore;
          if (ratingBefore === undefined || ratingBefore === null) {
            ratingBefore = 1000;
          }

          let ratingDelta = sub.ratingDelta;
          if (ratingDelta === undefined || ratingDelta === null) {
            ratingDelta = 0;
          }

          let codes = sub.codes;
          if (!codes) {
            codes = [];
          }

          let solveTimes = sub.solveTimes;
          if (!solveTimes) {
            solveTimes = [];
          }

          let problemResults = sub.problemResults;
          if (!problemResults) {
            problemResults = [];
          }

          let solvedProblems = sub.solvedProblems;
          if (!solvedProblems) {
            solvedProblems = [];
          }

          let totalSolveTime = sub.totalSolveTime;
          if (totalSolveTime === undefined || totalSolveTime === null) {
            totalSolveTime = 0;
          }

          let completionTime = sub.completionTime;
          if (completionTime === undefined || completionTime === null) {
            completionTime = 0;
          }

          await connection.query(
            `INSERT INTO match_submissions 
              (match_id, user_id, ingame_score, rating_score_before, rating_delta, codes, solve_times, problem_results, solved_problems, total_solve_time, completion_time)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              matchId,
              sub.userId,
              ingameScore,
              ratingBefore,
              ratingDelta,
              JSON.stringify(codes),
              JSON.stringify(solveTimes),
              JSON.stringify(problemResults),
              JSON.stringify(solvedProblems),
              totalSolveTime,
              completionTime,
            ],
          );
        }
      } else if (winnerId) {
        await connection.query(
          `INSERT INTO match_submissions 
            (match_id, user_id, ingame_score, rating_score_before, rating_delta, codes, solve_times, problem_results, solved_problems, total_solve_time, completion_time)
           VALUES (?, ?, ?, 1000, 0, '[]', '[]', '[]', '[]', 0, 0)
           ON DUPLICATE KEY UPDATE ingame_score = VALUES(ingame_score)`,
          [matchId, winnerId, score],
        );
      }

      await connection.commit();
      console.log(
        "[saveInfoService] Successfully saved match result for matchId: " +
          matchId,
      );
      return true;
    } catch (error) {
      await connection.rollback();
      console.error("[saveInfoService] Failed to save game result:", error);
      throw error;
    } finally {
      connection.release();
    }
  },
};

export async function saveAndFormatMessage(params) {
  const roomId = params.roomId;
  const sender = params.sender;
  const message = params.message;

  const chatData = {
    roomId: roomId,
    sender: {
      id: sender.id,
      displayName: sender.displayName,
    },
    message: message,
    timestamp: new Date().toISOString(),
  };

  try {
    const key = "room:" + roomId + ":messages";
    await redisClient.rPush(key, JSON.stringify(chatData));
    await redisClient.lTrim(key, -50, -1);
  } catch (error) {
    console.error("[getRecentMessages] Redis Error: " + error.message);
  }

  return chatData;
}

export async function getRecentMessages(roomId) {
  try {
    const key = "room:" + roomId + ":messages";
    const messages = await redisClient.lRange(key, 0, -1);
    const parsedMessages = [];

    for (let i = 0; i < messages.length; i++) {
      parsedMessages.push(JSON.parse(messages[i]));
    }

    return parsedMessages;
  } catch (error) {
    console.error("[getRecentMessages] Redis Error: " + error.message);
    return [];
  }
}

export async function saveReadyState(params) {
  const roomId = params.roomId;
  const userId = String(params.userId);
  const isReady = params.isReady;

  try {
    const key = "room:" + roomId + ":ready";

    const keyType = await redisClient.type(key);
    if (keyType !== "none" && keyType !== "set") {
      await redisClient.del(key);
    }

    if (isReady) {
      await redisClient.sAdd(key, userId);
    } else {
      await redisClient.sRem(key, userId);
    }

    const readyUserIds = await redisClient.sMembers(key);
    const readySet = new Set(readyUserIds.map(String));

    const participants = await redisClient.sMembers(
      "room:" + roomId + ":participants",
    );
    const allUsers = participants.length > 0 ? participants : [userId];

    const readyStates = allUsers.map(function (uId) {
      return {
        userId: String(uId),
        isReady: readySet.has(String(uId)),
      };
    });

    return {
      userId: userId,
      isReady: isReady,
      roomReadyStates: readyStates,
    };
  } catch (error) {
    console.error("[saveReadyState] Redis Error: " + error.message);
    return { userId: userId, isReady: isReady };
  }
}

export const socketGameService = {
  broadcastGameState(io, roomId, gameStateData) {
    const payload = socketDto.toGameStateResponse(gameStateData);
    io.to(roomId).emit(SOCKET_EVENTS.GAME_STATE_UPDATE, payload);
  },

  sendExecutionResult(socket, resultData) {
    const payload = socketDto.toExecResultResponse(resultData);
    socket.emit(SOCKET_EVENTS.EXEC_RESULT, payload);
  },

  broadcastItemUsed(io, roomId, itemData) {
    const payload = socketDto.toItemResultResponse(itemData);
    io.to(roomId).emit(SOCKET_EVENTS.ITEM_USED, payload);
  },

  broadcastNextQuestion(io, roomId, nextQuestionData) {
    const payload = socketDto.toNextQuestionResponse(nextQuestionData);
    io.to(roomId).emit(SOCKET_EVENTS.NEXT_QUESTION_STARTED, payload);
  },
};
