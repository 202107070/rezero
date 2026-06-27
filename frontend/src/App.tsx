import { useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { ROUTES } from './constants/routes';
import LobbyPage from './pages/lobby/LobbyPage';
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
    <BrowserRouter>
      <Routes>
        <Route path={ROUTES.LOBBY} element={<LobbyPage />} />
        <Route path={ROUTES.ROOM} element={<RoomPage />} />
        <Route path={ROUTES.BATTLE} element={<BattlePage />} />
        <Route path={ROUTES.RESULT} element={<ResultPage />} />
        <Route path={ROUTES.PRACTICE} element={<PracticePage />} />
        <Route path={ROUTES.BUILD} element={<BuildPage />} />
        <Route path="*" element={<Navigate to={ROUTES.LOBBY} replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
