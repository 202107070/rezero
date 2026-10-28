import { randomUUID } from "node:crypto";

import * as battleModel from "./model.js";
import * as roomModel from "../room/model.js";
import { judgeProblemAnswer, resolveProblemAnswers, selectProblems } from "../problem/service.js";
import { AppError } from "#utils/appError.js";
import { redisClient } from "#config/redisConfig.js";
import { getSocket } from "#config/socketConfig.js";
import { SOCKET_EVENTS } from "#constants/socketEvents.js";
import { toMatchStartResponse } from "./dto/matchStartResponseDto.js";
import { socketGameService } from "#service/socketService.js";

const SECONDS_PER_PROBLEM = 120;
const CORRECT_ANSWER_SCORE = 100;
const ITEM_KEYS = new Set([
  "paint",
  "revealLength",
  "revealPrev",
  "lightning",
  "timeReduce",
  "scribble",
  "lock",
  "blankBreak",
  "buildCharge",
  "revise",
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

  let problems;
  try {
    problems = await selectProblems({
      difficulty: room.difficulty,
      language: room.language,
      count: Number(room.problemCount),
    });
  } catch (error) {
    // rooms/start 이후 매치 생성 실패 시 대기 상태로 되돌려 재시작 가능하게
    await roomModel.markRoomWaiting(roomId);
    await redisClient.hSet(`room:${roomId}:state`, {
      status: "WAITING",
      updatedAt: new Date().toISOString(),
    });
    throw error;
  }
  const matchId = createMatchId(room.id);
  const problemCount = Number(room.problemCount) || problems.length || 5;
  let roundSeconds = SECONDS_PER_PROBLEM * Math.max(1, problemCount);

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
  const matchPayload = {
    ...match,
    problems,
  };

  await redisClient.hSet(`room:${room.id}:state`, {
    status: "STARTED",
    matchId,
    currentProblemIndex: "0",
    timeLimit: String(roundSeconds),
    language: room.language,
    difficulty: room.difficulty,
    updatedAt: new Date().toISOString(),
  });

  const io = getSocket();
  if (io) {
    const publicMatch = toMatchStartResponse(matchPayload);
    const roomIdStr = String(room.id);
    io.to(roomIdStr).emit(SOCKET_EVENTS.GAME_START_NOTICE, {
      message: "배틀이 곧 시작됩니다! 준비하세요.",
      roomId: roomIdStr,
      matchId,
    });
    io.to(roomIdStr).emit(SOCKET_EVENTS.GAME_STARTED, {
      ...publicMatch,
      message: "배틀이 곧 시작됩니다! 준비하세요.",
      participants: await redisClient.sMembers(`room:${room.id}:participants`),
    });
  }

  return matchPayload;
}

export async function getActiveMatchForRoom(roomId, userId) {
  const room = await roomModel.findRoomById(roomId);
  if (!room) {
    throw new AppError(404, "ROOM_NOT_FOUND", "방을 찾을 수 없습니다.");
  }

  const participants = await roomModel.findRoomParticipants(roomId);
  const isMember = participants.some(
    (participant) => String(participant.userId) === String(userId),
  );
  if (!isMember) {
    throw new AppError(
      403,
      "MATCH_PARTICIPANT_REQUIRED",
      "해당 방의 참가자만 경기 정보를 조회할 수 있습니다.",
    );
  }

  const state = await redisClient.hGetAll(`room:${roomId}:state`);
  let matchId = state?.matchId || null;
  let match = matchId ? await battleModel.findMatchById(matchId) : null;

  if (!match || match.status !== "IN_PROGRESS") {
    match = await battleModel.findActiveMatchByRoomId(roomId);
    matchId = match?.id || null;
  }

  if (!match) {
    throw new AppError(404, "MATCH_NOT_FOUND", "진행 중인 경기가 없습니다.");
  }

  const problems = await battleModel.findMatchProblems(match.id);
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

function writtenKey(matchId, userId) {
  return "battle:written:" + matchId + ":" + userId;
}

function submittedKey(matchId, problemIndex) {
  return "battle:submitted:" + matchId + ":" + problemIndex;
}

function scoreKey(matchId) {
  return "battle:scores:" + matchId;
}

function progressKey(matchId, userId) {
  return "battle:progress:" + matchId + ":" + userId;
}

function reviseAllowKey(matchId, userId) {
  return "battle:revise:" + matchId + ":" + userId;
}

function isNoSolveDraw(players) {
  if (!Array.isArray(players) || players.length === 0) return false;
  return players.every(function (player) {
    const solved = Array.isArray(player.solvedProblems) ? player.solvedProblems.length : 0;
    const correct = Array.isArray(player.problemResults)
      ? player.problemResults.filter(Boolean).length
      : 0;
    return numberOrZero(player.ingameScore) === 0 && solved === 0 && correct === 0;
  });
}

const CHARACTER_ICONS = {
  char1: "🤺",
  char2: "🧙",
  char3: "🥷",
  char4: "🤖",
};

function resolveAvatarIcon(avatar) {
  const key = String(avatar || "").trim();
  if (!key) return "😎";
  if (CHARACTER_ICONS[key]) return CHARACTER_ICONS[key];
  // 이미 이모지면 그대로
  if (key.length <= 4) return key;
  return CHARACTER_ICONS.char1;
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

function buildTitleData(previous, player, isWinner, match, isDraw) {
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
    totalWins: oldStats.totalWins + (isWinner && !isDraw ? 1 : 0),
    consecutiveWins: isDraw
      ? oldStats.consecutiveWins
      : isWinner
        ? oldStats.consecutiveWins + 1
        : 0,
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

  if (isWinner && !isDraw) {
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

function resolveTotalSolveTime(submitted, solvedProblems) {
  const times = parseJson(submitted.solveTimes, {});
  let sum = 0;
  (solvedProblems || []).forEach(function (idx) {
    const value = Number(times[idx] ?? times[String(idx)]);
    if (Number.isFinite(value) && value > 0) sum += value;
  });
  if (sum > 0) return sum;
  return numberOrZero(submitted.totalSolveTime);
}

function toRankingPlayer(participant, submission, match) {
  const submitted = submission || {};
  const solvedProblems = solvedProblemsOf(submitted);
  const problemResults = parseJson(submitted.problemResults, []);
  const totalSolveTime = resolveTotalSolveTime(submitted, solvedProblems);
  const completionTime =
    numberOrZero(submitted.completionTime) || totalSolveTime;

  return {
    id: participant.userId,
    name: participant.displayName || participant.username || participant.userId,
    avatar: resolveAvatarIcon(participant.avatar),
    ingameScore: numberOrZero(submitted.ingameScore),
    ratingScore:
      numberOrZero(submitted.ratingScoreBefore) ||
      numberOrZero(participant.ratingScore) ||
      1000,
    totalSolveTime,
    completionTime,
    solvedProblems,
    problemResults: Array.isArray(problemResults) ? problemResults : [],
  };
}

function attachSubmissionAnswers(players, submissions) {
  const byUserId = new Map(
    (submissions || []).map(function (submission) {
      return [String(submission.userId), submission];
    }),
  );
  return (players || []).map(function (player) {
    const submission = byUserId.get(String(player.id));
    if (!submission) return player;
    return {
      ...player,
      codes: parseJson(submission.codes, []),
      blankAnswers: parseJson(submission.blankAnswers, []),
      selectedOptions: parseJson(submission.selectedOptions, {}),
    };
  });
}

async function getStoredRanking(matchId) {
  const ranking = await battleModel.findMatchRanking(matchId);
  if (!ranking) {
    return null;
  }

  const players = parseJson(ranking.rankingsJson, []);
  let submissions = [];
  try {
    submissions = await battleModel.findMatchSubmissions(matchId);
  } catch (error) {
    submissions = [];
  }

  return {
    matchId,
    finalizedAt: ranking.finalizedAt,
    elapsedSec: Number(ranking.elapsedSec),
    roundSeconds: Number(ranking.roundSeconds),
    totalProblems: Number(ranking.totalProblems),
    players: attachSubmissionAnswers(players, submissions),
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

  const noSolveDraw = isNoSolveDraw(players);
  players.forEach(function (player, index) {
    player.rank = noSolveDraw ? 1 : index + 1;
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

  const totalPlayers = players.length;
  const playersWithRewards = players.map(function (player) {
    const isWinner = !noSolveDraw && player.rank <= winnerRankLimit;
    const base = Math.max(10, Math.floor(player.ingameScore / 10));
    const placeBonus = Math.max(0, (totalPlayers - player.rank) * 5);
    const placePenalty = Math.max(0, (player.rank - 1) * 3);
    const ratingAmount = noSolveDraw
      ? 0
      : isWinner
        ? base + placeBonus
        : -(base + placePenalty);
    const titleData = buildTitleData(
      titleByUserId.get(String(player.id)),
      player,
      isWinner,
      match,
      noSolveDraw,
    );

    return {
      ...player,
      earnedGold: noSolveDraw ? 0 : player.ingameScore + placeBonus * 2,
      ratingDelta: ratingAmount,
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
  const reviseAllowed = alreadySubmitted
    ? Boolean(
        await redisClient.sIsMember(
          reviseAllowKey(input.matchId, input.userId),
          String(input.problemIndex),
        ),
      )
    : false;

  if (alreadySubmitted && !reviseAllowed) {
    throw new AppError(409, "PROBLEM_ALREADY_SUBMITTED", "이미 제출한 문제입니다.");
  }

  const snapshot = parseProblemSnapshot(matchProblem.problemSnapshot);
  const isCorrect = judgeProblemAnswer({
    problem: snapshot,
    language: matchProblem.language,
    answers: input.answers,
    selectedOption: input.selectedOption,
  });
  const currentScore = Number(
    (await redisClient.hGet(scoreKey(input.matchId), String(input.userId))) || 0,
  );
  let previousAwarded = 0;
  if (alreadySubmitted) {
    const rawWritten = await redisClient.hGet(
      writtenKey(input.matchId, input.userId),
      String(input.problemIndex),
    );
    try {
      const parsed = rawWritten ? JSON.parse(rawWritten) : {};
      if (typeof parsed.awardedScore === "number") {
        previousAwarded = Number(parsed.awardedScore) || 0;
      } else if (parsed.isCorrect === true) {
        previousAwarded = CORRECT_ANSWER_SCORE;
      } else {
        const oldCorrect = judgeProblemAnswer({
          problem: snapshot,
          language: matchProblem.language,
          answers: Array.isArray(parsed.answers) ? parsed.answers : [],
          selectedOption: parsed.selectedOption,
        });
        previousAwarded = oldCorrect ? CORRECT_ANSWER_SCORE : 0;
      }
    } catch {
      previousAwarded = 0;
    }
  }
  const awardedScore = isCorrect ? CORRECT_ANSWER_SCORE : 0;
  const score = Math.max(0, currentScore - previousAwarded + awardedScore);

  const writer = redisClient.multi();
  if (!alreadySubmitted) {
    writer.sAdd(key, String(input.userId)).expire(key, 60 * 60);
  }
  await writer
    .hSet(scoreKey(input.matchId), String(input.userId), String(score))
    .expire(scoreKey(input.matchId), 60 * 60)
    .sAdd(progressKey(input.matchId, input.userId), String(input.problemIndex))
    .expire(progressKey(input.matchId, input.userId), 60 * 60)
    .hSet(
      writtenKey(input.matchId, input.userId),
      String(input.problemIndex),
      JSON.stringify({
        answers: Array.isArray(input.answers) ? input.answers : [],
        selectedOption:
          input.selectedOption == null ? null : Number(input.selectedOption),
        isCorrect,
        awardedScore,
      }),
    )
    .expire(writtenKey(input.matchId, input.userId), 60 * 60)
    .exec();

  const io = getSocket();
  if (io && matchProblem.roomId) {
    const scoreMap = await redisClient.hGetAll(scoreKey(input.matchId));
    const scores = Object.entries(scoreMap || {}).map(([userId, value]) => ({
      userId,
      score: Number(value) || 0,
    }));

    const participants = await battleModel.findMatchParticipantsForResult(input.matchId);
    const submitStatuses = [];
    for (let i = 0; i < participants.length; i++) {
      const uid = String(participants[i].userId);
      const solved = await redisClient.sMembers(progressKey(input.matchId, uid));
      for (let j = 0; j < solved.length; j++) {
        submitStatuses.push({
          userId: uid,
          problemIndex: Number(solved[j]),
          isSubmitted: true,
          isCorrect: true,
        });
      }
    }

    const submissions = [];
    for (let i = 0; i < participants.length; i++) {
      const uid = String(participants[i].userId);
      const written = await redisClient.hGetAll(writtenKey(input.matchId, uid));
      const fields = Object.keys(written || {});
      for (let j = 0; j < fields.length; j++) {
        try {
          const parsed = JSON.parse(written[fields[j]]);
          submissions.push({
            userId: uid,
            problemIndex: Number(fields[j]),
            answers: Array.isArray(parsed.answers) ? parsed.answers : [],
            selectedOption:
              parsed.selectedOption == null ? null : Number(parsed.selectedOption),
          });
        } catch {
          // 깨진 답안 기록은 건너뛴다
        }
      }
    }

    socketGameService.broadcastGameState(io, String(matchProblem.roomId), {
      roomId: String(matchProblem.roomId),
      question: { index: input.problemIndex },
      remainingTime: null,
      scores,
      submitStatuses,
      submissions,
    });
  }

  return {
    matchId: input.matchId,
    problemIndex: input.problemIndex,
    isCorrect,
    awardedScore,
    score,
  };
}

function buildSelfItemEffect(itemKey, problem, language, emptyBlankIndexes) {
  if (itemKey !== "revealLength" && itemKey !== "revealPrev" && itemKey !== "blankBreak") {
    return null;
  }

  const answers = resolveProblemAnswers(problem, language);
  if (answers.length === 0) {
    return { type: itemKey, unavailable: true };
  }

  if (itemKey === "blankBreak") {
    const candidates = Array.isArray(emptyBlankIndexes)
      ? emptyBlankIndexes
          .map(Number)
          .filter(function (index) {
            return Number.isInteger(index) && index >= 0 && index < answers.length;
          })
      : [];
    const pool = candidates.length > 0 ? candidates : answers.map(function (_value, index) {
      return index;
    });
    const blankIndex = pool[Math.floor(Math.random() * pool.length)];
    return {
      type: "blankBreak",
      blankIndex,
      value: String(answers[blankIndex] ?? ""),
      answers,
    };
  }

  const blankIndex = Math.floor(Math.random() * answers.length);
  const value = String(answers[blankIndex] ?? "");
  if (itemKey === "revealLength") {
    return {
      type: "revealLength",
      blankIndex,
      hint: `[${value.length}자]`,
    };
  }

  return {
    type: "revealPrev",
    blankIndex,
    hint: `[앞글자: ${value[0] || "?"}]`,
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

  const snapshot = parseProblemSnapshot(matchProblem.problemSnapshot);
  const effect = buildSelfItemEffect(
    input.itemKey,
    snapshot,
    matchProblem.language,
    input.emptyBlankIndexes,
  );

  if (effect && effect.unavailable) {
    throw new AppError(409, "ITEM_HINT_UNAVAILABLE", "이 문제에서는 해당 아이템 정보를 만들 수 없습니다.");
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
    effect,
  };
}

export async function activateReviseItems(input) {
  const indexes = [...new Set((input.problemIndexes || []).map(Number))].filter(function (index) {
    return Number.isInteger(index) && index >= 0;
  });
  if (indexes.length < 1) {
    throw new AppError(400, "INVALID_REVISE_SELECTION", "수정할 문제를 선택하세요.");
  }

  const match = await battleModel.findMatchById(input.matchId);
  if (!match) {
    throw new AppError(404, "MATCH_NOT_FOUND", "경기를 찾을 수 없습니다.");
  }
  if (match.status !== "IN_PROGRESS") {
    throw new AppError(409, "MATCH_NOT_IN_PROGRESS", "진행 중인 경기만 수정할 수 있습니다.");
  }
  if (match.gameMode !== "item") {
    throw new AppError(409, "ITEM_MODE_REQUIRED", "아이템 모드에서만 사용할 수 있습니다.");
  }

  const isParticipant = await battleModel.isMatchParticipant(input.matchId, input.userId);
  if (!isParticipant) {
    throw new AppError(403, "MATCH_PARTICIPANT_REQUIRED", "경기 참가자만 요청할 수 있습니다.");
  }

  const problemCount = Number(match.problemCount) || 0;
  for (let i = 0; i < indexes.length; i++) {
    if (problemCount > 0 && indexes[i] >= problemCount) {
      throw new AppError(400, "INVALID_REVISE_SELECTION", "문제 번호가 올바르지 않습니다.");
    }
  }

  const consumed = await battleModel.consumeUserItemCount(input.userId, "revise", indexes.length);
  if (!consumed) {
    throw new AppError(409, "ITEM_NOT_AVAILABLE", "수정 아이템이 부족합니다.");
  }

  const allowKey = reviseAllowKey(input.matchId, input.userId);
  const writer = redisClient.multi();
  for (let i = 0; i < indexes.length; i++) {
    writer.sAdd(allowKey, String(indexes[i]));
  }
  writer.expire(allowKey, 60 * 60);
  await writer.exec();

  return {
    matchId: input.matchId,
    problemIndexes: indexes,
    consumed: indexes.length,
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
      roomId: match.roomId,
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
      roomId: match.roomId,
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
    roomId: match.roomId,
    submitted: true,
    resultReady: true,
    ranking,
    earnedGold: myReward?.earnedGold || 0,
    ratingDelta: myReward?.ratingDelta || 0,
    newTitleIds: myReward?.newTitleIds || [],
  };
}

export async function getMatchPendingUsers(matchId, userId) {
  const match = await battleModel.findMatchById(matchId);

  if (!match) {
    throw new AppError(404, "MATCH_NOT_FOUND", "경기를 찾을 수 없습니다.");
  }

  const isParticipant = await battleModel.isMatchParticipant(matchId, userId);
  if (!isParticipant) {
    throw new AppError(403, "MATCH_PARTICIPANT_REQUIRED", "경기 참가자만 요청할 수 있습니다.");
  }

  if (match.status === "FINISHED") {
    return {
      roomId: match.roomId,
      resultReady: true,
      waitingForUserIds: [],
    };
  }

  const participants = await battleModel.findMatchParticipantsForResult(matchId);
  const submissions = await battleModel.findMatchSubmissions(matchId);
  const submittedUserIds = new Set(
    submissions.map(function (submission) {
      return String(submission.userId);
    }),
  );
  const waitingForUserIds = participants
    .map(function (item) {
      return String(item.userId);
    })
    .filter(function (id) {
      return !submittedUserIds.has(id);
    });

  return {
    roomId: match.roomId,
    resultReady: waitingForUserIds.length === 0,
    waitingForUserIds,
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
