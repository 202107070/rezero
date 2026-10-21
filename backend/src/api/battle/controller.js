import { parseStartMatchRequest } from "./dto/startMatchRequestDto.js";
import { toMatchStartResponse } from "./dto/matchStartResponseDto.js";
import { parseSubmitAnswerRequest } from "./dto/submitAnswerRequestDto.js";
import { parseUseItemRequest } from "./dto/useItemRequestDto.js";
import { parseSubmitMatchResultRequest } from "./dto/submitMatchResultRequestDto.js";
import {
  createBattle,
  getActiveMatchForRoom,
  getMatchPendingUsers,
  getMatchResult,
  activateReviseItems,
  submitBattleAnswer,
  submitMatchResult,
  useBattleItem,
} from "./service.js";
import { getSocket } from "#config/socketConfig.js";
import { socketGameService } from "#service/socketService.js";
import { sendSuccess } from "#utils/responseHelper.js";
import { AppError } from "#utils/appError.js";

export async function start(req, res, next) {
  try {
    const input = parseStartMatchRequest(req.body);
    const match = await createBattle(input.roomId, req.user.id, {
      roundSeconds: input.roundSeconds,
    });

    return sendSuccess(res, toMatchStartResponse(match), 201);
  } catch (error) {
    return next(error);
  }
}

export async function getActive(req, res, next) {
  try {
    const roomId = Number(req.params.roomId);
    if (!Number.isInteger(roomId) || roomId < 1) {
      throw new AppError(400, "INVALID_ROOM_ID", "올바른 방 ID가 필요합니다.");
    }
    const match = await getActiveMatchForRoom(roomId, req.user.id);
    return sendSuccess(res, toMatchStartResponse(match));
  } catch (error) {
    return next(error);
  }
}

export async function submitAnswer(req, res, next) {
  try {
    const input = parseSubmitAnswerRequest(req.params, req.body);
    const result = await submitBattleAnswer({
      ...input,
      userId: req.user.id,
    });

    return sendSuccess(res, result);
  } catch (error) {
    return next(error);
  }
}

export async function useItem(req, res, next) {
  try {
    const input = parseUseItemRequest(req.params, req.body);
    const result = await useBattleItem({
      ...input,
      userId: req.user.id,
    });

    return sendSuccess(res, result);
  } catch (error) {
    return next(error);
  }
}

export async function activateRevise(req, res, next) {
  try {
    const matchId = String(req.params.matchId || "").trim();
    const problemIndexes = Array.isArray(req.body?.problemIndexes) ? req.body.problemIndexes : [];
    if (!matchId) {
      throw new AppError(400, "INVALID_MATCH_ID", "경기 ID가 필요합니다.");
    }
    const result = await activateReviseItems({
      matchId,
      userId: req.user.id,
      problemIndexes,
    });
    return sendSuccess(res, result);
  } catch (error) {
    return next(error);
  }
}

export async function submitResult(req, res, next) {
  try {
    const input = parseSubmitMatchResultRequest(req.params, req.body);
    const result = await submitMatchResult({
      ...input,
      userId: req.user.id,
    });

    const io = getSocket();
    if (io && result.roomId) {
      if (result.resultReady === true && Array.isArray(result.ranking?.rewards)) {
        await socketGameService.broadcastGameEnded(io, String(result.roomId), {
          roomId: result.roomId,
          matchId: input.matchId,
          ranking: result.ranking.players,
          rewards: result.ranking.rewards,
        });
      } else if (Array.isArray(result.waitingForUserIds)) {
        socketGameService.broadcastMatchResultPending(io, String(result.roomId), {
          roomId: result.roomId,
          matchId: input.matchId,
          waitingForUserIds: result.waitingForUserIds,
        });
      }
    }

    return sendSuccess(res, result);
  } catch (error) {
    return next(error);
  }
}

export async function getPending(req, res, next) {
  try {
    const matchId = String(req.params.matchId || "");
    if (!matchId) {
      throw new AppError(400, "INVALID_MATCH_ID", "경기 ID가 필요합니다.");
    }
    const result = await getMatchPendingUsers(matchId, req.user.id);
    return sendSuccess(res, result);
  } catch (error) {
    return next(error);
  }
}

export async function getResult(req, res, next) {
  try {
    const result = await getMatchResult(req.params.matchId);
    return sendSuccess(res, result);
  } catch (error) {
    return next(error);
  }
}
