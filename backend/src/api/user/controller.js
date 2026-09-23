import { parseLoginRequest } from "./dto/loginRequestDto.js";
import { parseSignupRequest } from "./dto/signupRequestDto.js";
import {
  deleteMyMatchHistory,
  getCurrentUser,
  listMyMatchHistory,
  loginUser,
  saveMyMatchHistory,
  signupUser,
  spinRoulette,
} from "./service.js";
import { listOnlineUsers } from "#service/socketService.js";
import { sendSuccess } from "#utils/responseHelper.js";
import { AppError } from "#utils/appError.js";

export async function signup(req, res, next) {
  try {
    const input = parseSignupRequest(req.body);
    const result = await signupUser(input);
    return sendSuccess(res, result, 201);
  } catch (error) {
    return next(error);
  }
}

export async function login(req, res, next) {
  try {
    const input = parseLoginRequest(req.body);
    const result = await loginUser(input);
    return sendSuccess(res, result);
  } catch (error) {
    return next(error);
  }
}

export async function getMe(req, res, next) {
  try {
    const user = await getCurrentUser(req.user.id);
    return sendSuccess(res, user);
  } catch (error) {
    return next(error);
  }
}

export async function getOnlineUsers(req, res, next) {
  try {
    const users = await listOnlineUsers();
    return sendSuccess(res, { users });
  } catch (error) {
    return next(error);
  }
}

export async function postRoulette(req, res, next) {
  try {
    const result = await spinRoulette(req.user.id);
    return sendSuccess(res, result);
  } catch (error) {
    return next(error);
  }
}

export async function getMatchHistory(req, res, next) {
  try {
    const result = await listMyMatchHistory(req.user.id);
    return sendSuccess(res, result);
  } catch (error) {
    return next(error);
  }
}

export async function postMatchHistory(req, res, next) {
  try {
    const body = req.body || {};
    if (!body.submittedAt && !body.historyId) {
      throw new AppError(400, "INVALID_MATCH_HISTORY", "매치 기록이 올바르지 않습니다.");
    }
    const result = await saveMyMatchHistory(req.user.id, body);
    return sendSuccess(res, result, 201);
  } catch (error) {
    return next(error);
  }
}

export async function removeMatchHistory(req, res, next) {
  try {
    const ids = Array.isArray(req.body?.historyIds)
      ? req.body.historyIds.map(String)
      : [];
    if (ids.length === 0) {
      throw new AppError(400, "INVALID_MATCH_HISTORY", "삭제할 기록이 없습니다.");
    }
    const result = await deleteMyMatchHistory(req.user.id, ids);
    return sendSuccess(res, result);
  } catch (error) {
    return next(error);
  }
}
