// test.js
const { connectDB } = require('./src/config/dbConfig');
const { connectRedis } = require('./src/config/redisConfig');

console.log('데이터베이스 & 레디스 연결 테스트 시작...');

// DB 및 Redis 연결 함수 실행
connectDB();
connectRedis();