import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import {
  getCurrentUser,
  initAuth,
  login as authLogin,
  logout as authLogout,
  signup as authSignup,
  type AuthResult,
  type AuthUser,
} from '../services/authService';

interface AuthContextValue {
  user: AuthUser | null;
  isAuthenticated: boolean;
  login: (username: string, password: string) => AuthResult;
  signup: (username: string, password: string, displayName?: string) => AuthResult;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => initAuth());

  const login = useCallback((username: string, password: string) => {
    const result = authLogin(username, password);
    if (result.ok) {
      setUser(result.user);
    }
    return result;
  }, []);

  const signup = useCallback((username: string, password: string, displayName?: string) => {
    const result = authSignup(username, password, displayName);
    if (result.ok) {
      setUser(result.user);
    }
    return result;
  }, []);

  const logout = useCallback(() => {
    authLogout();
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({
      user,
      isAuthenticated: user !== null,
      login,
      signup,
      logout,
    }),
    [user, login, signup, logout],
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
