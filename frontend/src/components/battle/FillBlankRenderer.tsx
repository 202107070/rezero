interface FillBlankRendererProps {
  code: string;
  answers: string[];
  problemIndex: number;
  correctBlanks: Record<number, boolean>;
  breakingBlanks: Record<string, boolean>;
  isLocked: boolean;
  isBotView?: boolean;
  onUpdate?: (blankIndex: number, value: string) => void;
  onEnter?: (blankIndex: number, e: React.KeyboardEvent) => void;
}

export default function FillBlankRenderer({
  code,
  answers,
  problemIndex,
  correctBlanks,
  breakingBlanks,
  isLocked,
  isBotView = false,
  onUpdate,
  onEnter,
}: FillBlankRendererProps) {
  const codeStr = typeof code === 'string' ? code : '';
  if (!codeStr) return null;

  const parts = codeStr.split('_____');
  const safeAnswers = answers || [];
  const corrects = correctBlanks || {};

  return (
    <div style={{ whiteSpace: 'pre-wrap' }}>
      {parts.map((part, i) => (
        <span key={i} style={{ whiteSpace: 'pre-wrap' }}>
          {part}
          {i < parts.length - 1 &&
            (corrects[i] === true ? (
              <span style={{ color: 'var(--px-success)', fontWeight: 'bold', fontFamily: 'var(--font-pixel)' }}>
                {safeAnswers[i] || '?'}
              </span>
            ) : (
              <input
                className={`blank-input${breakingBlanks[`${problemIndex}_${i}`] ? ' hammer-breaking' : ''}`}
                value={safeAnswers[i] || ''}
                onChange={isBotView || isLocked ? undefined : (e) => onUpdate?.(i, e.target.value)}
                onKeyDown={isBotView || isLocked ? undefined : (e) => e.key === 'Enter' && onEnter?.(i, e)}
                readOnly={isBotView || isLocked}
                disabled={isBotView || isLocked}
                style={{
                  width: '80px',
                  display: 'inline-block',
                  ...(isBotView ? { pointerEvents: 'none' } : {}),
                }}
              />
            ))}
        </span>
      ))}
    </div>
  );
}
