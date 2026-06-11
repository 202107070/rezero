import { CHARACTERS, LANGUAGES } from '../../../constants/roomConstants';
import type { RoomPlayer } from '../../../types/room';

interface DuelSideProps {
  player: RoomPlayer | null;
  isHostSide: boolean;
  myCharacter: string;
  myLanguage: string;
  canInvite: boolean;
  onPlayerClick?: () => void;
  onInvite?: () => void;
}

function DuelSide({ player, isHostSide, myCharacter, myLanguage, canInvite, onPlayerClick, onInvite }: DuelSideProps) {
  const myCharIcon = CHARACTERS.find((c) => c.id === myCharacter)?.icon;
  const myLangIcon = LANGUAGES.find((l) => l.id === myLanguage)?.icon;
  const clickable = player ? onPlayerClick : canInvite ? onInvite : undefined;

  return (
    <div
      className={`duel-side ${player ? 'occupied' : 'empty'} ${player?.isHost ? 'host' : ''} ${!player && canInvite ? 'invite' : ''}`}
      onClick={clickable}
    >
      <div className="duel-avatar" style={{ color: player?.isHost ? 'var(--px-warning)' : 'var(--px-primary)' }}>
        {player ? (isHostSide ? myCharIcon : player.character) : <span className="duel-empty-mark">?</span>}
      </div>
      <div className="duel-name">
        {player ? (
          <>
            <span className="duel-lang">{isHostSide ? myLangIcon : player.language}</span>
            {player.name}
          </>
        ) : canInvite ? (
          '🤖 봇 초대'
        ) : (
          '대기 중'
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
  canInviteOpponent: boolean;
  onHostClick: () => void;
  onOpponentClick: () => void;
  onInviteOpponent: () => void;
}

export function PlayerDuelGrid({
  host,
  opponent,
  myCharacter,
  myLanguage,
  canInviteOpponent,
  onHostClick,
  onOpponentClick,
  onInviteOpponent,
}: PlayerDuelGridProps) {
  return (
    <div className="player-duel-grid">
      <DuelSide
        player={host}
        isHostSide
        myCharacter={myCharacter}
        myLanguage={myLanguage}
        canInvite={false}
        onPlayerClick={onHostClick}
      />
      <div className="duel-vs">VS</div>
      <DuelSide
        player={opponent}
        isHostSide={false}
        myCharacter={myCharacter}
        myLanguage={myLanguage}
        canInvite={canInviteOpponent}
        onPlayerClick={onOpponentClick}
        onInvite={onInviteOpponent}
      />
    </div>
  );
}
