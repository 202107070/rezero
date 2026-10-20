const LOBBY_CHAT_KEY = 'rezero_lobby_chat';
const RESET_FLAG_KEY = 'rezero_reset_lobby_chat';

export type StoredLobbyChatMessage = {
  id?: string;
  sender: string;
  text: string;
  time: string;
  mode: string;
};

function writeFlag(key: string, value: string | null): void {
  try {
    if (value == null) sessionStorage.removeItem(key);
    else sessionStorage.setItem(key, value);
  } catch {
    // ignore
  }
}

/** 다른 화면으로 나갔다가 로비로 돌아올 때, 내 채팅창만 비운 것처럼 보이게 한다. */
export function markLobbyChatReset(): void {
  writeFlag(RESET_FLAG_KEY, '1');
  writeFlag(LOBBY_CHAT_KEY, null);
}

export function loadLobbyChat(): StoredLobbyChatMessage[] {
  try {
    if (sessionStorage.getItem(RESET_FLAG_KEY) === '1') {
      sessionStorage.removeItem(RESET_FLAG_KEY);
      sessionStorage.removeItem(LOBBY_CHAT_KEY);
      return [];
    }
    const raw = sessionStorage.getItem(LOBBY_CHAT_KEY);
    const parsed = raw ? (JSON.parse(raw) as StoredLobbyChatMessage[]) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed.slice(-40).map((item) => ({
      ...item,
      sender: String(item.sender || 'SYSTEM'),
      text: String(item.text || ''),
      time: String(item.time || ''),
      mode: item.mode || '[전체]',
    }));
  } catch {
    return [];
  }
}

export function persistLobbyChat(messages: StoredLobbyChatMessage[]): void {
  try {
    if (sessionStorage.getItem(RESET_FLAG_KEY) === '1') return;
    sessionStorage.setItem(LOBBY_CHAT_KEY, JSON.stringify(messages.slice(-40)));
  } catch {
    // ignore
  }
}
