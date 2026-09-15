import { ERROR_CODE } from "#constants/errorCode.js";
import { AppError } from "#utils/appError.js";

/** 아이디: 영문 시작, 영문/숫자/_ , 4~20자. 대소문자는 동일 취급(소문자 저장) */
const USERNAME_PATTERN = /^[a-z][a-z0-9_]{3,19}$/;

const COMMON_PASSWORDS = new Set([
  "password",
  "password1",
  "password!",
  "12345678",
  "123456789",
  "qwerty123",
  "qwerty1!",
  "abcdefg1",
  "abcdefg!",
  "welcome1",
  "welcome!",
  "iloveyou1",
  "admin123",
  "admin123!",
  "letmein1",
  "letmein!",
  "rezero123",
  "rezero12!",
]);

function assertUsername(username) {
  if (!username) {
    throw new AppError(400, ERROR_CODE.INVALID_USERNAME, "아이디를 입력해 주세요.");
  }
  if (/\s/.test(username)) {
    throw new AppError(
      400,
      ERROR_CODE.INVALID_USERNAME,
      "아이디에는 공백을 넣을 수 없습니다.",
    );
  }
  if (username.length < 4 || username.length > 20) {
    throw new AppError(
      400,
      ERROR_CODE.INVALID_USERNAME,
      "아이디는 4~20자로 입력해 주세요.",
    );
  }
  if (!USERNAME_PATTERN.test(username)) {
    throw new AppError(
      400,
      ERROR_CODE.INVALID_USERNAME,
      "아이디는 영문으로 시작하고, 영문·숫자·_(밑줄)만 사용할 수 있습니다.",
    );
  }
}

function assertPassword(password, username) {
  if (!password) {
    throw new AppError(400, ERROR_CODE.INVALID_PASSWORD, "비밀번호를 입력해 주세요.");
  }
  if (/\s/.test(password)) {
    throw new AppError(
      400,
      ERROR_CODE.INVALID_PASSWORD,
      "비밀번호에는 공백을 넣을 수 없습니다.",
    );
  }
  if (password.length < 8 || password.length > 20) {
    throw new AppError(
      400,
      ERROR_CODE.INVALID_PASSWORD,
      "비밀번호는 8~20자로 입력해 주세요.",
    );
  }
  if (!/[A-Za-z]/.test(password)) {
    throw new AppError(
      400,
      ERROR_CODE.INVALID_PASSWORD,
      "비밀번호에 영문을 최소 1자 포함해 주세요.",
    );
  }
  if (!/[0-9]/.test(password)) {
    throw new AppError(
      400,
      ERROR_CODE.INVALID_PASSWORD,
      "비밀번호에 숫자를 최소 1자 포함해 주세요.",
    );
  }
  if (!/[^A-Za-z0-9\s]/.test(password)) {
    throw new AppError(
      400,
      ERROR_CODE.INVALID_PASSWORD,
      "비밀번호에 특수문자를 최소 1자 포함해 주세요.",
    );
  }
  if (username && password.toLowerCase().includes(username)) {
    throw new AppError(
      400,
      ERROR_CODE.INVALID_PASSWORD,
      "비밀번호에 아이디를 포함할 수 없습니다.",
    );
  }
  if (COMMON_PASSWORDS.has(password.toLowerCase())) {
    throw new AppError(
      400,
      ERROR_CODE.INVALID_PASSWORD,
      "너무 흔한 비밀번호입니다. 다른 비밀번호를 사용해 주세요.",
    );
  }
}

export function parseSignupRequest(body = {}) {
  const username =
    typeof body.username === "string" ? body.username.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const displayNameRaw =
    typeof body.displayName === "string" ? body.displayName.trim() : "";
  const displayName = displayNameRaw || username;

  assertUsername(username);
  assertPassword(password, username);

  if (!displayNameRaw) {
    throw new AppError(
      400,
      ERROR_CODE.INVALID_DISPLAY_NAME,
      "닉네임을 입력해 주세요.",
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
