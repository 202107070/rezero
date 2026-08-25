import { parseStartMatchRequest } from "./dto/startMatchRequestDto.js";
import { toMatchStartResponse } from "./dto/matchStartResponseDto.js";
import { parseSubmitAnswerRequest } from "./dto/submitAnswerRequestDto.js";
import { parseUseItemRequest } from "./dto/useItemRequestDto.js";
import { createBattle, submitBattleAnswer, useBattleItem } from "./service.js";
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
