interface StartGameOverlayProps {
  open: boolean;
  message: string;
}

export function StartGameOverlay({ open, message }: StartGameOverlayProps) {
  if (!open) return null;

  return (
    <div className="problem-modal-overlay">
      <div className="problem-modal-box">
        <div className="problem-modal-text">{message}</div>
        <div className="problem-modal-sub">BATTLE PAGE로 이동 중입니다...</div>
      </div>
    </div>
  );
}
