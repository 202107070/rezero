import "#config/envConfig.js";

import { createClient } from "redis";

function getRedisHost() {
  if (process.env.REDIS_HOST) {
    return process.env.REDIS_HOST;
  }
  return "127.0.0.1";
}

function getRedisPort() {
  if (process.env.REDIS_PORT) {
    return Number(process.env.REDIS_PORT);
  }
  return 6379;
}

function getRedisPassword() {
  if (process.env.REDIS_PASSWORD) {
    return process.env.REDIS_PASSWORD;
  }
  return undefined;
}

export const redisClient = createClient({
  socket: {
    host: getRedisHost(),
    port: getRedisPort(),
  },
  password: getRedisPassword(),
});

redisClient.on("error", function (error) {
  console.error("[Valkey] error:", error.message);
});

export async function connectRedis() {
  if (!redisClient.isOpen) {
    await redisClient.connect();
  }
  await redisClient.ping();
  console.log("[Valkey] connected");
}
