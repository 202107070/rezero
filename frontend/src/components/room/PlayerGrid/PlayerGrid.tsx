import type { RoomPlayer } from '../../../types/room';
import { PlayerDuelGrid } from '../PlayerDuelGrid/PlayerDuelGrid';
import { PlayerSlot } from '../PlayerSlot/PlayerSlot';

interface PlayerGridProps {
  players: (RoomPlayer | null)[];
  roomMode: string;
  myCharacter: string;
  myLanguage: string;
  canInviteMore: boolean;
  onPlayerClick: (player: RoomPlayer, index: number) => void;
  onInviteBot: (index: number) => void;
}

export function PlayerGrid({
  players,
  roomMode,
  myCharacter,
  myLanguage,
  canInviteMore,
  onPlayerClick,
  onInviteBot,
}: PlayerGridProps) {
  if (roomMode === '1/1') {
    const host = players[0];
    const opponentEntry = players
      .map((p, index) => ({ p, index }))
      .find(({ p, index }) => p !== null && index !== 0);
    const opponent = opponentEntry?.p ?? null;
    const opponentIndex = opponentEntry?.index ?? 1;

    return (
      <PlayerDuelGrid
        host={host}
        opponent={opponent}
        myCharacter={myCharacter}
        myLanguage={myLanguage}
        canInviteOpponent={canInviteMore && !opponent}
        onHostClick={() => host && onPlayerClick(host, 0)}
        onOpponentClick={() => opponent && onPlayerClick(opponent, opponentIndex)}
        onInviteOpponent={() => onInviteBot(1)}
      />
    );
  }

  return (
    <div className="player-grid">
      {players.map((p, idx) => (
        <PlayerSlot
          key={idx}
          player={p}
          index={idx}
          myCharacter={myCharacter}
          myLanguage={myLanguage}
          canInvite={!p && canInviteMore}
          onClick={p ? () => onPlayerClick(p, idx) : undefined}
          onInvite={() => onInviteBot(idx)}
        />
      ))}
    </div>
  );
}
