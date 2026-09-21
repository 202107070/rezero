import type { MouseEvent } from 'react';
import type { ResultPlayer } from '../../../utils/resultUtils';

interface ResultPlayerRowProps {
  player: ResultPlayer;
  showRank?: boolean;
  panelClass?: string;
  departed?: boolean;
  reviewSelectMode?: boolean;
  selectedReviewProblems?: Set<number>;
  onToggleReviewProblem?: (index: number) => void;
  onOpenProblemDetail?: (index: number) => void;
  isReviewSelectable?: boolean;
  inviteSelectable?: boolean;
  inviteSelected?: boolean;
  onInviteSelect?: () => void;
  onNicknameContextMenu?: (event: MouseEvent, player: ResultPlayer) => void;
}

export function ResultPlayerRow({
  player,
  showRank,
  panelClass,
  departed = false,
  reviewSelectMode = false,
  selectedReviewProblems,
  onToggleReviewProblem,
  onOpenProblemDetail,
  isReviewSelectable = false,
  inviteSelectable = false,
  inviteSelected = false,
  onInviteSelect,
  onNicknameContextMenu,
}: ResultPlayerRowProps) {
  const canSelectDots = reviewSelectMode && isReviewSelectable;
  const canOpenDetail = !reviewSelectMode && !!onOpenProblemDetail;

  const ratingDeltaLabel =
    player.delta > 0 ? ` +${player.delta}` : player.delta < 0 ? ` ${player.delta}` : '';
  const ratingAfter = Math.max(0, (Number(player.ratingScore) || 0) + (Number(player.delta) || 0));
  const completion =
    Number.isFinite(player.completionTime) && player.completionTime > 0
      ? player.completionTime
      : player.totalSolveTime;
  const solveTimeLabel = completion > 0 && Number.isFinite(completion) ? `${completion.toFixed(1)}s` : '—';

  const rowContent = (
    <>
      {showRank && <div className={`rank-number${player.rank <= 3 ? ` rank-${player.rank}` : ''}`}>{player.rank}</div>}
      <div className="player-avatar">{player.avatar}</div>
      <div className="player-info-col">
        <div
          className="player-nickname"
          onContextMenu={(event) => {
            if (!onNicknameContextMenu) return;
            onNicknameContextMenu(event, player);
          }}
        >
          {player.name}
        </div>
        {player.problemResults.length > 0 && (
          <div className="player-problem-dots-wrap">
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
                if (canOpenDetail) {
                  return (
                    <button
                      key={index}
                      type="button"
                      className={`problem-dot ${correct ? 'correct' : 'wrong'} clickable`}
                      title={`문제 ${index + 1} 보기 (${correct ? '정답' : '오답'})`}
                      onClick={() => onOpenProblemDetail(index)}
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
            {(canOpenDetail || canSelectDots) && (
              <div className="player-problem-hint">문제를 확인하세요.</div>
            )}
          </div>
        )}
      </div>
      <div className="player-score-info">
        <span className="player-solve-time">총 풀이 시간: {solveTimeLabel}</span>
        <span className="score-val">배틀 인게임 점수: {player.ingameScore.toLocaleString()}</span>
        <span className="player-rating-info">
          레이팅: {ratingAfter}
          {ratingDeltaLabel}
        </span>
      </div>
    </>
  );

  const rowClass = `player-row${showRank ? '' : ' no-rank'}${panelClass ? ` ${panelClass}` : ''}${departed ? ' departed' : ''}${inviteSelected ? ' invite-selected' : ''}${inviteSelectable ? ' invite-selectable' : ''}`;

  if (inviteSelectable && onInviteSelect) {
    return (
      <button type="button" className={rowClass} onClick={onInviteSelect}>
        {rowContent}
      </button>
    );
  }

  return <div className={rowClass}>{rowContent}</div>;
}
