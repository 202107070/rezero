import { pathToFileURL } from 'node:url';

export async function ensureNicknameUnique(connection, { apply = false, table = 'users' } = {}) {
  if (!/^[a-zA-Z0-9_]+$/.test(table)) throw new Error('Invalid table name');
  const [column] = await connection.query(`SELECT COLLATION_NAME AS collationName
    FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=? AND COLUMN_NAME='display_name'`, [table]);
  if (!column || !/_ci$/i.test(column.collationName || '')) throw new Error('NICKNAME_COLLATION_UNSUPPORTED: 대소문자를 동일하게 비교하는 DB collation을 먼저 확인해야 합니다.');
  const duplicates = await connection.query(`SELECT COUNT(*) AS count FROM \`${table}\` GROUP BY display_name HAVING COUNT(*) > 1`);
  if (duplicates.length) {
    throw new Error(`NICKNAME_DUPLICATES: 중복 그룹 ${duplicates.length}개, 관련 행 ${duplicates.reduce((sum, row) => sum + Number(row.count), 0)}개. 데이터는 변경하지 않았습니다.`);
  }
  const indexes = await connection.query(`SELECT INDEX_NAME AS indexName FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=? AND NON_UNIQUE=0 GROUP BY INDEX_NAME
    HAVING COUNT(*)=1 AND MAX(COLUMN_NAME)='display_name'`, [table]);
  if (indexes.length) return { status: 'already-applied', collation: column.collationName };
  if (!apply) return { status: 'ready-to-apply', collation: column.collationName };
  // ADD UNIQUE validates again inside MariaDB, including concurrent inserts.
  await connection.query(`ALTER TABLE \`${table}\` ADD UNIQUE KEY uq_users_display_name (display_name)`);
  return { status: 'applied', collation: column.collationName };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { pool } = await import('../src/config/dbConfig.js');
  const connection = await pool.getConnection();
  try { console.log(await ensureNicknameUnique(connection, { apply: process.argv.includes('--apply') })); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
  finally { connection.release(); await pool.end(); }
}
