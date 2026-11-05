import { pool } from '../src/config/dbConfig.js';
import { redisClient } from '../src/config/redisConfig.js';
import { isolatedRunner } from '../src/infra/docker/worker/isolatedRunner.js';
import { ensureNicknameUnique } from './nicknameUnique.js';
import { findAllProblems } from '../src/api/problem/model.js';
import { chooseProblems } from '../src/api/problem/service.js';

let connection;
try {
  connection = await pool.getConnection();
  await connection.query('SELECT 1');
  await redisClient.connect();
  await redisClient.ping(); // Do not call connectRedis(): its legacy startup routine clears chat.
  const nickname = await ensureNicknameUnique(connection);
  const runner = await isolatedRunner.ready();
  const poolRows = await findAllProblems();
  const availability = {};
  for (const difficulty of ['easy', 'medium', 'hard']) for (const language of ['JAVA', 'PYTHON', 'CPP', 'HTML', 'CSS']) {
    const rows = poolRows.filter(problem => problem.difficulty === difficulty);
    availability[`${difficulty}/${language}`] = rows.filter(problem => { try { chooseProblems([problem], language, 1); return true; } catch { return false; } }).length;
  }
  console.log(JSON.stringify({ database: 'connected', valkey: 'connected', nickname, runner: runner ? 'ready' : 'unavailable', runnerReason: runner ? undefined : isolatedRunner.getReadinessError(), architecture: process.arch, problemAvailability: availability }, null, 2));
  if (!runner || nickname.status !== 'already-applied' || Object.values(availability).some(count => count < 3)) process.exitCode = 1;
} catch (error) { console.error(error.code || error.message); process.exitCode = 1; }
finally {
  connection?.release();
  if (redisClient.isOpen) await redisClient.quit();
  await pool.end();
}
