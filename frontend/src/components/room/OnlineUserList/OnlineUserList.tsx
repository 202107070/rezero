import { TITLE_DEFS, loadTitles } from '../../../constants/titleTypes';
import { CHARACTERS } from '../../../constants/roomConstants';
import type { RoomPlayer } from '../../../types/room';

interface OnlineUserListProps {
  players: (RoomPlayer | null)[];
  myCharacter: string;
  onPlayerClick: (player: RoomPlayer, index: number) => void;
  expanded?: boolean;
}

function getEquippedTitleBadge() {
  try {
    const d = loadTitles();
    return TITLE_DEFS.find((td) => td.id === d?.equipped) ?? null;
  } catch {
    return null;
  }
}

function titleRarityStyle(rarity: string) {
  const rc =
    rarity === 'legendary'
      ? 'var(--px-warning)'
      : rarity === 'rare'
        ? 'var(--px-primary)'
        : rarity === 'uncommon'
          ? 'var(--px-success)'
          : '#aaa';
  const bg =
    rarity === 'legendary'
      ? 'rgba(247,213,29,0.1)'
      : rarity === 'rare'
        ? 'rgba(32,156,238,0.1)'
        : rarity === 'uncommon'
          ? 'rgba(146,204,65,0.1)'
          : 'rgba(170,170,170,0.08)';
  return { color: rc, borderColor: rc, background: bg };
}

function TitleBadgeForUser() {
  const t = getEquippedTitleBadge();
  if (!t) return null;

  const style = titleRarityStyle(t.rarity);

  return (
    <span className="online-user-title-badge" style={style}>
      {t.icon} {t.name}
    </span>
  );
}

export function OnlineUserList({ players, myCharacter, onPlayerClick, expanded = false }: OnlineUserListProps) {
  const occupied = players.filter((p): p is RoomPlayer => p !== null);
  const myCharIcon = CHARACTERS.find((c) => c.id === myCharacter)?.icon;

  return (
    <div className="panel-section online-user-panel">
      <div className="section-title" style={{ fontSize: '18px', textAlign: 'center', marginBottom: '6px' }}>
        USER STATUS
      </div>
      <div className={`online-user-card${expanded ? ' expanded' : ''}`}>
        {occupied.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#666', fontSize: '16px', padding: '8px 0' }}>
            접속 중인 유저가 없습니다
          </div>
        ) : (
          players.map(
            (p, idx) =>
              p && (
                <div className="online-user-row" key={idx} onClick={() => onPlayerClick(p, idx)}>
                  <div className="online-user-avatar">{idx === 0 ? myCharIcon : p.character}</div>
                  <div className="online-user-info">
                    <div className="online-user-name">
                      <span style={idx === 0 ? { fontWeight: 'bold', color: 'var(--px-warning)' } : undefined}>
                        {(p.name || 'Unknown').replace(' (나)', '')}
                      </span>
                    </div>
                    {idx === 0 && <TitleBadgeForUser />}
                  </div>
                  <div className={`online-indicator ${p.isReady ? 'ready' : 'waiting'}`}>●</div>
                </div>
              ),
          )
        )}
      </div>
    </div>
  );
}
