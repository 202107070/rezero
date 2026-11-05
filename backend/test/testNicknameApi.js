import assert from 'node:assert/strict';
import { pool } from '../src/config/dbConfig.js';
import { ensureNicknameUnique } from '../scripts/nicknameUnique.js';
const base = new URL(process.env.TEST_BASE_URL || 'http://127.0.0.1:18082');
if (!String(process.env.DB_NAME).startsWith('rezero_stability_') || base.hostname !== '127.0.0.1' || base.port !== '18082') {
  await pool.end(); throw new Error('Only isolated stability test resources allowed');
}
const suffix = Date.now();
async function signup(username, displayName) {
  const response = await fetch(new URL('/api/v1/auth/signup', base), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, displayName, password: 'NicknameTest123!' }) });
  return { status: response.status, data: await response.json() };
}
const connection = await pool.getConnection();
try {
  assert.equal((await ensureNicknameUnique(connection, { apply: true })).status, 'already-applied');
  const nickname = `같은닉네임${suffix}`;
  const responses = await Promise.all(['a', 'b'].map(name => signup(`n_${name}_${suffix}`, nickname)));
  assert.deepEqual(responses.map(r => r.status).sort(), [201, 409]);
  assert.equal(responses.find(r => r.status === 409).data.error.code, 'DISPLAY_NAME_ALREADY_EXISTS');
  assert.equal(Number((await connection.query('SELECT COUNT(*) AS count FROM users WHERE display_name=?', [nickname]))[0].count), 1);
  assert.equal((await signup(`n_c_${suffix}`, `Case${suffix}`)).status, 201);
  assert.equal((await signup(`n_d_${suffix}`, `case${suffix}`)).data.error.code, 'DISPLAY_NAME_ALREADY_EXISTS');
  const duplicateTable = `nickname_duplicate_fixture_${suffix}`;
  await connection.query(`CREATE TABLE \`${duplicateTable}\` (display_name VARCHAR(50) NOT NULL) COLLATE utf8mb4_unicode_ci`);
  await connection.query(`INSERT INTO \`${duplicateTable}\` VALUES ('same'), ('SAME')`);
  await assert.rejects(ensureNicknameUnique(connection, { apply: true, table: duplicateTable }), /NICKNAME_DUPLICATES/);
  assert.equal(Number((await connection.query(`SELECT COUNT(*) AS count FROM \`${duplicateTable}\``))[0].count), 2);
  const freshTable = `nickname_unique_fixture_${suffix}`;
  await connection.query(`CREATE TABLE \`${freshTable}\` (display_name VARCHAR(50) NOT NULL) COLLATE utf8mb4_unicode_ci`);
  assert.equal((await ensureNicknameUnique(connection, { table: freshTable })).status, 'ready-to-apply');
  assert.equal((await ensureNicknameUnique(connection, { apply: true, table: freshTable })).status, 'applied');
  assert.equal((await ensureNicknameUnique(connection, { apply: true, table: freshTable })).status, 'already-applied');
  console.log('PASS nickname: concurrent duplicate signup 201/409, one DB row, case policy, duplicate migration refusal without data changes, idempotent migration');
} finally { connection.release(); await pool.end(); }
