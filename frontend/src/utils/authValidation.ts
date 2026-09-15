/** 아이디: 대소문자 구분 없이 동일 취급 (서버에서 lower-case 저장) */
const USERNAME_PATTERN = /^[A-Za-z][A-Za-z0-9_]{3,19}$/;

const COMMON_PASSWORDS = new Set(
  [
    'password',
    'password1',
    'password!',
    '12345678',
    '123456789',
    'qwerty123',
    'qwerty1!',
    'abcdefg1',
    'abcdefg!',
    'welcome1',
    'welcome!',
    'iloveyou1',
    'admin123',
    'admin123!',
    'letmein1',
    'letmein!',
    'rezero123',
    'rezero12!',
  ].map((value) => value.toLowerCase()),
);

export type FieldValidation = { ok: true } | { ok: false; message: string };

export function validateUsername(raw: string): FieldValidation {
  const username = String(raw || '');
  if (!username.trim()) {
    return { ok: false, message: '아이디를 입력해 주세요.' };
  }
  if (/\s/.test(username)) {
    return { ok: false, message: '아이디에는 공백을 넣을 수 없습니다.' };
  }
  if (username.length < 4 || username.length > 20) {
    return { ok: false, message: '아이디는 4~20자로 입력해 주세요.' };
  }
  if (!/^[A-Za-z]/.test(username)) {
    return { ok: false, message: '아이디는 영문자로 시작해야 합니다.' };
  }
  if (!USERNAME_PATTERN.test(username)) {
    return {
      ok: false,
      message: '아이디는 영문, 숫자, _(밑줄)만 사용할 수 있습니다.',
    };
  }
  return { ok: true };
}

export function validatePassword(raw: string, username = ''): FieldValidation {
  const password = String(raw || '');
  if (!password) {
    return { ok: false, message: '비밀번호를 입력해 주세요.' };
  }
  if (/\s/.test(password)) {
    return { ok: false, message: '비밀번호에는 공백을 넣을 수 없습니다.' };
  }
  if (password.length < 8 || password.length > 20) {
    return { ok: false, message: '비밀번호는 8~20자로 입력해 주세요.' };
  }
  if (!/[A-Za-z]/.test(password)) {
    return { ok: false, message: '비밀번호에 영문을 최소 1자 포함해 주세요.' };
  }
  if (!/[0-9]/.test(password)) {
    return { ok: false, message: '비밀번호에 숫자를 최소 1자 포함해 주세요.' };
  }
  if (!/[^A-Za-z0-9\s]/.test(password)) {
    return { ok: false, message: '비밀번호에 특수문자를 최소 1자 포함해 주세요.' };
  }
  const normalizedUser = username.trim().toLowerCase();
  if (normalizedUser && password.toLowerCase().includes(normalizedUser)) {
    return { ok: false, message: '비밀번호에 아이디를 포함할 수 없습니다.' };
  }
  if (COMMON_PASSWORDS.has(password.toLowerCase())) {
    return { ok: false, message: '너무 흔한 비밀번호입니다. 다른 비밀번호를 사용해 주세요.' };
  }
  return { ok: true };
}

export function validatePasswordConfirm(password: string, confirm: string): FieldValidation {
  if (!confirm) {
    return { ok: false, message: '비밀번호 확인을 입력해 주세요.' };
  }
  if (password !== confirm) {
    return { ok: false, message: '비밀번호가 일치하지 않습니다.' };
  }
  return { ok: true };
}

export function validateDisplayName(raw: string): FieldValidation {
  const displayName = String(raw || '').trim();
  if (!displayName) {
    return { ok: false, message: '닉네임을 입력해 주세요.' };
  }
  if (displayName.length > 20) {
    return { ok: false, message: '닉네임은 20자 이하로 입력해 주세요.' };
  }
  return { ok: true };
}
