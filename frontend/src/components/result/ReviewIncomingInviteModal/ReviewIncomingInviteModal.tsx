/** 실제 유저 매칭 시 초대 수신측에 표시 (현재는 봇 자동 수락으로 미사용, 구조만 유지) */
interface ReviewIncomingInviteModalProps {
  show: boolean;
  fromUserName: string;
  problemCount: number;
  onAccept: () => void;
  onReject: () => void;
}

export function ReviewIncomingInviteModal({
  show,
  fromUserName,
  problemCount,
  onAccept,
  onReject,
}: ReviewIncomingInviteModalProps) {
  if (!show) return null;

  return (
    <div className="review-modal-overlay">
      <div className="review-modal-panel ranking-panel">
        <div className="rank-title">REVIEW INVITE</div>
        <div className="review-incoming-msg">
          <strong>{fromUserName}</strong>님이 {problemCount}문제 리뷰에 초대했습니다.
        </div>
        <div className="review-modal-actions">
          <button type="button" className="pixel-btn pixel-btn-primary review-modal-btn" onClick={onAccept}>
            수락
          </button>
          <button type="button" className="pixel-btn pixel-btn-secondary review-modal-btn" onClick={onReject}>
            거절
          </button>
        </div>
      </div>
    </div>
  );
}
