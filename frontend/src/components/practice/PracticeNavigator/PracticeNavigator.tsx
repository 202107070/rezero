interface PracticeNavigatorProps {
  currentIndex: number;
  totalCount: number;
  onPrev: () => void;
  onNext: () => void;
  onExit: () => void;
}

export function PracticeNavigator({ currentIndex, totalCount, onPrev, onNext, onExit }: PracticeNavigatorProps) {
  return (
    <div className="pixel-card practice-nav-bar">
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
        <button
          type="button"
          className="pixel-btn pixel-btn-secondary"
          onClick={onPrev}
          disabled={currentIndex <= 0}
          style={{ padding: '4px 14px', fontSize: '16px' }}
        >
          &lt;
        </button>
        <span style={{ fontSize: '18px', minWidth: '80px', textAlign: 'center' }}>
          {totalCount > 0 ? currentIndex + 1 : 0}/{totalCount}
        </span>
        <button
          type="button"
          className="pixel-btn pixel-btn-secondary"
          onClick={onNext}
          disabled={currentIndex >= totalCount - 1}
          style={{ padding: '4px 14px', fontSize: '16px' }}
        >
          &gt;
        </button>
      </div>
      <div style={{ display: 'flex', gap: '8px' }}>
        <button type="button" className="pixel-btn pixel-btn-danger" onClick={onExit} style={{ padding: '6px 18px' }}>
          EXIT
        </button>
      </div>
    </div>
  );
}
