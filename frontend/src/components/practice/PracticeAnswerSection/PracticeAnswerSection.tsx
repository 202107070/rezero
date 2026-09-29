import { useMemo } from 'react';
import FillBlankRenderer from '../../../components/battle/FillBlankRenderer';
import ProblemVisualPreview from '../../../components/battle/ProblemVisualPreview';
import { resolveProblemCapabilities } from '../../../utils/problemCapabilities';
import type { PracticeExercise } from '../../../utils/practiceUtils';
import { getProblemAnswersForLang } from '../../../utils/problemTypeUtils';

interface PracticeAnswerSectionProps {
  exercise: PracticeExercise;
  currentIndex: number;
  isChecked: boolean;
  isCorrect: boolean;
  selectedOption: number;
  shortAnswer: string;
  blankAnswers: string[];
  correctAnswers: string[];
  canCheck: boolean;
  onSelect: (idx: number) => void;
  onShortAnswerChange: (value: string) => void;
  onBlankChange: (blankIdx: number, value: string) => void;
  onCheck: () => void;
}

export function PracticeAnswerSection({
  exercise,
  currentIndex,
  isChecked,
  isCorrect,
  selectedOption,
  shortAnswer,
  blankAnswers,
  correctAnswers,
  canCheck,
  onSelect,
  onShortAnswerChange,
  onBlankChange,
  onCheck,
}: PracticeAnswerSectionProps) {
  const caps = useMemo(
    () => resolveProblemCapabilities(exercise, { gameMode: 'normal' }),
    [exercise],
  );
  const blankMarkerCount = (exercise.question || '').match(/_____/g)?.length || 0;
  const resolvedAnswers = useMemo(() => {
    if (correctAnswers.length > 0) return correctAnswers;
    return getProblemAnswersForLang(exercise.answer, 'JAVA');
  }, [correctAnswers, exercise.answer]);
  const answerText = useMemo(() => {
    if (exercise.type === 'multiple_choice' && exercise.correctIndex != null && exercise.options?.[exercise.correctIndex]) {
      return `${String.fromCharCode(65 + exercise.correctIndex)}. ${exercise.options[exercise.correctIndex]}`;
    }
    if (resolvedAnswers.length > 0) return resolvedAnswers.join(', ');
    return '정답을 찾지 못했습니다.';
  }, [exercise.correctIndex, exercise.options, exercise.type, resolvedAnswers]);
  const treatAsFillBlank =
    caps.showCodePanel || (exercise.type === 'short_answer' && blankMarkerCount > 0);
  const shouldRenderVisual = caps.hasVisual || caps.hasImage;

  return (
    <div className="practice-answer-box">
      {treatAsFillBlank && (
        <div className="practice-code-answer">
          {shouldRenderVisual && <ProblemVisualPreview visual={exercise.visual} compact />}
          <div className="practice-code-blanks">
            <FillBlankRenderer
              code={exercise.question || ''}
              answers={blankAnswers}
              problemIndex={currentIndex}
              breakingBlanks={{}}
              isLocked={isChecked}
              onUpdate={onBlankChange}
            />
          </div>
        </div>
      )}

      {exercise.type === 'multiple_choice' && (
        <div className="options-grid">
          {(exercise.options || []).map((opt, idx) => {
            const optLabel = String.fromCharCode(65 + idx);
            let btnClass = 'option-btn';
            if (isChecked) {
              if (idx === exercise.correctIndex) btnClass += ' correct';
              else if (idx === selectedOption) btnClass += ' wrong';
            } else if (idx === selectedOption) {
              btnClass += ' selected';
            }
            return (
              <button key={idx} type="button" className={btnClass} onClick={() => onSelect(idx)} disabled={isChecked}>
                <span style={{ color: 'var(--px-warning)', marginRight: '8px' }}>{optLabel}.</span>
                {opt}
              </button>
            );
          })}
        </div>
      )}

      {exercise.type === 'short_answer' && blankMarkerCount === 0 && (
        <input
          type="text"
          className={`short-answer-input ${isChecked ? (isCorrect ? 'correct' : 'wrong') : ''}`}
          placeholder="정답을 입력하세요"
          value={shortAnswer}
          onChange={(e) => onShortAnswerChange(e.target.value)}
          disabled={isChecked}
        />
      )}

      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
        <button type="button" className="pixel-btn pixel-btn-primary" onClick={onCheck} disabled={!canCheck}>
          정답 확인
        </button>
      </div>

      {isChecked && (
        <div>
          <div
            style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '8px' }}
            className={isCorrect ? 'result-correct' : 'result-wrong'}
          >
            {isCorrect ? '정답입니다!' : '틀렸습니다!'}
          </div>
          <div className="answer-box">
            <div style={{ fontSize: '14px', color: '#aaa', marginBottom: '4px' }}>정답:</div>
            <div style={{ color: 'var(--px-success)', fontSize: '18px' }}>{answerText}</div>
          </div>
          <div className="explain-box">
            <div style={{ fontSize: '14px', color: '#aaa', marginBottom: '4px' }}>해설:</div>
            <div style={{ fontSize: '16px', lineHeight: '1.5' }}>{exercise.explanation}</div>
          </div>
        </div>
      )}
    </div>
  );
}
