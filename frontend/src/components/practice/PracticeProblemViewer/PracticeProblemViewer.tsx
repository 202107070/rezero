import type { PracticeExercise } from '../../../utils/practiceUtils';

interface PracticeProblemViewerProps {
  exercise: PracticeExercise;
  currentIndex: number;
  totalCount: number;
  isChecked: boolean;
  blankAnswers: string[];
  correctAnswers: string[];
  onBlankChange: (blankIdx: number, value: string) => void;
}

export function PracticeProblemViewer({
  exercise,
  currentIndex,
  totalCount,
  isChecked,
  blankAnswers,
  correctAnswers,
  onBlankChange,
}: PracticeProblemViewerProps) {
  const renderQuestion = () => {
    if (!exercise.question) return null;
    if (exercise.type === 'fill_blank') {
      const parts = exercise.question.split('_____');
      const blanks = blankAnswers;
      return (
        <div className="problem-question">
          {parts.map((part, i) => (
            <span key={i}>
              <span style={{ whiteSpace: 'pre-wrap' }}>{part}</span>
              {i < parts.length - 1 && (
                <input
                  type="text"
                  className={`blank-input ${
                    isChecked
                      ? blanks[i]?.trim().toLowerCase() === (correctAnswers[i] || '').trim().toLowerCase()
                        ? 'correct hidden'
                        : 'wrong'
                      : ''
                  }`}
                  value={blanks[i] || ''}
                  onChange={(e) => onBlankChange(i, e.target.value)}
                  disabled={isChecked}
                  style={{ width: `${Math.max(40, ((correctAnswers[i] || '').length + 1) * 14)}px` }}
                />
              )}
            </span>
          ))}
        </div>
      );
    }
    return <div className="problem-question">{exercise.question}</div>;
  };

  return (
    <>
      <div className="pixel-card-header">
        <span style={{ color: 'var(--px-warning)' }}>
          QUESTION {totalCount > 0 ? currentIndex + 1 : 0}/{totalCount}
        </span>
        <span style={{ fontSize: '16px', color: '#aaa' }}>{exercise.title || 'Loading...'}</span>
      </div>
      <div style={{ padding: '16px 16px 0', display: 'flex', flexDirection: 'column', gap: '14px' }}>{renderQuestion()}</div>
    </>
  );
}
