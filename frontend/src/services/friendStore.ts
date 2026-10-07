import type { FriendEntry, FriendPresence, FriendPresenceStatus } from '../types/friend';

const LEGACY_FRIENDS_KEY = 'rezero_friends';
const LEGACY_PRESENCE_KEY = 'rezero_presence';
const OWNER_KEY = 'rezero_friends_owner';

let activeOwnerId: string | null = null;
const removedFriendIds = new Set<string>();

export const FRIENDS_CHANGED_EVENT = 'rezero:friends-changed';

function notifyFriendsChanged() {
  window.dispatchEvent(new Event(FRIENDS_CHANGED_EVENT));
}

function normalizeFriendId(userId?: string | null) {
  return String(userId || '').replace(/^player-/, '');
}

function tombstoneFriend(userId?: string | null) {
  const id = normalizeFriendId(userId);
  if (id) removedFriendIds.add(id);
}

function friendsKey(ownerId: string | null) {
  return ownerId ? `rezero_friends_${ownerId}` : LEGACY_FRIENDS_KEY;
}

function presenceKey(ownerId: string | null) {
  return ownerId ? `rezero_presence_${ownerId}` : LEGACY_PRESENCE_KEY;
}

/** 로그인 유저별로 친구/프레즌스 저장소를 분리한다. */
export function switchFriendOwner(userId: string | null | undefined) {
  const next = userId ? String(userId) : null;
  activeOwnerId = next;
  if (next) {
    localStorage.setItem(OWNER_KEY, next);
    // 예전 글로벌 키가 남아 있고 새 키가 비어 있으면 1회 이전
    const scoped = localStorage.getItem(friendsKey(next));
    const legacy = localStorage.getItem(LEGACY_FRIENDS_KEY);
    if (!scoped && legacy) {
      localStorage.setItem(friendsKey(next), legacy);
      localStorage.removeItem(LEGACY_FRIENDS_KEY);
    }
    const scopedPresence = localStorage.getItem(presenceKey(next));
    const legacyPresence = localStorage.getItem(LEGACY_PRESENCE_KEY);
    if (!scopedPresence && legacyPresence) {
      localStorage.setItem(presenceKey(next), legacyPresence);
      localStorage.removeItem(LEGACY_PRESENCE_KEY);
    }
  } else {
    localStorage.removeItem(OWNER_KEY);
  }
}

function currentOwnerId(): string | null {
  if (activeOwnerId) return activeOwnerId;
  const stored = localStorage.getItem(OWNER_KEY);
  activeOwnerId = stored || null;
  return activeOwnerId;
}

function readFriends(): FriendEntry[] {
  try {
    const raw = localStorage.getItem(friendsKey(currentOwnerId()));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as FriendEntry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeFriends(friends: FriendEntry[]) {
  localStorage.setItem(friendsKey(currentOwnerId()), JSON.stringify(friends));
}

function readPresenceMap(): Record<string, FriendPresence> {
  try {
    const raw = localStorage.getItem(presenceKey(currentOwnerId()));
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, FriendPresence>;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writePresenceMap(map: Record<string, FriendPresence>) {
  localStorage.setItem(presenceKey(currentOwnerId()), JSON.stringify(map));
}

export function loadFriends(): FriendEntry[] {
  return readFriends();
}

export function addFriend(name: string, userId?: string): boolean {
  const trimmed = name.trim();
  if (!trimmed) return false;
  const normalizedId = normalizeFriendId(userId);
  if (normalizedId) removedFriendIds.delete(normalizedId);
  const friends = readFriends();
  if (userId) {
    const byId = friends.find((f) => f.userId && String(f.userId) === String(userId));
    if (byId) {
      byId.name = trimmed;
      writeFriends(friends);
      return false;
    }
  }
  const existing = friends.find((f) => f.name === trimmed);
  if (existing) {
    if (userId) existing.userId = String(userId);
    writeFriends(friends);
    return false;
  }
  friends.push({ name: trimmed, userId: userId || undefined, addedAt: Date.now() });
  writeFriends(friends);
  return true;
}

/** 서버에 저장된 친구를 로컬 목록에 합친다. 이번 세션에서 삭제한 아이디는 다시 넣지 않는다. */
export function mergeServerFriends(entries: Array<{ name: string; userId: string }>) {
  for (const entry of entries) {
    const id = normalizeFriendId(entry.userId);
    if (!id || !entry.name || removedFriendIds.has(id)) continue;
    addFriend(entry.name, id);
  }
}

/** 서버 친구 목록으로 아이디가 있는 항목을 맞춘다. 아이디 없는 로컬 항목은 유지한다. */
export function replaceFriendsFromServer(entries: Array<{ name: string; userId: string }>) {
  const current = readFriends();
  const localOnly = current.filter((friend) => !normalizeFriendId(friend.userId));
  const next = [
    ...entries
      .filter((entry) => {
        const id = normalizeFriendId(entry.userId);
        return Boolean(id && entry.name && !removedFriendIds.has(id));
      })
      .map((entry) => {
        const id = normalizeFriendId(entry.userId);
        const prev = current.find((friend) => normalizeFriendId(friend.userId) === id);
        return {
          name: entry.name,
          userId: id,
          addedAt: prev?.addedAt || Date.now(),
        };
      }),
    ...localOnly,
  ];
  writeFriends(next);
  notifyFriendsChanged();
}

const recentFriendNotices = new Map<string, number>();

/** 같은 친구 알림이 짧은 시간에 두 번 붙지 않게 한다. */
export function claimFriendNotice(key: string, windowMs = 4000): boolean {
  const now = Date.now();
  const prev = recentFriendNotices.get(key) || 0;
  if (now - prev < windowMs) return false;
  recentFriendNotices.set(key, now);
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
  const current = readFriends();
  for (const friend of current) {
    if (friend.name === name) tombstoneFriend(friend.userId);
  }
  writeFriends(current.filter((f) => f.name !== name));
  notifyFriendsChanged();
}

export function removeFriendByUserId(userId: string) {
  const id = normalizeFriendId(userId);
  if (!id) return;
  tombstoneFriend(id);
  writeFriends(readFriends().filter((f) => normalizeFriendId(f.userId) !== id));
  notifyFriendsChanged();
}

/** 조회한 아이디 중 서버에 없는 유저만 친구 목록에서 뺀다. */
export function pruneFriendsNotIn(requestedIds: string[], existingUserIds: string[]) {
  const requested = new Set(requestedIds.map((id) => String(id)));
  const keep = new Set(existingUserIds.map((id) => String(id)));
  const current = readFriends();
  const next = current.filter((friend) => {
    if (!friend.userId) return true;
    const id = String(friend.userId);
    if (!requested.has(id)) return true;
    return keep.has(id);
  });
  if (next.length === current.length) return;
  writeFriends(next);
}

export function findFriendUserId(name: string): string | null {
  const friend = readFriends().find((f) => f.name === name);
  return friend?.userId ? String(friend.userId) : null;
}

export function isFriend(name: string, userId?: string): boolean {
  const id = normalizeFriendId(userId);
  return readFriends().some((friend) => {
    if (id && normalizeFriendId(friend.userId) === id) return true;
    return Boolean(name) && friend.name === name;
  });
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
    ratingScore?: number;
  },
) {
  if (!userName) return;
  const map = readPresenceMap();
  const prev = map[userName];
  const ratingScore =
    patch.ratingScore != null && Number.isFinite(Number(patch.ratingScore))
      ? Number(patch.ratingScore)
      : prev?.ratingScore;
  map[userName] = {
    userName,
    status: patch.status,
    roomId: patch.roomId,
    roomTitle: patch.roomTitle,
    roomQuery: patch.roomQuery,
    ratingScore,
    updatedAt: Date.now(),
  };
  writePresenceMap(map);
}

export function rememberFriendRating(userName: string, ratingScore: number) {
  if (!userName || !Number.isFinite(ratingScore)) return;
  const map = readPresenceMap();
  const prev = map[userName];
  map[userName] = {
    userName,
    status: prev?.status || 'offline',
    roomId: prev?.roomId,
    roomTitle: prev?.roomTitle,
    roomQuery: prev?.roomQuery,
    ratingScore,
    updatedAt: prev?.updatedAt || Date.now(),
  };
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
  return Boolean(presence && presence.status === 'lobby');
}

export function isFriendOnline(name: string): boolean {
  const presence = getUserPresence(name);
  if (!presence || presence.status === 'offline') return false;
  return true;
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
