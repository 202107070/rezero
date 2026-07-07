import type { RoomUser } from '../../types/battle';
import { BATTLE_CORRECT_SCORE } from '../../constants/battleConstants';
import { getCurrentUserId, getCurrentUserName } from '../../services/authService';
import type { DemoBot } from './demoBots';
import { getBotSolveDelay } from './demoBots';

export interface RankablePlayer {
  ingameScore: number;
  completionTime: number;
  totalSolveTime: number;
}

export function comparePlayersByRank(a: RankablePlayer, b: RankablePlayer): number {
  if (b.ingameScore !== a.ingameScore) return b.ingameScore - a.ingameScore;
  if (a.completionTime !== b.completionTime) return a.completionTime - b.completionTime;
  return a.totalSolveTime - b.totalSolveTime;
}

/** 봇 순위 점수 — 푼 문제 수 기준 (콤보 없음) */
export function computeBotRankScore(solvedCount: number): number {
  if (solvedCount <= 0) return 0;
  return solvedCount * BATTLE_CORRECT_SCORE;
}

export function normalizeBattlePlayerId(id: string, name?: string): string {
  const myId = getCurrentUserId();
  const myName = getCurrentUserName();
  if (id === 'me' || id === myId || name === myName) return myId;
  return id;
}

export function isBattleMe(id: string, name?: string): boolean {
  const myId = getCurrentUserId();
  const myName = getCurrentUserName();
  return id === 'me' || id === myId || name === myName;
}

export function getUserRankMetrics(
  solvedProblems: number[],
  solveTimes: Record<number, number>,
  finishedAtElapsed?: number,
) {
  const ordered = [...solvedProblems].sort((a, b) => a - b);
  const durations = ordered.map((idx) => solveTimes[idx] || 0).filter((t) => t > 0);
  const totalSolveTime = durations.reduce((sum, t) => sum + t, 0);
  const completionTime =
    typeof finishedAtElapsed === 'number' && finishedAtElapsed >= 0
      ? finishedAtElapsed
      : totalSolveTime > 0
        ? totalSolveTime
        : Number.POSITIVE_INFINITY;
  return { ordered, totalSolveTime, completionTime };
}

export function getBotRankMetrics(
  bot: Pick<DemoBot, 'solveScheduleByProblem'>,
  roundSeconds: number,
  solvedProblems: number[],
) {
  const solved = [...solvedProblems].sort((a, b) => a - b);
  const totalSolveTime = solved.reduce(
    (sum, idx) => sum + getBotSolveDelay(bot, idx, roundSeconds),
    0,
  );
  const lastIdx = solved.length > 0 ? solved[solved.length - 1] : -1;
  const completionTime =
    lastIdx >= 0 ? getBotSolveDelay(bot, lastIdx, roundSeconds) : Number.POSITIVE_INFINITY;
  return { solved, totalSolveTime, completionTime };
}

export interface RankingPlayerSnapshot {
  id: string;
  name: string;
  avatar: string;
  ingameScore: number;
  ratingScore: number;
  totalSolveTime: number;
  completionTime: number;
  solvedProblems: number[];
  problemResults: boolean[];
  rank: number;
}

export interface FinalRankingSnapshot {
  sessionId: string;
  roomId: string;
  finalizedAt: string;
  elapsedSec: number;
  roundSeconds: number;
  totalProblems: number;
  players: RankingPlayerSnapshot[];
}

export function buildRankingSnapshotFromRoomUsers(params: {
  sessionId: string;
  roomId: string;
  elapsedSec: number;
  roundSeconds: number;
  totalProblems: number;
  roomUsers: RoomUser[];
  myRatingScore: number;
}): FinalRankingSnapshot {
  const ranked = [...params.roomUsers].sort((a, b) =>
    comparePlayersByRank({
      ingameScore: a.ingameScore || 0,
      completionTime: a.completionTime ?? Number.POSITIVE_INFINITY,
      totalSolveTime: a.totalSolveTime || 0,
    }, {
      ingameScore: b.ingameScore || 0,
      completionTime: b.completionTime ?? Number.POSITIVE_INFINITY,
      totalSolveTime: b.totalSolveTime || 0,
    }),
  );

  const players: RankingPlayerSnapshot[] = ranked.map((u, index) => {
    const isMe = isBattleMe(u.id, u.name);
    return {
      id: normalizeBattlePlayerId(u.id, u.name),
      name: u.name,
      avatar: u.avatar,
      ingameScore: u.ingameScore || 0,
      ratingScore: isMe ? params.myRatingScore : 1000,
      totalSolveTime: u.totalSolveTime || 0,
      completionTime: u.completionTime ?? Number.POSITIVE_INFINITY,
      solvedProblems: Array.isArray(u.solvedProblems) ? u.solvedProblems : [],
      problemResults: Array.isArray(u.problemResults) ? u.problemResults : [],
      rank: index + 1,
    };
  });

  return {
    sessionId: params.sessionId,
    roomId: params.roomId,
    finalizedAt: new Date().toISOString(),
    elapsedSec: params.elapsedSec,
    roundSeconds: params.roundSeconds,
    totalProblems: params.totalProblems,
    players,
  };
}

export function rankingSnapshotToResultPlayers(
  snapshot: FinalRankingSnapshot,
): import('../resultUtils').ResultPlayer[] {
  return snapshot.players.map((p) => ({
    id: p.id,
    name: p.name,
    avatar: p.avatar,
    ingameScore: p.ingameScore,
    ratingScore: p.ratingScore,
    totalSolveTime: p.totalSolveTime,
    completionTime: p.completionTime,
    problemResults: p.problemResults,
    delta: 0,
    rank: p.rank,
  }));
}
