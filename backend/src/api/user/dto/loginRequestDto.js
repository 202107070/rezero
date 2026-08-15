import { ERROR_CODE } from "#constants/errorCode.js";
import { AppError } from "#utils/appError.js";

export function parseLoginRequest(body = {}) {
  const username =
    typeof body.username === "string" ? body.username.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";

  if (!username || !password) {
    throw new AppError(
      400,
      ERROR_CODE.INVALID_REQUEST,
      "아이디와 비밀번호를 모두 입력해 주세요.",
    );
  }

  return { username, password };
}
