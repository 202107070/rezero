require('dotenv').config();
const mariadb = require('mariadb');

const pool = mariadb.createPool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

async function testDbConnection() {
  let conn;
  try {
    conn = await pool.getConnection();
    const rows = await conn.query('SELECT 1 AS ok');
    console.log('[MariaDB] connected:', rows[0]);
  } catch (err) {
    console.error('[MariaDB] connection failed:', err.message);
    throw err;
  } finally {
    if (conn) conn.release();
  }
}

module.exports = {
  pool,
  testDbConnection,
};
