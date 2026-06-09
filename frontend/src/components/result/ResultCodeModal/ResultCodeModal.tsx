import type { ResultPlayer } from '../../../utils/resultUtils';

interface ModalProblem {
  title?: string;
  question?: string;
  explanation?: string;
  options?: string[];
}

interface ResultCodeModalProps {
  isOpen: boolean;
  player: ResultPlayer | null;
  problems: ModalProblem[];
  problemIndex: number;
  code: string;
  solutionText: string;
  onClose: () => void;
  onProblemIndexChange: (index: number) => void;
}

export function ResultCodeModal({
  isOpen,
  player,
  problems,
  problemIndex,
  code,
  solutionText,
  onClose,
  onProblemIndexChange,
}: ResultCodeModalProps) {
  if (!isOpen) return null;

  const currentProblem = problems[problemIndex];

  return (
    <div className="code-modal-overlay" onClick={onClose}>
      <div className="code-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="code-modal-header">
          <h4 className="code-modal-title">
            {player ? `${player.name.split(' ')[0]} - CODE REVIEW` : 'CODE REVIEW'}
          </h4>
          <button type="button" className="code-modal-close" onClick={onClose}>
            ✖
          </button>
        </div>
        <div className="code-modal-grid">
          <div className="pixel-card code-modal-panel" style={{ borderColor: 'var(--px-warning)' }}>
            <div className="pixel-card-header" style={{ justifyContent: 'center' }}>
              <span style={{ color: 'var(--px-warning)' }}>PROBLEM</span>
            </div>
            <div style={{ display: 'flex', gap: '6px', padding: '8px', flexWrap: 'wrap' }}>
              {problems.map((_, idx) => (
                <button
                  key={idx}
                  type="button"
                  className="btn-code-view"
                  onClick={() => onProblemIndexChange(idx)}
                  style={{ flex: '1 1 auto', fontSize: '14px', padding: '4px' }}
                >
                  문제 {idx + 1}
                </button>
              ))}
            </div>
            <div className="code-modal-problem">
              <div className="problem-title">{currentProblem?.title || ''}</div>
              <div style={{ marginBottom: '8px', whiteSpace: 'pre-wrap' }}>{currentProblem?.question || ''}</div>
              {currentProblem?.options && (
                <div className="example-box">
                  <div className="label">OPTIONS</div>
                  <div>{currentProblem.options.map((o, i) => `${i + 1}. ${o}`).join(' | ')}</div>
                </div>
              )}
              <div className="example-box">
                <div className="label">EXPLANATION</div>
                <div>{currentProblem?.explanation || ''}</div>
              </div>
            </div>
          </div>
          <div className="pixel-card code-modal-panel" style={{ display: 'flex', flexDirection: 'column' }}>
            <div className="pixel-card-header" style={{ justifyContent: 'center' }}>
              <span style={{ color: 'var(--px-primary)' }}>SOURCE CODE</span>
            </div>
            <div className="code-modal-code" style={{ flex: 1 }}>
              <pre>{code}</pre>
            </div>
            <div className="pixel-card-header" style={{ justifyContent: 'center', borderTop: '4px solid var(--px-border)' }}>
              <span style={{ color: 'var(--px-success)' }}>✅ CORRECT ANSWER</span>
            </div>
            <div className="code-modal-code" style={{ flex: 1 }}>
              <pre>{solutionText}</pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
