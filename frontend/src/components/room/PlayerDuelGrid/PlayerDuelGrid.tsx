import type { MouseEvent } from 'react';
import { CHARACTERS } from '../../../constants/roomConstants';
import type { RoomPlayer } from '../../../types/room';
import { getTierByUserName, getTierIconByTier } from '../../../utils/tierUtils';

interface DuelSideProps {
  player: RoomPlayer | null;
  isHostSide: boolean;
  myCharacter: string;
  myLanguage: string;
  onPlayerClick?: () => void;
  onPlayerContextMenu?: (event: MouseEvent, player: RoomPlayer) => void;
}

function DuelSide({
  player,
  isHostSide: _isHostSide,
  myCharacter,
  myLanguage: _myLanguage,
  onPlayerClick,
  onPlayerContextMenu,
}: DuelSideProps) {
  const myCharIcon = CHARACTERS.find((c) => c.id === myCharacter)?.icon;

  return (
    <div
      className={`duel-side ${player ? 'occupied' : 'empty'} ${player?.isHost ? 'host' : ''}`}
      onClick={player ? onPlayerClick : undefined}
      onContextMenu={(event) => {
        if (!player || !onPlayerContextMenu) return;
        onPlayerContextMenu(event, player);
      }}
    >
      <div className="duel-avatar" style={{ color: player?.isHost ? 'var(--px-warning)' : 'var(--px-primary)' }}>
        {player ? player.character || myCharIcon : <span className="duel-empty-mark">?</span>}
      </div>
      <div className="duel-name">
        {player ? (
          <>
            <span className="duel-rank">{getTierIconByTier(player.rank || getTierByUserName(player.name))}</span>
            {player.name}
          </>
        ) : (
          'Empty'
        )}
      </div>
      <div
        className={`duel-status ${
          player
            ? player.isHost
              ? 'status-host'
              : player.isReady
                ? 'status-ready'
                : 'status-waiting'
            : 'hidden'
        }`}
      >
        {player ? (player.isHost ? 'HOST' : player.isReady ? 'READY' : 'WAITING') : ''}
      </div>
    </div>
  );
}

interface PlayerDuelGridProps {
  host: RoomPlayer | null;
  opponent: RoomPlayer | null;
  myCharacter: string;
  myLanguage: string;
  onHostClick: () => void;
  onOpponentClick: () => void;
  onPlayerContextMenu?: (event: MouseEvent, player: RoomPlayer) => void;
}

export function PlayerDuelGrid({
  host,
  opponent,
  myCharacter,
  myLanguage,
  onHostClick,
  onOpponentClick,
  onPlayerContextMenu,
}: PlayerDuelGridProps) {
  return (
    <div className="player-duel-grid">
      <DuelSide
        player={host}
        isHostSide
        myCharacter={myCharacter}
        myLanguage={myLanguage}
        onPlayerClick={onHostClick}
        onPlayerContextMenu={onPlayerContextMenu}
      />
      <div className="duel-vs">VS</div>
      <DuelSide
        player={opponent}
        isHostSide={false}
        myCharacter={myCharacter}
        myLanguage={myLanguage}
        onPlayerClick={onOpponentClick}
        onPlayerContextMenu={onPlayerContextMenu}
      />
    </div>
  );
}
