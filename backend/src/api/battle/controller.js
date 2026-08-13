import { parseStartMatchRequest } from "./dto/startMatchRequestDto.js";
import { toMatchStartResponse } from "./dto/matchStartResponseDto.js";
import { createBattle } from "./service.js";
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
