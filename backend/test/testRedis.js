import { redisClient, connectRedis } from "#config/redisConfig.js";

async function testValkey() {
  const key = "test:valkey-connection";
  const value = "connected";

  try {
    await connectRedis();
    await redisClient.set(key, value);

    const savedValue = await redisClient.get(key);
    if (savedValue !== value) throw new Error("저장한 값을 읽지 못했습니다.");

    await redisClient.del(key);
    const deletedValue = await redisClient.get(key);
    if (deletedValue !== null)
      throw new Error("테스트 값이 삭제되지 않았습니다.");

    console.log("Valkey SET, GET, DEL 테스트를 모두 확인했습니다.");
  } catch (error) {
    console.error("Valkey 확인에 실패했습니다:", error.message);
    process.exitCode = 1;
  } finally {
    if (redisClient.isOpen) await redisClient.quit();
  }
}

testValkey();
