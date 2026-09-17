/**
 * 로비 테스트용: 열린 방을 모두 CLOSED 처리하고 WAITING/STARTED 샘플 방 3개만 남깁니다.
 * 또한 유령 WAITING(참가자 0) 방 정리 모드를 지원합니다.
 *
 * 사용 (Pi에서 권장):
 *   node backend/scripts/resetTestLobbyRooms.js
 *   node backend/scripts/resetTestLobbyRooms.js --stale-only
 *
 * Windows에서 Pi DB에 붙을 때:
 *   set DB_HOST=100.126.240.26
 *   node backend/scripts/resetTestLobbyRooms.js
 *
 * 비공개 방 비밀번호: 1234
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import mariadb from "mariadb";
import bcrypt from "bcryptjs";
import { createClient } from "redis";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../.env") });

const PRIVATE_PASSWORD = "1234";
const STALE_ONLY = process.argv.includes("--stale-only");
const STALE_MAX_AGE_HOURS = 6;

const pool = mariadb.createPool({
  host: process.env.DB_HOST || "127.0.0.1",
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  connectionLimit: 2,
  connectTimeout: 8000,
});

async function clearPersistedChat() {
  const redisClient = createClient({
    socket: {
      host: process.env.REDIS_HOST || "127.0.0.1",
      port: Number(process.env.REDIS_PORT || 6379),
    },
    password: process.env.REDIS_PASSWORD || undefined,
  });
  try {
    await redisClient.connect();
    const messageKeys = await redisClient.keys("room:*:messages");
    const legacyKeys = await redisClient.keys("chat:room:*:recent");
    const keys = [...messageKeys, ...legacyKeys];
    if (keys.length > 0) {
      await redisClient.del(keys);
    }
    console.log(`cleared persisted chat keys: ${keys.length}`);
  } catch (error) {
    console.warn("chat cache cleanup skipped:", error.message || error);
  } finally {
    if (redisClient.isOpen) {
      await redisClient.quit();
    }
  }
}

async function closeStaleWaitingRooms(conn) {
  const result = await conn.query(
    `UPDATE rooms r
     SET r.status = 'CLOSED'
     WHERE r.status = 'WAITING'
       AND (
         (SELECT COUNT(*) FROM room_participants rp
           WHERE rp.room_id = r.id AND rp.left_at IS NULL) = 0
         OR r.created_at < (NOW() - INTERVAL ? HOUR)
            AND (SELECT COUNT(*) FROM room_participants rp
                  WHERE rp.room_id = r.id AND rp.left_at IS NULL) = 0
       )`,
    [STALE_MAX_AGE_HOURS],
  );
  return Number(result.affectedRows || 0);
}

async function main() {
  if (!process.env.DB_USER || !process.env.DB_NAME) {
    throw new Error("backend/.env 에 DB_USER / DB_NAME 이 필요합니다.");
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    if (STALE_ONLY) {
      const closed = await closeStaleWaitingRooms(conn);
      await conn.commit();
      console.log(`closed stale WAITING rooms: ${closed}`);
      return;
    }

    const before = await conn.query(
      "SELECT COUNT(*) AS c FROM rooms WHERE status <> 'CLOSED'",
    );
    console.log(`open rooms before: ${Number(before[0].c)}`);

    await conn.query(
      `UPDATE room_participants
       SET left_at = COALESCE(left_at, CURRENT_TIMESTAMP),
           is_host = FALSE,
           is_ready = FALSE,
           status = 'LEFT'
       WHERE left_at IS NULL
         AND room_id IN (SELECT id FROM rooms WHERE status <> 'CLOSED')`,
    );
    await conn.query("UPDATE rooms SET status = 'CLOSED' WHERE status <> 'CLOSED'");

    const users = await conn.query(
      "SELECT id, username, display_name AS displayName FROM users ORDER BY created_at ASC LIMIT 1",
    );
    if (users.length === 0) {
      throw new Error("users 테이블에 계정이 없습니다. 먼저 회원가입하세요.");
    }
    const host = users[0];
    const passwordHash = await bcrypt.hash(PRIVATE_PASSWORD, 10);

    const seeds = [
      {
        title: "[테스트] 공개 대기실",
        status: "WAITING",
        mode: "1/1",
        gameMode: "normal",
        difficulty: "NORMAL",
        language: "JAVA",
        password: "",
        problemCount: 5,
        maxPlayers: 2,
      },
      {
        title: "[테스트] 비공개 대기실",
        status: "WAITING",
        mode: "1/N",
        gameMode: "item",
        difficulty: "EASY",
        language: "PYTHON",
        password: passwordHash,
        problemCount: 5,
        maxPlayers: 4,
      },
      {
        title: "[테스트] 진행중(STARTED)",
        status: "STARTED",
        mode: "1/1",
        gameMode: "normal",
        difficulty: "HARD",
        language: "JAVA",
        password: "",
        problemCount: 3,
        maxPlayers: 2,
      },
    ];

    const createdIds = [];
    for (const seed of seeds) {
      const result = await conn.query(
        `INSERT INTO rooms (
           title, status, mode, game_mode, difficulty, language,
           password, problem_count, max_players, host_user_id
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          seed.title,
          seed.status,
          seed.mode,
          seed.gameMode,
          seed.difficulty,
          seed.language,
          seed.password,
          seed.problemCount,
          seed.maxPlayers,
          host.id,
        ],
      );
      const roomId = Number(result.insertId);
      createdIds.push(roomId);
      await conn.query(
        `INSERT INTO room_participants (
           room_id, user_id, slot_index, is_host, is_ready, language, \`character\`, status
         ) VALUES (?, ?, 0, TRUE, FALSE, ?, 'char1', 'HOST')`,
        [roomId, host.id, seed.language],
      );
    }

    await conn.commit();
    await clearPersistedChat();

    const after = await conn.query(
      "SELECT id, title, status, mode FROM rooms WHERE status <> 'CLOSED' ORDER BY id",
    );
    console.log(`host: ${host.displayName || host.username} (${host.id})`);
    console.log(`private room password: ${PRIVATE_PASSWORD}`);
    console.log("seeded rooms:");
    for (const row of after) {
      console.log(`  #${row.id} [${row.status}] ${row.title} (${row.mode})`);
    }
    console.log(`created ids: ${createdIds.join(", ")}`);
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
