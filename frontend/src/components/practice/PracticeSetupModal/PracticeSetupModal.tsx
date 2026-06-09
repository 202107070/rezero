interface PracticeSetupModalProps {
  lang: string;
  diff: string;
  type: string;
  count: number;
  onLangChange: (value: string) => void;
  onDiffChange: (value: string) => void;
  onTypeChange: (value: string) => void;
  onCountChange: (value: number) => void;
  onStart: () => void;
}

export function PracticeSetupModal({
  lang,
  diff,
  type,
  count,
  onLangChange,
  onDiffChange,
  onTypeChange,
  onCountChange,
  onStart,
}: PracticeSetupModalProps) {
  return (
    <div className="setup-overlay">
      <div className="setup-box">
        <div className="setup-title">PRACTICE SETUP</div>
        <div className="setup-row">
          <div className="setup-label">언어</div>
          <select className="setup-select" value={lang} onChange={(e) => onLangChange(e.target.value)}>
            <option value="JAVA">JAVA</option>
            <option value="PYTHON">PYTHON</option>
            <option value="CPP">C++</option>
          </select>
        </div>
        <div className="setup-row">
          <div className="setup-label">난이도</div>
          <select className="setup-select" value={diff} onChange={(e) => onDiffChange(e.target.value)}>
            <option value="mixed">모든 난이도</option>
            <option value="easy">하 (예약어)</option>
            <option value="medium">중 (함수/배열)</option>
            <option value="hard">상 (포인터/알고리즘)</option>
          </select>
        </div>
        <div className="setup-row">
          <div className="setup-label">유형</div>
          <select className="setup-select" value={type} onChange={(e) => onTypeChange(e.target.value)}>
            <option value="mixed">모든 유형</option>
            <option value="multiple_choice">객관식</option>
            <option value="fill_blank">빈칸채우기</option>
            <option value="short_answer">주관식</option>
          </select>
        </div>
        <div className="setup-row">
          <div className="setup-label">문제 수 (3~90)</div>
          <div className="setup-count-row">
            <input
              className="setup-count-input"
              type="number"
              min={3}
              max={90}
              value={count}
              onChange={(e) => onCountChange(Math.max(3, Math.min(90, parseInt(e.target.value, 10) || 10)))}
            />
            <span className="setup-count-label">문제</span>
          </div>
        </div>
        <button
          type="button"
          className="pixel-btn pixel-btn-primary"
          onClick={onStart}
          style={{ marginTop: '8px', justifyContent: 'center' }}
        >
          START PRACTICE
        </button>
      </div>
    </div>
  );
}
