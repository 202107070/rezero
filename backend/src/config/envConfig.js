const path = require('path');
const dotenv = require('dotenv');

// 실행 위치와 관계없이 backend/.env를 읽을 수 있도록 경로를 고정합니다.
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  host: process.env.HOST || '0.0.0.0',
  // 프론트 개발 서버의 /api 프록시 포트와 동일한 8080을 사용합니다.
  port: Number(process.env.PORT || 8080),
};

module.exports = { env };
