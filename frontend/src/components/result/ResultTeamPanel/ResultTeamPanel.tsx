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
}

export function ResultTeamPanel({
  variant,
  players,
  departedUserIds,
  myUserId,
  reviewSelectMode = false,
  selectedReviewProblems,
  onToggleReviewProblem,
}: ResultTeamPanelProps) {
  const isWin = variant === 'win';
  const deltaSum = players.reduce((sum, p) => sum + (isWin ? Math.abs(p.delta) : p.delta), 0);
  const footerLabel = isWin ? `WIN + ${deltaSum}` : `LOSE ${deltaSum}`;

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
            isReviewSelectable={!!myUserId && p.id === myUserId}
          />
        ))}
      </div>
      <div className="team-footer">
        <div className="team-footer-inner">{footerLabel}</div>
      </div>
    </div>
  );
}
