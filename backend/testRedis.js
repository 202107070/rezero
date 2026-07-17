const redis = require('redis');

async function runRedisTest() {
    const client = redis.createClient({ url: 'redis://127.0.0.1:6379' });
    await client.connect();

    // 1. SET
    await client.set('test_key', 'mintae_test');
    console.log('✅ SET 성공');

    // 2. GET
    const val = await client.get('test_key');
    console.log('✅ GET 결과:', val);

    // 3. DEL
    await client.del('test_key');
    const check = await client.get('test_key');
    console.log('✅ DEL 성공, 결과(null이어야 함):', check);

    await client.disconnect();
}

runRedisTest();