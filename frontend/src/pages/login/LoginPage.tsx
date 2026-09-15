import type { FormEvent } from 'react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ROUTES } from '../../constants/routes';
import { useAuth } from '../../contexts/AuthContext';
import {
  validateDisplayName,
  validatePassword,
  validatePasswordConfirm,
  validateUsername,
} from '../../utils/authValidation';
import './login.css';

type AuthMode = 'login' | 'signup';

export default function LoginPage() {
  const navigate = useNavigate();
  const { login, signup } = useAuth();

  const [mode, setMode] = useState<AuthMode>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const switchMode = (next: AuthMode) => {
    setMode(next);
    setUsername('');
    setPassword('');
    setPasswordConfirm('');
    setDisplayName('');
    setError('');
    setFieldErrors({});
  };

  const focusField = (id: string) => {
    window.setTimeout(() => {
      const el = document.getElementById(id) as HTMLInputElement | null;
      el?.focus();
      el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }, 0);
  };

  const validateSignupFields = () => {
    const nextErrors: Record<string, string> = {};
    const displayResult = validateDisplayName(displayName);
    if (!displayResult.ok) nextErrors.displayName = displayResult.message;

    const usernameResult = validateUsername(username);
    if (!usernameResult.ok) nextErrors.username = usernameResult.message;

    const passwordResult = validatePassword(password, username);
    if (!passwordResult.ok) nextErrors.password = passwordResult.message;

    const confirmResult = validatePasswordConfirm(password, passwordConfirm);
    if (!confirmResult.ok) nextErrors.passwordConfirm = confirmResult.message;

    setFieldErrors(nextErrors);
    if (Object.keys(nextErrors).length === 0) return true;

    const order = ['displayName', 'username', 'password', 'passwordConfirm'];
    const first = order.find((key) => nextErrors[key]);
    if (first) focusField(first);
    return false;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    setError('');
    setFieldErrors({});

    if (mode === 'signup' && !validateSignupFields()) {
      return;
    }

    if (mode === 'login') {
      if (!username.trim() || !password) {
        setError('아이디와 비밀번호를 입력해 주세요.');
        focusField(!username.trim() ? 'username' : 'password');
        return;
      }
    }

    setSubmitting(true);

    try {
      const result =
        mode === 'login'
          ? await login(username, password)
          : await signup(username, password, displayName.trim());

      if (result.ok) {
        navigate(ROUTES.LOBBY, { replace: true });
      } else {
        setError(result.error);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="login-page page-container">
      <div className="login-container">
        <div className="login-header">
          <h1 className="login-logo">RE:ZERO</h1>
          <p className="login-subtitle">코딩 배틀 아레나에 오신 것을 환영합니다</p>
        </div>

        <div className="login-card">
          <div className="login-tabs">
            <button
              type="button"
              className={`login-tab ${mode === 'login' ? 'active' : ''}`}
              onClick={() => switchMode('login')}
            >
              로그인
            </button>
            <button
              type="button"
              className={`login-tab ${mode === 'signup' ? 'active' : ''}`}
              onClick={() => switchMode('signup')}
            >
              회원가입
            </button>
          </div>

          <form className="login-form" onSubmit={handleSubmit} noValidate>
            {mode === 'signup' && (
              <div className="login-field">
                <label htmlFor="displayName">닉네임</label>
                <input
                  id="displayName"
                  type="text"
                  value={displayName}
                  onChange={(e) => {
                    setDisplayName(e.target.value);
                    setFieldErrors((prev) => {
                      const next = { ...prev };
                      delete next.displayName;
                      return next;
                    });
                  }}
                  placeholder="게임에서 표시될 이름"
                  maxLength={20}
                  className={fieldErrors.displayName ? 'is-invalid' : ''}
                  aria-invalid={Boolean(fieldErrors.displayName)}
                />
                {fieldErrors.displayName ? (
                  <p className="login-field-error">{fieldErrors.displayName}</p>
                ) : (
                  <p className="login-field-hint">최대 20자</p>
                )}
              </div>
            )}

            <div className="login-field">
              <label htmlFor="username">아이디</label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value);
                  setFieldErrors((prev) => {
                    const next = { ...prev };
                    delete next.username;
                    return next;
                  });
                }}
                placeholder="영문으로 시작, 4~20자"
                autoComplete="username"
                maxLength={20}
                className={fieldErrors.username ? 'is-invalid' : ''}
                aria-invalid={Boolean(fieldErrors.username)}
              />
              {fieldErrors.username ? (
                <p className="login-field-error">{fieldErrors.username}</p>
              ) : mode === 'signup' ? (
                <p className="login-field-hint">영문·숫자·_ 만 가능 · 대소문자 구분 없음</p>
              ) : null}
            </div>

            <div className="login-field">
              <label htmlFor="password">비밀번호</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setFieldErrors((prev) => {
                    const next = { ...prev };
                    delete next.password;
                    return next;
                  });
                }}
                placeholder={mode === 'signup' ? '8~20자, 영문·숫자·특수문자 포함' : '비밀번호 입력'}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                maxLength={20}
                className={fieldErrors.password ? 'is-invalid' : ''}
                aria-invalid={Boolean(fieldErrors.password)}
              />
              {fieldErrors.password ? (
                <p className="login-field-error">{fieldErrors.password}</p>
              ) : mode === 'signup' ? (
                <p className="login-field-hint">영문·숫자·특수문자 각 1자 이상</p>
              ) : null}
            </div>

            {mode === 'signup' && (
              <div className="login-field">
                <label htmlFor="passwordConfirm">비밀번호 확인</label>
                <input
                  id="passwordConfirm"
                  type="password"
                  value={passwordConfirm}
                  onChange={(e) => {
                    setPasswordConfirm(e.target.value);
                    setFieldErrors((prev) => {
                      const next = { ...prev };
                      delete next.passwordConfirm;
                      return next;
                    });
                  }}
                  placeholder="비밀번호를 다시 입력"
                  autoComplete="new-password"
                  maxLength={20}
                  className={fieldErrors.passwordConfirm ? 'is-invalid' : ''}
                  aria-invalid={Boolean(fieldErrors.passwordConfirm)}
                />
                {fieldErrors.passwordConfirm && (
                  <p className="login-field-error">{fieldErrors.passwordConfirm}</p>
                )}
              </div>
            )}

            {error && <div className="login-error">{error}</div>}

            <button
              type="submit"
              className="pixel-btn pixel-btn-primary login-submit"
              disabled={submitting}
            >
              {submitting ? '처리 중...' : mode === 'login' ? '로그인' : '회원가입'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
