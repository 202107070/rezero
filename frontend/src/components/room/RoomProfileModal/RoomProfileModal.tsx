import { CHARACTERS } from '../../../constants/roomConstants';
import type { RoomPlayer } from '../../../types/room';

interface RoomProfileModalProps {
  open: boolean;
  player: RoomPlayer | null;
  playerIndex: number | null;
  myCharacter: string;
  isHost: boolean;
  roomMode: string;
  onClose: () => void;
  onKick: (index: number, name: string) => void;
}

export function RoomProfileModal({
  open,
  player,
  playerIndex,
  myCharacter,
  isHost,
  roomMode,
  onClose,
  onKick,
}: RoomProfileModalProps) {
  if (!open || !player) return null;

  const charIcon = player.isHost ? CHARACTERS.find((c) => c.id === myCharacter)?.icon : player.character;

  return (
    <div className="problem-modal-overlay" onClick={onClose}>
      <div className="modal-content" style={{ width: '320px' }} onClick={(e) => e.stopPropagation()}>
        <h3 className="text-center pixel-text-primary" style={{ marginBottom: '16px', fontSize: '22px' }}>
          USER PROFILE
        </h3>
        <div className="d-flex flex-column align-items-center gap-3 mb-4">
          <div style={{ fontSize: '4rem', lineHeight: 1 }}>{charIcon}</div>
          <div style={{ fontSize: '22px', color: '#eee' }}>{player.name}</div>
          {player.isHost && <div className="slot-host-badge" style={{ visibility: 'visible', fontSize: '18px' }}>HOST</div>}
        </div>
        <div className="text-center">
          {isHost && !player.isHost && roomMode !== '1/1' && playerIndex !== null && (
            <button
              type="button"
              className="pixel-btn pixel-btn-primary"
              style={{ minWidth: '120px', background: 'var(--px-danger)', marginRight: '8px' }}
              onClick={() => {
                onClose();
                onKick(playerIndex, player.name);
              }}
            >
              강퇴
            </button>
          )}
          <button type="button" className="pixel-btn pixel-btn-secondary" style={{ minWidth: '120px' }} onClick={onClose}>
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}
