interface ResultReviewFooterProps {
  playerCount: number;
  reviewSelectMode: boolean;
  selectedCount: number;
  reviewBlocked?: boolean;
  onStartReview: () => void;
  onCancelReview: () => void;
  onRequestReview: () => void;
}

export function ResultReviewFooter({
  playerCount,
  reviewSelectMode,
  selectedCount,
  reviewBlocked = false,
  onStartReview,
  onCancelReview,
  onRequestReview,
}: ResultReviewFooterProps) {
  return (
    <div className="ranking-footer ranking-footer-with-review">
      <span className="ranking-footer-text">
        {reviewBlocked
          ? '상대가 대기방 또는 로비에 있어 리뷰할 수 없습니다'
          : reviewSelectMode
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
              disabled={reviewBlocked}
            >
              리뷰 요청
            </button>
          </>
        ) : (
          <button
            type="button"
            className="pixel-btn pixel-btn-primary review-footer-btn"
            onClick={onStartReview}
            disabled={reviewBlocked}
          >
            리뷰하기
          </button>
        )}
      </div>
    </div>
  );
}
