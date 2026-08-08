import { ERROR_CODE } from "#constants/errorCode.js";
import { AppError } from "#utils/appError.js";

const USERNAME_PATTERN = /^[a-z0-9_]{3,32}$/;

export function parseSignupRequest(body = {}) {
  const username =
    typeof body.username === "string" ? body.username.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const displayName =
    typeof body.displayName === "string"
      ? body.displayName.trim() || username
      : username;

  if (!USERNAME_PATTERN.test(username)) {
    throw new AppError(
      400,
      ERROR_CODE.INVALID_USERNAME,
      "아이디는 3자 이상의 영문 소문자, 숫자, 밑줄만 사용할 수 있습니다.",
    );
  }

  if (password.length < 4) {
    throw new AppError(
      400,
      ERROR_CODE.INVALID_PASSWORD,
      "비밀번호는 4자 이상 입력해 주세요.",
    );
  }

  if (displayName.length > 20) {
    throw new AppError(
      400,
      ERROR_CODE.INVALID_DISPLAY_NAME,
      "닉네임은 20자 이하로 입력해 주세요.",
    );
  }

  return { username, password, displayName };
}
