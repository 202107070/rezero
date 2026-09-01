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

export async function findMatchParticipantsForResult(matchId) {
  return pool.query(
    `SELECT
       rp.user_id AS userId,
       u.display_name AS displayName,
       u.rating_score AS ratingScore,
       rp.\`character\` AS avatar
     FROM matches m
     JOIN room_participants rp ON rp.room_id = m.room_id
     JOIN users u ON u.id = rp.user_id
     WHERE m.id = ?
       AND rp.left_at IS NULL
     ORDER BY rp.slot_index ASC`,
    [matchId],
  );
}

export async function findMatchSubmissions(matchId) {
  return pool.query(
    `SELECT
       user_id AS userId,
       ingame_score AS ingameScore,
       rating_score_before AS ratingScoreBefore,
       rating_delta AS ratingDelta,
       codes,
       blank_answers AS blankAnswers,
       selected_options AS selectedOptions,
       solve_times AS solveTimes,
       problem_results AS problemResults,
       solved_problems AS solvedProblems,
       total_solve_time AS totalSolveTime,
       completion_time AS completionTime,
       finished_at_elapsed AS finishedAtElapsed
     FROM match_submissions
     WHERE match_id = ?`,
    [matchId],
  );
}

export async function saveMatchSubmission(input) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();
    await connection.query(
      `DELETE FROM match_submissions
       WHERE match_id = ? AND user_id = ?`,
      [input.matchId, input.userId],
    );
    await connection.query(
      `INSERT INTO match_submissions (
         match_id, user_id, ingame_score, rating_score_before, rating_delta,
         codes, blank_answers, selected_options, solve_times, problem_results,
         solved_problems, total_solve_time, completion_time, finished_at_elapsed
       ) VALUES (?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        input.matchId,
        input.userId,
        input.ingameScore,
        input.ratingScoreBefore,
        JSON.stringify(input.codes),
        JSON.stringify(input.blankAnswers),
        JSON.stringify(input.selectedOptions),
        JSON.stringify(input.solveTimes),
        JSON.stringify(input.problemResults),
        JSON.stringify(input.solvedProblems),
        input.totalSolveTime,
        input.completionTime,
        input.finishedAtElapsed,
      ],
    );
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function findMatchRanking(matchId) {
  const rows = await pool.query(
    `SELECT
       rankings_json AS rankingsJson,
       elapsed_sec AS elapsedSec,
       round_seconds AS roundSeconds,
       total_problems AS totalProblems,
       finalized_at AS finalizedAt
     FROM match_rankings
     WHERE match_id = ?
     LIMIT 1`,
    [matchId],
  );

  return rows.length > 0 ? rows[0] : null;
}

export async function findUserTitleStates(userIds) {
  if (userIds.length === 0) {
    return [];
  }

  const placeholders = userIds.map(function () {
    return "?";
  }).join(", ");

  return pool.query(
    `SELECT
       u.id AS userId,
       ut.owned_title_ids AS ownedTitleIds,
       ut.equipped_title_id AS equippedTitleId,
       ut.stats_total_wins AS totalWins,
       ut.stats_consecutive_wins AS consecutiveWins,
       ut.stats_total_games AS totalGames,
       ut.stats_perfect_game AS perfectGame,
       ut.stats_avg_speed AS avgSpeed,
       ut.stats_lang_wins AS langWins
     FROM users u
     LEFT JOIN user_titles ut ON ut.user_id = u.id
     WHERE u.id IN (${placeholders})`,
    userIds,
  );
}

export async function finalizeMatchResult(input) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const matchRows = await connection.query(
      `SELECT status FROM matches WHERE id = ? FOR UPDATE`,
      [input.matchId],
    );

    if (matchRows.length === 0) {
      await connection.rollback();
      return { finalized: false, reason: "MATCH_NOT_FOUND" };
    }

    if (matchRows[0].status === "FINISHED") {
      await connection.rollback();
      return { finalized: false, reason: "MATCH_ALREADY_FINISHED" };
    }

    for (const player of input.players) {
      await connection.query(
        `UPDATE match_submissions
         SET rating_delta = ?
         WHERE match_id = ? AND user_id = ?`,
        [player.ratingDelta, input.matchId, player.id],
      );
      await connection.query(
        `UPDATE users
         SET gold = gold + ?, rating_score = rating_score + ?
         WHERE id = ?`,
        [player.earnedGold, player.ratingDelta, player.id],
      );
      await connection.query(
        `INSERT INTO user_titles (
           user_id, owned_title_ids, equipped_title_id, stats_total_wins,
           stats_consecutive_wins, stats_total_games, stats_perfect_game,
           stats_avg_speed, stats_lang_wins
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           owned_title_ids = VALUES(owned_title_ids),
           stats_total_wins = VALUES(stats_total_wins),
           stats_consecutive_wins = VALUES(stats_consecutive_wins),
           stats_total_games = VALUES(stats_total_games),
           stats_perfect_game = VALUES(stats_perfect_game),
           stats_avg_speed = VALUES(stats_avg_speed),
           stats_lang_wins = VALUES(stats_lang_wins)`,
        [
          player.id,
          JSON.stringify(player.titleData.owned),
          player.titleData.equipped,
          player.titleData.stats.totalWins,
          player.titleData.stats.consecutiveWins,
          player.titleData.stats.totalGames,
          player.titleData.stats.perfectGame,
          player.titleData.stats.avgSpeed,
          JSON.stringify(player.titleData.stats.langWins),
        ],
      );
    }

    await connection.query(
      `INSERT INTO match_rankings (
         match_id, elapsed_sec, round_seconds, total_problems, rankings_json
       ) VALUES (?, ?, ?, ?, ?)`,
      [
        input.matchId,
        input.elapsedSec,
        input.roundSeconds,
        input.totalProblems,
        JSON.stringify(input.rankings),
      ],
    );
    await connection.query(
      `UPDATE matches
       SET status = 'FINISHED', finished_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [input.matchId],
    );
    await connection.commit();
    return { finalized: true };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
