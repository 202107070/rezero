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

export function addFriend(name: string): boolean {
  const trimmed = name.trim();
  if (!trimmed) return false;
  const friends = readFriends();
  if (friends.some((f) => f.name === trimmed)) return false;
  friends.push({ name: trimmed, addedAt: Date.now() });
  writeFriends(friends);
  return true;
}

export function removeFriend(name: string) {
  writeFriends(readFriends().filter((f) => f.name !== name));
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
  const map = readPresenceMap();
  map[userName] = {
    userName,
    status: patch.status,
    roomId: patch.roomId,
    roomTitle: patch.roomTitle,
    roomQuery: patch.roomQuery,
    updatedAt: Date.now(),
  };
  writePresenceMap(map);
}

export function clearUserPresence(userName: string) {
  const map = readPresenceMap();
  delete map[userName];
  writePresenceMap(map);
}

export function getUserPresence(userName: string): FriendPresence | null {
  return readPresenceMap()[userName] ?? null;
}

export function getPresenceMap(): Record<string, FriendPresence> {
  return readPresenceMap();
}

export function getFriendPresences(): FriendPresence[] {
  const names = new Set(getFriendNames());
  const map = readPresenceMap();
  return [...names].map(
    (name) =>
      map[name] ?? {
        userName: name,
        status: 'offline',
        updatedAt: 0,
      },
  );
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

/** 데모: 친구 접속 상태 초기값 */
export function seedDemoFriendPresence() {
  const map = readPresenceMap();
  if (!map['테스트유저1']) {
    setUserPresence('테스트유저1', {
      status: 'room',
      roomId: '1',
      roomTitle: '초보 환영 방',
      roomQuery: 'id=1&title=%EC%B4%88%EB%B3%B4%20%ED%99%98%EC%98%81%20%EB%B0%A9&mode=1%2FN&diff=%EB%B3%B4%ED%86%B5&lang=JAVA&pwd=&count=5&maxPlayers=8&gameMode=item',
    });
  }
  if (!map['테스트유저2']) {
    setUserPresence('테스트유저2', { status: 'lobby' });
  }
}
