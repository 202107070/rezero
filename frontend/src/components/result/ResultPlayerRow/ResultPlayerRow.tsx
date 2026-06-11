import type { ResultPlayer } from '../../../utils/resultUtils';

interface ResultPlayerRowProps {
  player: ResultPlayer;
  showRank?: boolean;
  panelClass?: string;
  departed?: boolean;
  reviewSelectMode?: boolean;
  selectedReviewProblems?: Set<number>;
  onToggleReviewProblem?: (index: number) => void;
  isReviewSelectable?: boolean;
  inviteSelectable?: boolean;
  inviteSelected?: boolean;
  onInviteSelect?: () => void;
}

export function ResultPlayerRow({
  player,
  showRank,
  panelClass,
  departed = false,
  reviewSelectMode = false,
  selectedReviewProblems,
  onToggleReviewProblem,
  isReviewSelectable = false,
  inviteSelectable = false,
  inviteSelected = false,
  onInviteSelect,
}: ResultPlayerRowProps) {
  const canSelectDots = reviewSelectMode && isReviewSelectable;

  const rowContent = (
    <>
      {showRank && <div className={`rank-number${player.rank <= 3 ? ` rank-${player.rank}` : ''}`}>{player.rank}</div>}
      <div className="player-avatar">{player.avatar}</div>
      <div className="player-info-col">
        <div className="player-nickname">{player.name}</div>
        {player.problemResults.length > 0 && (
          <div className="player-problem-dots">
            {player.problemResults.map((correct, index) => {
              const selected = selectedReviewProblems?.has(index) ?? false;
              if (canSelectDots) {
                return (
                  <button
                    key={index}
                    type="button"
                    className={`problem-dot ${correct ? 'correct' : 'wrong'} selectable${selected ? ' selected' : ''}`}
                    title={`문제 ${index + 1}: ${correct ? '정답' : '오답'}`}
                    onClick={() => onToggleReviewProblem?.(index)}
                  >
                    {index + 1}
                  </button>
                );
              }
              return (
                <span
                  key={index}
                  className={`problem-dot ${correct ? 'correct' : 'wrong'}`}
                  title={`문제 ${index + 1}: ${correct ? '정답' : '오답'}`}
                >
                  {index + 1}
                </span>
              );
            })}
          </div>
        )}
      </div>
      <div className="player-score-info">
        <span style={{ fontSize: '14px', color: '#aaa' }}>
          {player.totalSolveTime > 0 ? `${player.totalSolveTime.toFixed(1)}s` : ''}
        </span>
        <span className="score-val">{player.ingameScore.toLocaleString()} PTS</span>
        <span style={{ fontSize: '12px', color: 'var(--px-text-muted)' }}>
          레이팅 {player.ratingScore}
          {player.delta > 0 ? ` +${player.delta}` : ''}
        </span>
      </div>
    </>
  );

  const rowClass = `player-row${panelClass ? ` ${panelClass}` : ''}${departed ? ' departed' : ''}${inviteSelected ? ' invite-selected' : ''}${inviteSelectable ? ' invite-selectable' : ''}`;

  if (inviteSelectable && onInviteSelect) {
    return (
      <button type="button" className={rowClass} onClick={onInviteSelect}>
        {rowContent}
      </button>
    );
  }

  return <div className={rowClass}>{rowContent}</div>;
}
