import React, { useState } from 'react';
import MultiplayerGame from './components/MultiplayerGame';
import MobileControls from './components/MobileControls';
import TitleScreen from './components/TitleScreen';
import './index.css';

function App() {
  const [gameMode, setGameMode] = useState(null); // null = title screen, 'multiplayer' only
  const [playerName, setPlayerName] = useState('');
  const [serverAddress, setServerAddress] = useState(null); // host/IP chosen on title screen
  const [isHost, setIsHost] = useState(false);

  const handleModeSelect = (mode, name, opts = {}) => {
    if (mode === 'multiplayer') {
      setPlayerName(name || 'Player');
      if (opts.serverAddress) setServerAddress(opts.serverAddress);
      setIsHost(!!opts.isHost);
    }
    setGameMode(mode);
  };

  const handleBackToTitle = () => {
    setGameMode(null);
  };

  if (gameMode === 'multiplayer') {
    return <>
  <MultiplayerGame onBackToTitle={handleBackToTitle} playerName={playerName} serverAddress={serverAddress} isHost={isHost} />
      <MobileControls />
    </>;
  }

  return <>
    <TitleScreen onModeSelect={handleModeSelect} />
    <MobileControls />
  </>;
}

export default App;