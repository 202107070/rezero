import { ERROR_CODE } from '../constants/errorCode.js';
import { AppError } from '../utils/appError.js';
import { verifyAccessToken } from '../utils/cryptoUtils.js';

export function authenticate(req, res, next) {
  const authorization = req.headers.authorization;

  if (!authorization?.startsWith('Bearer ')) {
    return next(new AppError(
      401,
      ERROR_CODE.TOKEN_REQUIRED,
      '로그인이 필요합니다.',
    ));
  }

  try {
    const token = authorization.slice('Bearer '.length).trim();
    const payload = verifyAccessToken(token);

    if (!payload.sub) {
      throw new Error('토큰에 사용자 ID가 없습니다.');
    }

    req.user = { id: payload.sub };
    return next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return next(new AppError(
        401,
        ERROR_CODE.TOKEN_EXPIRED,
        '로그인 정보가 만료되었습니다.',
      ));
    }

    if (error.message.startsWith('JWT_SECRET')) {
      return next(error);
    }

    return next(new AppError(
      401,
      ERROR_CODE.TOKEN_INVALID,
      '올바르지 않은 토큰입니다.',
    ));
  }
}
