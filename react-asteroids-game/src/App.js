import React, { useState } from 'react';
import MultiplayerGame from './components/MultiplayerGame';
import TitleScreen from './components/TitleScreen';
import './index.css';

function App() {
  const [gameMode, setGameMode] = useState(null); // null = title screen, 'multiplayer' only
  const [playerName, setPlayerName] = useState('');

  const handleModeSelect = (mode, name) => {
    if (mode === 'multiplayer') {
      setPlayerName(name || 'Player');
    }
    setGameMode(mode);
  };

  const handleBackToTitle = () => {
    setGameMode(null);
  };

  if (gameMode === 'multiplayer') {
    return <MultiplayerGame onBackToTitle={handleBackToTitle} playerName={playerName} />;
  }

  return <TitleScreen onModeSelect={handleModeSelect} />;
}

export default App;