import { useModalShake } from '../../../hooks/useModalShake';

interface JoinRoomPasswordModalProps {
  open: boolean;
  roomTitle: string;
  password: string;
  error: string;
  submitting: boolean;
  onPasswordChange: (value: string) => void;
  onClose: () => void;
  onConfirm: () => void;
}

export function JoinRoomPasswordModal({
  open,
  roomTitle,
  password,
  error,
  submitting,
  onPasswordChange,
  onClose,
  onConfirm,
}: JoinRoomPasswordModalProps) {
  const { shaking, triggerShake } = useModalShake();
  if (!open) return null;

  return (
    <div className="modal-overlay" onClick={triggerShake}>
      <div
        className={`modal-content join-pwd-modal ${shaking ? 'modal-shake-error' : ''}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="join-pwd-modal-kicker">PRIVATE ROOM</div>
        <h3 className="join-pwd-modal-title">비공개 방</h3>
        <p className="join-pwd-modal-room">{roomTitle}</p>
        <label className="join-pwd-modal-label" htmlFor="join-room-password">
          비밀번호
        </label>
        <input
          id="join-room-password"
          type="password"
          className="join-pwd-modal-input"
          placeholder="방 비밀번호 입력"
          value={password}
          onChange={(e) => onPasswordChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onConfirm();
          }}
          autoFocus
        />
        {error ? <div className="join-pwd-modal-error">{error}</div> : null}
        <div className="join-pwd-modal-actions">
          <button type="button" className="pixel-btn pixel-btn-secondary" onClick={onClose} disabled={submitting}>
            취소
          </button>
          <button type="button" className="pixel-btn pixel-btn-primary" onClick={onConfirm} disabled={submitting}>
            {submitting ? '입장 중...' : '입장'}
          </button>
        </div>
      </div>
    </div>
  );
}
