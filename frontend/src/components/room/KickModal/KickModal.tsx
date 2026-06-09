interface KickModalProps {
  open: boolean;
  targetName: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function KickModal({ open, targetName, onConfirm, onCancel }: KickModalProps) {
  if (!open) return null;

  return (
    <div className="problem-modal-overlay" onClick={onCancel}>
      <div className="modal-content" style={{ width: '360px' }} onClick={(e) => e.stopPropagation()}>
        <h3 className="text-center pixel-text-danger" style={{ marginBottom: '16px', fontSize: '22px' }}>
          ⚠ 강제 퇴출
        </h3>
        <div className="text-center mb-4" style={{ fontSize: '18px', color: '#ddd' }}>
          [{targetName}] 님을 강퇴하시겠습니까?
        </div>
        <div className="d-flex justify-content-center gap-3">
          <button
            type="button"
            className="pixel-btn pixel-btn-primary"
            style={{ minWidth: '100px', background: 'var(--px-danger)' }}
            onClick={onConfirm}
          >
            강퇴
          </button>
          <button type="button" className="pixel-btn pixel-btn-secondary" style={{ minWidth: '100px' }} onClick={onCancel}>
            취소
          </button>
        </div>
      </div>
    </div>
  );
}
