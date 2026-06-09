import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { ROUTES } from './constants/routes';
import LobbyPage from './pages/lobby/LobbyPage';
import RoomPage from './pages/room/RoomPage';
import BattlePage from './pages/battle/BattlePage';
import ResultPage from './pages/result/ResultPage';
import PracticePage from './pages/practice/PracticePage';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path={ROUTES.LOBBY} element={<LobbyPage />} />
        <Route path={ROUTES.ROOM} element={<RoomPage />} />
        <Route path={ROUTES.BATTLE} element={<BattlePage />} />
        <Route path={ROUTES.RESULT} element={<ResultPage />} />
        <Route path={ROUTES.PRACTICE} element={<PracticePage />} />
        <Route path="*" element={<Navigate to={ROUTES.LOBBY} replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
