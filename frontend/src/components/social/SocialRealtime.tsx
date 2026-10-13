import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ROUTES } from '../../constants/routes';
import { useAuth } from '../../contexts/AuthContext';
import { apiRequest } from '../../services/apiClient';
import { getCurrentUserId } from '../../services/authService';
import {
  addFriend,
  removeFriend,
  removeFriendByUserId,
  replaceFriendsFromServer,
} from '../../services/friendStore';
import {
  emitFriendRequestResult,
  emitRoomInviteResponse,
  getActiveRoomId,
  subscribeSocialEvents,
} from '../../services/roomSocket';
import { allowExplicitRejoinFromPath, leaveRoom, setPendingInviteMeta } from '../../services/roomService';

interface FriendRequestNotice {
  fromUserId: string;
  fromUserName: string;
}

interface RoomInviteNotice {
  fromUserId: string;
  fromUserName: string;
  roomId: string;
  roomTitle: string;
  roomQuery: string;
  inviteToken?: string;
}

function pullServerFriends() {
  void apiRequest<{ friends?: Array<{ userId?: string; displayName?: string; username?: string }> }>(
    '/users/me/friends',
  )
    .then((data) => {
      replaceFriendsFromServer(
        (data.friends || [])
          .filter((friend) => friend.userId)
          .map((friend) => ({
            userId: String(friend.userId),
            name: friend.displayName || friend.username || String(friend.userId),
          })),
      );
    })
    .catch(() => undefined);
}

export function SocialRealtime() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [friendRequest, setFriendRequest] = useState<FriendRequestNotice | null>(null);
  const [roomInvite, setRoomInvite] = useState<RoomInviteNotice | null>(null);

  useEffect(() => {
    if (!user?.id) return;
    pullServerFriends();
    const poll = window.setInterval(pullServerFriends, 5000);
    const recent = new Map<string, number>();
    const takeOnce = (key: string) => {
      const now = Date.now();
      const prev = recent.get(key) || 0;
      if (now - prev < 4000) return false;
      recent.set(key, now);
      return true;
    };

    const unsubscribe = subscribeSocialEvents((event, raw) => {
      const payload = (raw || {}) as {
        fromUserId?: string;
        fromUserName?: string;
        accepted?: boolean;
        roomId?: string;
        roomTitle?: string;
        roomQuery?: string;
        inviteToken?: string;
        userId?: string;
      };
      const myId = String(getCurrentUserId() || user.id);
      if (event === 'friend_request') {
        const fromUserId = String(payload.fromUserId || '').replace(/^player-/, '');
        if (!fromUserId || fromUserId === myId) return;
        if (!takeOnce(`friend:${fromUserId}`)) return;
        setFriendRequest({
          fromUserId,
          fromUserName: payload.fromUserName || 'UNKNOWN',
        });
        return;
      }
      if (event === 'friend_request_result') {
        if (payload.accepted && payload.fromUserName) {
          addFriend(payload.fromUserName, payload.fromUserId);
          pullServerFriends();
        }
        return;
      }
      if (event === 'friend_remove') {
        const fromUserId = String(payload.fromUserId || '').replace(/^player-/, '');
        if (!fromUserId || fromUserId === myId) return;
        removeFriendByUserId(fromUserId);
        if (payload.fromUserName) removeFriend(payload.fromUserName);
        pullServerFriends();
        return;
      }
      if (event === 'user_deleted') {
        if (payload.userId) removeFriendByUserId(String(payload.userId));
        pullServerFriends();
        return;
      }
      if (event === 'room_invite') {
        const fromUserId = String(payload.fromUserId || '').replace(/^player-/, '');
        const roomId = String(payload.roomId || '');
        if (!fromUserId || !roomId || fromUserId === myId) return;
        const key = `invite:${fromUserId}:${roomId}:${payload.inviteToken || ''}`;
        if (!takeOnce(key)) return;
        setRoomInvite({
          fromUserId,
          fromUserName: payload.fromUserName || 'UNKNOWN',
          roomId,
          roomTitle: payload.roomTitle || '대기실',
          roomQuery: payload.roomQuery || `id=${roomId}`,
          inviteToken: payload.inviteToken,
        });
      }
    });

    return () => {
      window.clearInterval(poll);
      unsubscribe();
    };
  }, [user?.id]);

  if (!user) return null;

  return (
    <>
      {friendRequest && (
        <div className="review-modal-overlay" style={{ zIndex: 4500 }}>
          <div
            className="review-modal-panel ranking-panel"
            style={{ width: 'min(420px, 92vw)', height: 'auto', minHeight: 180 }}
          >
            <div className="rank-title">FRIEND REQUEST</div>
            <div className="review-incoming-msg">
              <strong>{friendRequest.fromUserName}</strong>님이 친구 요청을 보냈습니다.
            </div>
            <div className="review-modal-actions review-modal-actions-end">
              <button
                type="button"
                className="pixel-btn pixel-btn-secondary review-modal-btn"
                onClick={() => {
                  void emitFriendRequestResult(friendRequest.fromUserId, false);
                  setFriendRequest(null);
                }}
              >
                거절
              </button>
              <button
                type="button"
                className="pixel-btn pixel-btn-primary review-modal-btn"
                onClick={() => {
                  addFriend(friendRequest.fromUserName, friendRequest.fromUserId);
                  void emitFriendRequestResult(friendRequest.fromUserId, true).then((result) => {
                    if (result.success) pullServerFriends();
                  });
                  setFriendRequest(null);
                }}
              >
                수락
              </button>
            </div>
          </div>
        </div>
      )}

      {roomInvite && (
        <div className="review-modal-overlay" style={{ zIndex: 4500 }}>
          <div
            className="review-modal-panel ranking-panel"
            style={{ width: 'min(420px, 92vw)', height: 'auto', minHeight: 180 }}
          >
            <div className="rank-title">ROOM INVITE</div>
            <div className="review-incoming-msg">
              <strong>{roomInvite.fromUserName}</strong>님이 <strong>{roomInvite.roomTitle || '대기실'}</strong>로
              초대했습니다.
            </div>
            <div className="review-modal-actions review-modal-actions-end">
              <button
                type="button"
                className="pixel-btn pixel-btn-secondary review-modal-btn"
                onClick={() => {
                  void emitRoomInviteResponse(roomInvite.fromUserId, false, roomInvite.roomId);
                  setRoomInvite(null);
                }}
              >
                거절
              </button>
              <button
                type="button"
                className="pixel-btn pixel-btn-primary review-modal-btn"
                onClick={() => {
                  const invite = roomInvite;
                  setRoomInvite(null);
                  if (invite.inviteToken) {
                    setPendingInviteMeta({
                      token: invite.inviteToken,
                      fromUserId: invite.fromUserId,
                      roomId: invite.roomId,
                    });
                  }
                  void emitRoomInviteResponse(invite.fromUserId, true, invite.roomId);
                  void (async () => {
                    const current = getActiveRoomId();
                    if (current && current !== invite.roomId) {
                      const numeric = Number(current);
                      if (Number.isInteger(numeric) && numeric > 0) {
                        try {
                          await leaveRoom(numeric);
                        } catch {
                          // 이미 없는 방이면 초대 방으로만 이동한다
                        }
                      }
                    }
                    const query = invite.roomQuery.replace(/^\?/, '');
                    allowExplicitRejoinFromPath(`?${query}`);
                    navigate(`${ROUTES.ROOM}?${query}`);
                  })();
                }}
              >
                수락
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
