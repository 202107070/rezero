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

function parseJson(value, fallback) {
  if (value === null || value === undefined) {
    return fallback;
  }
  if (typeof value !== "string") {
    return value;
  }

  try {
    return JSON.parse(value);
  } catch (error) {
    return fallback;
  }
}

function numberOrZero(value) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : 0;
}

function solvedProblemsOf(submission) {
  const solvedProblems = parseJson(submission.solvedProblems, []);
  if (Array.isArray(solvedProblems) && solvedProblems.length > 0) {
    return solvedProblems.map(Number).filter(Number.isInteger);
  }

  const problemResults = parseJson(submission.problemResults, []);
  if (!Array.isArray(problemResults)) {
    return [];
  }

  return problemResults.reduce(function (result, isCorrect, index) {
    if (isCorrect === true) {
      result.push(index);
    }
    return result;
  }, []);
}

function comparePlayersByRank(left, right) {
  if (right.ingameScore !== left.ingameScore) {
    return right.ingameScore - left.ingameScore;
  }
  if (left.completionTime !== right.completionTime) {
    return left.completionTime - right.completionTime;
  }
  return left.totalSolveTime - right.totalSolveTime;
}

function titleIdsFor(stats) {
  const ids = [];

  if (stats.totalWins >= 1) ids.push("rookie");
  if (stats.consecutiveWins >= 3) ids.push("streak3");
  if (stats.consecutiveWins >= 5) ids.push("streak5");
  if (stats.totalWins >= 10) ids.push("veteran");
  if (stats.perfectGame) ids.push("perfect");
  if ((stats.langWins.JAVA || 0) >= 5) ids.push("java_master");
  if ((stats.langWins.PYTHON || 0) >= 5) ids.push("python_master");
  if ((stats.langWins.CPP || 0) >= 5) ids.push("cpp_master");
  if (stats.avgSpeed > 0 && stats.avgSpeed < 30) ids.push("speedster");
  if (
    (stats.langWins.JAVA || 0) > 0 &&
    (stats.langWins.PYTHON || 0) > 0 &&
    (stats.langWins.CPP || 0) > 0
  ) {
    ids.push("all_rounder");
  }

  return ids;
}

function buildTitleData(previous, player, isWinner, match) {
  const owned = parseJson(previous?.ownedTitleIds, []);
  const oldStats = {
    totalWins: numberOrZero(previous?.totalWins),
    consecutiveWins: numberOrZero(previous?.consecutiveWins),
    totalGames: numberOrZero(previous?.totalGames),
    perfectGame: Boolean(previous?.perfectGame),
    avgSpeed: numberOrZero(previous?.avgSpeed),
    langWins: parseJson(previous?.langWins, {}),
  };
  const solvedCount = player.solvedProblems.length;
  const currentGameSpeed =
    solvedCount > 0 ? player.totalSolveTime / solvedCount : 0;
  const totalGames = oldStats.totalGames + 1;
  const stats = {
    totalWins: oldStats.totalWins + (isWinner ? 1 : 0),
    consecutiveWins: isWinner ? oldStats.consecutiveWins + 1 : 0,
    totalGames,
    perfectGame:
      oldStats.perfectGame ||
      (match.problemCount > 0 && solvedCount >= Number(match.problemCount)),
    avgSpeed:
      currentGameSpeed > 0
        ? (oldStats.avgSpeed * oldStats.totalGames + currentGameSpeed) / totalGames
        : oldStats.avgSpeed,
    langWins: { ...oldStats.langWins },
  };

  if (isWinner) {
    stats.langWins[match.language] = numberOrZero(stats.langWins[match.language]) + 1;
  }

  const previousOwned = Array.isArray(owned) ? owned : [];
  const newTitleIds = titleIdsFor(stats).filter(function (titleId) {
    return !previousOwned.includes(titleId);
  });

  return {
    owned: [...previousOwned, ...newTitleIds],
    equipped: previous?.equippedTitleId || null,
    stats,
    newTitleIds,
  };
}

function toRankingPlayer(participant, submission, match) {
  const submitted = submission || {};
  const solvedProblems = solvedProblemsOf(submitted);
  const problemResults = parseJson(submitted.problemResults, []);
  const completionTime =
    numberOrZero(submitted.completionTime) || Number(match.roundSeconds);

  return {
    id: participant.userId,
    name: participant.displayName,
    avatar: participant.avatar || "",
    ingameScore: numberOrZero(submitted.ingameScore),
    ratingScore: numberOrZero(participant.ratingScore) || 1000,
    totalSolveTime: numberOrZero(submitted.totalSolveTime),
    completionTime,
    solvedProblems,
    problemResults: Array.isArray(problemResults) ? problemResults : [],
  };
}

async function getStoredRanking(matchId) {
  const ranking = await battleModel.findMatchRanking(matchId);
  if (!ranking) {
    return null;
  }

  return {
    matchId,
    finalizedAt: ranking.finalizedAt,
    elapsedSec: Number(ranking.elapsedSec),
    roundSeconds: Number(ranking.roundSeconds),
    totalProblems: Number(ranking.totalProblems),
    players: parseJson(ranking.rankingsJson, []),
  };
}

async function finalizeSubmittedMatch(match, participants, submissions) {
  const submissionByUserId = new Map(
    submissions.map(function (submission) {
      return [String(submission.userId), submission];
    }),
  );
  const players = participants.map(function (participant) {
    return toRankingPlayer(
      participant,
      submissionByUserId.get(String(participant.userId)),
      match,
    );
  }).sort(comparePlayersByRank);

  players.forEach(function (player, index) {
    player.rank = index + 1;
  });

  const winnerRankLimit = Math.ceil(players.length / 2);
  const titleStates = await battleModel.findUserTitleStates(
    players.map(function (player) {
      return player.id;
    }),
  );
  const titleByUserId = new Map(
    titleStates.map(function (titleState) {
      return [String(titleState.userId), titleState];
    }),
  );

  const playersWithRewards = players.map(function (player) {
    const isWinner = player.rank <= winnerRankLimit;
    const ratingAmount = Math.max(10, Math.floor(player.ingameScore / 10));
    const titleData = buildTitleData(
      titleByUserId.get(String(player.id)),
      player,
      isWinner,
      match,
    );

    return {
      ...player,
      earnedGold: player.ingameScore,
      ratingDelta: isWinner ? ratingAmount : -ratingAmount,
      titleData,
    };
  });

  const elapsedSec = playersWithRewards.reduce(function (maximum, player) {
    return Math.max(maximum, player.completionTime);
  }, 0);
  const rankings = playersWithRewards.map(function (player) {
    return {
      id: player.id,
      name: player.name,
      avatar: player.avatar,
      ingameScore: player.ingameScore,
      ratingScore: player.ratingScore,
      totalSolveTime: player.totalSolveTime,
      completionTime: player.completionTime,
      solvedProblems: player.solvedProblems,
      problemResults: player.problemResults,
      rank: player.rank,
    };
  });

  const finalized = await battleModel.finalizeMatchResult({
    matchId: match.id,
    players: playersWithRewards,
    rankings,
    elapsedSec,
    roundSeconds: Number(match.roundSeconds),
    totalProblems: Number(match.problemCount),
  });

  if (!finalized.finalized) {
    return getStoredRanking(match.id);
  }

  return {
    matchId: match.id,
    finalizedAt: new Date().toISOString(),
    elapsedSec,
    roundSeconds: Number(match.roundSeconds),
    totalProblems: Number(match.problemCount),
    players: rankings,
    rewards: playersWithRewards.map(function (player) {
      return {
        userId: player.id,
        earnedGold: player.earnedGold,
        ratingDelta: player.ratingDelta,
        newTitleIds: player.titleData.newTitleIds,
      };
    }),
  };
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

export async function submitMatchResult(input) {
  const match = await battleModel.findMatchById(input.matchId);

  if (!match) {
    throw new AppError(404, "MATCH_NOT_FOUND", "경기를 찾을 수 없습니다.");
  }

  if (match.status === "FINISHED") {
    const ranking = await getStoredRanking(input.matchId);
    return {
      submitted: true,
      resultReady: true,
      ranking,
    };
  }

  if (match.status !== "IN_PROGRESS") {
    throw new AppError(409, "MATCH_NOT_IN_PROGRESS", "진행 중인 경기만 종료할 수 있습니다.");
  }

  const isParticipant = await battleModel.isMatchParticipant(input.matchId, input.userId);
  if (!isParticipant) {
    throw new AppError(403, "MATCH_PARTICIPANT_REQUIRED", "경기 참가자만 결과를 저장할 수 있습니다.");
  }

  const savedScore = await redisClient.hGet(scoreKey(input.matchId), String(input.userId));
  const ingameScore =
    savedScore === null ? input.ingameScore : numberOrZero(savedScore);
  const participants = await battleModel.findMatchParticipantsForResult(input.matchId);
  const participant = participants.find(function (item) {
    return String(item.userId) === String(input.userId);
  });

  await battleModel.saveMatchSubmission({
    ...input,
    ingameScore,
    ratingScoreBefore: numberOrZero(participant?.ratingScore) || 1000,
  });

  const submissions = await battleModel.findMatchSubmissions(input.matchId);
  const submittedUserIds = new Set(
    submissions.map(function (submission) {
      return String(submission.userId);
    }),
  );
  const waitingForUserIds = participants
    .map(function (item) {
      return String(item.userId);
    })
    .filter(function (userId) {
      return !submittedUserIds.has(userId);
    });

  if (waitingForUserIds.length > 0) {
    return {
      submitted: true,
      resultReady: false,
      waitingForUserIds,
    };
  }

  const ranking = await finalizeSubmittedMatch(match, participants, submissions);
  const myReward = ranking.rewards?.find(function (reward) {
    return String(reward.userId) === String(input.userId);
  });

  return {
    submitted: true,
    resultReady: true,
    ranking,
    earnedGold: myReward?.earnedGold || 0,
    ratingDelta: myReward?.ratingDelta || 0,
    newTitleIds: myReward?.newTitleIds || [],
  };
}

export async function getMatchResult(matchId) {
  const match = await battleModel.findMatchById(matchId);

  if (!match) {
    throw new AppError(404, "MATCH_NOT_FOUND", "경기를 찾을 수 없습니다.");
  }

  if (match.status !== "FINISHED") {
    throw new AppError(409, "MATCH_RESULT_NOT_READY", "경기가 아직 종료되지 않았습니다.");
  }

  const ranking = await getStoredRanking(matchId);
  if (!ranking) {
    throw new AppError(404, "MATCH_RANKING_NOT_FOUND", "경기 순위를 찾을 수 없습니다.");
  }

  return ranking;
}
