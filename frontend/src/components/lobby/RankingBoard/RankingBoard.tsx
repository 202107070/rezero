import { TITLE_DEFS } from '../../../constants/titleTypes';
import { getEquippedTitle, type TitleData } from '../../../constants/titleTypes';
import type { LobbyUser } from '../../../types/lobby';

const TIER_ORDER: Record<string, number> = {
  마스터: 6,
  다이아: 5,
  플래티넘: 4,
  골드: 3,
  실버: 2,
  브론즈: 1,
};

const TIER_ICONS: Record<string, string> = {
  브론즈: '🥉',
  실버: '🥈',
  골드: '🥇',
  플래티넘: '💠',
  다이아: '💎',
  마스터: '👑',
};

interface RankingBoardProps {
  users: LobbyUser[];
  activeTab: string;
  titleData: TitleData;
  onTabChange: (tab: string) => void;
}

function UserTitleBadge({ titleId }: { titleId: string | null }) {
  if (!titleId) return null;
  const td = TITLE_DEFS.find((t) => t.id === titleId);
  if (!td) return null;
  return (
    <span style={{ marginLeft: '6px', fontSize: '11px' }} className={`title-badge rarity-${td.rarity}`}>
      {td.icon} {td.name}
    </span>
  );
}

const MY_USER_NAME = 'rocky_user';

function sortUsersForTab(users: LobbyUser[], activeTab: string) {
  if (activeTab === '랭킹') {
    return [...users].sort((a, b) => (TIER_ORDER[b.rank] || 0) - (TIER_ORDER[a.rank] || 0));
  }

  const list = [...users];
  const myIndex = list.findIndex((user) => user.name === MY_USER_NAME);
  if (myIndex > 0) {
    const [me] = list.splice(myIndex, 1);
    list.unshift(me);
  }
  return list;
}

export function RankingBoard({ users, activeTab, titleData, onTabChange }: RankingBoardProps) {
  const sortedUsers = sortUsersForTab(users, activeTab);

  const myEquipped = getEquippedTitle(titleData);

  return (
    <div className="pixel-card d-flex flex-column lobby-ranking-panel">
      <div
        style={{
          fontSize: '14px',
          color: 'var(--px-primary)',
          textAlign: 'left',
          border: '2px solid var(--px-primary)',
          display: 'inline-block',
          padding: '2px 8px',
          marginBottom: '4px',
          width: 'fit-content',
        }}
      >
        👥 유저 목록
      </div>
      <div className="d-flex gap-2 mb-1">
        <button
          type="button"
          className={`tab-btn ${activeTab === '일반' ? 'active' : ''}`}
          onClick={() => onTabChange('일반')}
        >
          일반
        </button>
        <button
          type="button"
          className={`tab-btn ${activeTab === '랭킹' ? 'active' : ''}`}
          onClick={() => onTabChange('랭킹')}
        >
          랭킹
        </button>
      </div>
      <div style={{ overflowY: 'auto', flex: '1 1 0', minHeight: 0 }}>
        <table className="data-table" style={{ color: '#ddd' }}>
          <thead>
            <tr>
              <th>티어</th>
              <th>닉네임</th>
            </tr>
          </thead>
          <tbody>
            {sortedUsers.map((u, i) => (
              <tr key={`${activeTab}-${i}`}>
                <td className="pixel-text-warning">
                  <span className="tier-icon-wrap">{TIER_ICONS[u.rank] || '⭐'}</span>
                  {u.rank}
                </td>
                <td>
                  {u.name === MY_USER_NAME ? (
                    <>
                      <strong style={{ color: 'var(--px-warning)' }}>{u.name}</strong>
                      {myEquipped && (
                        <span style={{ marginLeft: '6px', fontSize: '11px' }} className={`title-badge rarity-${myEquipped.rarity}`}>
                          {myEquipped.icon} {myEquipped.name}
                        </span>
                      )}
                    </>
                  ) : (
                    <>
                      {u.name}
                      <UserTitleBadge titleId={u.title} />
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
