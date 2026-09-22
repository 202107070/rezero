import { useModalShake } from '../../../hooks/useModalShake';

interface ConnectionLostModalProps {
  open: boolean;
  onConfirm: () => void;
}

export function ConnectionLostModal({ open, onConfirm }: ConnectionLostModalProps) {
  const { shaking, triggerShake } = useModalShake();
  if (!open) return null;

  return (
    <div className="modal-overlay" onClick={triggerShake} style={{ zIndex: 5000 }}>
      <div
        className={`modal-content exit-confirm-modal${shaking ? ' modal-shake-error' : ''}`}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-center pixel-text-danger exit-confirm-title">접속 종료</h3>
        <p className="exit-confirm-message">접속이 끊겨서 프로그램을 종료합니다.</p>
        <div className="exit-confirm-actions">
          <button type="button" className="pixel-btn pixel-btn-danger" onClick={onConfirm}>
            확인
          </button>
        </div>
      </div>
    </div>
  );
}
