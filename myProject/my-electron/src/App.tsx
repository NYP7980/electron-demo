// src/App.tsx
// 根组件：HashRouter 路由 + 持久导航栏 + 玩家身份上下文
import { useState } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import './App.css';
import NavBar from './components/NavBar';
import NicknameModal from './components/NicknameModal';
import FeatureDemoPage from './pages/FeatureDemoPage';
import GameRoomPage from './pages/GameRoomPage';
import { PlayerProvider, usePlayer } from './contexts/PlayerContext';
import { RoomProvider } from './contexts/RoomContext';

function AppInner() {
  const { state } = usePlayer();
  // Show modal on first launch when no nickname has been set yet
  // (state.nickname === null means either never set or explicitly skipped)
  // We track whether the user has dismissed the modal this session
  const [modalDismissed, setModalDismissed] = useState(false);
  const [showModal, setShowModal] = useState(() => {
    return localStorage.getItem('player_nickname') === null;
  });

  const openModal = () => setShowModal(true);
  const closeModal = () => { setShowModal(false); setModalDismissed(true); };

  return (
    <div className="app">
      <NavBar onOpenNicknameModal={openModal} />
      {showModal && <NicknameModal onClose={closeModal} />}
      <Routes>
        <Route path="/demo" element={<FeatureDemoPage />} />
        <Route path="/game" element={<GameRoomPage />} />
        <Route path="*" element={<Navigate to="/demo" replace />} />
      </Routes>
    </div>
  );
}

function App() {
  return (
    <PlayerProvider>
      <RoomProvider>
        <HashRouter>
          <AppInner />
        </HashRouter>
      </RoomProvider>
    </PlayerProvider>
  );
}

export default App;
