import { pool, testDbConnection } from './src/config/dbConfig.js';

const expectedTables = [
  'users',
  'user_items',
  'user_titles',
  'match_code_history',
  'rooms',
  'room_participants',
  'problems',
  'matches',
  'match_problems',
  'match_submissions',
  'match_rankings',
  'friends',
  'review_invites',
];

async function testDatabase() {
  let connection;

  try {
    await testDbConnection();
    connection = await pool.getConnection();

    const rows = await connection.query('SHOW TABLES');
    const actualTables = rows.map((row) => Object.values(row)[0]);
    const missingTables = expectedTables.filter((table) => !actualTables.includes(table));

    if (missingTables.length > 0) {
      throw new Error(`생성되지 않은 테이블이 있습니다: ${missingTables.join(', ')}`);
    }

    console.log(`MariaDB 테이블 ${expectedTables.length}개를 모두 확인했습니다.`);
  } catch (error) {
    console.error('MariaDB 확인에 실패했습니다:', error.message);
    process.exitCode = 1;
  } finally {
    if (connection) connection.release();
    await pool.end();
  }
}

testDatabase();
