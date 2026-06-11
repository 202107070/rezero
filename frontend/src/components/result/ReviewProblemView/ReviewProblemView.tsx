export interface ReviewProblemItem {
  index: number;
  title: string;
  question: string;
  myAnswer: string;
  correctAnswer: string;
  explanation: string;
  isCorrect: boolean;
}

interface ReviewProblemViewProps {
  problems: ReviewProblemItem[];
  partnerName: string;
  rankBorderColor: string;
  rankGlow: string;
  onExitReview: () => void;
}

export function ReviewProblemView({
  problems,
  partnerName,
  rankBorderColor,
  rankGlow,
  onExitReview,
}: ReviewProblemViewProps) {
  return (
    <div className="ranking-panel review-problem-panel" style={{ borderColor: rankBorderColor, boxShadow: rankGlow }}>
      <div className="rank-title">REVIEW</div>
      <div className="review-problem-partner">리뷰 파트너: {partnerName}</div>
      <div className="review-problem-list">
        {problems.map((item) => (
          <div key={item.index} className={`review-problem-card ${item.isCorrect ? 'correct' : 'wrong'}`}>
            <div className="review-problem-head">
              <span className={`problem-dot ${item.isCorrect ? 'correct' : 'wrong'}`}>{item.index + 1}</span>
              <span className="review-problem-title">{item.title}</span>
              <span className={`review-problem-badge ${item.isCorrect ? 'correct' : 'wrong'}`}>
                {item.isCorrect ? '정답' : '오답'}
              </span>
            </div>
            <div className="review-problem-question">{item.question}</div>
            <div className="review-problem-answers">
              <div>
                <span className="review-label">내 답:</span> {item.myAnswer || '(미입력)'}
              </div>
              <div>
                <span className="review-label">정답:</span> {item.correctAnswer}
              </div>
            </div>
            <div className="review-problem-explanation">
              <span className="review-label">해설:</span> {item.explanation}
            </div>
          </div>
        ))}
      </div>
      <div className="ranking-footer ranking-footer-with-review">
        <span className="ranking-footer-text">선택한 {problems.length}문제 리뷰 중</span>
        <div className="ranking-footer-actions">
          <button type="button" className="pixel-btn pixel-btn-secondary review-footer-btn" onClick={onExitReview}>
            리뷰 종료
          </button>
        </div>
      </div>
    </div>
  );
}
