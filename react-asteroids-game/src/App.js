import React, { useState } from 'react';
import MultiplayerGame from './components/MultiplayerGame';
import MobileControls from './components/MobileControls';
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
    return <>
      <MultiplayerGame onBackToTitle={handleBackToTitle} playerName={playerName} />
      <MobileControls />
    </>;
  }

  return <>
    <TitleScreen onModeSelect={handleModeSelect} />
    <MobileControls />
  </>;
}

export default App;