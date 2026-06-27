interface FillBlankRendererProps {
  code: string;
  answers: string[];
  problemIndex: number;
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

  return (
    <div style={{ whiteSpace: 'pre-wrap' }}>
      {parts.map((part, i) => (
        <span key={i} style={{ whiteSpace: 'pre-wrap' }}>
          {part}
          {i < parts.length - 1 && (
            <input
              className={`blank-input${breakingBlanks[`${problemIndex}_${i}`] ? ' hammer-breaking' : ''}`}
              value={safeAnswers[i] || ''}
              onChange={isBotView || isLocked ? undefined : (e) => onUpdate?.(i, e.target.value)}
              onKeyDown={isBotView || isLocked ? undefined : (e) => e.key === 'Enter' && onEnter?.(i, e)}
              readOnly={isBotView || isLocked}
              disabled={isBotView || isLocked}
              style={{
                width: `${Math.max(88, ((safeAnswers[i] || '').length + 2) * 16)}px`,
                display: 'inline-block',
                ...(isBotView ? { pointerEvents: 'none' } : {}),
              }}
            />
          )}
        </span>
      ))}
    </div>
  );
}
