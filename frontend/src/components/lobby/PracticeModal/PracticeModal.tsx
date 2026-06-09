interface PracticeModalProps {
  open: boolean;
  practiceLang: string;
  practiceDiff: string;
  practiceCount: string;
  onClose: () => void;
  onStart: () => void;
  onLangChange: (value: string) => void;
  onDiffChange: (value: string) => void;
  onCountChange: (value: string) => void;
}

export function PracticeModal({
  open,
  practiceLang,
  practiceDiff,
  practiceCount,
  onClose,
  onStart,
  onLangChange,
  onDiffChange,
  onCountChange,
}: PracticeModalProps) {
  if (!open) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-center pixel-text-primary" style={{ marginBottom: '16px', fontSize: '22px' }}>
          PRACTICE MODE
        </h3>
        <div className="modal-row mb-4">
          <select className="modal-select-new" value={practiceLang} onChange={(e) => onLangChange(e.target.value)}>
            <option value="JAVA">언어 (JAVA)</option>
            <option value="PYTHON">언어 (PYTHON)</option>
            <option value="C++">언어 (C++)</option>
          </select>
          <select className="modal-select-new" value={practiceDiff} onChange={(e) => onDiffChange(e.target.value)}>
            <option value="쉬움">난이도 (쉬움)</option>
            <option value="보통">난이도 (보통)</option>
            <option value="어려움">난이도 (어려움)</option>
          </select>
          <select className="modal-select-new" value={practiceCount} onChange={(e) => onCountChange(e.target.value)}>
            {['3', '4', '5', '6', '7', '8', '9', '10'].map((n) => (
              <option key={n} value={n}>
                문제 {n}개
              </option>
            ))}
          </select>
        </div>
        <div className="d-flex justify-content-end gap-3">
          <button type="button" className="pixel-btn pixel-btn-primary" style={{ minWidth: '120px' }} onClick={onStart}>
            시작
          </button>
          <button type="button" className="pixel-btn pixel-btn-secondary" style={{ minWidth: '120px' }} onClick={onClose}>
            나가기
          </button>
        </div>
      </div>
    </div>
  );
}
