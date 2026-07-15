require('./envConfig');

const { createClient } = require('redis');

// Valkey는 Redis 규격을 지원하므로 Redis 클라이언트를 사용합니다.
const redisClient = createClient({
  socket: {
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: Number(process.env.REDIS_PORT || 6379),
  },
  password: process.env.REDIS_PASSWORD || undefined,
});

redisClient.on('error', (error) => {
  console.error('[Valkey] error:', error.message);
});

async function connectRedis() {
  if (!redisClient.isOpen) await redisClient.connect();
  await redisClient.ping();
  console.log('[Valkey] connected');
}

module.exports = {
  redisClient,
  connectRedis,
};
