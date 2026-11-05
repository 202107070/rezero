import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { redisClient, connectRedis } from '../src/config/redisConfig.js';
import { assertIsolatedTestTarget } from './isolatedTestGuard.js';

assertIsolatedTestTarget(process.env.TEST_BASE_URL || 'http://127.0.0.1:18082');
process.env.PRESERVE_CHAT_ON_START = 'true';
const id = `startup-preserve-${randomUUID()}`;
const keys = [`room:${id}:messages`, `chat:room:${id}:recent`];
try {
  await redisClient.connect();
  for (const key of keys) {
    await redisClient.rPush(key, 'retained message');
    await redisClient.expire(key, 120);
  }
  await redisClient.quit();
  await connectRedis();
  for (const key of keys) {
    assert.deepEqual(await redisClient.lRange(key, 0, -1), ['retained message']);
    assert.ok(await redisClient.ttl(key) > 0);
  }
  console.log('PASS: deployment startup preserves both current and legacy chat caches');
} finally {
  if (redisClient.isOpen) {
    await redisClient.del(keys);
    await redisClient.quit();
  }
}
