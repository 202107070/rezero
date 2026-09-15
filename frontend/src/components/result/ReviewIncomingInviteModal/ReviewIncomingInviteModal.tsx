interface ReviewProblemPreview {
  index: number;
  title?: string;
  question?: string;
}

interface ReviewIncomingInviteModalProps {
  show: boolean;
  fromUserName: string;
  problemCount: number;
  problems?: ReviewProblemPreview[];
  onAccept: () => void;
  onReject: () => void;
}

export function ReviewIncomingInviteModal({
  show,
  fromUserName,
  problemCount,
  problems = [],
  onAccept,
  onReject,
}: ReviewIncomingInviteModalProps) {
  if (!show) return null;

  return (
    <div className="review-modal-overlay">
      <div className="review-modal-panel ranking-panel review-incoming-panel">
        <div className="rank-title">REVIEW INVITE</div>
        <div className="review-incoming-msg">
          <strong>{fromUserName}</strong>님이 {problemCount}문제 리뷰에 초대했습니다.
        </div>
        <div className="review-incoming-list">
          {problems.length === 0 ? (
            <div className="review-incoming-empty">선택된 문제 정보가 없습니다.</div>
          ) : (
            problems.map((problem) => (
              <div key={problem.index} className="review-incoming-item">
                <div className="review-incoming-item-head">
                  <span className="review-incoming-no">문제 {problem.index + 1}</span>
                  <span className="review-incoming-title">{problem.title || `Problem ${problem.index + 1}`}</span>
                </div>
                <div className="review-incoming-question">
                  {problem.question || '(문제 본문 없음)'}
                </div>
              </div>
            ))
          )}
        </div>
        <div className="review-modal-actions review-modal-actions-end">
          <button type="button" className="pixel-btn pixel-btn-secondary review-modal-btn" onClick={onReject}>
            거절
          </button>
          <button type="button" className="pixel-btn pixel-btn-primary review-modal-btn" onClick={onAccept}>
            수락
          </button>
        </div>
      </div>
    </div>
  );
}
