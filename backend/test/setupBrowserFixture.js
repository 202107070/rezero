// Pin one isolated QA match to existing bank questions so all input styles are exercised.
import assert from 'node:assert/strict';
import { pool } from '../src/config/dbConfig.js';
import { assertIsolatedTestTarget } from './isolatedTestGuard.js';
import { readProblemFixture } from './problemFixture.js';
import { applyLanguageVariant } from '../src/api/problem/variants.js';
assertIsolatedTestTarget(process.env.TEST_BASE_URL || 'http://127.0.0.1:18082');
const roomId = Number(process.argv[2]);
assert.ok(Number.isInteger(roomId) && roomId > 0);
const connection = await pool.getConnection();
try {
  const [match] = await connection.query(`SELECT m.id, m.problem_count AS count, m.lang AS language
    FROM matches m JOIN rooms r ON r.id=m.room_id JOIN users u ON u.id=r.host_user_id
    WHERE m.room_id=? AND m.status='IN_PROGRESS' AND u.username='qa_flow_1105a'`, [roomId]);
  assert.ok(match && ['PYTHON', 'JAVA', 'CPP', 'C++', 'HTML', 'CSS'].includes(match.language) && Number(match.count) === 3, 'Only the named isolated QA 3-problem match can be changed');
  const language = match.language === 'C++' ? 'CPP' : match.language;
  const bank = readProblemFixture();
  const ids = { PYTHON: ['M02', 'M18', 'M10'], JAVA: ['LJ01', 'M18', 'M10'], CPP: ['LC01', 'M18', 'M10'], HTML: ['HT01', 'HT02', 'HT03'], CSS: ['CS01', 'CS02', 'CS03'] }[language];
  await connection.beginTransaction();
  for (const [index, id] of ids.entries()) {
    const variant = applyLanguageVariant(bank.find(problem => problem.id === id), language);
    await connection.query('UPDATE match_problems SET problem_id=?, problem_snapshot=? WHERE match_id=? AND problem_index=?', [id, JSON.stringify(variant), match.id, index]);
  }
  await connection.commit();
  console.log('BROWSER_FIXTURE', { matchId: match.id, ids });
} catch (error) { await connection.rollback(); throw error; }
finally { connection.release(); await pool.end(); }
