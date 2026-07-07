import type { MouseEvent } from 'react';
import type { ResultPlayer } from '../../../utils/resultUtils';
import { ResultPlayerRow } from '../ResultPlayerRow/ResultPlayerRow';

interface ResultTeamPanelProps {
  variant: 'win' | 'lose';
  players: ResultPlayer[];
  departedUserIds?: Set<string>;
  myUserId?: string;
  reviewSelectMode?: boolean;
  selectedReviewProblems?: Set<number>;
  onToggleReviewProblem?: (index: number) => void;
  onOpenProblemDetail?: (player: ResultPlayer, problemIndex: number) => void;
  onNicknameContextMenu?: (event: MouseEvent, player: ResultPlayer) => void;
}

export function ResultTeamPanel({
  variant,
  players,
  departedUserIds,
  myUserId,
  reviewSelectMode = false,
  selectedReviewProblems,
  onToggleReviewProblem,
  onOpenProblemDetail,
  onNicknameContextMenu,
}: ResultTeamPanelProps) {
  const isWin = variant === 'win';
  const deltaSum = players.reduce((sum, player) => sum + player.delta, 0);
  const footerLabel = isWin ? `WIN + ${Math.abs(deltaSum)}` : `LOSE - ${Math.abs(deltaSum)}`;

  return (
    <div className={`team-panel ${variant}`}>
      <div className="team-title">{isWin ? 'WIN' : 'LOSE'}</div>
      <div className="player-list">
        {players.map((p) => (
          <ResultPlayerRow
            key={p.id}
            player={p}
            departed={departedUserIds?.has(p.id) ?? false}
            reviewSelectMode={reviewSelectMode}
            selectedReviewProblems={selectedReviewProblems}
            onToggleReviewProblem={onToggleReviewProblem}
            onOpenProblemDetail={
              onOpenProblemDetail ? (index) => onOpenProblemDetail(p, index) : undefined
            }
            isReviewSelectable={!!myUserId && p.id === myUserId}
            onNicknameContextMenu={onNicknameContextMenu}
          />
        ))}
      </div>
      <div className="team-footer">
        <div className="team-footer-inner">{footerLabel}</div>
      </div>
    </div>
  );
}
