import { useMemo } from 'react';
import FillBlankRenderer from '../../../components/battle/FillBlankRenderer';
import ProblemVisualPreview from '../../../components/battle/ProblemVisualPreview';
import { resolveProblemCapabilities } from '../../../utils/problemCapabilities';
import type { PracticeExercise } from '../../../utils/practiceUtils';
import { isBlankBasedType } from '../../../utils/problemTypeUtils';

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
  const shouldRenderVisual = caps.hasVisual || caps.hasImage;

  return (
    <div className="practice-answer-box">
      {caps.showCodePanel && (
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

      {exercise.type === 'short_answer' && (
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
          {!isCorrect && exercise.type === 'multiple_choice' && exercise.correctIndex != null && (
            <div className="answer-box">
              <div style={{ fontSize: '14px', color: '#aaa', marginBottom: '4px' }}>정답:</div>
              <div style={{ color: 'var(--px-success)', fontSize: '18px' }}>
                {String.fromCharCode(65 + exercise.correctIndex)}. {exercise.options?.[exercise.correctIndex]}
              </div>
            </div>
          )}
          {!isCorrect && exercise.type === 'short_answer' && (
            <div className="answer-box">
              <div style={{ fontSize: '14px', color: '#aaa', marginBottom: '4px' }}>정답:</div>
              <div style={{ color: 'var(--px-success)', fontSize: '18px' }}>{correctAnswers[0] || ''}</div>
            </div>
          )}
          {!isCorrect && isBlankBasedType(exercise.type) && (
            <div className="answer-box">
              <div style={{ fontSize: '14px', color: '#aaa', marginBottom: '4px' }}>정답:</div>
              <div style={{ color: 'var(--px-success)', fontSize: '18px' }}>{correctAnswers.join(', ')}</div>
            </div>
          )}
          <div className="explain-box">
            <div style={{ fontSize: '14px', color: '#aaa', marginBottom: '4px' }}>해설:</div>
            <div style={{ fontSize: '16px', lineHeight: '1.5' }}>{exercise.explanation}</div>
          </div>
        </div>
      )}
    </div>
  );
}
