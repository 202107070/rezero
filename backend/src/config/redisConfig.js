// ioredis 패키지를 첫 줄에서 불러옴
const Redis = require('ioredis');
require('dotenv').config();

// Valkey(Redis) 연결 설정
const redisClient = new Redis({
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: Number(process.env.REDIS_PORT || 6379),
    password: process.env.REDIS_PASSWORD || undefined,
});

redisClient.on('error', (err) => console.error('[Valkey/Redis] Error:', err.message));
redisClient.on('connect', () => console.log('[Valkey/Redis] connected successfully'));

async function connectRedis() {
    try {
        await redisClient.ping(); // 서버가 켜져 있는지 핑 테스트
        console.log('[Valkey/Redis] Ping Test Success');
    } catch (err) {
        console.error('[Valkey/Redis] Warning: Server is not running, skipping...', err.message);
    }
}

module.exports = {
    redisClient,
    connectRedis
};