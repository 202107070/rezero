import { pool, testDbConnection } from "#config/dbConfig.js";
import { redisClient, connectRedis } from "#config/redisConfig.js";

async function testConnections() {
  try {
    await testDbConnection();
    await connectRedis();
    console.log("MariaDB와 Valkey 연결을 모두 확인했습니다.");
  } catch (error) {
    console.error("연결 확인에 실패했습니다:", error.message);
    process.exitCode = 1;
  } finally {
    if (redisClient.isOpen) {
      await redisClient.quit();
    }
    await pool.end();
  }
}

testConnections();
