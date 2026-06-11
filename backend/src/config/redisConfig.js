require('dotenv').config();
const { createClient } = require('redis');

const redisClient = createClient({
  socket: {
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: Number(process.env.REDIS_PORT || 6379),
  },
});

redisClient.on('error', (err) => {
  console.error('[Redis] error:', err.message);
});

async function connectRedis() {
  if (!redisClient.isOpen) {
    await redisClient.connect();
  }

  const pong = await redisClient.ping();
  console.log('[Redis] connected:', pong);
}

module.exports = {
  redisClient,
  connectRedis,
};
