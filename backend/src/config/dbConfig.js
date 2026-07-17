const mysql = require('mysql'); 
require('dotenv').config();

// MariaDB 연결 설정
const pool = mysql.createPool({
    host: process.env.DB_HOST || '127.0.0.1',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || 'osDB',
    port: process.env.DB_PORT || 3306,
    connectionLimit: 10
});

// DB 연결 테스트 함수 (콜백 방식 적용)
function connectDB() {
    pool.getConnection((err, connection) => {
        if (err) {
            console.error('[MariaDB] Warning: Could not connect to DB, skipping...', err.message);
            return;
        }
        console.log('[MariaDB] connected successfully');
        connection.release();
    });
}

module.exports = {
    pool,
    connectDB
};