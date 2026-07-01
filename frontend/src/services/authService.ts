import { initializeUserSession } from './userService';



export interface AuthUser {

  id: string;

  username: string;

  displayName: string;

}



interface StoredAccount {

  id: string;

  username: string;

  password: string;

  displayName: string;

}



const ACCOUNTS_KEY = 'rezero_auth_accounts';

const LEGACY_SESSION_KEY = 'rezero_auth_session';



const TEST_ACCOUNTS: StoredAccount[] = [

  { id: 'test_user_1', username: 'testuser1', password: 'test1234', displayName: '테스트유저1' },

  { id: 'test_user_2', username: 'testuser2', password: 'test1234', displayName: '테스트유저2' },

];



let currentUser: AuthUser | null = null;



function loadAccounts(): StoredAccount[] {

  try {

    const raw = localStorage.getItem(ACCOUNTS_KEY);

    if (raw) {

      return JSON.parse(raw) as StoredAccount[];

    }

  } catch {

    /* ignore */

  }

  localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(TEST_ACCOUNTS));

  return [...TEST_ACCOUNTS];

}



function saveAccounts(accounts: StoredAccount[]): void {

  localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));

}



/** 세션은 메모리에만 유지 — 앱 종료 후 재실행 시 로그인 화면 표시 */

export function initAuth(): AuthUser | null {

  loadAccounts();

  localStorage.removeItem(LEGACY_SESSION_KEY);

  currentUser = null;

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



export function login(username: string, password: string): AuthResult {

  const trimmed = username.trim().toLowerCase();

  const accounts = loadAccounts();

  const account = accounts.find((a) => a.username.toLowerCase() === trimmed);



  if (!account) {

    return { ok: false, error: '존재하지 않는 계정입니다.' };

  }

  if (account.password !== password) {

    return { ok: false, error: '비밀번호가 일치하지 않습니다.' };

  }



  const user: AuthUser = {

    id: account.id,

    username: account.username,

    displayName: account.displayName,

  };

  currentUser = user;

  initializeUserSession();

  return { ok: true, user };

}



export function signup(username: string, password: string, displayName?: string): AuthResult {

  const trimmed = username.trim().toLowerCase();

  if (trimmed.length < 3) {

    return { ok: false, error: '아이디는 3자 이상이어야 합니다.' };

  }

  if (!/^[a-z0-9_]+$/.test(trimmed)) {

    return { ok: false, error: '아이디는 영문 소문자, 숫자, _ 만 사용 가능합니다.' };

  }

  if (password.length < 4) {

    return { ok: false, error: '비밀번호는 4자 이상이어야 합니다.' };

  }



  const accounts = loadAccounts();

  if (accounts.some((a) => a.username.toLowerCase() === trimmed)) {

    return { ok: false, error: '이미 사용 중인 아이디입니다.' };

  }



  const newAccount: StoredAccount = {

    id: `user_${Date.now()}`,

    username: trimmed,

    password,

    displayName: displayName?.trim() || trimmed,

  };

  accounts.push(newAccount);

  saveAccounts(accounts);



  const user: AuthUser = {

    id: newAccount.id,

    username: newAccount.username,

    displayName: newAccount.displayName,

  };

  currentUser = user;

  initializeUserSession();

  return { ok: true, user };

}



export function logout(): void {

  currentUser = null;

}


