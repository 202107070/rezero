import { getCurrentUserId } from '../services/authService';
import {
  clearReviewInviteMemory,
  persistReviewInviteMemory,
  readReviewInviteMemory,
} from './reviewInviteStore';

export type ReviewInviteStatus = 'pending' | 'accepted' | 'rejected' | 'cancelled';

export interface ReviewInvitePayload {
  id: string;
  sessionId: string;
  fromUserId: string;
  fromUserName: string;
  toUserId: string;
  toUserName: string;
  problemIndices: number[];
  status: ReviewInviteStatus;
  createdAt: number;
}

export function createReviewInviteId(): string {
  return `review-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function persistReviewInvite(invite: ReviewInvitePayload): void {
  try {
    persistReviewInviteMemory(invite);
  } catch (e) {
    console.error('리뷰 초대 저장 실패:', e);
  }
}

export function readReviewInvite(sessionId: string): ReviewInvitePayload | null {
  return readReviewInviteMemory(sessionId);
}

export function updateReviewInviteStatus(sessionId: string, status: ReviewInviteStatus): void {
  const invite = readReviewInvite(sessionId);
  if (!invite) return;
  persistReviewInvite({ ...invite, status });
}

export function clearReviewInvite(sessionId: string): void {
  clearReviewInviteMemory(sessionId);
}

export function isInviterUser(userId: string): boolean {
  return userId === getCurrentUserId();
}

/** 실제 유저 매칭 전까지 봇/비-본인 유저는 자동 수락 대상 */
export function shouldAutoAcceptReviewInvite(toUserId: string): boolean {
  return toUserId !== getCurrentUserId();
}

export function scheduleReviewInviteResponse(
  sessionId: string,
  onAccepted: () => void,
  onRejected: () => void,
  delayMs: number,
  accept = true,
): () => void {
  const timer = window.setTimeout(() => {
    updateReviewInviteStatus(sessionId, accept ? 'accepted' : 'rejected');
    if (accept) onAccepted();
    else onRejected();
  }, delayMs);
  return () => clearTimeout(timer);
}
