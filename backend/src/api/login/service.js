// src/api/login/service.js
import { pool } from '../../config/dbConfig.js';

// 1. 사용자 생성 (createUser)
export const createUser = async (username, passwordHash) => {
    const result = await pool.query(
        'INSERT INTO users (username, passwordHash) VALUES (?, ?)',
        [username, passwordHash]
    );
    return {
        id: Number(result.insertId), // mariadb 패키지는 insertId가 BigInt일 수 있어 Number로 감싸면 안전합니다
        username: username
    };
};

// 2. 아이디 존재 여부 확인 (isUsernameTaken)
export const isUsernameTaken = async (username) => {
    const rows = await pool.query(
        'SELECT COUNT(*) AS count FROM users WHERE username = ?',
        [username]
    );
    return Number(rows[0].count) > 0;
};

// 3. 사용자 이름으로 조회 (findUserByUsername)
export const findUserByUsername = async (username) => {
    const rows = await pool.query(
        'SELECT * FROM users WHERE username = ?',
        [username]
    );
    return rows.length > 0 ? rows[0] : null;
};

// 4. 사용자 ID로 조회 (findUserById)
export const findUserById = async (id) => {
    const rows = await pool.query(
        'SELECT id, username FROM users WHERE id = ?',
        [id]
    );
    return rows.length > 0 ? rows[0] : null;
};