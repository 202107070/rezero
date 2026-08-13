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
