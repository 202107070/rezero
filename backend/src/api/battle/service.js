import { randomUUID } from "node:crypto";

import * as battleModel from "./model.js";
import * as roomModel from "../room/model.js";
import { selectProblems } from "../problem/service.js";
import { AppError } from "#utils/appError.js";

const DEFAULT_ROUND_SECONDS = 2700;

function createMatchId(roomId) {
  return `battle-${roomId}-${randomUUID()}`;
}

export async function createBattle(roomId, userId, options = {}) {
  const room = await roomModel.findRoomById(roomId);

  if (!room) {
    throw new AppError(404, "ROOM_NOT_FOUND", "방을 찾을 수 없습니다.");
  }

  if (String(room.hostUserId) !== String(userId)) {
    throw new AppError(
      403,
      "MATCH_START_FORBIDDEN",
      "방장만 경기를 만들 수 있습니다.",
    );
  }

  if (room.status !== "STARTED") {
    throw new AppError(
      409,
      "ROOM_NOT_STARTED",
      "게임 시작이 완료된 방에서만 경기를 만들 수 있습니다.",
    );
  }

  const problems = await selectProblems({
    difficulty: room.difficulty,
    language: room.language,
    count: Number(room.problemCount),
  });
  const matchId = createMatchId(room.id);
  let roundSeconds = DEFAULT_ROUND_SECONDS;

  if (options.roundSeconds !== undefined) {
    roundSeconds = Number(options.roundSeconds);
  }

  if (!Number.isInteger(roundSeconds) || roundSeconds < 1) {
    throw new AppError(
      400,
      "INVALID_ROUND_SECONDS",
      "제한 시간은 1초 이상이어야 합니다.",
    );
  }

  await battleModel.createMatchWithProblems({
    matchId,
    roomId: Number(room.id),
    language: room.language,
    difficulty: room.difficulty,
    maxPlayers: Number(room.maxPlayers),
    roomMode: room.mode,
    gameMode: room.gameMode,
    roundSeconds,
    problems,
  });

  const match = await battleModel.findMatchById(matchId);

  return {
    ...match,
    problems,
  };
}
