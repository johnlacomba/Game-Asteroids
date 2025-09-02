import React, { useState } from 'react';
import MultiplayerGame from './components/MultiplayerGame';
import TitleScreen from './components/TitleScreen';
import './index.css';

function App() {
  const [gameMode, setGameMode] = useState(null); // null = title screen, 'multiplayer' only

  const handleModeSelect = (mode) => {
    setGameMode(mode);
  };

  const handleBackToTitle = () => {
    setGameMode(null);
  };

  if (gameMode === 'multiplayer') {
    return <MultiplayerGame onBackToTitle={handleBackToTitle} />;
  }

  return <TitleScreen onModeSelect={handleModeSelect} />;
}

export default App;