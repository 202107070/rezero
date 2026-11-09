import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { ROUTES } from '../../constants/routes';
import { useAuth } from '../../contexts/AuthContext';
import { fetchReconnectMatch } from '../../services/matchService';

function SignedInDestination() {
  const [destination, setDestination] = useState('');
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    void fetchReconnectMatch(controller.signal).then(({ match }) => {
      if (controller.signal.aborted) return;
      if (!match) {
        setDestination(ROUTES.LOBBY);
        return;
      }
      const params = new URLSearchParams({ matchId: match.matchId });
      if (match.roomId) params.set('roomId', String(match.roomId));
      if (match.status === 'FINISHED') {
        setDestination(`${ROUTES.RESULT}?${params}`);
        return;
      }
      params.set('lang', match.language);
      params.set('mode', match.roomMode);
      params.set('gameMode', match.gameMode);
      params.set('count', String(match.problemCount));
      params.set('maxPlayers', String(match.maxPlayers));
      setDestination(`${ROUTES.BATTLE}?${params}`);
    }).catch(() => {
      if (!controller.signal.aborted) setFailed(true);
    });
    return () => controller.abort();
  }, [attempt]);

  if (destination) return <Navigate to={destination} replace />;
  if (failed) {
    return (
      <div className="login-page page-container">
        <div className="login-card">
          <p role="alert">이어서 볼 경기를 확인할 수 없습니다.</p>
          <button type="button" onClick={() => { setFailed(false); setAttempt((value) => value + 1); }}>
            다시 시도
          </button>
        </div>
      </div>
    );
  }
  return null;
}

export function GuestRoute({ children }: { children: React.ReactNode }) {
  const { user, authReady } = useAuth();
  if (!authReady) return null;
  return user ? <SignedInDestination key={user.id} /> : children;
}
