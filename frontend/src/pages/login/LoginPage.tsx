import type { FormEvent } from 'react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ROUTES } from '../../constants/routes';
import { useAuth } from '../../contexts/AuthContext';
import './login.css';

type AuthMode = 'login' | 'signup';

export default function LoginPage() {
  const navigate = useNavigate();
  const { login, signup } = useAuth();

  const [mode, setMode] = useState<AuthMode>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError('');

    const result =
      mode === 'login'
        ? login(username, password)
        : signup(username, password, displayName || undefined);

    if (result.ok) {
      navigate(ROUTES.LOBBY, { replace: true });
    } else {
      setError(result.error);
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
              onClick={() => {
                setMode('login');
                setError('');
              }}
            >
              로그인
            </button>
            <button
              type="button"
              className={`login-tab ${mode === 'signup' ? 'active' : ''}`}
              onClick={() => {
                setMode('signup');
                setError('');
              }}
            >
              회원가입
            </button>
          </div>

          <form className="login-form" onSubmit={handleSubmit}>
            {mode === 'signup' && (
              <div className="login-field">
                <label htmlFor="displayName">닉네임</label>
                <input
                  id="displayName"
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="게임에서 표시될 이름"
                  maxLength={20}
                />
              </div>
            )}

            <div className="login-field">
              <label htmlFor="username">아이디</label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="아이디 입력"
                autoComplete="username"
                required
              />
            </div>

            <div className="login-field">
              <label htmlFor="password">비밀번호</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="비밀번호 입력"
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                required
              />
            </div>

            {error && <div className="login-error">{error}</div>}

            <button type="submit" className="pixel-btn pixel-btn-primary login-submit">
              {mode === 'login' ? '로그인' : '회원가입'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
