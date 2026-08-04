import { pool } from "../config/dbConfig.js";
import { redisClient } from "../config/redisConfig.js";

export async function saveAndFormatMessage(params) {
  const roomId = params.roomId;
  const sender = params.sender;
  const message = params.message;

  const chatData = {
    roomId: roomId,
    senderId: sender.id,
    senderUsername: sender.username,
    senderDisplayName: sender.displayName,
    message: message,
    createdAt: new Date().toISOString(),
  };

  try {
    const redisKey = "chat:room:" + roomId + ":recent";
    await redisClient.lPush(redisKey, JSON.stringify(chatData));
    await redisClient.lTrim(redisKey, 0, 49);
  } catch (err) {
    console.error("Valkey 최근 대화 저장 실패: " + err.message);
  }

  // DB 영구 저장 필요 시 chat_messages 테이블에 INSERT
  /*
  const sql = " \
    INSERT INTO chat_messages (room_id, user_id, message, created_at) \
    VALUES (?, ?, ?, NOW()) \
  ";
  await pool.query(sql, [roomId, sender.id, message]);
  */

  return chatData;
}

export async function getRecentMessages(roomId) {
  try {
    const redisKey = "chat:room:" + roomId + ":recent";
    const cachedMessages = await redisClient.lRange(redisKey, 0, 49);

    if (cachedMessages && cachedMessages.length > 0) {
      const parsedMessages = [];
      for (let i = 0; i < cachedMessages.length; i++) {
        parsedMessages.push(JSON.parse(cachedMessages[i]));
      }
      return parsedMessages.reverse();
    }
  } catch (err) {
    console.error("Valkey 조회 실패, DB 조회 전환: " + err.message);
  }

  return [];
}

export async function saveReadyState(params) {
  const roomId = params.roomId;
  const userId = String(params.userId);
  const participantsKey = "room:" + roomId + ":participants";
  const readyKey = "room:" + roomId + ":ready";
  const stateKey = "room:" + roomId + ":state";

  const roomState = await redisClient.hGetAll(stateKey);
  if (!roomState || !roomState.hostUserId) {
    throw new Error("현재 대기 중인 방을 찾을 수 없습니다.");
  }

  const isParticipant = await redisClient.sIsMember(participantsKey, userId);
  if (!isParticipant) {
    throw new Error("방에 참가한 사용자만 READY 상태를 변경할 수 있습니다.");
  }

  if (String(roomState.hostUserId) === userId) {
    throw new Error("방장은 READY 대상이 아닙니다.");
  }

  if (params.isReady) {
    await redisClient.sAdd(readyKey, userId);
  } else {
    await redisClient.sRem(readyKey, userId);
  }

  return {
    roomId: String(roomId),
    userId,
    isReady: params.isReady,
  };
}
