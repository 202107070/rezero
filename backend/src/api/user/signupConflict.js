import { AppError } from '../../utils/appError.js';

export async function mapSignupConflict(error, input, model) {
  if (error.code !== 'ER_DUP_ENTRY' && error.errno !== 1062) throw error;
  if (await model.isDisplayNameTaken(input.displayName)) {
    throw new AppError(409, 'DISPLAY_NAME_ALREADY_EXISTS', '이미 사용 중인 닉네임입니다.');
  }
  if (await model.isUsernameTaken(input.username)) {
    throw new AppError(409, 'USERNAME_ALREADY_EXISTS', '이미 사용 중인 아이디입니다.');
  }
  throw new AppError(409, 'SIGNUP_CONFLICT', '가입 정보가 다른 요청과 충돌했습니다. 다시 시도해 주세요.');
}
