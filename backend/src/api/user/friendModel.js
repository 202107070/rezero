import { pool } from "#config/dbConfig.js";

let tablesReady = false;

async function ensureFriendTables() {
  if (tablesReady) return;
  await pool.query(
    `CREATE TABLE IF NOT EXISTS friend_requests (
       from_user_id VARCHAR(64) NOT NULL,
       to_user_id VARCHAR(64) NOT NULL,
       created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
       PRIMARY KEY (from_user_id, to_user_id)
     ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  );
  tablesReady = true;
}

export async function userExists(userId) {
  const rows = await pool.query("SELECT id FROM users WHERE id = ? LIMIT 1", [userId]);
  return rows.length > 0;
}

export async function createFriendRequest(fromUserId, toUserId) {
  await ensureFriendTables();
  const already = await pool.query(
    `SELECT 1 AS ok FROM friends WHERE user_id = ? AND friend_user_id = ? LIMIT 1`,
    [fromUserId, toUserId],
  );
  if (already.length > 0) {
    return { alreadyFriends: true };
  }
  await pool.query(
    `INSERT INTO friend_requests (from_user_id, to_user_id)
     VALUES (?, ?)
     ON DUPLICATE KEY UPDATE created_at = CURRENT_TIMESTAMP`,
    [fromUserId, toUserId],
  );
  return { alreadyFriends: false };
}

export async function listPendingFriendRequests(userId) {
  await ensureFriendTables();
  return pool.query(
    `SELECT
       r.from_user_id AS fromUserId,
       u.display_name AS fromUserName,
       u.username AS fromUsername
     FROM friend_requests r
     JOIN users u ON u.id = r.from_user_id
     WHERE r.to_user_id = ?
     ORDER BY r.created_at ASC`,
    [userId],
  );
}

export async function acceptFriendRequest(fromUserId, toUserId) {
  await ensureFriendTables();
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const result = await connection.query(
      "DELETE FROM friend_requests WHERE from_user_id = ? AND to_user_id = ?",
      [fromUserId, toUserId],
    );
    if (result.affectedRows !== 1) {
      await connection.rollback();
      return false;
    }
    await connection.query(
      `INSERT INTO friends (user_id, friend_user_id) VALUES (?, ?), (?, ?)
       ON DUPLICATE KEY UPDATE added_at = added_at`,
      [fromUserId, toUserId, toUserId, fromUserId],
    );
    await connection.query(
      "DELETE FROM friend_requests WHERE from_user_id = ? AND to_user_id = ?",
      [toUserId, fromUserId],
    );
    await connection.commit();
    return true;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function declineFriendRequest(fromUserId, toUserId) {
  await ensureFriendTables();
  await pool.query(
    `DELETE FROM friend_requests WHERE from_user_id = ? AND to_user_id = ?`,
    [fromUserId, toUserId],
  );
}

export async function removeFriendship(userId, friendUserId) {
  await ensureFriendTables();
  await pool.query(
    `DELETE FROM friends
     WHERE (user_id = ? AND friend_user_id = ?)
        OR (user_id = ? AND friend_user_id = ?)`,
    [userId, friendUserId, friendUserId, userId],
  );
}

export async function listFriendsForUser(userId) {
  await ensureFriendTables();
  return pool.query(
    `SELECT
       f.friend_user_id AS userId,
       u.display_name AS displayName,
       u.username AS username
     FROM friends f
     JOIN users u ON u.id = f.friend_user_id
     WHERE f.user_id = ?
     ORDER BY u.display_name ASC`,
    [userId],
  );
}
