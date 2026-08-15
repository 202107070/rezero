import { redisClient } from "#config/redisConfig.js";

class LockService {
  async acquireLock(key, ttlSeconds) {
    let ttl = 30;
    if (ttlSeconds) {
      ttl = ttlSeconds;
    }

    const lockKey = "lock:" + key;
    const result = await redisClient.set(lockKey, "locked", {
      NX: true,
      EX: ttl,
    });

    if (result === "OK") {
      return true;
    }
    return false;
  }

  async releaseLock(key) {
    const lockKey = "lock:" + key;
    await redisClient.del(lockKey);
  }

  async executeWithLock(key, ttlSeconds, taskFunction) {
    const acquired = await this.acquireLock(key, ttlSeconds);
    if (!acquired) {
      throw new Error(
        "락(Lock)을 획득하지 못했습니다. 이미 해당 작업이 처리 중이거나 실행되었습니다.",
      );
    }

    try {
      const result = await taskFunction();
      return result;
    } finally {
      await this.releaseLock(key);
    }
  }
}

export const lockService = new LockService();
