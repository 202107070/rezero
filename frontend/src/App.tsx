import { useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { GuestRoute } from './components/auth/GuestRoute';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { ROUTES } from './constants/routes';
import { AuthProvider } from './contexts/AuthContext';
import LobbyPage from './pages/lobby/LobbyPage';
import LoginPage from './pages/login/LoginPage';
import RoomPage from './pages/room/RoomPage';
import BattlePage from './pages/battle/BattlePage';
import ResultPage from './pages/result/ResultPage';
import PracticePage from './pages/practice/PracticePage';
import BuildPage from './pages/build/BuildPage';
import { applyDisplayMode, applyDisplayModeToDom, loadDisplayMode, updateUiScale } from './utils/windowBridge';
import { installClipboardBlockers } from './utils/blockClipboard';

function App() {
  useEffect(() => {
    applyDisplayModeToDom(loadDisplayMode());
    const timer = window.setTimeout(() => {
      void applyDisplayMode(loadDisplayMode());
    }, 200);
    const handleResize = () => updateUiScale();
    window.addEventListener('resize', handleResize);
    const removeClipboardBlockers = installClipboardBlockers();
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('resize', handleResize);
      removeClipboardBlockers();
    };
  }, []);

  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route
            path={ROUTES.LOGIN}
            element={
              <GuestRoute>
                <LoginPage />
              </GuestRoute>
            }
          />
          <Route
            path={ROUTES.LOBBY}
            element={
              <ProtectedRoute>
                <LobbyPage />
              </ProtectedRoute>
            }
          />
          <Route
            path={ROUTES.ROOM}
            element={
              <ProtectedRoute>
                <RoomPage />
              </ProtectedRoute>
            }
          />
          <Route
            path={ROUTES.BATTLE}
            element={
              <ProtectedRoute>
                <BattlePage />
              </ProtectedRoute>
            }
          />
          <Route
            path={ROUTES.RESULT}
            element={
              <ProtectedRoute>
                <ResultPage />
              </ProtectedRoute>
            }
          />
          <Route
            path={ROUTES.PRACTICE}
            element={
              <ProtectedRoute>
                <PracticePage />
              </ProtectedRoute>
            }
          />
          <Route
            path={ROUTES.BUILD}
            element={
              <ProtectedRoute>
                <BuildPage />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to={ROUTES.LOGIN} replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
