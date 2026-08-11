import { createClient } from "redis";

const redisHost = process.env.REDIS_HOST || "127.0.0.1";
const redisPort = process.env.REDIS_PORT || "6379";
const redisPassword = process.env.REDIS_PASSWORD || "";

let redisUrl = "redis://";
if (redisPassword) {
  redisUrl = redisUrl + ":" + redisPassword + "@";
}
redisUrl = redisUrl + redisHost + ":" + redisPort;

export const redisClient = createClient({
  url: redisUrl,
});

redisClient.on("error", function (err) {
  console.error("[Redis Client Error]", err);
});

redisClient.on("connect", function () {
  console.log("[Redis Client Connected]");
});

await redisClient.connect();
