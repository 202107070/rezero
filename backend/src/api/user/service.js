import * as userModel from "./model.js";
import { toSignupUserResponse, toUserResponse } from "./dto/userResponseDto.js";
import { ERROR_CODE } from "#constants/errorCode.js";
import { AppError } from "#utils/appError.js";
import {
  comparePassword,
  createAccessToken,
  hashPassword,
} from "#utils/cryptoUtils.js";

function getModelFunction(name) {
  const modelFunction = userModel[name];

  if (typeof modelFunction !== "function") {
    throw new AppError(
      503,
      ERROR_CODE.AUTH_DB_NOT_READY,
      "사용자 DB 함수 연결 후 진행하시면 됩니다.",
    );
  }

  return modelFunction;
}

function parseJson(value, fallback) {
  if (value === null || value === undefined) {
    return fallback;
  }

  if (typeof value !== "string") {
    return value;
  }

  try {
    return JSON.parse(value);
  } catch (error) {
    return fallback;
  }
}

async function getUserProfile(user) {
  const [items, titleRow] = await Promise.all([
    getModelFunction("findUserItems")(user.id),
    getModelFunction("findUserTitleData")(user.id),
  ]);

  return toUserResponse({
    ...user,
    items,
    titleData: {
      owned: parseJson(titleRow?.ownedTitleIds, []),
      equipped: titleRow?.equippedTitleId || null,
      stats: {
        totalWins: Number(titleRow?.totalWins || 0),
        consecutiveWins: Number(titleRow?.consecutiveWins || 0),
        totalGames: Number(titleRow?.totalGames || 0),
        perfectGame: Boolean(titleRow?.perfectGame),
        avgSpeed: Number(titleRow?.avgSpeed || 0),
        langWins: parseJson(titleRow?.langWins, {}),
      },
    },
  });
}

export async function signupUser(input) {
  const isUsernameTaken = getModelFunction("isUsernameTaken");
  const createUser = getModelFunction("createUser");

  if (await isUsernameTaken(input.username)) {
    throw new AppError(
      409,
      ERROR_CODE.USERNAME_ALREADY_EXISTS,
      "이미 사용 중인 아이디입니다.",
    );
  }

  const user = await createUser({
    id: `user_${Date.now()}`,
    username: input.username,
    passwordHash: await hashPassword(input.password),
    displayName: input.displayName,
  });

  return {
    user: toSignupUserResponse(user),
    token: createAccessToken(user.id),
  };
}

export async function loginUser(input) {
  const findUserByUsername = getModelFunction("findUserByUsername");
  const user = await findUserByUsername(input.username);

  if (
    !user ||
    !(await comparePassword(
      input.password,
      user.passwordHash ?? user.password_hash,
    ))
  ) {
    throw new AppError(
      401,
      ERROR_CODE.INVALID_CREDENTIALS,
      "아이디 또는 비밀번호가 올바르지 않습니다.",
    );
  }

  return {
    user: await getUserProfile(user),
    token: createAccessToken(user.id),
  };
}

export async function getCurrentUser(userId) {
  const findUserById = getModelFunction("findUserById");
  const user = await findUserById(userId);

  if (!user) {
    throw new AppError(
      404,
      ERROR_CODE.USER_NOT_FOUND,
      "사용자를 찾을 수 없습니다.",
    );
  }

  return getUserProfile(user);
}
