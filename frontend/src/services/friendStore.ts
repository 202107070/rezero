import type { FriendEntry, FriendPresence, FriendPresenceStatus } from '../types/friend';

const FRIENDS_KEY = 'rezero_friends';
const PRESENCE_KEY = 'rezero_presence';

function readFriends(): FriendEntry[] {
  try {
    const raw = localStorage.getItem(FRIENDS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as FriendEntry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeFriends(friends: FriendEntry[]) {
  localStorage.setItem(FRIENDS_KEY, JSON.stringify(friends));
}

function readPresenceMap(): Record<string, FriendPresence> {
  try {
    const raw = localStorage.getItem(PRESENCE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, FriendPresence>;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writePresenceMap(map: Record<string, FriendPresence>) {
  localStorage.setItem(PRESENCE_KEY, JSON.stringify(map));
}

export function loadFriends(): FriendEntry[] {
  return readFriends();
}

export function addFriend(name: string, userId?: string): boolean {
  const trimmed = name.trim();
  if (!trimmed) return false;
  const friends = readFriends();
  const existing = friends.find((f) => f.name === trimmed);
  if (existing) {
    if (userId && !existing.userId) {
      existing.userId = userId;
      writeFriends(friends);
    }
    return false;
  }
  friends.push({ name: trimmed, userId: userId || undefined, addedAt: Date.now() });
  writeFriends(friends);
  return true;
}

export function getFriendUserIds(onlineUsers?: Array<{ name?: string; userId?: string }>): string[] {
  const friends = readFriends();
  const ids = new Set<string>();
  for (const friend of friends) {
    if (friend.userId) {
      ids.add(String(friend.userId));
      continue;
    }
    const online = (onlineUsers || []).find(
      (user) => user.name === friend.name || user.userId === friend.userId,
    );
    if (online?.userId) ids.add(String(online.userId));
  }
  return [...ids];
}

export function removeFriend(name: string) {
  writeFriends(readFriends().filter((f) => f.name !== name));
}

export function removeFriendByUserId(userId: string) {
  const id = String(userId || '');
  if (!id) return;
  writeFriends(readFriends().filter((f) => String(f.userId || '') !== id));
}

export function findFriendUserId(name: string): string | null {
  const friend = readFriends().find((f) => f.name === name);
  return friend?.userId ? String(friend.userId) : null;
}

export function isFriend(name: string): boolean {
  return readFriends().some((f) => f.name === name);
}

export function getFriendNames(): string[] {
  return readFriends().map((f) => f.name);
}

export function setUserPresence(
  userName: string,
  patch: {
    status: FriendPresenceStatus;
    roomId?: string;
    roomTitle?: string;
    roomQuery?: string;
  },
) {
  if (!userName) return;
  const map = readPresenceMap();
  const entry = {
    userName,
    status: patch.status,
    roomId: patch.roomId,
    roomTitle: patch.roomTitle,
    roomQuery: patch.roomQuery,
    updatedAt: Date.now(),
  };
  map[userName] = entry;
  writePresenceMap(map);
}

export function clearUserPresence(userName: string) {
  const map = readPresenceMap();
  delete map[userName];
  writePresenceMap(map);
}

export function getUserPresence(userName: string): FriendPresence | null {
  const map = readPresenceMap();
  if (map[userName]) return map[userName];
  // displayName / username 혼용 대비: 값 매칭
  const found = Object.values(map).find((entry) => entry.userName === userName);
  return found ?? null;
}

export function getPresenceMap(): Record<string, FriendPresence> {
  return readPresenceMap();
}

export function getFriendPresences(): FriendPresence[] {
  const names = new Set(getFriendNames());
  const map = readPresenceMap();
  return [...names].map((name) => {
    const direct = map[name];
    if (direct) return direct;
    const byValue = Object.values(map).find((entry) => entry.userName === name);
    return (
      byValue ?? {
        userName: name,
        status: 'offline' as FriendPresenceStatus,
        updatedAt: 0,
      }
    );
  });
}

export function getFollowRoomPath(friendName: string): string | null {
  if (!isFriend(friendName)) return null;
  const presence = getUserPresence(friendName);
  if (!presence || presence.status !== 'room' || !presence.roomQuery) return null;
  return `/room?${presence.roomQuery}`;
}

export function canSummonFriend(friendName: string): boolean {
  if (!isFriend(friendName)) return false;
  const presence = getUserPresence(friendName);
  return !presence || presence.status === 'lobby';
}

export function summonFriendToRoom(
  friendName: string,
  room: { id: string; title: string; query: string },
): boolean {
  if (!canSummonFriend(friendName)) return false;
  setUserPresence(friendName, {
    status: 'room',
    roomId: room.id,
    roomTitle: room.title,
    roomQuery: room.query,
  });
  return true;
}

/** 데모용 친구 시드 — 실제 유저 presence만 쓰도록 비활성화 */
export function seedDemoFriendPresence() {
  // no-op
}
