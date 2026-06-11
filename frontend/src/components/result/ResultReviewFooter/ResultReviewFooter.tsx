interface ResultReviewFooterProps {
  playerCount: number;
  reviewSelectMode: boolean;
  selectedCount: number;
  onStartReview: () => void;
  onCancelReview: () => void;
  onRequestReview: () => void;
}

export function ResultReviewFooter({
  playerCount,
  reviewSelectMode,
  selectedCount,
  onStartReview,
  onCancelReview,
  onRequestReview,
}: ResultReviewFooterProps) {
  return (
    <div className="ranking-footer ranking-footer-with-review">
      <span className="ranking-footer-text">
        {reviewSelectMode
          ? `리뷰할 문제를 선택하세요 (${selectedCount}개)`
          : `총 ${playerCount}명 참가`}
      </span>
      <div className="ranking-footer-actions">
        {reviewSelectMode ? (
          <>
            <button type="button" className="pixel-btn pixel-btn-secondary review-footer-btn" onClick={onCancelReview}>
              취소
            </button>
            <button
              type="button"
              className="pixel-btn pixel-btn-primary review-footer-btn"
              onClick={onRequestReview}
              disabled={selectedCount === 0}
            >
              리뷰 요청
            </button>
          </>
        ) : (
          <button type="button" className="pixel-btn pixel-btn-primary review-footer-btn" onClick={onStartReview}>
            리뷰하기
          </button>
        )}
      </div>
    </div>
  );
}
