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
  getCurrentUser,
  login as authLogin,
  logout as authLogout,
  restoreSession,
  signup as authSignup,
  type AuthResult,
  type AuthUser,
} from '../services/authService';
import { disconnectRoomSocket } from '../services/roomSocket';

interface AuthContextValue {
  user: AuthUser | null;
  isAuthenticated: boolean;
  authReady: boolean;
  login: (username: string, password: string) => Promise<AuthResult>;
  signup: (username: string, password: string, displayName?: string) => Promise<AuthResult>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void restoreSession().then((restored) => {
      if (cancelled) return;
      setUser(restored);
      setAuthReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    const result = await authLogin(username, password);
    if (result.ok) {
      setUser(result.user);
    }
    return result;
  }, []);

  const signup = useCallback(async (username: string, password: string, displayName?: string) => {
    const result = await authSignup(username, password, displayName);
    if (result.ok) {
      setUser(result.user);
    }
    return result;
  }, []);

  const logout = useCallback(() => {
    authLogout();
    disconnectRoomSocket(true);
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

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
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
