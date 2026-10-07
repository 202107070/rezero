import { useCallback, useState, type MouseEvent } from 'react';
import { TITLE_DEFS } from '../../../constants/titleTypes';
import { getEquippedTitle, type TitleData } from '../../../constants/titleTypes';
import { getCurrentDisplayName, getCurrentUserId, getCurrentUserName } from '../../../services/authService';
import { findFriendUserId, getUserPresence, isFriend, isFriendOnline } from '../../../services/friendStore';
import { getTierByRating } from '../../../utils/tierUtils';
import { getActiveRoomId } from '../../../services/roomSocket';
import type { LobbyUser } from '../../../types/lobby';
import { getTierIconByTier } from '../../../utils/tierUtils';
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

interface RankingBoardProps {
  users: LobbyUser[];
  friendNames: string[];
  activeTab: string;
  titleData: TitleData;
  identityReady?: boolean;
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
      const friendId = findFriendUserId(name);
      const found = users.find(
        (user) => user.name === name || (friendId && String(user.userId) === String(friendId)),
      );
      const presence = getUserPresence(name);
      const storedTier =
        presence?.ratingScore != null ? getTierByRating(presence.ratingScore) : '';
      const rank = storedTier || (found?.rank && found.rank !== '-' ? found.rank : '브론즈');
      if (found) return { ...found, rank };
      return { name, rank, title: null, userId: friendId || undefined };
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
  identityReady = true,
  onTabChange,
  onUserMenuAction,
}: RankingBoardProps) {
  const myUserId = getCurrentUserId();
  const myNames = new Set(
    [getCurrentDisplayName(), getCurrentUserName()].filter(Boolean).map(String),
  );
  const sortedUsers = sortUsersForTab(users, activeTab, friendNames);
  const myEquipped = getEquippedTitle(titleData);

  const [showTierChart, setShowTierChart] = useState(false);
  const [contextMenu, setContextMenu] = useState<{
    open: boolean;
    x: number;
    y: number;
    user: LobbyUser | null;
  }>({ open: false, x: 0, y: 0, user: null });

  const closeContextMenu = useCallback(() => {
    setContextMenu((prev) => ({ ...prev, open: false, user: null }));
  }, []);

  const isSelfUser = (user: LobbyUser) =>
    Boolean(
      (user.userId && String(user.userId) === String(myUserId)) || myNames.has(user.name),
    );

  const handleNicknameContextMenu = (event: MouseEvent, user: LobbyUser) => {
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
    const user = sortedUsers.find((entry) => entry.name === userName) || contextMenu.user;
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
      <div className="tier-chart-launch">
        <button type="button" className="tab-btn" onClick={() => setShowTierChart(true)}>
          티어표
        </button>
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
              const isSelf = isSelfUser(u);
              const presence = getUserPresence(u.name);
              const online = isFriendOnline(u.name);
              return (
                <tr key={`${activeTab}-${i}`}>
                  <td className="pixel-text-warning">
                    <span className="tier-icon-wrap">{getTierIconByTier(u.rank)}</span>
                    {u.rank}
                  </td>
                  <td
                    className={`user-nickname-cell${isSelf ? ' is-self' : ''}`}
                    onContextMenu={(event) => handleNicknameContextMenu(event, u)}
                  >
                    {isSelf ? (
                      <span style={{ visibility: identityReady ? 'visible' : 'hidden' }}>
                        <strong style={{ color: 'var(--px-warning)' }}>{u.name}</strong>
                        {identityReady && myEquipped && (
                          <span style={{ marginLeft: '6px', fontSize: '11px' }} className={`title-badge rarity-${myEquipped.rarity}`}>
                            {myEquipped.icon} {myEquipped.name}
                          </span>
                        )}
                      </span>
                    ) : (
                      <>
                        {u.name}
                        <UserTitleBadge titleId={u.title} />
                        {activeTab === '친구' && (
                          <span className={`friend-presence-badge ${online ? 'is-online' : 'is-offline'}`}>
                            {!online
                              ? '오프라인'
                              : presence?.status === 'practice'
                                ? '연습'
                                : presence?.status === 'build'
                                  ? '빌드'
                                  : presence?.status === 'battle'
                                    ? presence.roomId
                                      ? `${presence.roomId}번·게임`
                                      : '게임중'
                                    : presence?.status === 'result'
                                      ? '결과'
                                      : presence?.status === 'room'
                                        ? presence.roomId
                                          ? `${presence.roomId}번 방`
                                          : '대기방'
                                        : '로비'}
                          </span>
                        )}
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
            'match-story': '프로필 보기',
            'add-friend': isFriend(contextMenu.user.name, contextMenu.user.userId) ? '친구삭제' : '친구추가',
          }}
          hiddenActions={
            isSelfUser(contextMenu.user)
              ? (['match-story', 'add-friend', 'whisper', 'follow', 'summon'] as UserListMenuAction[])
              : (['my-info', 'summon'] as UserListMenuAction[])
          }
          disabledActions={(() => {
            if (isSelfUser(contextMenu.user!)) return [];
            const presence = getUserPresence(contextMenu.user!.name);
            const activeRoomId = getActiveRoomId();
            const sameRoom =
              Boolean(presence?.roomId) &&
              Boolean(activeRoomId) &&
              String(presence?.roomId) === String(activeRoomId);
            const canFollow =
              isFriend(contextMenu.user!.name) && presence?.status === 'room' && !sameRoom;
            const disabled: UserListMenuAction[] = [];
            if (!canFollow) disabled.push('follow');
            if (!isFriendOnline(contextMenu.user!.name)) {
              disabled.push('follow', 'summon');
            }
            return disabled;
          })()}
          onSelect={handleMenuSelect}
          onClose={closeContextMenu}
        />
      )}
      {showTierChart && (
        <div className="modal-overlay" style={{ zIndex: 4200 }} onClick={() => setShowTierChart(false)}>
          <div className="modal-content tier-chart-modal" onClick={(event) => event.stopPropagation()}>
            <h3 className="text-center pixel-text-primary">티어표</h3>
            <div className="tier-chart-row">
              {[
                { name: '브론즈', icon: '🥉', range: '0 ~ 999' },
                { name: '실버', icon: '🥈', range: '1000 ~ 1299' },
                { name: '골드', icon: '🥇', range: '1300 ~ 1599' },
                { name: '플래티넘', icon: '💠', range: '1600 ~ 1899' },
                { name: '다이아', icon: '💎', range: '1900 ~ 2199' },
                { name: '마스터', icon: '👑', range: '2200+' },
              ].map((tier) => (
                <div key={tier.name} className="tier-chart-item">
                  <div className="tier-chart-icon">{tier.icon}</div>
                  <div className="tier-chart-name">{tier.name}</div>
                  <div className="tier-chart-bar" />
                  <div className="tier-chart-range">{tier.range}</div>
                </div>
              ))}
            </div>
            <div className="text-center" style={{ marginTop: '14px' }}>
              <button type="button" className="pixel-btn pixel-btn-secondary" onClick={() => setShowTierChart(false)}>
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
