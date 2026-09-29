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

  try {
    await getModelFunction("grantStarterItems")(user.id, 5);
  } catch (error) {
    console.error("[signupUser] starter items grant failed:", error.message);
  }

  return {
    user: toSignupUserResponse(user),
    token: createAccessToken({
      id: user.id,
      username: user.username,
      displayName: user.displayName || user.username,
    }),
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
    token: createAccessToken({
      id: user.id,
      username: user.username,
      displayName: user.displayName || user.username,
    }),
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

const ROULETTE_POOL = [
  "paint",
  "lightning",
  "timeReduce",
  "revealLength",
  "revealPrev",
  "miss",
  "scribble",
  "blankBreak",
  "buildCharge",
];
const ROULETTE_COST = 1000;

export async function spinRoulette(userId) {
  const deductUserGold = getModelFunction("deductUserGold");
  const addUserItem = getModelFunction("addUserItem");
  const findUserById = getModelFunction("findUserById");
  const findUserItems = getModelFunction("findUserItems");

  const deducted = await deductUserGold(userId, ROULETTE_COST);
  if (!deducted.ok) {
    throw new AppError(400, "INSUFFICIENT_GOLD", "골드가 부족합니다.");
  }

  const itemKey = ROULETTE_POOL[Math.floor(Math.random() * ROULETTE_POOL.length)];
  if (itemKey !== "miss") {
    await addUserItem(userId, itemKey, 1);
  }

  const [user, items] = await Promise.all([
    findUserById(userId),
    findUserItems(userId),
  ]);

  return {
    itemKey,
    missed: itemKey === "miss",
    gold: Number(user?.gold ?? deducted.gold),
    items,
  };
}

export async function listMyMatchHistory(userId) {
  const listMatchCodeHistory = getModelFunction("listMatchCodeHistory");
  const entries = await listMatchCodeHistory(userId);
  return { entries };
}

function buildHistoryId(userId, input) {
  const raw = String(input.historyId || "").trim();
  const submitted = input.submittedAt || new Date().toISOString();
  const room = String(input.roomId || "solo");
  const suffix = raw || `${room}::${submitted}`;
  const prefixed = suffix.startsWith(`${userId}::`) ? suffix : `${userId}::${suffix}`;
  return prefixed.slice(0, 128);
}

export async function saveMyMatchHistory(userId, input) {
  const upsertMatchCodeHistory = getModelFunction("upsertMatchCodeHistory");
  const historyId = buildHistoryId(userId, input);
  await upsertMatchCodeHistory({
    historyId,
    userId,
    roomId: String(input.roomId || ""),
    submittedAt: input.submittedAt || new Date().toISOString(),
    lang: input.lang || "UNKNOWN",
    mode: input.mode || null,
    code: input.code || "",
    codes: Array.isArray(input.codes) ? input.codes : [],
    problems: Array.isArray(input.problems) ? input.problems : [],
  });
  return { historyId };
}

export async function deleteMyMatchHistory(userId, historyIds) {
  const deleteMatchCodeHistory = getModelFunction("deleteMatchCodeHistory");
  const deleted = await deleteMatchCodeHistory(userId, historyIds);
  return { deleted };
}

export async function deleteAccount(userId) {
  const deleteUserById = getModelFunction("deleteUserById");
  const deleted = await deleteUserById(userId);
  if (!deleted) {
    throw new AppError(404, ERROR_CODE.USER_NOT_FOUND, "사용자를 찾을 수 없습니다.");
  }
  return { deleted: true };
}

export async function analyzeUserProfile(targetUserId) {
  const findUserById = getModelFunction("findUserById");
  const findUserMatchAnalytics = getModelFunction("findUserMatchAnalytics");
  const {
    buildAnalyticsSummary,
    buildLocalAnalysisText,
    generateCursorAnalysis,
    polishAnalysisText,
  } = await import("./aiAnalysis.js");
  const { env } = await import("#config/envConfig.js");

  const user = await findUserById(targetUserId);
  if (!user) {
    throw new AppError(404, ERROR_CODE.USER_NOT_FOUND, "사용자를 찾을 수 없습니다.");
  }

  const profile = await getUserProfile(user);
  const matches = await findUserMatchAnalytics(targetUserId, 40);
  const summary = buildAnalyticsSummary(profile, matches);

  if (!env.cursorApiKey) {
    throw new AppError(
      503,
      "CURSOR_NOT_CONFIGURED",
      "CURSOR_API_KEY가 backend/.env에 설정되어 있지 않습니다. Cursor Dashboard → API Keys에서 키를 발급해 추가한 뒤 백엔드를 재시작하세요.",
    );
  }

  try {
    const aiText = await generateCursorAnalysis(summary);
    if (!aiText) {
      throw new Error("Cursor AI 응답이 비어 있습니다.");
    }
    return {
      userId: targetUserId,
      displayName: summary.displayName,
      source: "cursor",
      summary,
      analysis: aiText,
    };
  } catch (error) {
    console.error("[analyzeUserProfile] Cursor AI error:", error.message);
    const fallback = buildLocalAnalysisText(summary);
    return {
      userId: targetUserId,
      displayName: summary.displayName,
      source: "local-fallback",
      summary,
      analysis: polishAnalysisText(
        "AI 분석을 잠시 불러오지 못해, 전적을 바탕으로 간단히 정리했습니다.\n\n" + fallback,
      ),
    };
  }
}

export async function analyzeMatchHistory(userId, historyId) {
  const findUserById = getModelFunction("findUserById");
  const findMatchCodeHistoryById = getModelFunction("findMatchCodeHistoryById");
  const {
    buildMatchAnalysisText,
    generateCursorAnalysis,
    polishAnalysisText,
  } = await import("./aiAnalysis.js");
  const { env } = await import("#config/envConfig.js");

  const user = await findUserById(userId);
  if (!user) {
    throw new AppError(404, ERROR_CODE.USER_NOT_FOUND, "사용자를 찾을 수 없습니다.");
  }

  const entry = await findMatchCodeHistoryById(userId, historyId);
  if (!entry) {
    throw new AppError(404, "MATCH_HISTORY_NOT_FOUND", "해당 방의 매치 기록을 찾을 수 없습니다.");
  }

  const problems = Array.isArray(entry.problems) ? entry.problems : [];
  const codes = Array.isArray(entry.codes) ? entry.codes : [];
  const summary = {
    scope: "한 판",
    displayName: user.displayName || user.username || userId,
    roomId: entry.roomId || "",
    lang: entry.lang || "UNKNOWN",
    submittedAt: entry.submittedAt,
    mode: entry.mode || "",
    problemCount: problems.length || codes.length || 0,
    problems: problems.slice(0, 8).map(function (problem, index) {
      return {
        order: index + 1,
        title: problem?.title || "문제 " + (index + 1),
        question: String(problem?.question || "").slice(0, 500),
      };
    }),
    codes: (codes.length > 0 ? codes : [entry.code || ""]).slice(0, 8).map(function (code) {
      return String(code || "").slice(0, 1500);
    }),
  };

  const roomLabel = entry.roomId ? entry.roomId + "번 방" : "개인 매치";

  if (!env.cursorApiKey) {
    throw new AppError(
      503,
      "CURSOR_NOT_CONFIGURED",
      "CURSOR_API_KEY가 backend/.env에 설정되어 있지 않습니다. Cursor Dashboard → API Keys에서 키를 발급해 추가한 뒤 백엔드를 재시작하세요.",
    );
  }

  try {
    const aiText = await generateCursorAnalysis(summary);
    if (!aiText) {
      throw new Error("Cursor AI 응답이 비어 있습니다.");
    }
    return {
      userId,
      displayName: summary.displayName,
      historyId: entry.historyId,
      roomId: entry.roomId,
      lang: entry.lang,
      source: "cursor",
      summary: {
        roomId: entry.roomId,
        lang: entry.lang,
        problemCount: summary.problemCount,
      },
      analysis: aiText,
    };
  } catch (error) {
    console.error("[analyzeMatchHistory] Cursor AI error:", error.message);
    return {
      userId,
      displayName: summary.displayName,
      historyId: entry.historyId,
      roomId: entry.roomId,
      lang: entry.lang,
      source: "local-fallback",
      summary: {
        roomId: entry.roomId,
        lang: entry.lang,
        problemCount: summary.problemCount,
      },
      analysis: polishAnalysisText(
        roomLabel + " 분석을 잠시 불러오지 못해, 이 판 기록으로 간단히 정리했습니다.\n\n" +
          buildMatchAnalysisText(entry),
      ),
    };
  }
}
