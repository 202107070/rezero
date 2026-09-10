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
        className={`modal-content ${shaking ? 'modal-shake-error' : ''}`}
        style={{ width: '380px' }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-center pixel-text-primary" style={{ marginBottom: '16px', fontSize: '22px' }}>
          비공개 방
        </h3>
        <div className="text-center mb-3" style={{ fontSize: '16px', color: '#ddd' }}>
          {roomTitle}
        </div>
        <input
          type="password"
          className="modal-pwd-compact"
          placeholder="비밀번호"
          value={password}
          onChange={(e) => onPasswordChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onConfirm();
          }}
          autoFocus
        />
        {error ? (
          <div className="text-center pixel-text-warning" style={{ marginTop: '12px', fontSize: '14px' }}>
            {error}
          </div>
        ) : null}
        <div className="d-flex justify-content-center gap-3" style={{ marginTop: '18px' }}>
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
