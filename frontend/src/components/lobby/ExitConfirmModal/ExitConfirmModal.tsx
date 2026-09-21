import { useModalShake } from '../../../hooks/useModalShake';

interface ExitConfirmModalProps {
  open: boolean;
  title?: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ExitConfirmModal({
  open,
  title = '게임 종료',
  message = '게임을 종료하시겠습니까?',
  confirmLabel = '예',
  cancelLabel = '아니오',
  onConfirm,
  onCancel,
}: ExitConfirmModalProps) {
  const { shaking, triggerShake } = useModalShake();
  if (!open) return null;

  return (
    <div className="modal-overlay" onClick={triggerShake}>
      <div className={`modal-content exit-confirm-modal${shaking ? ' modal-shake-error' : ''}`} onClick={(e) => e.stopPropagation()}>
        <h3 className="text-center pixel-text-warning exit-confirm-title">{title}</h3>
        <p className="exit-confirm-message">{message}</p>
        <div className="exit-confirm-actions">
          <button type="button" className="pixel-btn pixel-btn-danger" onClick={onConfirm}>
            {confirmLabel}
          </button>
          <button type="button" className="pixel-btn pixel-btn-secondary" onClick={onCancel}>
            {cancelLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
