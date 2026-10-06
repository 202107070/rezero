import type { MouseEvent } from 'react';
import type { ResultPlayer } from '../../../utils/resultUtils';

function formatSolveDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '—';
  const total = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(total / 60);
  const remain = total % 60;
  return `${minutes}분 ${remain}초`;
}

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
  reviewPulse?: number;
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
  reviewPulse = 0,
  inviteSelectable = false,
  inviteSelected = false,
  onInviteSelect,
  onNicknameContextMenu,
}: ResultPlayerRowProps) {
  const canSelectDots = reviewSelectMode && isReviewSelectable;
  const canOpenDetail = !!onOpenProblemDetail && !canSelectDots;

  const ratingBase = Math.max(0, Number(player.ratingScore) || 0);
  const ratingDeltaLabel =
    player.delta > 0 ? ` + ${player.delta}` : player.delta < 0 ? ` ${player.delta}` : '';
  const solveSeconds =
    Number.isFinite(player.totalSolveTime) && player.totalSolveTime > 0
      ? player.totalSolveTime
      : 0;
  const solveTimeLabel = formatSolveDuration(solveSeconds);

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
              <div className="player-problem-hint">
                {canSelectDots ? '내 문제를 선택하세요.' : '문제를 확인하세요.'}
              </div>
            )}
          </div>
        )}
      </div>
      <div className="player-score-info">
        <span className="player-solve-time">총 풀이 시간: {solveTimeLabel}</span>
        <span className="score-val">배틀 인게임 점수: {player.ingameScore.toLocaleString()}</span>
        <span className="player-rating-info">
          레이팅: {ratingBase}
          {ratingDeltaLabel}
        </span>
      </div>
    </>
  );

  const rowClass = `player-row${showRank ? '' : ' no-rank'}${panelClass ? ` ${panelClass}` : ''}${departed ? ' departed' : ''}${inviteSelected ? ' invite-selected' : ''}${inviteSelectable ? ' invite-selectable' : ''}${canSelectDots ? ' review-select-mine' : ''}`;

  if (inviteSelectable && onInviteSelect) {
    return (
      <button type="button" key={canSelectDots ? reviewPulse : undefined} className={rowClass} onClick={onInviteSelect}>
        {rowContent}
      </button>
    );
  }

  return (
    <div key={canSelectDots ? reviewPulse : undefined} className={rowClass}>
      {rowContent}
    </div>
  );
}
