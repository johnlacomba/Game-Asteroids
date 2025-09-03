import React, { useState, useEffect } from 'react';
import MultiplayerGame from './components/MultiplayerGame';
import MobileControls from './components/MobileControls';
import TitleScreen from './components/TitleScreen';
import './index.css';

function App() {
  const [gameMode, setGameMode] = useState(null); // null = title screen, 'multiplayer' only
  const [playerName, setPlayerName] = useState('');
  const [serverAddress, setServerAddress] = useState(null); // host/IP chosen on title screen
  const [isHost, setIsHost] = useState(false);

  // If user closes tab while still on title screen (no game started), shut down dev servers
  useEffect(() => {
    const host = window.location.hostname;
    const handleUnload = () => {
      if (gameMode === null) {
        try { navigator.sendBeacon && navigator.sendBeacon(`http://${host}:5002/shutdown`); } catch(e) {}
      }
    };
    window.addEventListener('beforeunload', handleUnload);
    return () => window.removeEventListener('beforeunload', handleUnload);
  }, [gameMode]);

  const handleModeSelect = (mode, name, opts = {}) => {
    if (mode === 'multiplayer') {
      setPlayerName(name || 'Player');
      if (opts.serverAddress) setServerAddress(opts.serverAddress);
      setIsHost(!!opts.isHost);
    }
    setGameMode(mode);
  };

  const handleBackToTitle = () => {
    // If host returning to title, request backend & dev server shutdown (dev only)
    if (isHost) {
      try { fetch('http://'+window.location.hostname+':5002/shutdown', { method:'POST' }); } catch(e) {}
    }
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