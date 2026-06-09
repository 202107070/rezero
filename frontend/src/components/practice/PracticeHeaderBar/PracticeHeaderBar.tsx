interface PracticeHeaderBarProps {
  displayLang: string;
  solvedCount: number;
  totalCount: number;
  onOpenSetup: () => void;
}

export function PracticeHeaderBar({ displayLang, solvedCount, totalCount, onOpenSetup }: PracticeHeaderBarProps) {
  return (
    <div
      className="pixel-card"
      style={{
        flexShrink: 0,
        padding: '8px 12px',
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        boxShadow: 'none',
        borderWidth: '3px',
      }}
    >
      <span style={{ color: 'var(--px-warning)', fontSize: '18px' }}>PRACTICE MODE</span>
      <div style={{ display: 'flex', gap: '8px', fontSize: '14px' }}>
        <button
          type="button"
          className="pixel-btn pixel-btn-secondary"
          style={{ fontSize: '12px', padding: '2px 8px' }}
          onClick={onOpenSetup}
        >
          설정 변경
        </button>
        <span style={{ background: '#1a1e21', border: '2px solid #000', padding: '2px 8px' }}>{displayLang}</span>
        <span style={{ background: '#1a1e21', border: '2px solid #000', padding: '2px 8px', color: 'var(--px-success)' }}>
          {solvedCount}/{totalCount} SOLVED
        </span>
      </div>
    </div>
  );
}
