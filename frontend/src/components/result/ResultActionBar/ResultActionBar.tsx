interface ResultActionBarProps {
  onReplay: () => void;
  onExit: () => void;
}

export function ResultActionBar({ onReplay, onExit }: ResultActionBarProps) {
  return (
    <div className="action-panel">
      <button type="button" className="pixel-btn pixel-btn-primary btn-action" onClick={onReplay}>
        다시하기
      </button>
      <button type="button" className="pixel-btn pixel-btn-secondary btn-action" onClick={onExit}>
        나가기
      </button>
    </div>
  );
}
