import type { MouseEvent } from 'react';
import { CharacterAvatar } from '../../common/CharacterAvatar';
import type { RoomPlayer } from '../../../types/room';
import { getTierIconByTier } from '../../../utils/tierUtils';

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
  return (
    <div
      className={`duel-side ${player ? 'occupied' : 'empty'} ${player?.isHost ? 'host' : ''}`}
      onClick={player ? onPlayerClick : undefined}
      onContextMenu={(event) => {
        if (!player || !onPlayerContextMenu) return;
        onPlayerContextMenu(event, player);
      }}
    >
      <div className="duel-avatar">
        {player ? (
          <CharacterAvatar character={player.character || myCharacter} />
        ) : (
          <span className="duel-empty-mark">?</span>
        )}
      </div>
      <div className="duel-name">
        {player ? (
          <>
            <span className="duel-rank">{getTierIconByTier(player.rank || '브론즈')}</span>
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
