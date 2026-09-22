import type { MouseEvent } from 'react';
import type { RoomPlayer } from '../../../types/room';
import { PlayerDuelGrid } from '../PlayerDuelGrid/PlayerDuelGrid';
import { PlayerSlot } from '../PlayerSlot/PlayerSlot';

interface PlayerGridProps {
  players: (RoomPlayer | null)[];
  roomMode: string;
  myCharacter: string;
  myLanguage: string;
  onPlayerClick: (player: RoomPlayer, index: number) => void;
  onPlayerContextMenu?: (event: MouseEvent, player: RoomPlayer) => void;
}

export function PlayerGrid({
  players,
  roomMode,
  myCharacter,
  myLanguage,
  onPlayerClick,
  onPlayerContextMenu,
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
        onHostClick={() => host && onPlayerClick(host, 0)}
        onOpponentClick={() => opponent && onPlayerClick(opponent, opponentIndex)}
        onPlayerContextMenu={onPlayerContextMenu}
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
          onClick={p ? () => onPlayerClick(p, idx) : undefined}
          onContextMenu={onPlayerContextMenu}
        />
      ))}
    </div>
  );
}
