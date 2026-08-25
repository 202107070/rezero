import { randomUUID } from "node:crypto";

import * as battleModel from "./model.js";
import * as roomModel from "../room/model.js";
import { judgeProblemAnswer, selectProblems } from "../problem/service.js";
import { AppError } from "#utils/appError.js";
import { redisClient } from "#config/redisConfig.js";

const DEFAULT_ROUND_SECONDS = 2700;
const CORRECT_ANSWER_SCORE = 100;
const ITEM_KEYS = new Set([
  "paint",
  "revealLength",
  "revealPrev",
  "lightning",
  "timeReduce",
  "scribble",
  "blankBreak",
  "buildCharge",
]);

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

function parseProblemSnapshot(value) {
  if (typeof value !== "string") {
    return value;
  }

  try {
    return JSON.parse(value);
  } catch (error) {
    throw new AppError(500, "INVALID_MATCH_PROBLEM", "경기 문제 정보를 읽을 수 없습니다.");
  }
}

function submittedKey(matchId, problemIndex) {
  return "battle:submitted:" + matchId + ":" + problemIndex;
}

function scoreKey(matchId) {
  return "battle:scores:" + matchId;
}

async function getMatchProblemForUser(matchId, problemIndex, userId) {
  const matchProblem = await battleModel.findMatchProblem(matchId, problemIndex);

  if (!matchProblem) {
    throw new AppError(404, "MATCH_PROBLEM_NOT_FOUND", "경기 문제를 찾을 수 없습니다.");
  }

  if (matchProblem.status !== "IN_PROGRESS") {
    throw new AppError(409, "MATCH_NOT_IN_PROGRESS", "진행 중인 경기만 제출할 수 있습니다.");
  }

  const isParticipant = await battleModel.isMatchParticipant(matchId, userId);
  if (!isParticipant) {
    throw new AppError(403, "MATCH_PARTICIPANT_REQUIRED", "경기 참가자만 요청할 수 있습니다.");
  }

  return matchProblem;
}

export async function submitBattleAnswer(input) {
  const matchProblem = await getMatchProblemForUser(
    input.matchId,
    input.problemIndex,
    input.userId,
  );
  const key = submittedKey(input.matchId, input.problemIndex);
  const alreadySubmitted = await redisClient.sIsMember(key, String(input.userId));

  if (alreadySubmitted) {
    throw new AppError(409, "PROBLEM_ALREADY_SUBMITTED", "이미 제출한 문제입니다.");
  }

  const isCorrect = judgeProblemAnswer({
    problem: parseProblemSnapshot(matchProblem.problemSnapshot),
    language: matchProblem.language,
    answers: input.answers,
    selectedOption: input.selectedOption,
  });
  const currentScore = Number(
    (await redisClient.hGet(scoreKey(input.matchId), String(input.userId))) || 0,
  );
  const awardedScore = isCorrect ? CORRECT_ANSWER_SCORE : 0;
  const score = currentScore + awardedScore;

  await redisClient
    .multi()
    .sAdd(key, String(input.userId))
    .expire(key, 60 * 60)
    .hSet(scoreKey(input.matchId), String(input.userId), String(score))
    .expire(scoreKey(input.matchId), 60 * 60)
    .exec();

  return {
    matchId: input.matchId,
    problemIndex: input.problemIndex,
    isCorrect,
    awardedScore,
    score,
  };
}

export async function useBattleItem(input) {
  if (!ITEM_KEYS.has(input.itemKey)) {
    throw new AppError(400, "INVALID_ITEM_KEY", "지원하지 않는 아이템입니다.");
  }

  const matchProblem = await getMatchProblemForUser(
    input.matchId,
    input.problemIndex,
    input.userId,
  );

  if (matchProblem.gameMode !== "item") {
    throw new AppError(409, "ITEM_MODE_REQUIRED", "아이템 모드에서만 사용할 수 있습니다.");
  }

  const consumed = await battleModel.consumeUserItem(input.userId, input.itemKey);
  if (!consumed) {
    throw new AppError(409, "ITEM_NOT_AVAILABLE", "보유한 아이템이 없습니다.");
  }

  return {
    matchId: input.matchId,
    problemIndex: input.problemIndex,
    itemKey: input.itemKey,
    targetUserId: input.targetUserId || null,
    success: true,
  };
}
