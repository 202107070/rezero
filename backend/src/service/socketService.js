import { pool as dbPool } from "#config/dbConfig.js";
import { redisClient } from "#config/redisConfig.js";
import { SOCKET_EVENTS } from "#constants/socketEvents.js";
import { socketDto } from "#dto/socketDto.js";
import * as roomModel from "../api/room/model.js";

const ONLINE_SET_KEY = "presence:online";
const ONLINE_META_PREFIX = "presence:meta:";
export const LOBBY_ROOM_ID = "lobby";

export async function markUserOnline(user) {
  if (!user?.id) return;
  const userId = String(user.id);
  try {
    let ratingScore = user.ratingScore;
    if (ratingScore == null) {
      try {
        const rows = await dbPool.query(
          "SELECT rating_score AS ratingScore FROM users WHERE id = ? LIMIT 1",
          [userId],
        );
        ratingScore = rows[0]?.ratingScore ?? 1000;
      } catch {
        ratingScore = 1000;
      }
    }
    await redisClient.sAdd(ONLINE_SET_KEY, userId);
    const fields = {
      userId,
      username: String(user.username || ""),
      displayName: String(user.displayName || user.username || userId),
      ratingScore: String(Number(ratingScore) || 1000),
      updatedAt: new Date().toISOString(),
    };
    if (user.equippedTitleId != null) {
      fields.equippedTitleId = String(user.equippedTitleId || "");
    }
    await redisClient.hSet(ONLINE_META_PREFIX + userId, fields);
  } catch (err) {
    console.error("[markUserOnline] " + err.message);
  }
}

export async function markUserOffline(userId) {
  if (!userId) return;
  const id = String(userId);
  try {
    await redisClient.sRem(ONLINE_SET_KEY, id);
    await redisClient.del(ONLINE_META_PREFIX + id);
  } catch (err) {
    console.error("[markUserOffline] " + err.message);
  }
}

export async function listOnlineUsers() {
  try {
    const ids = await redisClient.sMembers(ONLINE_SET_KEY);
    const users = [];
    for (let i = 0; i < ids.length; i++) {
      const meta = await redisClient.hGetAll(ONLINE_META_PREFIX + ids[i]);
      if (meta && meta.userId) {
        users.push({
          userId: meta.userId,
          username: meta.username || "",
          displayName: meta.displayName || meta.username || meta.userId,
          equippedTitleId: meta.equippedTitleId || null,
          ratingScore: Number(meta.ratingScore || 1000),
        });
      }
    }
    return users;
  } catch (err) {
    console.error("[listOnlineUsers] " + err.message);
    return [];
  }
}

export async function broadcastLobbyPresence(io) {
  if (!io) return;
  const users = await listOnlineUsers();
  io.to(LOBBY_ROOM_ID).emit(SOCKET_EVENTS.LOBBY_PRESENCE, { users });
}

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
  const mode = params.mode || "ALL";
  const targetUserId = params.targetUserId || null;
  const targetUserName = params.targetUserName || "";

  const chatData = {
    roomId: roomId,
    sender: {
      id: sender.id,
      username: sender.username || "",
      displayName:
        sender.displayName || sender.username || String(sender.id || "UNKNOWN"),
    },
    message: message,
    mode,
    targetUserId,
    targetUserName,
    timestamp: new Date().toISOString(),
  };

  // 전체 채팅만 방 히스토리에 저장 (친구/귓속말은 개인 전달)
  if (mode === "ALL") {
    try {
      const key = "room:" + roomId + ":messages";
      await redisClient.rPush(key, JSON.stringify(chatData));
      await redisClient.lTrim(key, -50, -1);
    } catch (error) {
      console.error("[getRecentMessages] Redis Error: " + error.message);
    }
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

/** 재입장 시 이전 대화를 보여주지 않도록 Redis에 쌓인 채팅을 비웁니다. */
export async function clearRoomChatMessages(roomId) {
  if (!roomId) return;
  try {
    await redisClient.del([
      "room:" + roomId + ":messages",
      "chat:room:" + roomId + ":recent",
    ]);
  } catch (error) {
    console.error("[clearRoomChatMessages] Redis Error: " + error.message);
  }
}

/** 서버 기동 시 남아 있는 채팅 캐시를 모두 제거합니다. */
export async function clearAllPersistedChatMessages() {
  try {
    const messageKeys = await redisClient.keys("room:*:messages");
    const legacyKeys = await redisClient.keys("chat:room:*:recent");
    const keys = [...messageKeys, ...legacyKeys];
    if (keys.length > 0) {
      await redisClient.del(keys);
    }
    if (keys.length > 0) {
      console.log(
        "[socketService] persisted chat cleared (" + keys.length + " keys)",
      );
    }
  } catch (error) {
    console.error("[clearAllPersistedChatMessages] Redis Error: " + error.message);
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

    // DB room_participants.is_ready 도 동기화
    try {
      await dbPool.query(
        `UPDATE room_participants
         SET is_ready = ?
         WHERE room_id = ?
           AND user_id = ?
           AND left_at IS NULL`,
        [isReady ? 1 : 0, roomId, userId],
      );
    } catch (dbError) {
      console.error("[saveReadyState] DB Error: " + dbError.message);
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

export async function cleanupRoomValkeyData(roomId) {
  try {
    const keysToDel = [
      "room:" + roomId + ":state",
      "room:" + roomId + ":participants",
      "room:" + roomId + ":ready",
      "room:" + roomId + ":messages",
      "room:" + roomId + ":problems",
    ];
    for (let i = 0; i < keysToDel.length; i++) {
      await redisClient.del(keysToDel[i]);
    }
    console.log(
      "[socketService] Valkey 방 데이터 정리 완료 (roomId: " + roomId + ")",
    );
  } catch (err) {
    console.error("[cleanupRoomValkeyData] Redis Error: " + err.message);
  }
}

/** 매치 종료 후 방을 WAITING으로 되돌리고 참가자 Valkey 상태를 복구합니다. */
export async function resetRoomAfterMatch(roomId) {
  try {
    await roomModel.markRoomWaiting(roomId);
    const room = await roomModel.findRoomById(roomId);
    if (!room) {
      await cleanupRoomValkeyData(roomId);
      return;
    }

    const participants = await roomModel.findRoomParticipants(roomId);
    const id = String(roomId);

    await redisClient.del([
      "room:" + id + ":ready",
      "room:" + id + ":problems",
      "room:" + id + ":state",
      "room:" + id + ":participants",
      "room:" + id + ":messages",
      "chat:room:" + id + ":recent",
    ]);

    // DB is_ready 는 markRoomWaiting에서 이미 초기화됨. Redis ready 집합도 비운 채 참가자만 복구.
    const multi = redisClient.multi();
    for (let i = 0; i < participants.length; i++) {
      multi.sAdd("room:" + id + ":participants", String(participants[i].userId));
    }
    multi.hSet("room:" + id + ":state", {
      status: "WAITING",
      hostUserId: String(room.hostUserId),
      currentPlayers: String(participants.length),
      maxPlayers: String(room.maxPlayers),
      updatedAt: new Date().toISOString(),
    });
    await multi.exec();

    console.log(
      "[socketService] 매치 종료 후 방 WAITING 복구 (roomId: " + roomId + ", players: " + participants.length + ")",
    );
  } catch (err) {
    console.error("[resetRoomAfterMatch] Error: " + err.message);
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

  async broadcastGameEnded(io, roomId, resultData) {
    io.to(String(roomId)).emit(SOCKET_EVENTS.GAME_ENDED, resultData);
    await resetRoomAfterMatch(roomId);
    // 다시하기 시 전원 ready 해제 동기화
    try {
      const participants = await roomModel.findRoomParticipants(roomId);
      const roomReadyStates = (participants || []).map(function (p) {
        return { userId: String(p.userId), isReady: false };
      });
      io.to(String(roomId)).emit(SOCKET_EVENTS.READY_CHANGED, {
        userId: null,
        isReady: false,
        roomReadyStates,
      });
    } catch {
      // ignore
    }
  },
};
