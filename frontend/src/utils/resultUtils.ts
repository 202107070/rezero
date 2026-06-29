import { getBattleSettings, getOpponentBattleCode } from '../services/sessionStore';
import type { DemoBot } from './battle/demoBots';
import {
  comparePlayersByRank,
  computeBotRankScore,
  getBotRankMetrics,
  getUserRankMetrics,
  isBattleMe,
  normalizeBattlePlayerId,
  rankingSnapshotToResultPlayers,
  type FinalRankingSnapshot,
} from './battle/rankUtils';
import {
  buildBotProblemResults,
  finalizeProblemResults,
} from './battle/problemResultUtils';
import { getTotalBattleSeconds } from './battle/codeUtils';

export type { RankablePlayer, FinalRankingSnapshot } from './battle/rankUtils';
export { comparePlayersByRank, rankingSnapshotToResultPlayers } from './battle/rankUtils';

export interface ResultPlayer {
  id: string;
  name: string;
  avatar: string;
  ingameScore: number;
  ratingScore: number;
  totalSolveTime: number;
  completionTime: number;
  problemResults: boolean[];
  delta: number;
  rank: number;
}

interface RoomUserLike {
  id?: string;
  name?: string;
  avatar?: string;
  solvedProblems?: number[];
  ingameScore?: number;
  totalSolveTime?: number;
  completionTime?: number;
  finishedAtElapsed?: number;
  problemResults?: boolean[];
  score?: string | number;
}

interface BattleSubmissionLike {
  ingameScore?: number;
  myRatingScore?: number;
  solveTimes?: Record<number, number>;
  problemResults?: boolean[];
  problems?: unknown[];
}

interface DemoStateLike {
  roundSeconds?: number;
  solveTimes?: Record<number, number>;
  battleBots?: DemoBot[];
  localSolvedProblems?: number[];
  finishedAtElapsedSec?: number;
  problemResults?: boolean[];
}

function readBattleRoundSeconds(problemCount: number, demoState: DemoStateLike | null): number {
  if (demoState?.roundSeconds) return demoState.roundSeconds;
  try {
    const settings = getBattleSettings();
    const count = parseInt(String(settings.count), 10) || problemCount || 5;
    return getTotalBattleSeconds(String(settings.diff || 'NORMAL'), count);
  } catch {
    return getTotalBattleSeconds('NORMAL', problemCount || 5);
  }
}

function parseScore(scoreStr: string | number | undefined): number {
  const num = parseInt(String(scoreStr).replace(/[^0-9]/g, ''), 10);
  return Number.isFinite(num) ? num : 0;
}

/** 스냅샷 우선, 없으면 세션 데이터로 재구성 (폴백) */
export function buildResultPlayers(params: {
  rankingSnapshot?: FinalRankingSnapshot | null;
  roomUsers: RoomUserLike[];
  demoBots: DemoBot[];
  submission: BattleSubmissionLike;
  demoState: DemoStateLike | null;
}): ResultPlayer[] {
  if (params.rankingSnapshot?.players?.length) {
    return rankingSnapshotToResultPlayers(params.rankingSnapshot);
  }
  return rebuildResultPlayers(params);
}

function rebuildResultPlayers(params: {
  roomUsers: RoomUserLike[];
  demoBots: DemoBot[];
  submission: BattleSubmissionLike;
  demoState: DemoStateLike | null;
}): ResultPlayer[] {
  const list: ResultPlayer[] = [];
  const seen = new Set<string>();
  const solveTimes = params.submission?.solveTimes || params.demoState?.solveTimes || {};
  const roundSeconds = readBattleRoundSeconds(
    params.submission?.problems?.length || Object.keys(solveTimes).length || 5,
    params.demoState,
  );

  const totalProblems =
    params.submission?.problems?.length ||
    params.demoState?.problemResults?.length ||
    Object.keys(solveTimes).length ||
    5;

  params.roomUsers.forEach((u) => {
    const id = u.id || '';
    if (seen.has(id)) return;
    seen.add(id);
    const isMe = isBattleMe(id, u.name);
    const solvedProblems = isMe
      ? (Array.isArray(u.solvedProblems) && u.solvedProblems.length > 0
          ? u.solvedProblems
          : params.demoState?.localSolvedProblems || [])
      : Array.isArray(u.solvedProblems)
        ? u.solvedProblems
        : [];

    const ratingScore = isMe
      ? params.submission?.myRatingScore ?? 1000
      : u.score
        ? parseScore(u.score)
        : 1000;

    const ingameScore = isMe
      ? (params.submission?.ingameScore ?? u.ingameScore ?? 0)
      : (u.ingameScore ?? computeBotRankScore(solvedProblems.length));

    const finishedAt =
      u.finishedAtElapsed ??
      (isMe ? params.demoState?.finishedAtElapsedSec : undefined);

    const metrics = isMe
      ? getUserRankMetrics(solvedProblems, solveTimes, finishedAt)
      : (() => {
          const bot = params.demoBots.find((b) => b.id === id);
          if (!bot) {
            return {
              totalSolveTime: u.totalSolveTime ?? Number.POSITIVE_INFINITY,
              completionTime: u.completionTime ?? Number.POSITIVE_INFINITY,
            };
          }
          const botMetrics = getBotRankMetrics(bot, roundSeconds, solvedProblems);
          return {
            totalSolveTime: u.totalSolveTime ?? botMetrics.totalSolveTime,
            completionTime: u.completionTime ?? botMetrics.completionTime,
          };
        })();

    const problemResults = isMe
      ? (Array.isArray(u.problemResults) && u.problemResults.length > 0
          ? u.problemResults
          : params.submission?.problemResults ||
            params.demoState?.problemResults ||
            finalizeProblemResults(
              Object.fromEntries(solvedProblems.map((idx) => [idx, true])),
              totalProblems,
            ))
      : Array.isArray(u.problemResults) && u.problemResults.length > 0
        ? u.problemResults
        : buildBotProblemResults(solvedProblems, totalProblems);

    list.push({
      id: normalizeBattlePlayerId(id, u.name),
      name: u.name || (isMe ? 'rocky_user' : id),
      avatar: u.avatar || '👤',
      ingameScore,
      ratingScore,
      totalSolveTime: metrics.totalSolveTime,
      completionTime: metrics.completionTime,
      problemResults,
      delta: Math.floor(ingameScore / 10),
      rank: 0,
    });
  });

  params.demoBots.forEach((bot) => {
    if (seen.has(bot.id)) return;
    seen.add(bot.id);
    const solved = Array.isArray(bot.solvedProblems) ? bot.solvedProblems : [];
    const botMetrics = getBotRankMetrics(bot, roundSeconds, solved);
    const botScore = computeBotRankScore(solved.length);
    list.push({
      id: bot.id,
      name: bot.name,
      avatar: bot.avatar || '🤖',
      ingameScore: botScore,
      ratingScore: 1000,
      totalSolveTime: botMetrics.totalSolveTime,
      completionTime: botMetrics.completionTime,
      problemResults: buildBotProblemResults(solved, totalProblems),
      delta: Math.floor(botScore / 10),
      rank: 0,
    });
  });

  if (list.length === 0) {
    return [
      {
        id: 'rocky_user',
        name: 'rocky_user',
        ingameScore: 0,
        ratingScore: 1000,
        totalSolveTime: 0,
        completionTime: Number.POSITIVE_INFINITY,
        problemResults: [],
        delta: 0,
        avatar: '😎',
        rank: 1,
      },
    ];
  }

  list.sort(comparePlayersByRank);
  list.forEach((p, i) => {
    p.rank = i + 1;
  });
  return list;
}

export function getPlayerCodeByProblem(
  playerId: string,
  problemIndex: number,
  mySubmissionCodes: string[],
  demoBots: DemoBot[],
): string {
  if (playerId === 'rocky_user' || playerId === 'me') {
    return mySubmissionCodes[problemIndex] || '// 코드를 찾을 수 없습니다.';
  }
  const bot = demoBots.find((b) => b.id === playerId);
  if (bot && Array.isArray(bot.codeByProblem)) {
    return bot.codeByProblem[problemIndex] || '// 코드를 찾을 수 없습니다.';
  }
  return getOpponentBattleCode();
}

// Re-export for tests / battle page
export { computeBotRankScore, getBotRankMetrics, getUserRankMetrics } from './battle/rankUtils';
