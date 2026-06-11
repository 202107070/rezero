import type { ResultPlayer } from '../../../utils/resultUtils';
import { ResultPlayerRow } from '../ResultPlayerRow/ResultPlayerRow';
import { ResultReviewFooter } from '../ResultReviewFooter/ResultReviewFooter';

interface ResultRankingPanelProps {
  players: ResultPlayer[];
  rankBorderColor: string;
  rankGlow: string;
  departedUserIds?: Set<string>;
  myUserId: string;
  reviewSelectMode: boolean;
  selectedReviewProblems: Set<number>;
  onToggleReviewProblem: (index: number) => void;
  onStartReview: () => void;
  onCancelReview: () => void;
  onRequestReview: () => void;
}

export function ResultRankingPanel({
  players,
  rankBorderColor,
  rankGlow,
  departedUserIds,
  myUserId,
  reviewSelectMode,
  selectedReviewProblems,
  onToggleReviewProblem,
  onStartReview,
  onCancelReview,
  onRequestReview,
}: ResultRankingPanelProps) {
  return (
    <div className="ranking-panel" style={{ borderColor: rankBorderColor, boxShadow: rankGlow }}>
      <div className="rank-title">RANKING</div>
      <div className="player-list">
        {players.map((p) => (
          <ResultPlayerRow
            key={p.id}
            player={p}
            showRank
            panelClass={`rank-${p.rank <= 3 ? p.rank : ''}`}
            departed={departedUserIds?.has(p.id) ?? false}
            reviewSelectMode={reviewSelectMode}
            selectedReviewProblems={selectedReviewProblems}
            onToggleReviewProblem={onToggleReviewProblem}
            isReviewSelectable={p.id === myUserId}
          />
        ))}
      </div>
      <ResultReviewFooter
        playerCount={players.length}
        reviewSelectMode={reviewSelectMode}
        selectedCount={selectedReviewProblems.size}
        onStartReview={onStartReview}
        onCancelReview={onCancelReview}
        onRequestReview={onRequestReview}
      />
    </div>
  );
}
