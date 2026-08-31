import { pool } from "#config/dbConfig.js";

export async function createUser(input) {
  await pool.query(
    `INSERT INTO users (id, username, password_hash, display_name)
     VALUES (?, ?, ?, ?)`,
    [input.id, input.username, input.passwordHash, input.displayName],
  );

  return findUserById(input.id);
}

export async function isUsernameTaken(username) {
  const rows = await pool.query(
    "SELECT COUNT(*) AS count FROM users WHERE username = ?",
    [username],
  );

  return Number(rows[0].count) > 0;
}

export async function findUserByUsername(username) {
  const rows = await pool.query(
    `SELECT
       id,
       username,
       password_hash AS passwordHash,
       display_name AS displayName,
       gold,
       rating_score AS ratingScore,
       created_at AS createdAt
     FROM users
     WHERE username = ?
     LIMIT 1`,
    [username],
  );

  if (rows.length === 0) {
    return null;
  }

  return rows[0];
}

export async function findUserById(id) {
  const rows = await pool.query(
    `SELECT
       id,
       username,
       display_name AS displayName,
       gold,
       rating_score AS ratingScore,
       created_at AS createdAt
     FROM users
     WHERE id = ?
     LIMIT 1`,
    [id],
  );

  if (rows.length === 0) {
    return null;
  }

  return rows[0];
}

export async function findUserItems(userId) {
  return pool.query(
    `SELECT item_key AS itemKey, quantity
     FROM user_items
     WHERE user_id = ?`,
    [userId],
  );
}

export async function findUserTitleData(userId) {
  const rows = await pool.query(
    `SELECT
       owned_title_ids AS ownedTitleIds,
       equipped_title_id AS equippedTitleId,
       stats_total_wins AS totalWins,
       stats_consecutive_wins AS consecutiveWins,
       stats_total_games AS totalGames,
       stats_perfect_game AS perfectGame,
       stats_avg_speed AS avgSpeed,
       stats_lang_wins AS langWins
     FROM user_titles
     WHERE user_id = ?
     LIMIT 1`,
    [userId],
  );

  return rows.length > 0 ? rows[0] : null;
}
