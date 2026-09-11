import type { RoomPlayer } from '../../types/room';

/** 혼자 시작 우회 (개발용). 운영/멀티에서는 false 유지. */
export const SOLO_START_BYPASS = false;

function isRealParticipant(player: RoomPlayer): boolean {
  return Boolean(player.userId);
}

export function getStartBlockReason(players: (RoomPlayer | null)[], roomMode: string): string | null {
  if (SOLO_START_BYPASS) return null;
  return getStartBlockReasonStrict(players, roomMode);
}

export function getStartBlockReasonStrict(players: (RoomPlayer | null)[], roomMode: string): string | null {
  const occupied = players.filter((p): p is RoomPlayer => p !== null);
  // 로컬 봇은 슬롯/초대 UI 테스트용 — START 인원·READY 검사는 실제 userId 유저만
  const realPlayers = occupied.filter(isRealParticipant);

  if (roomMode === '1/1') {
    if (realPlayers.length < 2) {
      return '1:1 모드는 실제 유저 2명이 참가해야 시작할 수 있습니다.';
    }
  } else if (realPlayers.length < 3) {
    return '1/N 모드는 실제 유저 최소 3명이 참가해야 시작할 수 있습니다.';
  }

  const notReady = realPlayers.filter((p) => !p.isHost && !p.isReady);
  if (notReady.length > 0) {
    const names = notReady.map((p) => p.name).join(', ');
    return `모든 플레이어가 준비 상태여야 합니다.\n준비 안 됨: ${names}`;
  }

  return null;
}
