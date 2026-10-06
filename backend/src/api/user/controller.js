import { parseLoginRequest } from "./dto/loginRequestDto.js";
import { parseSignupRequest } from "./dto/signupRequestDto.js";
import {
  analyzeMatchHistory,
  analyzeUserProfile,
  deleteAccount,
  deleteMyMatchHistory,
  getCurrentUser,
  listMyMatchHistory,
  getPublicCard,
  listPublicProfiles,
  loginUser,
  saveMyMatchHistory,
  updateEquippedTitle,
  signupUser,
  spinRoulette,
} from "./service.js";
import {
  broadcastLobbyPresence,
  listOnlineUsers,
  markUserOffline,
} from "#service/socketService.js";
import { getSocket } from "#config/socketConfig.js";
import { SOCKET_EVENTS } from "#constants/socketEvents.js";
import { listFriendsForUser } from "./friendModel.js";
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

export async function getPublicProfiles(req, res, next) {
  try {
    const raw = String(req.query.ids || "");
    const ids = raw
      .split(",")
      .map(function (id) { return id.trim(); })
      .filter(function (id) { return /^[\w-]{1,64}$/.test(id); })
      .slice(0, 40);
    const users = await listPublicProfiles(ids);
    return sendSuccess(res, { users });
  } catch (error) {
    return next(error);
  }
}

export async function getPublicUserCard(req, res, next) {
  try {
    const userId = String(req.params.userId || "").trim();
    if (!userId || userId === "me") {
      throw new AppError(400, "INVALID_USER", "조회할 유저가 없습니다.");
    }
    const card = await getPublicCard(userId);
    return sendSuccess(res, card);
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

export async function postEquippedTitle(req, res, next) {
  try {
    const raw = req.body?.equippedTitleId;
    const titleId = raw == null || raw === "" ? null : String(raw);
    const result = await updateEquippedTitle(req.user.id, titleId);
    return sendSuccess(res, result);
  } catch (error) {
    return next(error);
  }
}

export async function removeMe(req, res, next) {
  try {
    const userId = req.user.id;
    await markUserOffline(userId);
    const io = getSocket();
    await broadcastLobbyPresence(io);
    if (io) {
      io.emit(SOCKET_EVENTS.USER_DELETED, { userId: String(userId) });
    }
    const result = await deleteAccount(userId);
    try {
      if (io) {
        for (const [, socket] of io.of("/").sockets) {
          if (String(socket.user?.id) === String(userId)) {
            socket.disconnect(true);
          }
        }
      }
    } catch {
      // ignore
    }
    return sendSuccess(res, result);
  } catch (error) {
    return next(error);
  }
}

export async function getMyFriends(req, res, next) {
  try {
    const rows = await listFriendsForUser(req.user.id);
    return sendSuccess(res, {
      friends: rows.map(function (row) {
        return {
          userId: String(row.userId),
          displayName: row.displayName || row.username || String(row.userId),
          username: row.username || "",
        };
      }),
    });
  } catch (error) {
    return next(error);
  }
}

export async function postUserAiAnalysis(req, res, next) {
  try {
    const historyId = String(req.body?.historyId || "").trim();
    if (historyId) {
      const result = await analyzeMatchHistory(req.user.id, historyId);
      return sendSuccess(res, result);
    }
    const targetUserId = String(req.body?.userId || req.user.id || "").trim();
    if (!targetUserId) {
      throw new AppError(400, "INVALID_USER", "분석 대상 유저가 없습니다.");
    }
    const result = await analyzeUserProfile(targetUserId);
    return sendSuccess(res, result);
  } catch (error) {
    return next(error);
  }
}
