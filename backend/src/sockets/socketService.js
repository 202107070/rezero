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