import { pool } from "#config/dbConfig.js";

export async function findProblemsByDifficulty(difficulty) {
  return pool.query(
    `SELECT
       id,
       type,
       difficulty,
       title,
       question,
       answer,
       options,
       correct_index AS correctIndex,
       explanation,
       description,
       input,
       output,
       visual,
       capability_overrides AS capabilityOverrides
     FROM problems
     WHERE LOWER(difficulty) = ?
     ORDER BY id ASC`,
    [difficulty],
  );
}

export async function findAllProblems() {
  return pool.query(
    `SELECT
       id,
       type,
       difficulty,
       title,
       question,
       answer,
       options,
       correct_index AS correctIndex,
       explanation,
       description,
       input,
       output,
       visual,
       capability_overrides AS capabilityOverrides
     FROM problems
     ORDER BY id ASC`,
  );
}
