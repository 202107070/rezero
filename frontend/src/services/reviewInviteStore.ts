import type { ReviewInvitePayload } from './reviewSessionService';

const reviewInvites = new Map<string, ReviewInvitePayload>();

export function persistReviewInviteMemory(invite: ReviewInvitePayload): void {
  reviewInvites.set(invite.sessionId, invite);
}

export function readReviewInviteMemory(sessionId: string): ReviewInvitePayload | null {
  return reviewInvites.get(sessionId) ?? null;
}

export function clearReviewInviteMemory(sessionId: string): void {
  reviewInvites.delete(sessionId);
}
