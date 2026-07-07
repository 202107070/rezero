import type { MouseEvent } from 'react';
import { CHARACTERS } from '../../../constants/roomConstants';
import type { RoomPlayer } from '../../../types/room';
import { getTierByUserName, getTierIconByTier } from '../../../utils/tierUtils';

interface PlayerSlotProps {
  player: RoomPlayer | null;
  index: number;
  myCharacter: string;
  myLanguage: string;
  canInvite?: boolean;
  onClick?: () => void;
  onInvite?: () => void;
  onContextMenu?: (event: MouseEvent, player: RoomPlayer) => void;
}

export function PlayerSlot({
  player,
  index,
  myCharacter,
  myLanguage: _myLanguage,
  canInvite,
  onClick,
  onInvite,
  onContextMenu,
}: PlayerSlotProps) {
  const myCharIcon = CHARACTERS.find((c) => c.id === myCharacter)?.icon;

  return (
    <div
      className={`player-slot ${player ? 'occupied' : 'empty'} ${player?.isHost ? 'host' : ''} ${!player && canInvite ? 'invite' : ''}`}
      onClick={player ? onClick : canInvite ? onInvite : undefined}
      onContextMenu={(event) => {
        if (!player || !onContextMenu) return;
        onContextMenu(event, player);
      }}
    >
      <div className="slot-avatar" style={{ color: player?.isHost ? 'var(--px-warning)' : 'var(--px-primary)' }}>
        {player ? (index === 0 ? myCharIcon : player.character) : <span className="status-empty">X</span>}
      </div>
      <div className="slot-name" style={{ color: player ? '#ddd' : '#555' }}>
        {player ? (
          <>
            <span className="slot-rank">{getTierIconByTier(player.rank || getTierByUserName(player.name))}</span>
            {player.name}
          </>
        ) : canInvite ? (
          '🤖 봇 초대'
        ) : (
          'Empty'
        )}
      </div>
      <div
        className={`slot-status ${
          player
            ? player.isHost
              ? 'status-host'
              : player.isReady
                ? 'status-ready'
                : 'status-waiting'
            : ''
        }`}
        style={!player ? { visibility: 'hidden' } : undefined}
      >
        {player ? (player.isHost ? 'HOST' : player.isReady ? 'READY' : 'WAITING') : ''}
      </div>
      <div className="slot-button-area">
        <div style={{ width: '1px' }} />
      </div>
    </div>
  );
}
