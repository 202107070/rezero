import { useEffect, type MouseEvent, useState } from 'react';
import { getFriendPresences } from '../../../services/friendStore';
import type { FriendPresence } from '../../../types/friend';
import { getTierByUserName, getTierIconByTier } from '../../../utils/tierUtils';

interface RoomFriendMessengerProps {
  roomId: string;
  roomTitle: string;
  roomQuery: string;
  onSummonSuccess: (friendName: string) => void;
  onSummonFail: (friendName: string, reason: string) => void;
  onFriendContextMenu?: (event: MouseEvent, userName: string) => void;
}

function presenceLabel(presence: FriendPresence) {
  if (presence.status === 'room') {
    return presence.roomId ? `방 · ${presence.roomTitle || presence.roomId}` : '대기방';
  }
  if (presence.status === 'lobby') return '로비';
  return '오프라인';
}

export function RoomFriendMessenger({
  roomId: _roomId,
  roomTitle: _roomTitle,
  roomQuery: _roomQuery,
  onSummonSuccess: _onSummonSuccess,
  onSummonFail: _onSummonFail,
  onFriendContextMenu,
}: RoomFriendMessengerProps) {
  const [open, setOpen] = useState(false);
  const [friends, setFriends] = useState<FriendPresence[]>([]);

  const refreshFriends = () => {
    setFriends(getFriendPresences());
  };

  useEffect(() => {
    refreshFriends();
    const timer = window.setInterval(refreshFriends, 2000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <div className={`room-friend-messenger${open ? ' is-open' : ''}`}>
      {open && (
        <div className="room-friend-messenger-panel pixel-card">
          <div className="room-friend-messenger-header">
            <span>💬 친구 메신저</span>
            <button type="button" className="room-friend-messenger-close" onClick={() => setOpen(false)} aria-label="닫기">
              ✕
            </button>
          </div>
          <div className="room-friend-messenger-body">
            {friends.length === 0 ? (
              <div className="room-friend-messenger-empty">친구 목록이 비어 있습니다.</div>
            ) : (
              <table className="room-friend-table">
                <thead>
                  <tr>
                    <th>티어</th>
                    <th>닉네임</th>
                  </tr>
                </thead>
                <tbody>
                  {friends.map((friend) => {
                    return (
                      <tr key={friend.userName}>
                        <td className="room-friend-tier-cell">
                          {getTierIconByTier(getTierByUserName(friend.userName))}
                        </td>
                        <td
                          className="room-friend-name-cell"
                          title={`${friend.userName} · ${presenceLabel(friend)}`}
                          onContextMenu={(event) => onFriendContextMenu?.(event, friend.userName)}
                        >
                          {friend.userName}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      <button
        type="button"
        className={`room-friend-messenger-toggle pixel-btn pixel-btn-primary${open ? ' is-active' : ''}`}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        💬 친구
      </button>
    </div>
  );
}
