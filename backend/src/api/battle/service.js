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
import { draftKey, matchDeadline, TIME_REDUCE_SECONDS, withMatchOperation } from "./matchClock.js";

const SECONDS_PER_PROBLEM = 120;
const CORRECT_ANSWER_SCORE = 100;
const ATTACK_ITEM_KEYS = new Set(["paint", "lightning", "timeReduce", "scribble", "lock"]);
const ITEM_KEYS = new Set([
  ...ATTACK_ITEM_KEYS,
  "revealLength",
  "revealPrev",
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
    hostUserId: userId,
    language: problems[0].language || room.language,
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

  const match = room.status === "STARTED" && await battleModel.findActiveMatchByRoomId(roomId);
  if (!match) {
    throw new AppError(404, "MATCH_NOT_FOUND", "진행 중인 경기가 없습니다.");
  }
  if (!await battleModel.isMatchParticipant(match.id, userId)) {
    throw new AppError(403, "MATCH_PARTICIPANT_REQUIRED", "경기 참가자만 요청할 수 있습니다.");
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

const CHARACTER_IDS = new Set(["char1", "char2", "char3", "char4"]);

function resolveAvatarIcon(avatar) {
  const key = String(avatar || "").trim();
  if (!key) return "char1";
  // 프론트 CharacterAvatar가 이미지로 해석하도록 id 유지
  if (CHARACTER_IDS.has(key)) return key;
  // 레거시 이모지 등 짧은 키는 그대로 전달
  if (key.length <= 4) return key;
  return "char1";
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
      solveTimes: parseJson(submission.solveTimes, {}),
    };
  });
}

function goldForRank(player, totalPlayers, noSolveDraw) {
  const placeBonus = Math.max(0, (totalPlayers - player.rank) * 5);
  return noSolveDraw ? 0 : numberOrZero(player.ingameScore) + placeBonus * 2;
}

async function getStoredRanking(matchId) {
  const ranking = await battleModel.findMatchRanking(matchId);
  if (!ranking) {
    return null;
  }

  const players = parseJson(ranking.rankingsJson, []);
  const submissions = await battleModel.findMatchSubmissions(matchId);

  return {
    matchId,
    finalizedAt: ranking.finalizedAt,
    elapsedSec: Number(ranking.elapsedSec),
    roundSeconds: Number(ranking.roundSeconds),
    totalProblems: Number(ranking.totalProblems),
    players: attachSubmissionAnswers(players, submissions),
    rewards: players.map(player => ({
      userId: player.id,
      earnedGold: typeof player.earnedGold === 'number' ? player.earnedGold : goldForRank(player, players.length, isNoSolveDraw(players)),
      ratingDelta: typeof player.ratingDelta === 'number' ? player.ratingDelta : numberOrZero(submissions.find(row => String(row.userId) === String(player.id))?.ratingDelta),
      newTitleIds: Array.isArray(player.newTitleIds) ? player.newTitleIds : [],
    })),
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
      earnedGold: goldForRank(player, totalPlayers, noSolveDraw),
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
      earnedGold: player.earnedGold,
      ratingDelta: player.ratingDelta,
      newTitleIds: player.titleData.newTitleIds,
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

  const ranking = await getStoredRanking(match.id);
  if (finalized.finalized && match.roomId && getSocket()) {
    await socketGameService.broadcastGameEnded(getSocket(), String(match.roomId), {
      roomId: match.roomId,
      matchId: match.id,
      ranking: ranking.players,
      rewards: ranking.rewards,
    });
  }
  return ranking;
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

async function assertPlayerCanPlay(match, matchId, userId, { allowSubmitted = false } = {}) {
  const [timePenalty, submitted] = await Promise.all([
    battleModel.findPlayerTimePenalty(matchId, userId),
    battleModel.hasMatchSubmission(matchId, userId),
  ]);
  if (Date.now() >= matchDeadline(match, timePenalty)) {
    throw new AppError(409, "MATCH_TIME_EXPIRED", "경기 시간이 종료되었습니다.");
  }
  if (submitted && !allowSubmitted) {
    throw new AppError(409, "MATCH_ALREADY_SUBMITTED", "이미 최종 제출했습니다.");
  }
}

export function submitBattleAnswer(input) {
  return withMatchOperation(input.matchId, () => recordBattleAnswer(input));
}

async function recordBattleAnswer(input) {
  const matchProblem = await getMatchProblemForUser(
    input.matchId,
    input.problemIndex,
    input.userId,
  );
  await assertPlayerCanPlay(matchProblem, input.matchId, input.userId);
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

export function useBattleItem(input) {
  return withMatchOperation(input.matchId, () => applyBattleItem(input));
}

async function applyBattleItem(input) {
  if (!ITEM_KEYS.has(input.itemKey)) {
    throw new AppError(400, "INVALID_ITEM_KEY", "지원하지 않는 아이템입니다.");
  }

  const matchProblem = await getMatchProblemForUser(
    input.matchId,
    input.problemIndex,
    input.userId,
  );
  const isAttackItem = ATTACK_ITEM_KEYS.has(input.itemKey);
  await assertPlayerCanPlay(matchProblem, input.matchId, input.userId, { allowSubmitted: isAttackItem });

  if (matchProblem.gameMode !== "item") {
    throw new AppError(409, "ITEM_MODE_REQUIRED", "아이템 모드에서만 사용할 수 있습니다.");
  }

  if (isAttackItem) {
    if (!input.targetUserId || String(input.targetUserId) === String(input.userId)
      || !await battleModel.isMatchParticipant(input.matchId, input.targetUserId)) {
      throw new AppError(409, "ITEM_TARGET_UNAVAILABLE", "아이템을 사용할 상대가 없습니다.");
    }
    await assertPlayerCanPlay(matchProblem, input.matchId, input.targetUserId);
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

  let targetTimePenalty;
  if (input.itemKey === "timeReduce") {
    targetTimePenalty = await battleModel.findPlayerTimePenalty(input.matchId, input.targetUserId) + TIME_REDUCE_SECONDS;
  }
  const consumed = targetTimePenalty === undefined
    ? await battleModel.consumeUserItem(input.userId, input.itemKey)
    : await battleModel.consumeTimeReduceItem(input.matchId, input.userId, input.targetUserId, TIME_REDUCE_SECONDS);
  if (!consumed) {
    throw new AppError(409, "ITEM_NOT_AVAILABLE", "보유한 아이템이 없습니다.");
  }

  if (input.itemKey === 'buildCharge') {
    const key = `battle:buildBonus:${input.matchId}:${input.userId}`;
    await redisClient.hIncrBy(key, String(input.problemIndex), 3);
    await redisClient.expire(key, 7200);
  }

  if (targetTimePenalty !== undefined && getSocket()) {
    getSocket().to(String(matchProblem.roomId)).emit(SOCKET_EVENTS.ITEM_USED, {
      roomId: String(matchProblem.roomId),
      matchId: input.matchId,
      fromUserId: input.userId,
      targetUserId: input.targetUserId,
      itemType: input.itemKey,
      remainingSeconds: Math.max(0, Math.ceil((matchDeadline(matchProblem, targetTimePenalty) - Date.now()) / 1000)),
      success: true,
    });
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

export function activateReviseItems(input) {
  return withMatchOperation(input.matchId, () => activateRevise(input));
}

async function activateRevise(input) {
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

  await assertPlayerCanPlay(match, input.matchId, input.userId);

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

function waitingUsers(participants, submissions) {
  const submitted = new Set(submissions.map(row => String(row.userId)));
  return participants.map(player => String(player.userId)).filter(id => !submitted.has(id));
}

async function timeoutSubmission(match, player, problems) {
  const userId = String(player.userId);
  const [rawDraft, written] = await Promise.all([
    redisClient.get(draftKey(match.id, userId)),
    redisClient.hGetAll(writtenKey(match.id, userId)),
  ]);
  const draft = parseJson(rawDraft, {});
  const selectedOptions = {};
  const blankAnswers = [];
  const solvedProblems = [];
  const problemResults = problems.map((problem, index) => {
    const answer = parseJson(written[index], null);
    const blanks = answer ? answer.answers : draft.blankAnswers?.[index];
    const selected = answer ? answer.selectedOption : draft.selectedOptions?.[index];
    blankAnswers[index] = Array.isArray(blanks) ? blanks : [];
    if (selected != null) selectedOptions[index] = selected;
    const correct = answer?.isCorrect ?? judgeProblemAnswer({
      problem,
      language: match.language,
      answers: blankAnswers[index],
      selectedOption: selected,
    });
    if (correct) solvedProblems.push(index);
    return correct;
  });
  const solveTimes = draft.solveTimes || {};
  const elapsed = Math.max(0, Number(match.roundSeconds) - player.timePenalty);
  return {
    matchId: match.id,
    userId,
    ratingScoreBefore: Number(player.ratingScore),
    ingameScore: solvedProblems.length * CORRECT_ANSWER_SCORE,
    codes: problems.map((_, index) => draft.codes?.[index] || ''),
    blankAnswers,
    selectedOptions,
    solveTimes,
    problemResults,
    solvedProblems,
    totalSolveTime: resolveTotalSolveTime({ solveTimes }, solvedProblems),
    completionTime: elapsed,
    finishedAtElapsed: elapsed,
  };
}

async function settleMatch(match, participants, submissions) {
  const waiting = new Set(waitingUsers(participants, submissions));
  const expired = participants.filter(player => waiting.has(String(player.userId)) && Date.now() >= matchDeadline(match, player.timePenalty));
  if (expired.length) {
    const problems = await battleModel.findMatchProblems(match.id);
    for (const player of expired) {
      const result = await timeoutSubmission(match, player, problems);
      await battleModel.saveMatchSubmission(result);
    }
    submissions = await battleModel.findMatchSubmissions(match.id);
  }
  const waitingForUserIds = waitingUsers(participants, submissions);
  const ranking = participants.length >= 2 && waitingForUserIds.length === 0
    ? await finalizeSubmittedMatch(match, participants, submissions)
    : null;
  return { ranking, waitingForUserIds, submissions };
}

async function settleMatchById(matchId) {
  return withMatchOperation(matchId, async () => {
    const match = await battleModel.findMatchById(matchId);
    if (match?.status !== "IN_PROGRESS") return;
    const [participants, submissions] = await Promise.all([
      battleModel.findMatchParticipantsForResult(matchId),
      battleModel.findMatchSubmissions(matchId),
    ]);
    if (participants.length >= 2) await settleMatch(match, participants, submissions);
  });
}

export function startMatchDeadlineWorker() {
  let stopped = false;
  let timer;
  async function check() {
    try {
      for (const id of await battleModel.findMatchesToSettle()) {
        if (stopped) return;
        try {
          await settleMatchById(id);
        } catch (error) {
          console.error("[match deadline] " + id + ": " + error.message);
        }
      }
    } catch (error) {
      console.error("[match deadlines] " + error.message);
    } finally {
      if (!stopped) timer = setTimeout(check, 1000).unref();
    }
  }
  void check();
  return () => {
    stopped = true;
    clearTimeout(timer);
  };
}

export function submitMatchResult(input) {
  return withMatchOperation(input.matchId, () => submitPlayerResult(input));
}

async function submitPlayerResult(input) {
  const match = await battleModel.findMatchById(input.matchId);
  if (!match) {
    throw new AppError(404, "MATCH_NOT_FOUND", "경기를 찾을 수 없습니다.");
  }
  if (match.status === "FINISHED") {
    const ranking = await getAuthorizedRanking(input.matchId, input.userId);
    return { roomId: match.roomId, submitted: true, resultReady: true, ranking };
  }
  if (match.status !== "IN_PROGRESS") {
    throw new AppError(409, "MATCH_NOT_IN_PROGRESS", "진행 중인 경기만 종료할 수 있습니다.");
  }
  if (!await battleModel.isMatchParticipant(input.matchId, input.userId)) {
    throw new AppError(403, "MATCH_PARTICIPANT_REQUIRED", "경기 참가자만 결과를 저장할 수 있습니다.");
  }

  const participants = await battleModel.findMatchParticipantsForResult(input.matchId);
  const participant = participants.find(player => String(player.userId) === String(input.userId));
  if (!participant) {
    throw new AppError(403, "MATCH_PARTICIPANT_REQUIRED", "경기 참가자만 결과를 저장할 수 있습니다.");
  }
  if (Date.now() < matchDeadline(match, participant.timePenalty)) {
    const savedScore = await redisClient.hGet(scoreKey(input.matchId), String(input.userId));
    await battleModel.saveMatchSubmission({
      ...input,
      ingameScore: savedScore === null ? input.ingameScore : numberOrZero(savedScore),
      ratingScoreBefore: Number(participant.ratingScore),
    });
  }

  const submissions = await battleModel.findMatchSubmissions(input.matchId);
  const { ranking, waitingForUserIds } = await settleMatch(match, participants, submissions);
  if (!ranking) {
    return { roomId: match.roomId, submitted: true, resultReady: false, waitingForUserIds };
  }
  const reward = ranking.rewards.find(row => String(row.userId) === String(input.userId));
  return {
    roomId: match.roomId,
    submitted: true,
    resultReady: true,
    ranking,
    earnedGold: reward?.earnedGold || 0,
    ratingDelta: reward?.ratingDelta || 0,
    newTitleIds: reward?.newTitleIds || [],
  };
}

export async function getMatchPendingUsers(matchId, userId) {
  const match = await battleModel.findMatchById(matchId);
  if (!match) {
    throw new AppError(404, "MATCH_NOT_FOUND", "경기를 찾을 수 없습니다.");
  }
  if (match.status === "FINISHED") {
    await getAuthorizedRanking(matchId, userId);
    return { roomId: match.roomId, submitted: true, resultReady: true, waitingForUserIds: [] };
  }
  if (match.status === "ABANDONED") {
    const member = await battleModel.findMatchMembership(matchId, userId);
    if (member) {
      return {
        roomId: match.roomId,
        abandoned: true,
        canReturnToRoom: Number(member.canReturnToRoom) === 1,
        submitted: false,
        resultReady: false,
        waitingForUserIds: [],
      };
    }
  }
  if (!await battleModel.isMatchParticipant(matchId, userId)) {
    throw new AppError(403, "MATCH_PARTICIPANT_REQUIRED", "경기 참가자만 요청할 수 있습니다.");
  }
  const [participants, submissions] = await Promise.all([
    battleModel.findMatchParticipantsForResult(matchId),
    battleModel.findMatchSubmissions(matchId),
  ]);
  const player = participants.find(member => String(member.userId) === String(userId));
  return {
    roomId: match.roomId,
    remainingSeconds: Math.max(0, Math.ceil((matchDeadline(match, player?.timePenalty) - Date.now()) / 1000)),
    submitted: submissions.some(row => String(row.userId) === String(userId)),
    resultReady: false,
    waitingForUserIds: waitingUsers(participants, submissions),
  };
}

export async function getReconnectMatch(userId) {
  const match = await battleModel.findReconnectMatch(userId);
  if (match?.status !== "IN_PROGRESS") return match;
  await settleMatchById(match.matchId);
  return battleModel.findReconnectMatch(userId);
}

export async function markMatchResultSeen(matchId, userId) {
  await battleModel.markMatchResultSeen(matchId, userId);
}

async function getAuthorizedRanking(matchId, userId) {
  const ranking = await getStoredRanking(matchId);
  if (!ranking) {
    throw new AppError(404, "MATCH_RANKING_NOT_FOUND", "경기 순위를 찾을 수 없습니다.");
  }
  if (!ranking.players.some(player => String(player.id) === String(userId))) {
    throw new AppError(403, "MATCH_PARTICIPANT_REQUIRED", "경기 참가자만 결과를 볼 수 있습니다.");
  }
  return ranking;
}

export async function getMatchResult(matchId, userId) {
  const match = await battleModel.findMatchById(matchId);
  if (!match) {
    throw new AppError(404, "MATCH_NOT_FOUND", "경기를 찾을 수 없습니다.");
  }
  if (match.status !== "FINISHED") {
    throw new AppError(409, "MATCH_RESULT_NOT_READY", "경기가 아직 종료되지 않았습니다.");
  }

  const ranking = await getAuthorizedRanking(matchId, userId);
  return {
    ...ranking,
    match: {
      language: match.language,
      roomMode: match.roomMode,
      problems: await battleModel.findMatchProblems(matchId),
    },
  };
}
