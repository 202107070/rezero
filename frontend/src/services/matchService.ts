import type { BattleProblem } from '../types/battle';
import { ApiError, apiRequest } from './apiClient';

export interface MatchStartProblem extends BattleProblem {
  description?: string;
  input?: string;
  output?: string;
}

export interface MatchStartResponse {
  matchId: string;
  roomId: number;
  status: string;
  language: string;
  difficulty: string;
  problemCount: number;
  maxPlayers: number;
  roomMode: string;
  gameMode: string;
  roundSeconds: number;
  startedAt?: string;
  problems: MatchStartProblem[];
}

export interface MatchAnswerResult {
  matchId: string;
  problemIndex: number;
  isCorrect: boolean;
  awardedScore: number;
  score: number;
}

export interface MatchItemResult {
  matchId: string;
  problemIndex: number;
  itemKey: string;
  targetUserId: string | null;
  success: boolean;
}

export interface MatchRankingPlayer {
  id: string;
  name: string;
  avatar?: string;
  ingameScore: number;
  ratingScore: number;
  totalSolveTime: number;
  completionTime: number;
  solvedProblems: number[];
  problemResults: boolean[];
  rank: number;
}

export interface MatchRanking {
  matchId: string;
  finalizedAt?: string;
  elapsedSec: number;
  roundSeconds: number;
  totalProblems: number;
  players: MatchRankingPlayer[];
  rewards?: Array<{
    userId?: string;
    id?: string;
    earnedGold?: number;
    ratingDelta?: number;
    newTitleIds?: string[];
  }>;
}

export interface MatchSubmitResult {
  roomId?: number;
  submitted: boolean;
  resultReady: boolean;
  waitingForUserIds?: string[];
  ranking?: MatchRanking;
  earnedGold?: number;
  ratingDelta?: number;
  newTitleIds?: string[];
}

export function parseRoomTimeToSeconds(time: string): number | undefined {
  const text = String(time || '').trim();
  const matched = text.match(/(\d+)/);
  if (!matched) return undefined;
  const value = Number(matched[1]);
  if (!Number.isInteger(value) || value < 1) return undefined;
  if (/초/.test(text)) return value;
  return value * 60;
}

export async function startMatch(params: {
  roomId: number;
  roundSeconds?: number;
}): Promise<MatchStartResponse> {
  const body: { roomId: number; roundSeconds?: number } = { roomId: params.roomId };
  if (params.roundSeconds !== undefined) body.roundSeconds = params.roundSeconds;
  return apiRequest<MatchStartResponse>('/matches/start', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function submitMatchAnswer(
  matchId: string,
  params: {
    problemIndex: number;
    answers: string[];
    selectedOption?: number;
  },
): Promise<MatchAnswerResult> {
  const body: Record<string, unknown> = {
    problemIndex: params.problemIndex,
    answers: params.answers,
  };
  if (params.selectedOption !== undefined) {
    body.selectedOption = params.selectedOption;
  }
  return apiRequest<MatchAnswerResult>(`/matches/${encodeURIComponent(matchId)}/answers`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function useMatchItem(
  matchId: string,
  params: {
    problemIndex: number;
    itemKey: string;
    targetUserId?: string;
  },
): Promise<MatchItemResult> {
  return apiRequest<MatchItemResult>(`/matches/${encodeURIComponent(matchId)}/items/use`, {
    method: 'POST',
    body: JSON.stringify({
      problemIndex: params.problemIndex,
      itemKey: params.itemKey,
      targetUserId: params.targetUserId || '',
    }),
  });
}

export async function submitMatchResult(
  matchId: string,
  params: {
    ingameScore: number;
    codes: string[];
    blankAnswers: string[][];
    selectedOptions: Record<number, number>;
    solveTimes: Record<number, number>;
    problemResults: boolean[];
    localSolvedProblems: number[];
    totalSolveTime: number;
    finishedAtElapsedSec: number;
  },
): Promise<MatchSubmitResult> {
  return apiRequest<MatchSubmitResult>(`/matches/${encodeURIComponent(matchId)}/submit`, {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

export async function fetchMatchRanking(matchId: string): Promise<MatchRanking> {
  return apiRequest<MatchRanking>(`/matches/${encodeURIComponent(matchId)}/ranking`);
}

export function isAlreadySubmittedError(error: unknown): boolean {
  return error instanceof ApiError && error.code === 'PROBLEM_ALREADY_SUBMITTED';
}

export function isMatchResultNotReady(error: unknown): boolean {
  return error instanceof ApiError && error.code === 'MATCH_RESULT_NOT_READY';
}

export function getMatchErrorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  return '요청을 처리하지 못했습니다.';
}
