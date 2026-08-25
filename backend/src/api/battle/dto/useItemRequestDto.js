import { AppError } from "#utils/appError.js";

function invalidRequest(message) {
  return new AppError(400, "INVALID_ITEM_REQUEST", message);
}

export function parseUseItemRequest(params = {}, body = {}) {
  const matchId = typeof params.matchId === "string" ? params.matchId.trim() : "";
  const problemIndex = Number(body.problemIndex);
  const itemKey = typeof body.itemKey === "string" ? body.itemKey.trim() : "";
  const targetUserId =
    typeof body.targetUserId === "string" ? body.targetUserId.trim() : "";

  if (!matchId) {
    throw invalidRequest("경기 ID가 필요합니다.");
  }

  if (!Number.isInteger(problemIndex) || problemIndex < 0) {
    throw invalidRequest("문제 번호가 올바르지 않습니다.");
  }

  if (!itemKey) {
    throw invalidRequest("아이템 종류가 필요합니다.");
  }

  return {
    matchId,
    problemIndex,
    itemKey,
    targetUserId: targetUserId || null,
  };
}
