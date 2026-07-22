import { sendError } from '../utils/responseHelper.js';

export function notFoundHandler(req, res, next) {
  const error = new Error(`요청한 주소를 찾을 수 없습니다: ${req.method} ${req.originalUrl}`);
  error.status = 404;
  error.code = 'NOT_FOUND';
  next(error);
}

export function errorHandler(error, req, res, next) {
  // Express 오류 처리 함수는 인자 4개가 필요하므로 next는 그대로 유지합니다.
  void next;

  const status = error.status || 500;
  const code = error.code || 'INTERNAL_SERVER_ERROR';
  const message = status === 500 ? '서버에서 오류가 발생했습니다.' : error.message;

  if (status === 500) console.error(error);
  return sendError(res, status, code, message, error.details);
}
