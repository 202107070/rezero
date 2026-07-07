import { useMemo } from 'react';
import ProblemVisualPreview from '../../../components/battle/ProblemVisualPreview';
import { resolveProblemCapabilities } from '../../../utils/problemCapabilities';
import type { PracticeExercise } from '../../../utils/practiceUtils';

interface PracticeProblemViewerProps {
  exercise: PracticeExercise;
  currentIndex: number;
  totalCount: number;
}

export function PracticeProblemViewer({ exercise, currentIndex, totalCount }: PracticeProblemViewerProps) {
  const caps = useMemo(
    () => resolveProblemCapabilities(exercise, { gameMode: 'normal' }),
    [exercise],
  );
  const shouldRenderVisual = caps.hasVisual || caps.hasImage;

  return (
    <>
      <div className="pixel-card-header">
        <span style={{ color: 'var(--px-warning)' }}>
          QUESTION {totalCount > 0 ? currentIndex + 1 : 0}/{totalCount}
        </span>
        <span style={{ fontSize: '16px', color: '#aaa' }}>{exercise.title || 'Loading...'}</span>
      </div>
      <div className="practice-prompt-box">
        {!caps.showCodePanel && (
          <div className="problem-question">{exercise.question || ''}</div>
        )}
        {shouldRenderVisual && !caps.showCodePanel && (
          <ProblemVisualPreview visual={exercise.visual} compact />
        )}
      </div>
    </>
  );
}
