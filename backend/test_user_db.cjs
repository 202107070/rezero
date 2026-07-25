// test_user_db.cjs
const userService = require('./src/api/login/service.js');
const pool = require('./src/config/dbConfig.js');

async function runTest() {
    console.log("🚀 유저 DB 함수 테스트 시작!\n");
    
    // 테스트용 가짜 데이터
    const testUsername = 'test_user_999';
    const testPasswordHash = 'hashed_password_123';
    let newUserId = null;

    try {
        // 1. 사용자 생성 테스트
        const newUser = await userService.createUser(testUsername, testPasswordHash);
        newUserId = newUser.id;
        console.log("✅ [createUser 성공]:", newUser);

        // 2. 아이디 중복 확인 테스트
        const isTaken = await userService.isUsernameTaken(testUsername);
        console.log(`✅ [isUsernameTaken 성공] '${testUsername}' 존재 여부:`, isTaken);

        // 3. Username으로 조회 (로그인용)
        const userByName = await userService.findUserByUsername(testUsername);
        console.log("✅ [findUserByUsername 성공]:", userByName.username, "조회됨");

        // 4. ID로 조회 (비밀번호 제외)
        const userById = await userService.findUserById(newUserId);
        console.log("✅ [findUserById 성공]:", userById);

    } catch (error) {
        console.error("❌ 에러 발생:", error);
    } finally {
        // 5. 테스트 완료 후 데이터 삭제
        if (newUserId) {
            await pool.query('DELETE FROM users WHERE id = ?', [newUserId]);
            console.log(`\n🧹 테스트 데이터(ID: ${newUserId}) 완전 삭제 성공! (DB 롤백 완료)`);
        }
        
        // 안전하게 풀 종료
        if (pool && typeof pool.end === 'function') {
            await pool.end();
        }
        console.log("🏁 테스트 종료");
    }
}

runTest();