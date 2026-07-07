import type { ResultPlayer } from '../../../utils/resultUtils';
import { ResultPlayerRow } from '../ResultPlayerRow/ResultPlayerRow';

interface ReviewInviteModalProps {
  show: boolean;
  players: ResultPlayer[];
  myUserId: string;
  rankBorderColor: string;
  rankGlow: string;
  departedUserIds?: Set<string>;
  selectedTargetIds: Set<string>;
  allowMultiple?: boolean;
  waiting: boolean;
  inviteTargetLabel?: string;
  onToggleTarget: (playerId: string) => void;
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
  selectedTargetIds,
  allowMultiple = false,
  waiting,
  inviteTargetLabel,
  onToggleTarget,
  onInvite,
  onClose,
}: ReviewInviteModalProps) {
  if (!show) return null;

  const selectedCount = selectedTargetIds.size;

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
                inviteSelected={selectedTargetIds.has(p.id)}
                onInviteSelect={!isSelf && !waiting ? () => onToggleTarget(p.id) : undefined}
              />
            );
          })}
        </div>
        <div className="ranking-footer ranking-footer-with-review">
          <span className="ranking-footer-text">
            {waiting
              ? `${inviteTargetLabel || '상대방'}님의 응답을 기다리는 중...`
              : allowMultiple
                ? `${selectedCount}명 선택 · 총 ${players.length}명 참가`
                : `총 ${players.length}명 참가`}
          </span>
          <div className="ranking-footer-actions">
            <button
              type="button"
              className="pixel-btn pixel-btn-primary review-footer-btn"
              onClick={onInvite}
              disabled={waiting || selectedCount === 0}
            >
              {allowMultiple && selectedCount > 1 ? `${selectedCount}명 초대` : '초대하기'}
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
