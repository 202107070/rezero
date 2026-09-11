import type { RoomPlayer } from '../../types/room';

/** 혼자 시작 우회 (개발용). 운영/멀티에서는 false 유지. */
export const SOLO_START_BYPASS = false;

function isRealParticipant(player: RoomPlayer): boolean {
  return Boolean(player.userId);
}

/** 로컬 봇(userId 없음)이 한 명이라도 있으면 로컬 테스트 시작 경로 */
export function hasLocalBots(players: (RoomPlayer | null)[]): boolean {
  return players.some((player) => player !== null && !isRealParticipant(player));
}

export function getStartBlockReason(players: (RoomPlayer | null)[], roomMode: string): string | null {
  if (SOLO_START_BYPASS) return null;
  return getStartBlockReasonStrict(players, roomMode);
}

export function getStartBlockReasonStrict(players: (RoomPlayer | null)[], roomMode: string): string | null {
  const occupied = players.filter((p): p is RoomPlayer => p !== null);

  if (roomMode === '1/1') {
    if (occupied.length < 2) {
      return '1:1 모드는 최소 2명이 참가해야 시작할 수 있습니다.';
    }
  } else if (occupied.length < 3) {
    return '1/N 모드는 최소 3명이 참가해야 시작할 수 있습니다.';
  }

  const notReady = occupied.filter((p) => !p.isHost && !p.isReady);
  if (notReady.length > 0) {
    const names = notReady.map((p) => p.name).join(', ');
    return `모든 플레이어가 준비 상태여야 합니다.\n준비 안 됨: ${names}`;
  }

  return null;
}
