import type { ResultPlayer } from '../../../utils/resultUtils';
import { ResultPlayerRow } from '../ResultPlayerRow/ResultPlayerRow';

interface ReviewInviteModalProps {
  show: boolean;
  players: ResultPlayer[];
  myUserId: string;
  rankBorderColor: string;
  rankGlow: string;
  departedUserIds?: Set<string>;
  selectedTargetId: string | null;
  waiting: boolean;
  inviteTargetName?: string;
  onSelectTarget: (playerId: string) => void;
  onInvite: () => void;
  onClose: () => void;
}

export function ReviewInviteModal({
  show,
  players,
  myUserId,
  rankBorderColor,
  rankGlow,
  departedUserIds,
  selectedTargetId,
  waiting,
  inviteTargetName,
  onSelectTarget,
  onInvite,
  onClose,
}: ReviewInviteModalProps) {
  if (!show) return null;

  return (
    <div className="review-modal-overlay">
      <div className="review-modal-panel ranking-panel" style={{ borderColor: rankBorderColor, boxShadow: rankGlow }}>
        <div className="rank-title">RANKING</div>
        <div className="player-list">
          {players.map((p) => {
            const isSelf = p.id === myUserId;
            return (
              <ResultPlayerRow
                key={p.id}
                player={p}
                showRank
                panelClass={`rank-${p.rank <= 3 ? p.rank : ''}`}
                departed={departedUserIds?.has(p.id) ?? false}
                inviteSelectable={!isSelf && !waiting}
                inviteSelected={selectedTargetId === p.id}
                onInviteSelect={!isSelf && !waiting ? () => onSelectTarget(p.id) : undefined}
              />
            );
          })}
        </div>
        <div className="ranking-footer ranking-footer-with-review">
          <span className="ranking-footer-text">
            {waiting
              ? `${inviteTargetName || '상대방'}님의 응답을 기다리는 중...`
              : `총 ${players.length}명 참가`}
          </span>
          <div className="ranking-footer-actions">
            <button
              type="button"
              className="pixel-btn pixel-btn-primary review-footer-btn"
              onClick={onInvite}
              disabled={waiting || !selectedTargetId}
            >
              초대하기
            </button>
            <button
              type="button"
              className="pixel-btn pixel-btn-secondary review-footer-btn"
              onClick={onClose}
              disabled={waiting}
            >
              나가기
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
