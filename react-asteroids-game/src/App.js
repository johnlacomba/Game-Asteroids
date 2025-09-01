import React, { useState } from 'react';
import Game from './components/Game';
import MultiplayerGame from './components/MultiplayerGame';
import TitleScreen from './components/TitleScreen';
import './index.css';

function App() {
  const [gameMode, setGameMode] = useState(null); // null = title screen, 'offline' = game, 'multiplayer' = multiplayer

  const handleModeSelect = (mode) => {
    setGameMode(mode);
  };

  const handleBackToTitle = () => {
    setGameMode(null);
  };

  if (gameMode === 'offline') {
    return <Game onBackToTitle={handleBackToTitle} />;
  }

  if (gameMode === 'multiplayer') {
    return <MultiplayerGame onBackToTitle={handleBackToTitle} />;
  }

  return <TitleScreen onModeSelect={handleModeSelect} />;
}

export default App;