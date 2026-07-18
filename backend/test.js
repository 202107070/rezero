import { pool, testDbConnection } from './src/config/dbConfig.js';
import { redisClient, connectRedis } from './src/config/redisConfig.js';

async function testConnections() {
  try {
    // DB와 Valkey 연결 상태는 이 파일에서 함께 확인하시면 됩니다.
    await testDbConnection();
    await connectRedis();
    console.log('MariaDB와 Valkey 연결을 모두 확인했습니다.');
  } catch (error) {
    console.error('연결 확인에 실패했습니다:', error.message);
    process.exitCode = 1;
  } finally {
    if (redisClient.isOpen) await redisClient.quit();
    await pool.end();
  }
}

testConnections();
