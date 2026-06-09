import type { PracticeExercise } from '../../../utils/practiceUtils';

interface PracticeProgressPanelProps {
  exercises: PracticeExercise[];
  currentIndex: number;
  checked: Set<number>;
  progressPct: number;
  langKey: string;
  userAnswers: number[];
  blankAnswers: string[][];
  isExerciseCorrect: (
    ex: PracticeExercise,
    idx: number,
    lang: string,
    userAnswers: number[],
    blankAnswers: string[][],
  ) => boolean;
  onSelectIndex: (idx: number) => void;
}

export function PracticeProgressPanel({
  exercises,
  currentIndex,
  checked,
  progressPct,
  langKey,
  userAnswers,
  blankAnswers,
  isExerciseCorrect,
  onSelectIndex,
}: PracticeProgressPanelProps) {
  return (
    <div className="pixel-card" style={{ width: '300px', minHeight: 0, flexShrink: 0 }}>
      <div className="pixel-card-header" style={{ justifyContent: 'center' }}>
        <span>PROBLEM SET</span>
      </div>
      <div style={{ padding: '8px 10px' }}>
        <div style={{ fontSize: '12px', color: '#aaa', marginBottom: '6px' }}>진행도</div>
        <div className="progress-track">
          <div className="progress-fill" style={{ width: `${progressPct}%` }} />
        </div>
      </div>
      <div className="user-list">
        {exercises.map((ex, idx) => {
          let cls = '';
          if (checked.has(idx)) {
            const correct = isExerciseCorrect(ex, idx, langKey, userAnswers, blankAnswers);
            cls = correct ? 'solved' : 'wrong';
          } else if (idx === currentIndex) {
            cls = 'me';
          }
          return (
            <div className={`user-item ${cls}`} key={ex.id || idx} onClick={() => onSelectIndex(idx)}>
              <div className="user-avatar" style={{ fontSize: '1.2rem' }}>
                {checked.has(idx) ? (cls === 'solved' ? 'O' : 'X') : idx === currentIndex ? '▶' : '□'}
              </div>
              <div className="user-info">
                <div>문제 {idx + 1}</div>
                <div style={{ fontSize: '13px', color: '#aaa' }}>{ex.title || ''}</div>
              </div>
              <div
                className="user-score"
                style={{ color: checked.has(idx) ? (cls === 'solved' ? 'var(--px-success)' : 'var(--px-danger)') : '#777' }}
              >
                {checked.has(idx) ? (cls === 'solved' ? '정답' : '오답') : '미풀이'}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
