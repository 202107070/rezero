import { AppError } from "#utils/appError.js";

function invalidStartRequest(message) {
  return new AppError(400, "INVALID_MATCH_START_REQUEST", message);
}

export function parseStartMatchRequest(body = {}) {
  const roomId = Number(body.roomId);

  if (!Number.isInteger(roomId) || roomId < 1) {
    throw invalidStartRequest("올바른 방 ID를 입력해 주세요.");
  }

  let roundSeconds;

  if (body.roundSeconds !== undefined) {
    roundSeconds = Number(body.roundSeconds);

    if (!Number.isInteger(roundSeconds) || roundSeconds < 1) {
      throw invalidStartRequest("제한 시간은 1초 이상이어야 합니다.");
    }
  }

  return {
    roomId,
    roundSeconds,
  };
}
