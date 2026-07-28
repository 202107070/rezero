import { pool } from './src/config/dbConfig.js';
import {
  createUser,
  findUserById,
  findUserByUsername,
  isUsernameTaken,
} from './src/api/user/model.js';

async function runTest() {
  const suffix = Date.now();
  let userCreated = false;
  const testUser = {
    id: `user_test_${suffix}`,
    username: `test_user_${suffix}`,
    passwordHash: 'test_password_hash',
    displayName: 'DB 테스트',
  };

  try {
    const createdUser = await createUser(testUser);
    userCreated = true;
    console.log('[사용자 생성]', createdUser);

    const usernameTaken = await isUsernameTaken(testUser.username);
    console.log('[아이디 중복 확인]', usernameTaken);

    const userByUsername = await findUserByUsername(testUser.username);
    console.log('[아이디로 조회]', userByUsername);

    const userById = await findUserById(testUser.id);
    console.log('[사용자 ID로 조회]', userById);

    if (!usernameTaken || !userByUsername || !userById) {
      throw new Error('사용자 저장 또는 조회 결과를 확인해 주세요.');
    }

    console.log('사용자 DB 함수 테스트를 완료했습니다.');
  } finally {
    if (userCreated) {
      await pool.query('DELETE FROM users WHERE id = ?', [testUser.id]);
    }
    await pool.end();
  }
}

runTest().catch(function handleTestError(error) {
  console.error('사용자 DB 함수 테스트에 실패했습니다:', error.message);
  process.exitCode = 1;
});
