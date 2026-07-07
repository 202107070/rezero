import ProblemVisualPreview from '../../battle/ProblemVisualPreview';
import { useModalShake } from '../../../hooks/useModalShake';
import type { BattleProblem } from '../../../types/battle';
import type { ResultPlayer } from '../../../utils/resultUtils';
import { formatCorrectAnswer } from '../../../utils/resultAnswerUtils';

interface ResultProblemModalProps {
  isOpen: boolean;
  player: ResultPlayer | null;
  problems: BattleProblem[];
  problemIndex: number;
  langKey: string;
  submittedAnswer: string;
  onClose: () => void;
  onProblemIndexChange: (index: number) => void;
}

export function ResultProblemModal({
  isOpen,
  player,
  problems,
  problemIndex,
  langKey,
  submittedAnswer,
  onClose,
  onProblemIndexChange,
}: ResultProblemModalProps) {
  const { shaking, triggerShake } = useModalShake();
  if (!isOpen || !player) return null;

  const currentProblem = problems[problemIndex];
  const correctAnswer = currentProblem ? formatCorrectAnswer(currentProblem, langKey) : '';
  const isCorrect = player.problemResults[problemIndex] === true;
  const playerLabel = player.name.split(' ')[0];

  return (
    <div className="code-modal-overlay" onClick={triggerShake}>
      <div className={`code-modal-content result-problem-modal${shaking ? ' modal-shake-error' : ''}`} onClick={(e) => e.stopPropagation()}>
        <div className="code-modal-header">
          <h4 className="code-modal-title">
            {playerLabel} · 문제 {problemIndex + 1}
            <span className={`result-problem-modal-badge ${isCorrect ? 'correct' : 'wrong'}`}>
              {isCorrect ? '정답' : '오답'}
            </span>
          </h4>
          <button type="button" className="code-modal-close" onClick={onClose}>
            ✖
          </button>
        </div>
        <div className="result-problem-modal-tabs">
          {problems.map((_, idx) => (
            <button
              key={idx}
              type="button"
              className={`btn-code-view${idx === problemIndex ? ' active' : ''}`}
              onClick={() => onProblemIndexChange(idx)}
            >
              {idx + 1}
            </button>
          ))}
        </div>
        <div className="code-modal-grid result-problem-modal-grid">
          <div className="pixel-card code-modal-panel" style={{ borderColor: 'var(--px-warning)' }}>
            <div className="pixel-card-header" style={{ justifyContent: 'center' }}>
              <span style={{ color: 'var(--px-warning)' }}>문제</span>
            </div>
            <div className="code-modal-problem">
              <div className="problem-title">{currentProblem?.title || `문제 ${problemIndex + 1}`}</div>
              <div className="result-problem-modal-question">{currentProblem?.question || ''}</div>
              {currentProblem?.visual && <ProblemVisualPreview visual={currentProblem.visual} compact />}
              {currentProblem?.options && currentProblem.options.length > 0 && (
                <div className="example-box">
                  <div className="label">선택지</div>
                  <div className="result-problem-modal-options">
                    {currentProblem.options.map((opt, i) => (
                      <div key={i}>
                        {String.fromCharCode(65 + i)}. {opt}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
          <div className="pixel-card code-modal-panel result-problem-modal-answers" style={{ display: 'flex', flexDirection: 'column' }}>
            <div className="result-problem-modal-answer-block">
              <div className="pixel-card-header result-problem-modal-answer-header">
                <span style={{ color: 'var(--px-primary)' }}>{playerLabel} 답안</span>
              </div>
              <div className="code-modal-code">
                <pre>{submittedAnswer}</pre>
              </div>
            </div>
            <div className="result-problem-modal-answer-block">
              <div className="pixel-card-header result-problem-modal-answer-header">
                <span style={{ color: 'var(--px-success)' }}>실제 정답</span>
              </div>
              <div className="code-modal-code">
                <pre>{correctAnswer || '(정답 정보 없음)'}</pre>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
