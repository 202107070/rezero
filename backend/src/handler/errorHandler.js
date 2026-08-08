import { sendError } from "#utils/responseHelper.js";

export function notFoundHandler(req, res, next) {
  const error = new Error(
    `요청한 주소를 찾을 수 없습니다: ${req.method} ${req.originalUrl}`,
  );
  error.status = 404;
  error.code = "NOT_FOUND";
  next(error);
}

export function errorHandler(error, req, res, next) {
  void next;

  let status;
  if (error.status) {
    status = error.status;
  } else {
    status = 500;
  }

  let code;
  if (error.code) {
    code = error.code;
  } else {
    code = "INTERNAL_SERVER_ERROR";
  }

  let message;
  if (status === 500) {
    message = "서버에서 오류가 발생했습니다.";
  } else {
    message = error.message;
  }

  if (status === 500) {
    console.error(error);
  }

  return sendError(res, status, code, message, error.details);
}
