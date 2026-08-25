import { pool } from "#config/dbConfig.js";

export async function createMatchWithProblems(input) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    await connection.query(
      `INSERT INTO matches (
         id,
         room_id,
         status,
         lang,
         difficulty,
         problem_count,
         max_players,
         room_mode,
         game_mode,
         round_seconds
       )
       VALUES (?, ?, 'IN_PROGRESS', ?, ?, ?, ?, ?, ?, ?)`,
      [
        input.matchId,
        input.roomId,
        input.language,
        input.difficulty,
        input.problems.length,
        input.maxPlayers,
        input.roomMode,
        input.gameMode,
        input.roundSeconds,
      ],
    );

    for (let index = 0; index < input.problems.length; index += 1) {
      const problem = input.problems[index];

      await connection.query(
        `INSERT INTO match_problems (
           match_id,
           problem_index,
           problem_id,
           problem_snapshot
         )
         VALUES (?, ?, ?, ?)`,
        [input.matchId, index, problem.id, JSON.stringify(problem)],
      );
    }

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function findMatchById(matchId) {
  const rows = await pool.query(
    `SELECT
       id,
       room_id AS roomId,
       status,
       lang AS language,
       difficulty,
       problem_count AS problemCount,
       max_players AS maxPlayers,
       room_mode AS roomMode,
       game_mode AS gameMode,
       round_seconds AS roundSeconds,
       started_at AS startedAt,
       finished_at AS finishedAt
     FROM matches
     WHERE id = ?
     LIMIT 1`,
    [matchId],
  );

  if (rows.length === 0) {
    return null;
  }

  return rows[0];
}

export async function findMatchProblem(matchId, problemIndex) {
  const rows = await pool.query(
    `SELECT
       m.id AS matchId,
       m.room_id AS roomId,
       m.status,
       m.lang AS language,
       m.game_mode AS gameMode,
       mp.problem_index AS problemIndex,
       mp.problem_snapshot AS problemSnapshot
     FROM matches m
     JOIN match_problems mp ON mp.match_id = m.id
     WHERE m.id = ?
       AND mp.problem_index = ?
     LIMIT 1`,
    [matchId, problemIndex],
  );

  if (rows.length === 0) {
    return null;
  }

  return rows[0];
}

export async function isMatchParticipant(matchId, userId) {
  const rows = await pool.query(
    `SELECT rp.user_id AS userId
     FROM matches m
     JOIN room_participants rp ON rp.room_id = m.room_id
     WHERE m.id = ?
       AND rp.user_id = ?
       AND rp.left_at IS NULL
     LIMIT 1`,
    [matchId, userId],
  );

  return rows.length > 0;
}

export async function consumeUserItem(userId, itemKey) {
  const result = await pool.query(
    `UPDATE user_items
     SET quantity = quantity - 1
     WHERE user_id = ?
       AND item_key = ?
       AND quantity > 0`,
    [userId, itemKey],
  );

  return Number(result.affectedRows) === 1;
}
