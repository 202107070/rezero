interface PracticeHeaderBarProps {
  displayLang: string;
  solvedCount: number;
  totalCount: number;
  onOpenSetup: () => void;
}

export function PracticeHeaderBar({ displayLang, solvedCount, totalCount, onOpenSetup }: PracticeHeaderBarProps) {
  return (
    <div className="pixel-card practice-header-bar">
      <span className="practice-header-title">PRACTICE MODE</span>
      <div className="practice-header-meta">
        <button type="button" className="pixel-btn pixel-btn-secondary" style={{ fontSize: '16px', padding: '6px 12px' }} onClick={onOpenSetup}>
          설정 변경
        </button>
        <span style={{ background: '#1a1e21', border: '2px solid #000', padding: '4px 10px' }}>{displayLang}</span>
        <span style={{ background: '#1a1e21', border: '2px solid #000', padding: '4px 10px', color: 'var(--px-success)' }}>
          {solvedCount}/{totalCount} SOLVED
        </span>
      </div>
    </div>
  );
}
