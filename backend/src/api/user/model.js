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
    "SELECT COUNT(*) AS count FROM users WHERE LOWER(username) = LOWER(?)",
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
     WHERE LOWER(username) = LOWER(?)
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

/** 회원가입/시드용: 모든 아이템 quantity개 지급 */
export async function grantStarterItems(userId, quantity = 5) {
  for (let i = 0; i < STARTER_ITEM_KEYS.length; i++) {
    const itemKey = STARTER_ITEM_KEYS[i];
    await pool.query(
      `INSERT INTO user_items (user_id, item_key, quantity)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE quantity = VALUES(quantity)`,
      [userId, itemKey, quantity],
    );
  }
}

export async function addUserItem(userId, itemKey, delta = 1) {
  await pool.query(
    `INSERT INTO user_items (user_id, item_key, quantity)
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE quantity = quantity + VALUES(quantity)`,
    [userId, itemKey, delta],
  );
}

export async function updateUserGold(userId, gold) {
  await pool.query(`UPDATE users SET gold = ? WHERE id = ?`, [
    Math.max(0, Number(gold) || 0),
    userId,
  ]);
}

export async function deductUserGold(userId, cost) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const rows = await connection.query(
      `SELECT gold FROM users WHERE id = ? LIMIT 1 FOR UPDATE`,
      [userId],
    );
    const current = Number(rows[0]?.gold || 0);
    if (current < cost) {
      await connection.rollback();
      return { ok: false, gold: current };
    }
    const next = current - cost;
    await connection.query(`UPDATE users SET gold = ? WHERE id = ?`, [next, userId]);
    await connection.commit();
    return { ok: true, gold: next };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function grantStarterItemsByUsernames(usernames, quantity = 5) {
  if (!Array.isArray(usernames) || usernames.length === 0) return 0;
  const placeholders = usernames.map(() => "?").join(", ");
  const users = await pool.query(
    `SELECT id, username FROM users WHERE username IN (${placeholders})`,
    usernames,
  );
  for (let i = 0; i < users.length; i++) {
    await grantStarterItems(users[i].id, quantity);
  }
  return users.length;
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

function parseJsonColumn(value, fallback) {
  if (value == null) return fallback;
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

export async function listMatchCodeHistory(userId) {
  const rows = await pool.query(
    `SELECT
       history_id AS historyId,
       user_id AS userId,
       room_id AS roomId,
       submitted_at AS submittedAt,
       lang,
       mode,
       code,
       codes,
       problems
     FROM match_code_history
     WHERE user_id = ?
     ORDER BY submitted_at DESC
     LIMIT 100`,
    [userId],
  );

  return rows.map(function (row) {
    return {
      historyId: row.historyId,
      userId: row.userId,
      roomId: String(row.roomId || ""),
      submittedAt:
        row.submittedAt instanceof Date
          ? row.submittedAt.toISOString()
          : String(row.submittedAt || ""),
      lang: row.lang || "UNKNOWN",
      mode: row.mode || null,
      code: row.code || "",
      codes: parseJsonColumn(row.codes, []),
      problems: parseJsonColumn(row.problems, []),
    };
  });
}

export async function upsertMatchCodeHistory(entry) {
  await pool.query(
    `INSERT INTO match_code_history
       (history_id, user_id, room_id, submitted_at, lang, mode, code, codes, problems)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       lang = VALUES(lang),
       mode = VALUES(mode),
       code = VALUES(code),
       codes = VALUES(codes),
       problems = VALUES(problems)`,
    [
      entry.historyId,
      entry.userId,
      entry.roomId || "",
      entry.submittedAt || new Date(),
      entry.lang || "UNKNOWN",
      entry.mode || null,
      entry.code || "",
      JSON.stringify(Array.isArray(entry.codes) ? entry.codes : []),
      JSON.stringify(Array.isArray(entry.problems) ? entry.problems : []),
    ],
  );
}

export async function deleteMatchCodeHistory(userId, historyIds) {
  if (!Array.isArray(historyIds) || historyIds.length === 0) return 0;
  const placeholders = historyIds.map(function () {
    return "?";
  }).join(", ");
  const result = await pool.query(
    `DELETE FROM match_code_history
     WHERE user_id = ?
       AND history_id IN (${placeholders})`,
    [userId, ...historyIds],
  );
  return Number(result?.affectedRows || 0);
}

export async function deleteUserById(userId) {
  const result = await pool.query(`DELETE FROM users WHERE id = ?`, [userId]);
  return Number(result?.affectedRows || 0);
}

/** AI 분석용: 유저의 최근 매치 제출·메타 집계 */
export async function findUserMatchAnalytics(userId, limit = 40) {
  const rows = await pool.query(
    `SELECT
       ms.match_id AS matchId,
       ms.ingame_score AS ingameScore,
       ms.rating_delta AS ratingDelta,
       ms.solve_times AS solveTimes,
       ms.problem_results AS problemResults,
       ms.solved_problems AS solvedProblems,
       ms.total_solve_time AS totalSolveTime,
       ms.completion_time AS completionTime,
       m.lang AS language,
       m.difficulty,
       m.game_mode AS gameMode,
       m.room_mode AS roomMode,
       m.problem_count AS problemCount,
       m.finished_at AS finishedAt
     FROM match_submissions ms
     JOIN matches m ON m.id = ms.match_id
     WHERE ms.user_id = ?
     ORDER BY COALESCE(m.finished_at, m.started_at) DESC
     LIMIT ?`,
    [userId, Math.max(1, Math.min(100, Number(limit) || 40))],
  );

  return rows.map(function (row) {
    return {
      matchId: row.matchId,
      ingameScore: Number(row.ingameScore || 0),
      ratingDelta: Number(row.ratingDelta || 0),
      solveTimes: parseJsonColumn(row.solveTimes, []),
      problemResults: parseJsonColumn(row.problemResults, []),
      solvedProblems: parseJsonColumn(row.solvedProblems, []),
      totalSolveTime: Number(row.totalSolveTime || 0),
      completionTime: Number(row.completionTime || 0),
      language: row.language || "UNKNOWN",
      difficulty: row.difficulty || "",
      gameMode: row.gameMode || "",
      roomMode: row.roomMode || "",
      problemCount: Number(row.problemCount || 0),
      finishedAt:
        row.finishedAt instanceof Date
          ? row.finishedAt.toISOString()
          : row.finishedAt
            ? String(row.finishedAt)
            : null,
    };
  });
}
