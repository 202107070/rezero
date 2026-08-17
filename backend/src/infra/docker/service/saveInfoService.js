import { pool as dbPool } from "#config/dbConfig.js";

export const saveInfoService = {
  async saveGameResult({ matchId, roomId, winnerId, score, submissions = [] }) {
    const connection = await dbPool.getConnection();
    try {
      await connection.beginTransaction();

      await connection.query(
        `UPDATE matches 
         SET status = 'FINISHED', finished_at = CURRENT_TIMESTAMP 
         WHERE id = ?`,
        [matchId],
      );

      if (submissions && submissions.length > 0) {
        for (const sub of submissions) {
          await connection.query(
            `INSERT INTO match_submissions 
              (match_id, user_id, ingame_score, rating_score_before, rating_delta, codes, solve_times, problem_results, solved_problems, total_solve_time, completion_time)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              matchId,
              sub.userId,
              sub.score ?? 0,
              sub.ratingBefore ?? 1000,
              sub.ratingDelta ?? 0,
              JSON.stringify(sub.codes ?? []),
              JSON.stringify(sub.solveTimes ?? []),
              JSON.stringify(sub.problemResults ?? []),
              JSON.stringify(sub.solvedProblems ?? []),
              sub.totalSolveTime ?? 0,
              sub.completionTime ?? 0,
            ],
          );
        }
      } else if (winnerId) {
        await connection.query(
          `INSERT INTO match_submissions 
            (match_id, user_id, ingame_score, rating_score_before, rating_delta, codes, solve_times, problem_results, solved_problems, total_solve_time, completion_time)
           VALUES (?, ?, ?, 1000, 0, '[]', '[]', '[]', '[]', 0, 0)
           ON DUPLICATE KEY UPDATE ingame_score = VALUES(ingame_score)`,
          [matchId, winnerId, score],
        );
      }

      await connection.commit();
      console.log(
        `[saveInfoService] Successfully saved match result for matchId: ${matchId}`,
      );
      return true;
    } catch (error) {
      await connection.rollback();
      console.error(`[saveInfoService] Failed to save game result:`, error);
      throw error;
    } finally {
      connection.release();
    }
  },
};
