// 1. 가져올 때 connectValkey 대신 connectRedis로 가져옴
const { redisClient, connectRedis } = require('./src/config/redisConfig');

async function testRedis() {
    try {
        console.log('🔄 Valkey 연결 시도 중...');
        
        // 2. 호출할 때도 connectRedis()로 바꿈
        await connectRedis(); 
        
        await redisClient.set('test_key', 'Hello Valkey!');
        const value = await redisClient.get('test_key');
        
        console.log(`✅ Valkey 테스트 성공! 값: ${value}`);
        
        await redisClient.disconnect();
    } catch (err) {
        console.error('❌ Valkey 연결 테스트 실패:', err);
    }
}

testRedis();