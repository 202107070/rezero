/**
 * 기존 테스트 유저(hojin, ymtest 등)에게 아이템 5개씩 지급
 *
 *   node backend/scripts/grantStarterItems.js
 *   node backend/scripts/grantStarterItems.js hojin ymtest
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import mariadb from "mariadb";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../.env") });

const STARTER_ITEM_KEYS = [
  "paint",
  "revealLength",
  "revealPrev",
  "lightning",
  "timeReduce",
  "scribble",
  "blankBreak",
  "buildCharge",
];

const pool = mariadb.createPool({
  host: process.env.DB_HOST || "127.0.0.1",
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  connectionLimit: 2,
  connectTimeout: 8000,
});

async function main() {
  const usernames = process.argv.slice(2);
  const targets = usernames.length > 0 ? usernames : ["hojin", "ymtest"];
  if (!process.env.DB_USER || !process.env.DB_NAME) {
    throw new Error("backend/.env 에 DB_USER / DB_NAME 이 필요합니다.");
  }

  const conn = await pool.getConnection();
  try {
    const placeholders = targets.map(() => "?").join(", ");
    const users = await conn.query(
      `SELECT id, username FROM users WHERE username IN (${placeholders})`,
      targets,
    );
    if (users.length === 0) {
      throw new Error(`유저를 찾지 못했습니다: ${targets.join(", ")}`);
    }

    for (const user of users) {
      for (const itemKey of STARTER_ITEM_KEYS) {
        await conn.query(
          `INSERT INTO user_items (user_id, item_key, quantity)
           VALUES (?, ?, 5)
           ON DUPLICATE KEY UPDATE quantity = 5`,
          [user.id, itemKey],
        );
      }
      console.log(`[grantItems] ${user.username} (${user.id}) ← 아이템 8종 × 5`);
    }
  } finally {
    conn.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error("[grantItems] 실패:", error.message || error);
  process.exit(1);
});
