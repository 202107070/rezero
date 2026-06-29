import type { BattleProblem, RoomUser } from '../types/battle';
import type { FinalRankingSnapshot } from '../utils/battle/rankUtils';

let battleProblems: BattleProblem[] | null = null;
let battleSettings: Record<string, unknown> | null = null;
let battleSubmission: Record<string, unknown> | null = null;
let opponentBattleCode: string | null = null;
let roomUsers: RoomUser[] | null = null;

const battleDrafts = new Map<string, Record<string, unknown>>();
const battleDraftCodes = new Map<string, string[]>();
const battleDraftMeta = new Map<string, Record<string, unknown>>();
const battleDemoStates = new Map<string, Record<string, unknown>>();
const battleSubmittedProblems = new Map<string, number[]>();
const battleFinalRankings = new Map<string, FinalRankingSnapshot>();

export function getBattleProblems(): BattleProblem[] | null {
  return battleProblems;
}

export function setBattleProblems(problems: BattleProblem[]): void {
  battleProblems = problems;
}

export function getBattleSettings(): Record<string, unknown> {
  return battleSettings ?? {};
}

export function setBattleSettings(settings: Record<string, unknown>): void {
  battleSettings = settings;
}

export function getBattleSubmission<T = Record<string, unknown>>(): T {
  return (battleSubmission ?? {}) as T;
}

export function setBattleSubmission(submission: Record<string, unknown>): void {
  battleSubmission = submission;
}

export function setBattleProblemMeta(_title: string, _data: Record<string, unknown>): void {
  // reserved for result/review flow when API is connected
}

export function setMyBattleCode(_code: string): void {
  // reserved for result/review flow when API is connected
}

export function getOpponentBattleCode(): string {
  return opponentBattleCode ?? '// 코드를 찾을 수 없습니다.';
}

export function setOpponentBattleCode(code: string): void {
  opponentBattleCode = code;
}

export function getRoomUsers(): RoomUser[] {
  return roomUsers ?? [];
}

export function setRoomUsers(users: RoomUser[]): void {
  roomUsers = users;
}

export function updateRoomUsers(updater: (users: RoomUser[]) => RoomUser[]): void {
  roomUsers = updater(getRoomUsers());
}

export function setBattleDraft(sessionId: string, draft: Record<string, unknown>): void {
  battleDrafts.set(sessionId, draft);
}

export function getBattleDraft(sessionId: string): Record<string, unknown> | null {
  return battleDrafts.get(sessionId) ?? null;
}

export function setBattleDraftCodes(sessionId: string, codes: string[]): void {
  battleDraftCodes.set(sessionId, codes);
}

export function getBattleDraftCodes(sessionId: string): string[] | null {
  return battleDraftCodes.get(sessionId) ?? null;
}

export function setBattleDraftMeta(sessionId: string, meta: Record<string, unknown>): void {
  battleDraftMeta.set(sessionId, meta);
}

export function getBattleDraftMeta(sessionId: string): Record<string, unknown> | null {
  return battleDraftMeta.get(sessionId) ?? null;
}

export function setBattleDemoState(sessionId: string, state: Record<string, unknown>): void {
  battleDemoStates.set(sessionId, state);
}

export function mergeBattleDemoState(sessionId: string, patch: Record<string, unknown>): void {
  const prev = battleDemoStates.get(sessionId) ?? {};
  battleDemoStates.set(sessionId, { ...prev, ...patch, updatedAt: new Date().toISOString() });
}

export function getBattleDemoState<T = Record<string, unknown>>(sessionId: string): T | null {
  const state = battleDemoStates.get(sessionId);
  return state ? (state as T) : null;
}

export function setBattleSubmittedProblems(sessionId: string, indices: number[]): void {
  battleSubmittedProblems.set(sessionId, indices);
}

export function setFinalRankingSnapshot(snapshot: FinalRankingSnapshot): void {
  battleFinalRankings.set(snapshot.sessionId, snapshot);
}

export function getFinalRankingSnapshot(sessionId: string): FinalRankingSnapshot | null {
  return battleFinalRankings.get(sessionId) ?? null;
}

export function clearActiveBattleGlobals(): void {
  battleProblems = null;
  battleSettings = null;
  battleSubmission = null;
  opponentBattleCode = null;
  roomUsers = null;
}

export function clearBattleSessionData(sessionId: string): void {
  battleDrafts.delete(sessionId);
  battleDraftCodes.delete(sessionId);
  battleDraftMeta.delete(sessionId);
  battleDemoStates.delete(sessionId);
  battleSubmittedProblems.delete(sessionId);
  battleFinalRankings.delete(sessionId);
}

export function clearBattleSessionForLeave(sessionId: string): void {
  clearBattleSessionData(sessionId);
  clearActiveBattleGlobals();
}
