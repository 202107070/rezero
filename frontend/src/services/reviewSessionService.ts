import { MY_RESULT_USER_ID } from '../constants/resultConstants';

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

const STORAGE_PREFIX = 'reviewInvite_';

export function createReviewInviteId(): string {
  return `review-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function persistReviewInvite(invite: ReviewInvitePayload): void {
  try {
    localStorage.setItem(`${STORAGE_PREFIX}${invite.sessionId}`, JSON.stringify(invite));
  } catch (e) {
    console.error('리뷰 초대 저장 실패:', e);
  }
}

export function readReviewInvite(sessionId: string): ReviewInvitePayload | null {
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${sessionId}`);
    return raw ? (JSON.parse(raw) as ReviewInvitePayload) : null;
  } catch {
    return null;
  }
}

export function updateReviewInviteStatus(sessionId: string, status: ReviewInviteStatus): void {
  const invite = readReviewInvite(sessionId);
  if (!invite) return;
  persistReviewInvite({ ...invite, status });
}

export function clearReviewInvite(sessionId: string): void {
  try {
    localStorage.removeItem(`${STORAGE_PREFIX}${sessionId}`);
  } catch {
    /* ignore */
  }
}

export function isInviterUser(userId: string): boolean {
  return userId === MY_RESULT_USER_ID;
}

/** 실제 유저 매칭 전까지 봇/비-본인 유저는 자동 수락 대상 */
export function shouldAutoAcceptReviewInvite(toUserId: string): boolean {
  return toUserId !== MY_RESULT_USER_ID;
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
