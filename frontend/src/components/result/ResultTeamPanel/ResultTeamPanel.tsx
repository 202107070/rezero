import type { ResultPlayer } from '../../../utils/resultUtils';
import { ResultPlayerRow } from '../ResultPlayerRow/ResultPlayerRow';

interface ResultTeamPanelProps {
  variant: 'win' | 'lose';
  players: ResultPlayer[];
  departedUserIds?: Set<string>;
}

export function ResultTeamPanel({ variant, players, departedUserIds }: ResultTeamPanelProps) {
  const isWin = variant === 'win';
  const deltaSum = players.reduce((sum, p) => sum + (isWin ? Math.abs(p.delta) : p.delta), 0);
  const footerLabel = isWin ? `WIN + ${deltaSum}` : `LOSE ${deltaSum}`;

  return (
    <div className={`team-panel ${variant}`}>
      <div className="team-title">{isWin ? 'WIN' : 'LOSE'}</div>
      <div className="player-list">
        {players.map((p) => (
          <ResultPlayerRow key={p.id} player={p} departed={departedUserIds?.has(p.id) ?? false} />
        ))}
      </div>
      <div className="team-footer">
        <div className="team-footer-inner">{footerLabel}</div>
      </div>
    </div>
  );
}
