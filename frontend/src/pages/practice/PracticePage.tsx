import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { PracticeAnswerSection } from '../../components/practice/PracticeAnswerSection/PracticeAnswerSection';
import { PracticeHeaderBar } from '../../components/practice/PracticeHeaderBar/PracticeHeaderBar';
import { PracticeNavigator } from '../../components/practice/PracticeNavigator/PracticeNavigator';
import { PracticeProblemViewer } from '../../components/practice/PracticeProblemViewer/PracticeProblemViewer';
import { PracticeProgressPanel } from '../../components/practice/PracticeProgressPanel/PracticeProgressPanel';
import { PracticeSetupModal } from '../../components/practice/PracticeSetupModal/PracticeSetupModal';
import { ROUTES } from '../../constants/routes';
import { getLangKey } from '../../utils/battle/codeUtils';
import {
  createExercisePool,
  isExerciseCorrect,
  PRACTICE_STATE_KEY,
  type PracticeExercise,
} from '../../utils/practiceUtils';
import './practice.css';

function normalizeUrlLang(raw: string | null): string {
  if (!raw) return 'JAVA';
  if (raw === 'C++' || raw.toUpperCase() === 'CPP') return 'CPP';
  return raw.toUpperCase();
}

export default function PracticePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const urlLang = searchParams.get('lang');
  const urlCount = searchParams.get('count') ? parseInt(searchParams.get('count')!, 10) : null;
  const urlDiff = searchParams.get('diff');
  const urlType = searchParams.get('type');
  const hasUrlParams = Boolean(urlLang && urlCount);

  const [showSetup, setShowSetup] = useState(!hasUrlParams);
  const [lang, setLang] = useState(normalizeUrlLang(urlLang));
  const [diff, setDiff] = useState(urlDiff || 'mixed');
  const [type, setType] = useState(urlType || 'mixed');
  const [count, setCount] = useState(urlCount || 10);

  const [exercises, setExercises] = useState<PracticeExercise[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [checked, setChecked] = useState<Set<number>>(new Set());
  const [userAnswers, setUserAnswers] = useState<number[]>([]);
  const [blankAnswers, setBlankAnswers] = useState<string[][]>([]);

  const langKey = getLangKey(lang);
  const displayLang = langKey === 'CPP' ? 'C++' : langKey;

  const startPractice = useCallback(() => {
    const pool = createExercisePool(count, diff, type);
    setExercises(pool);
    setCurrentIndex(0);
    setChecked(new Set());
    setUserAnswers(Array(pool.length).fill(-1));
    setBlankAnswers(Array(pool.length).fill(null).map(() => []));
    setShowSetup(false);
    localStorage.removeItem(PRACTICE_STATE_KEY);
  }, [count, diff, type]);

  useEffect(() => {
    if (hasUrlParams) startPractice();
  }, [hasUrlParams, startPractice]);

  const currentEx = exercises[currentIndex] || ({} as PracticeExercise);
  const isChecked = checked.has(currentIndex);
  const selectedOption = userAnswers[currentIndex];
  const correctAnswers = currentEx.answer?.[langKey] || [];

  const isMultipleChoiceCorrect =
    isChecked && currentEx.type === 'multiple_choice' && selectedOption === currentEx.correctIndex;

  const isFillBlankCorrect = () => {
    if (currentEx.type !== 'fill_blank') return false;
    const blanks = blankAnswers[currentIndex] || [];
    if (blanks.length !== correctAnswers.length) return false;
    for (let i = 0; i < blanks.length; i++) {
      if ((blanks[i] || '').trim().toLowerCase() !== (correctAnswers[i] || '').trim().toLowerCase()) return false;
    }
    return true;
  };

  const isShortAnswerCorrect = () => {
    if (currentEx.type !== 'short_answer') return false;
    const ans = (blankAnswers[currentIndex]?.[0] || '').trim().toLowerCase();
    return ans === (correctAnswers[0] || '').trim().toLowerCase();
  };

  const isCorrect = isMultipleChoiceCorrect || isFillBlankCorrect() || isShortAnswerCorrect();

  const handleSelect = (idx: number) => {
    if (isChecked || currentEx.type !== 'multiple_choice') return;
    setUserAnswers((prev) => {
      const next = [...prev];
      next[currentIndex] = idx;
      return next;
    });
  };

  const handleBlankChange = (blankIdx: number, value: string) => {
    if (isChecked) return;
    setBlankAnswers((prev) => {
      const next = prev.map((arr) => [...arr]);
      if (!next[currentIndex]) next[currentIndex] = [];
      next[currentIndex][blankIdx] = value;
      return next;
    });
  };

  const handleShortAnswerChange = (value: string) => {
    if (isChecked) return;
    setBlankAnswers((prev) => {
      const next = prev.map((arr) => [...arr]);
      if (!next[currentIndex]) next[currentIndex] = [];
      next[currentIndex][0] = value;
      return next;
    });
  };

  const handleCheck = () => {
    if (isChecked) return;
    if (currentEx.type === 'multiple_choice') {
      if (selectedOption === -1 || selectedOption === undefined) return;
    } else if (currentEx.type === 'fill_blank') {
      const blanks = blankAnswers[currentIndex] || [];
      const required = (currentEx.question?.match(/_____/g) || []).length;
      if (blanks.length < required || blanks.some((v) => !v || v.trim() === '')) return;
    } else if (currentEx.type === 'short_answer') {
      const ans = (blankAnswers[currentIndex]?.[0] || '').trim();
      if (ans === '') return;
    }
    setChecked((prev) => new Set(prev).add(currentIndex));
  };

  const handlePrev = () => setCurrentIndex((i) => Math.max(0, i - 1));
  const handleNext = () => setCurrentIndex((i) => Math.min(exercises.length - 1, i + 1));

  const handleExit = () => {
    if (window.confirm('연습을 종료하고 로비로 돌아가시겠습니까?')) {
      localStorage.removeItem(PRACTICE_STATE_KEY);
      navigate(ROUTES.LOBBY);
    }
  };

  const solvedCount = useMemo(() => {
    let total = 0;
    for (let i = 0; i < exercises.length; i++) {
      if (!checked.has(i)) continue;
      if (isExerciseCorrect(exercises[i], i, langKey, userAnswers, blankAnswers)) total++;
    }
    return total;
  }, [checked, userAnswers, blankAnswers, exercises, langKey]);

  const progressPct = exercises.length > 0 ? (solvedCount / exercises.length) * 100 : 0;

  const canCheck = () => {
    if (isChecked) return false;
    if (currentEx.type === 'multiple_choice') return selectedOption !== -1 && selectedOption !== undefined;
    if (currentEx.type === 'fill_blank') {
      const required = (currentEx.question?.match(/_____/g) || []).length;
      const blanks = blankAnswers[currentIndex] || [];
      return blanks.length >= required && blanks.every((v) => v && v.trim() !== '');
    }
    if (currentEx.type === 'short_answer') {
      return (blankAnswers[currentIndex]?.[0] || '').trim() !== '';
    }
    return false;
  };

  return (
    <div className="page-container practice-page">
      {showSetup && (
        <PracticeSetupModal
          lang={lang}
          diff={diff}
          type={type}
          count={count}
          onLangChange={setLang}
          onDiffChange={setDiff}
          onTypeChange={setType}
          onCountChange={setCount}
          onStart={startPractice}
        />
      )}

      <PracticeHeaderBar
        displayLang={displayLang}
        solvedCount={solvedCount}
        totalCount={exercises.length}
        onOpenSetup={() => setShowSetup(true)}
      />

      <div style={{ display: 'flex', gap: '12px', flexGrow: 1, minHeight: 0 }}>
        <div className="pixel-card" style={{ flex: '2', minHeight: 0, overflow: 'auto' }}>
          <PracticeProblemViewer
            exercise={currentEx}
            currentIndex={currentIndex}
            totalCount={exercises.length}
            isChecked={isChecked}
            blankAnswers={blankAnswers[currentIndex] || []}
            correctAnswers={correctAnswers}
            onBlankChange={handleBlankChange}
          />
          <PracticeAnswerSection
            exercise={currentEx}
            isChecked={isChecked}
            isCorrect={isCorrect}
            selectedOption={selectedOption}
            shortAnswer={blankAnswers[currentIndex]?.[0] || ''}
            correctAnswers={correctAnswers}
            canCheck={canCheck()}
            onSelect={handleSelect}
            onShortAnswerChange={handleShortAnswerChange}
            onCheck={handleCheck}
          />
        </div>

        <PracticeProgressPanel
          exercises={exercises}
          currentIndex={currentIndex}
          checked={checked}
          progressPct={progressPct}
          langKey={langKey}
          userAnswers={userAnswers}
          blankAnswers={blankAnswers}
          isExerciseCorrect={isExerciseCorrect}
          onSelectIndex={setCurrentIndex}
        />
      </div>

      <PracticeNavigator
        currentIndex={currentIndex}
        totalCount={exercises.length}
        onPrev={handlePrev}
        onNext={handleNext}
        onExit={handleExit}
      />
    </div>
  );
}
