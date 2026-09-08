import { ApiError, apiRequest, setAccessToken } from './apiClient';
import { applyUserProfile, clearUserSession, type UserProfilePayload } from './userService';

export interface AuthUser {
  id: string;
  username: string;
  displayName: string;
}

interface AuthUserPayload extends UserProfilePayload {
  id: string;
  username: string;
  displayName: string;
}

interface AuthResponse {
  user: AuthUserPayload;
  token: string;
}

let currentUser: AuthUser | null = null;

export function initAuth(): AuthUser | null {
  currentUser = null;
  setAccessToken(null);
  clearUserSession();
  return null;
}

export function getCurrentUser(): AuthUser | null {
  return currentUser;
}

export function getCurrentUserId(): string {
  return currentUser?.id ?? '';
}

export function getCurrentUserName(): string {
  return currentUser?.username ?? '';
}

export function getCurrentDisplayName(): string {
  return currentUser?.displayName ?? '';
}

export function isAuthenticated(): boolean {
  return currentUser !== null;
}

export type AuthResult =
  | { ok: true; user: AuthUser }
  | { ok: false; error: string };

function toAuthUser(user: AuthUserPayload): AuthUser {
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
  };
}

function toAuthError(error: unknown): AuthResult {
  if (error instanceof ApiError) {
    return { ok: false, error: error.message };
  }
  return { ok: false, error: '요청을 처리하지 못했습니다.' };
}

async function fetchMeProfile(): Promise<AuthUserPayload> {
  return apiRequest<AuthUserPayload>('/users/me');
}

export async function login(username: string, password: string): Promise<AuthResult> {
  try {
    const result = await apiRequest<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });

    setAccessToken(result.token);
    applyUserProfile(result.user);
    currentUser = toAuthUser(result.user);
    return { ok: true, user: currentUser };
  } catch (error) {
    setAccessToken(null);
    currentUser = null;
    return toAuthError(error);
  }
}

export async function signup(
  username: string,
  password: string,
  displayName?: string,
): Promise<AuthResult> {
  try {
    const result = await apiRequest<AuthResponse>('/auth/signup', {
      method: 'POST',
      body: JSON.stringify({
        username,
        password,
        displayName: displayName?.trim() || undefined,
      }),
    });

    setAccessToken(result.token);

    try {
      const me = await fetchMeProfile();
      applyUserProfile(me);
      currentUser = toAuthUser(me);
    } catch {
      applyUserProfile(result.user);
      currentUser = toAuthUser(result.user);
    }

    return { ok: true, user: currentUser };
  } catch (error) {
    setAccessToken(null);
    currentUser = null;
    return toAuthError(error);
  }
}

export function logout(): void {
  currentUser = null;
  setAccessToken(null);
  clearUserSession();
}
