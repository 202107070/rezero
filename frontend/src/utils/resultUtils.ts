import { getBotSolveDelay, type DemoBot } from './battle/demoBots';
import { getTotalBattleSeconds } from './battle/codeUtils';

export interface ResultPlayer {
  id: string;
  name: string;
  avatar: string;
  ingameScore: number;
  ratingScore: number;
  totalSolveTime: number;
  completionTime: number;
  delta: number;
  rank: number;
}

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

function readBattleRoundSeconds(problemCount: number, demoState: DemoStateLike | null): number {
  if (demoState?.roundSeconds) return demoState.roundSeconds;
  try {
    const settings = JSON.parse(localStorage.getItem('battleSettings') || '{}');
    const count = parseInt(settings.count, 10) || problemCount || 5;
    return getTotalBattleSeconds(settings.diff || 'NORMAL', count);
  } catch {
    return getTotalBattleSeconds('NORMAL', problemCount || 5);
  }
}

function resolveSolvedProblems(
  isMe: boolean,
  solvedProblems: number[],
  solveTimes: Record<number, number>,
): number[] {
  if (solvedProblems.length > 0) return solvedProblems;
  if (!isMe) return [];
  return Object.keys(solveTimes)
    .map((key) => parseInt(key, 10))
    .filter((idx) => Number.isFinite(idx) && (solveTimes[idx] || 0) > 0)
    .sort((a, b) => a - b);
}

function getUserSolveMetrics(solvedProblems: number[], solveTimes: Record<number, number>) {
  const ordered = resolveSolvedProblems(true, solvedProblems, solveTimes);
  const durations = ordered.map((idx) => solveTimes[idx] || 0).filter((t) => t > 0);
  const totalSolveTime = durations.reduce((sum, t) => sum + t, 0);
  const completionTime = totalSolveTime > 0 ? totalSolveTime : Number.POSITIVE_INFINITY;
  return { ordered, totalSolveTime, completionTime };
}

function getBotSolveMetrics(bot: DemoBot, roundSeconds: number) {
  const solved = Array.isArray(bot.solvedProblems) ? [...bot.solvedProblems].sort((a, b) => a - b) : [];
  const totalSolveTime = solved.reduce(
    (sum, idx) => sum + getBotSolveDelay(bot, idx, roundSeconds),
    0,
  );
  const completionTime =
    solved.length > 0
      ? getBotSolveDelay(bot, solved[solved.length - 1], roundSeconds)
      : Number.POSITIVE_INFINITY;
  return { solved, totalSolveTime, completionTime };
}

function resolveIngameScore(
  isMe: boolean,
  solvedProblems: number[],
  solveTimes: Record<number, number>,
  submission: BattleSubmissionLike,
  demoState: DemoStateLike | null,
  roomUserScore?: number,
): number {
  const solvedList = resolveSolvedProblems(isMe, solvedProblems, solveTimes);
  const scoreFromSolved = computeIngameScore(solvedList);
  const candidates = [
    scoreFromSolved,
    isMe ? submission?.ingameScore : undefined,
    isMe ? demoState?.ingameScore : undefined,
    roomUserScore,
  ].filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
  return candidates.length > 0 ? Math.max(...candidates) : 0;
}

interface RoomUserLike {
  id?: string;
  name?: string;
  avatar?: string;
  solvedProblems?: number[];
  ingameScore?: number;
  score?: string | number;
}

interface BattleSubmissionLike {
  ingameScore?: number;
  myRatingScore?: number;
  solveTimes?: Record<number, number>;
  mode?: string;
  lang?: string;
  codes?: string[];
  answers?: string[];
  problems?: Array<{ title?: string; question?: string; explanation?: string; answer?: Record<string, string[]> }>;
  submittedAt?: string;
  roomId?: string;
  historyId?: string;
  code?: string;
}

interface DemoStateLike {
  mode?: string;
  lang?: string;
  roundSeconds?: number;
  remaining?: number;
  ingameScore?: number;
  solveTimes?: Record<number, number>;
  battleBots?: DemoBot[];
}

function parseScore(scoreStr: string | number | undefined): number {
  const num = parseInt(String(scoreStr).replace(/[^0-9]/g, ''), 10);
  return Number.isFinite(num) ? num : 0;
}

function computeIngameScore(solvedProblems: number[]): number {
  const count = solvedProblems.length;
  if (count === 0) return 0;
  return count * 1000 + (100 * (count * (count - 1))) / 2;
}

export function buildResultPlayers(params: {
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

  params.roomUsers.forEach((u) => {
    const id = u.id || '';
    if (seen.has(id)) return;
    seen.add(id);
    const isMe = id === 'me' || Boolean(u.name?.includes('rocky_user'));
    const solvedProblems = Array.isArray(u.solvedProblems) ? u.solvedProblems : [];

    const ratingScore = isMe
      ? params.submission?.myRatingScore ?? 1000
      : u.score
        ? parseScore(u.score)
        : 1000;
    const ingameScore = resolveIngameScore(
      isMe,
      solvedProblems,
      solveTimes,
      params.submission,
      params.demoState,
      u.ingameScore,
    );

    const metrics = isMe
      ? getUserSolveMetrics(solvedProblems, solveTimes)
      : (() => {
          const bot = params.demoBots.find((b) => b.id === id);
          return bot
            ? getBotSolveMetrics(bot, roundSeconds)
            : { totalSolveTime: Number.POSITIVE_INFINITY, completionTime: Number.POSITIVE_INFINITY };
        })();

    list.push({
      id: isMe ? 'rocky_user' : id,
      name: u.name || (isMe ? 'rocky_user' : id),
      avatar: u.avatar || '👤',
      ingameScore,
      ratingScore,
      totalSolveTime: metrics.totalSolveTime,
      completionTime: metrics.completionTime,
      delta: Math.floor(ingameScore / 10),
      rank: 0,
    });
  });

  params.demoBots.forEach((bot) => {
    if (seen.has(bot.id)) return;
    seen.add(bot.id);
    const metrics = getBotSolveMetrics(bot, roundSeconds);
    const botScore = computeIngameScore(metrics.solved);
    list.push({
      id: bot.id,
      name: bot.name,
      avatar: bot.avatar || '🤖',
      ingameScore: botScore,
      ratingScore: 1000,
      totalSolveTime: metrics.totalSolveTime,
      completionTime: metrics.completionTime,
      delta: Math.floor(botScore / 10),
      rank: 0,
    });
  });

  if (list.length === 0) {
    list.push({
      id: 'rocky_user',
      name: 'rocky_user',
      ingameScore: 0,
      ratingScore: 1000,
      totalSolveTime: 0,
      completionTime: Number.POSITIVE_INFINITY,
      delta: 0,
      avatar: '😎',
      rank: 1,
    });
    list.push({
      id: 'elder',
      name: '알고리즘깎는노인',
      ingameScore: 2500,
      ratingScore: 1420,
      totalSolveTime: 0,
      completionTime: Number.POSITIVE_INFINITY,
      delta: 250,
      avatar: '👴',
      rank: 2,
    });
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
  return localStorage.getItem('opponentBattleCode') || '// 코드를 찾을 수 없습니다.';
}
