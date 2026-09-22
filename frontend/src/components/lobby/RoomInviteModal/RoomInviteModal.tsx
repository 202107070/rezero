interface RoomInviteModalProps {
  show: boolean;
  fromUserName: string;
  roomTitle: string;
  onAccept: () => void;
  onDecline: () => void;
}

export function RoomInviteModal({
  show,
  fromUserName,
  roomTitle,
  onAccept,
  onDecline,
}: RoomInviteModalProps) {
  if (!show) return null;

  return (
    <div className="review-modal-overlay" style={{ zIndex: 4000 }}>
      <div
        className="review-modal-panel ranking-panel"
        style={{ width: 'min(420px, 92vw)', height: 'auto', minHeight: 180 }}
      >
        <div className="rank-title">ROOM INVITE</div>
        <div className="review-incoming-msg">
          <strong>{fromUserName}</strong>님이{' '}
          <strong>{roomTitle || '대기실'}</strong>로 초대했습니다.
        </div>
        <div className="review-modal-actions review-modal-actions-end">
          <button type="button" className="pixel-btn pixel-btn-secondary review-modal-btn" onClick={onDecline}>
            거절
          </button>
          <button type="button" className="pixel-btn pixel-btn-primary review-modal-btn" onClick={onAccept}>
            수락
          </button>
        </div>
      </div>
    </div>
  );
}
