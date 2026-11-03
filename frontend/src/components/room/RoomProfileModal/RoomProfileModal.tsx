import { CharacterAvatar } from '../../common/CharacterAvatar';
import { useModalShake } from '../../../hooks/useModalShake';
import type { RoomPlayer } from '../../../types/room';

interface RoomProfileModalProps {
  open: boolean;
  player: RoomPlayer | null;
  playerIndex: number | null;
  myCharacter: string;
  isHost: boolean;
  onClose: () => void;
  onKick: (index: number, name: string) => void;
}

export function RoomProfileModal({
  open,
  player,
  playerIndex,
  myCharacter,
  isHost,
  onClose,
  onKick,
}: RoomProfileModalProps) {
  const { shaking, triggerShake } = useModalShake();
  if (!open || !player) return null;

  return (
    <div className="problem-modal-overlay" onClick={triggerShake}>
      <div className={`modal-content${shaking ? ' modal-shake-error' : ''}`} style={{ width: '360px' }} onClick={(e) => e.stopPropagation()}>
        <h3 className="text-center pixel-text-primary" style={{ marginBottom: '16px', fontSize: '22px' }}>
          USER PROFILE
        </h3>
        <div className="d-flex flex-column align-items-center gap-3 mb-4">
          <div className="room-profile-avatar">
            <CharacterAvatar character={player.character || myCharacter} />
          </div>
          <div style={{ fontSize: '22px', color: '#eee' }}>{player.name}</div>
          {player.isHost && <div className="slot-host-badge" style={{ visibility: 'visible', fontSize: '18px' }}>HOST</div>}
        </div>
        <div className="text-center" style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'center' }}>
          {isHost && !player.isHost && playerIndex !== null && (
            <button
              type="button"
              className="pixel-btn pixel-btn-danger room-kick-btn"
              style={{ minWidth: '120px' }}
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
