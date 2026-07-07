import { useCallback, useState, type MouseEvent } from 'react';
import { TITLE_DEFS } from '../../../constants/titleTypes';
import { getEquippedTitle, type TitleData } from '../../../constants/titleTypes';
import { getCurrentUserName } from '../../../services/authService';
import { getUserPresence, isFriend } from '../../../services/friendStore';
import type { LobbyUser } from '../../../types/lobby';
import {
  UserListContextMenu,
  type UserListMenuAction,
} from '../UserListContextMenu/UserListContextMenu';

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
  friendNames: string[];
  activeTab: string;
  titleData: TitleData;
  onTabChange: (tab: string) => void;
  onUserMenuAction?: (action: UserListMenuAction, user: LobbyUser) => void;
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

function sortUsersForTab(users: LobbyUser[], activeTab: string, friendNames: string[]) {
  const myUserName = getCurrentUserName();
  if (activeTab === '랭킹') {
    return [...users].sort((a, b) => (TIER_ORDER[b.rank] || 0) - (TIER_ORDER[a.rank] || 0));
  }

  if (activeTab === '친구') {
    return friendNames.map((name) => {
      const found = users.find((user) => user.name === name);
      return found ?? { name, rank: '-', title: null };
    });
  }

  const list = [...users];
  const myIndex = list.findIndex((user) => user.name === myUserName);
  if (myIndex > 0) {
    const [me] = list.splice(myIndex, 1);
    list.unshift(me);
  }
  return list;
}

export function RankingBoard({
  users,
  friendNames,
  activeTab,
  titleData,
  onTabChange,
  onUserMenuAction,
}: RankingBoardProps) {
  const myUserName = getCurrentUserName();
  const sortedUsers = sortUsersForTab(users, activeTab, friendNames);
  const myEquipped = getEquippedTitle(titleData);

  const [contextMenu, setContextMenu] = useState<{
    open: boolean;
    x: number;
    y: number;
    user: LobbyUser | null;
  }>({ open: false, x: 0, y: 0, user: null });

  const closeContextMenu = useCallback(() => {
    setContextMenu((prev) => ({ ...prev, open: false, user: null }));
  }, []);

  const handleNicknameContextMenu = (event: MouseEvent, user: LobbyUser) => {
    if (user.name === myUserName) return;
    event.preventDefault();
    event.stopPropagation();
    setContextMenu({
      open: true,
      x: event.clientX,
      y: event.clientY,
      user,
    });
  };

  const handleMenuSelect = (action: UserListMenuAction, userName: string) => {
    const user = sortedUsers.find((entry) => entry.name === userName);
    if (user) onUserMenuAction?.(action, user);
  };

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
          className={`tab-btn ${activeTab === '친구' ? 'active' : ''}`}
          onClick={() => onTabChange('친구')}
        >
          친구
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
            {sortedUsers.length === 0 && activeTab === '친구' ? (
              <tr>
                <td colSpan={2} className="friend-tab-empty">
                  친구가 없습니다. 유저 닉네임을 우클릭해 친구추가하세요.
                </td>
              </tr>
            ) : null}
            {sortedUsers.map((u, i) => {
              const isSelf = u.name === myUserName;
              return (
                <tr key={`${activeTab}-${i}`}>
                  <td className="pixel-text-warning">
                    <span className="tier-icon-wrap">{TIER_ICONS[u.rank] || '⭐'}</span>
                    {u.rank}
                  </td>
                  <td
                    className={`user-nickname-cell${isSelf ? ' is-self' : ''}`}
                    onContextMenu={isSelf ? undefined : (event) => handleNicknameContextMenu(event, u)}
                  >
                    {isSelf ? (
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
              );
            })}
          </tbody>
        </table>
      </div>

      {contextMenu.user && (
        <UserListContextMenu
          open={contextMenu.open}
          x={contextMenu.x}
          y={contextMenu.y}
          userName={contextMenu.user.name}
          actionLabels={{
            'add-friend': isFriend(contextMenu.user.name) ? '친구삭제' : '친구추가',
          }}
          hiddenActions={['summon']}
          disabledActions={(() => {
            const presence = getUserPresence(contextMenu.user!.name);
            const canFollow = isFriend(contextMenu.user!.name) && presence?.status === 'room';
            return canFollow ? [] : (['follow'] as UserListMenuAction[]);
          })()}
          onSelect={handleMenuSelect}
          onClose={closeContextMenu}
        />
      )}
    </div>
  );
}
