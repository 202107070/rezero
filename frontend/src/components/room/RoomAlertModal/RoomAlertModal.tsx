interface RoomAlertModalProps {
  open: boolean;
  message: string;
  onClose: () => void;
}

export function RoomAlertModal({ open, message, onClose }: RoomAlertModalProps) {
  if (!open) return null;

  return (
    <div className="problem-modal-overlay" onClick={onClose}>
      <div className="modal-content" style={{ width: '380px' }} onClick={(e) => e.stopPropagation()}>
        <h3 className="text-center pixel-text-warning" style={{ marginBottom: '16px', fontSize: '22px' }}>
          ⚠ 알림
        </h3>
        <div className="text-center mb-4" style={{ fontSize: '17px', color: '#ddd', lineHeight: 1.6, whiteSpace: 'pre-line' }}>
          {message}
        </div>
        <div className="text-center">
          <button type="button" className="pixel-btn pixel-btn-primary" style={{ minWidth: '120px' }} onClick={onClose}>
            확인
          </button>
        </div>
      </div>
    </div>
  );
}
