import type { ResultPlayer } from '../../../utils/resultUtils';

interface ResultPlayerRowProps {
  player: ResultPlayer;
  showRank?: boolean;
  panelClass?: string;
  departed?: boolean;
}

export function ResultPlayerRow({ player, showRank, panelClass, departed = false }: ResultPlayerRowProps) {
  return (
    <div className={`player-row${panelClass ? ` ${panelClass}` : ''}${departed ? ' departed' : ''}`}>
      {showRank && <div className={`rank-number${player.rank <= 3 ? ` rank-${player.rank}` : ''}`}>{player.rank}</div>}
      <div className="player-avatar">{player.avatar}</div>
      <div className="player-nickname">{player.name}</div>
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
    </div>
  );
}
