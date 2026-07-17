// mysql 패키지를 첫 줄에서 불러옴 (import/require)
const mysql = require('mysql2/promise'); 
require('dotenv').config(); // 환경변수 로드

// MariaDB 연결 설정
const pool = mysql.createPool({
    host: process.env.DB_HOST || '127.0.0.1',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || 'osDB',
    port: process.env.DB_PORT || 3306,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

async function connectDB() {
    try {
        const connection = await pool.getConnection();
        console.log('[MariaDB] connected successfully');
        connection.release();
    } catch (error) {
        console.error('[MariaDB] Warning: Could not connect to DB, skipping...', error.message);
    }
}

module.exports = {
    pool,
    connectDB
};