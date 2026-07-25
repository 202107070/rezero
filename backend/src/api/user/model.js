import { pool } from '../../config/dbConfig.js';

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
    'SELECT COUNT(*) AS count FROM users WHERE username = ?',
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
