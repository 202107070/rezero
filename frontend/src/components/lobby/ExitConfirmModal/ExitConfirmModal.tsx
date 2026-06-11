import { useModalShake } from '../../../hooks/useModalShake';

interface ExitConfirmModalProps {
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ExitConfirmModal({ open, onConfirm, onCancel }: ExitConfirmModalProps) {
  const { shaking, triggerShake } = useModalShake();
  if (!open) return null;

  return (
    <div className="modal-overlay" onClick={triggerShake}>
      <div className={`modal-content exit-confirm-modal${shaking ? ' modal-shake-error' : ''}`} onClick={(e) => e.stopPropagation()}>
        <h3 className="text-center pixel-text-warning exit-confirm-title">게임 종료</h3>
        <p className="exit-confirm-message">게임을 종료하시겠습니까?</p>
        <div className="exit-confirm-actions">
          <button type="button" className="pixel-btn pixel-btn-danger" onClick={onConfirm}>
            예
          </button>
          <button type="button" className="pixel-btn pixel-btn-secondary" onClick={onCancel}>
            아니오
          </button>
        </div>
      </div>
    </div>
  );
}
