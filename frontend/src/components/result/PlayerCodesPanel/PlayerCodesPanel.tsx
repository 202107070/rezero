import type { TitleDef } from '../../../constants/titleTypes';

interface OnlineUser {
  id?: string;
  name?: string;
  avatar?: string;
}

interface UserStatusPanelProps {
  onlineUsers: OnlineUser[];
  equippedTitle: TitleDef | null;
  myUserId: string;
  departedUserIds?: Set<string>;
}

export function UserStatusPanel({ onlineUsers, equippedTitle, myUserId, departedUserIds }: UserStatusPanelProps) {
  return (
    <div className="user-status-panel">
      <div className="online-user-card user-status-card">
        <div className="online-user-header">USER STATUS</div>
        <div className="online-user-list">
          {onlineUsers.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#666', fontSize: '16px', padding: '8px 0' }}>
              접속 중인 유저가 없습니다
            </div>
          ) : (
            onlineUsers.map((u, idx) => {
              const isMe = u.id === 'me' || u.name?.includes(myUserId);
              const userKey = u.id || u.name || String(idx);
              const isDeparted = departedUserIds?.has(userKey) ?? false;
              return (
                <div className={`online-user-row${isDeparted ? ' departed' : ''}`} key={idx}>
                  <div className="online-user-avatar">{u.avatar || '👤'}</div>
                  <div className="online-user-name">
                    <span style={isMe ? { fontWeight: 'bold', color: 'var(--px-warning)' } : {}}>
                      {(u.name || 'Unknown').replace(' (나)', '')}
                    </span>
                    {equippedTitle && (
                      <span className={`title-badge-sm rarity-${equippedTitle.rarity}`}>
                        {equippedTitle.icon} {equippedTitle.name}
                      </span>
                    )}
                  </div>
                  <div className="online-indicator">●</div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
