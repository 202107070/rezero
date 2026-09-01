import { parseStartMatchRequest } from "./dto/startMatchRequestDto.js";
import { toMatchStartResponse } from "./dto/matchStartResponseDto.js";
import { parseSubmitAnswerRequest } from "./dto/submitAnswerRequestDto.js";
import { parseUseItemRequest } from "./dto/useItemRequestDto.js";
import { parseSubmitMatchResultRequest } from "./dto/submitMatchResultRequestDto.js";
import {
  createBattle,
  getMatchResult,
  submitBattleAnswer,
  submitMatchResult,
  useBattleItem,
} from "./service.js";
import { getSocket } from "#config/socketConfig.js";
import { socketGameService } from "#service/socketService.js";
import { sendSuccess } from "#utils/responseHelper.js";

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

export async function submitResult(req, res, next) {
  try {
    const input = parseSubmitMatchResultRequest(req.params, req.body);
    const result = await submitMatchResult({
      ...input,
      userId: req.user.id,
    });

    if (
      result.resultReady === true &&
      Array.isArray(result.ranking?.rewards)
    ) {
      const io = getSocket();

      if (io) {
        await socketGameService.broadcastGameEnded(
          io,
          String(result.roomId),
          {
            roomId: result.roomId,
            matchId: input.matchId,
            ranking: result.ranking.players,
            rewards: result.ranking.rewards,
          },
        );
      }
    }

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
