import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  getCurrentDisplayName,
  getCurrentUser,
  getCurrentUserName,
  login as authLogin,
  logout as authLogout,
  restoreSession,
  signup as authSignup,
  type AuthResult,
  type AuthUser,
} from '../services/authService';
import { leaveRoom } from '../services/roomService';
import {
  disconnectRoomSocket,
  emitUserLogout,
  getActiveRoomId,
} from '../services/roomSocket';
import { setUserPresence, switchFriendOwner } from '../services/friendStore';
import { AUTH_EXPIRED_EVENT } from '../services/apiClient';
import { ConnectionLostModal } from '../components/lobby/ConnectionLostModal/ConnectionLostModal';
import { quitApp } from '../utils/windowBridge';

interface AuthContextValue {
  user: AuthUser | null;
  isAuthenticated: boolean;
  authReady: boolean;
  login: (username: string, password: string) => Promise<AuthResult>;
  signup: (username: string, password: string, displayName?: string) => Promise<AuthResult>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [connectionLost, setConnectionLost] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void restoreSession().then((restored) => {
      if (cancelled) return;
      switchFriendOwner(restored?.id || null);
      setUser(restored);
      setAuthReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const onAuthExpired = () => {
      setConnectionLost(true);
    };
    window.addEventListener(AUTH_EXPIRED_EVENT, onAuthExpired);
    return () => window.removeEventListener(AUTH_EXPIRED_EVENT, onAuthExpired);
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    const result = await authLogin(username, password);
    if (result.ok) {
      switchFriendOwner(result.user.id);
      setUser(result.user);
      setConnectionLost(false);
    }
    return result;
  }, []);

  const signup = useCallback(async (username: string, password: string, displayName?: string) => {
    const result = await authSignup(username, password, displayName);
    if (result.ok) {
      switchFriendOwner(result.user.id);
      setUser(result.user);
      setConnectionLost(false);
    }
    return result;
  }, []);

  const logout = useCallback(async () => {
    const me = getCurrentDisplayName() || getCurrentUserName();
    const username = getCurrentUserName();
    if (me) setUserPresence(me, { status: 'offline' });
    if (username && username !== me) setUserPresence(username, { status: 'offline' });

    try {
      await emitUserLogout();
    } catch {
      // ignore
    }

    const roomId = getActiveRoomId();
    const numericRoomId = roomId ? Number(roomId) : NaN;
    if (Number.isInteger(numericRoomId) && numericRoomId > 0) {
      void leaveRoom(numericRoomId).catch(() => undefined);
    }
    authLogout();
    disconnectRoomSocket(true);
    switchFriendOwner(null);
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({
      user,
      isAuthenticated: user !== null,
      authReady,
      login,
      signup,
      logout,
    }),
    [user, authReady, login, signup, logout],
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
      <ConnectionLostModal
        open={connectionLost}
        onConfirm={() => {
          void logout().then(() => quitApp());
        }}
      />
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}

export function useAuthUser(): AuthUser {
  const { user } = useAuth();
  if (!user) {
    return getCurrentUser() ?? { id: '', username: '', displayName: '' };
  }
  return user;
}
