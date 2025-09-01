import React, { useEffect, useRef, useState, useCallback } from 'react';
import io from 'socket.io-client';
import { handleInput, cleanup } from '../core/inputController';
import Asteroid from './Asteroid';

const MultiplayerGame = ({ onBackToTitle }) => {
  const canvasRef = useRef(null);
  const socketRef = useRef(null);
  const playerIdRef = useRef(null);
  const [gameState, setGameState] = useState(null);
  const [connected, setConnected] = useState(false);
  const [playerCount, setPlayerCount] = useState(0);
  const [showUfoWarning, setShowUfoWarning] = useState(false);
  const lastInputRef = useRef({ keys: {}, rotation: 0 });
  const animationFrameRef = useRef(null);
  const rotationRef = useRef(0);

  // Cache for asteroid instances
  const asteroidInstancesRef = useRef(new Map());

  const getAsteroidInstance = (asteroidData) => {
    const key = asteroidData.id;
    
    if (!asteroidInstancesRef.current.has(key)) {
      const asteroidInstance = new Asteroid({
        position: asteroidData.position,
        size: asteroidData.radius
      });
      
      asteroidInstance.position = asteroidData.position;
      asteroidInstance.rotation = asteroidData.rotation;
      asteroidInstance.id = asteroidData.id;
      
      asteroidInstancesRef.current.set(key, asteroidInstance);
    } else {
      const instance = asteroidInstancesRef.current.get(key);
      instance.position = asteroidData.position;
      instance.rotation = asteroidData.rotation;
    }
    
    return asteroidInstancesRef.current.get(key);
  };

  // Initialize socket connection
  useEffect(() => {
    socketRef.current = io('http://localhost:5001');

    socketRef.current.on('connect', () => {
      setConnected(true);
      const playerName = `Player ${Math.floor(Math.random() * 1000)}`;
      socketRef.current.emit('joinGame', playerName);
    });

    socketRef.current.on('playerJoined', (data) => {
      playerIdRef.current = data.playerId;
    });

    socketRef.current.on('gameState', (state) => {
      if (state.players) {
        state.players = state.players.map(player => ({
          ...player,
          activePowerups: new Map(Object.entries(player.activePowerups || {}))
        }));
      }
      
      // Clean up asteroid instances that no longer exist
      if (state.asteroids) {
        const serverAsteroidIds = new Set(state.asteroids.map(a => a.id));
        asteroidInstancesRef.current.forEach((instance, id) => {
          if (!serverAsteroidIds.has(id)) {
            asteroidInstancesRef.current.delete(id);
          }
        });
      }
      
      setGameState(state);
    });

    socketRef.current.on('playerCount', (count) => {
      setPlayerCount(count);
    });

    socketRef.current.on('ufoSwarmIncoming', () => {
      setShowUfoWarning(true);
      setTimeout(() => setShowUfoWarning(false), 2000);
    });

    socketRef.current.on('disconnect', () => {
      setConnected(false);
    });

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
      cleanup();
    };
  }, []);

  // Input and rendering loop
  const gameLoop = useCallback(() => {
    if (!connected || !gameState) {
      animationFrameRef.current = requestAnimationFrame(gameLoop);
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) {
      animationFrameRef.current = requestAnimationFrame(gameLoop);
      return;
    }

    const context = canvas.getContext('2d');
    canvas.width = 1024;
    canvas.height = 768;

    const myPlayer = gameState.players.find(p => p.id === playerIdRef.current);
    if (!myPlayer) {
      animationFrameRef.current = requestAnimationFrame(gameLoop);
      return;
    }

    // Handle input
    const keys = handleInput();
    
    if (keys.a) {
      rotationRef.current -= 5;
    }
    if (keys.d) {
      rotationRef.current += 5;
    }

    rotationRef.current = ((rotationRef.current % 360) + 360) % 360;

    const currentInput = {
      keys: {
        w: keys.w,
        s: keys.s,
        a: keys.a,
        d: keys.d,
        space: keys[' ']
      },
      rotation: rotationRef.current
    };

    const inputChanged = JSON.stringify(currentInput) !== JSON.stringify(lastInputRef.current);
    if (inputChanged) {
      socketRef.current.emit('playerInput', currentInput);
      lastInputRef.current = { ...currentInput };
    }

    // Clear canvas
    context.fillStyle = 'black';
    context.fillRect(0, 0, canvas.width, canvas.height);

    // Set up camera
    context.save();
    const cameraX = myPlayer.position.x - canvas.width / 2;
    const cameraY = myPlayer.position.y - canvas.height / 2;
    context.translate(-cameraX, -cameraY);

    // Draw stars
    context.fillStyle = 'white';
    gameState.stars.forEach(star => {
      context.beginPath();
      context.arc(star.x, star.y, star.radius, 0, 2 * Math.PI);
      context.fill();
    });

    // Draw world border
    context.strokeStyle = 'white';
    context.lineWidth = 4;
    context.strokeRect(0, 0, 3000, 2000);

    // Draw players
    gameState.players.forEach(player => {
      if (player.delete) return;
      
      context.save();
      context.translate(player.position.x, player.position.y);
      context.rotate(player.rotation * Math.PI / 180);
      
      const isMe = player.id === playerIdRef.current;
      context.strokeStyle = isMe ? '#00FFFF' : '#FFFF00';
      context.lineWidth = 2;
      
      // Draw ship
      context.beginPath();
      context.moveTo(0, -10);
      context.lineTo(-8, 10);
      context.lineTo(0, 5);
      context.lineTo(8, 10);
      context.closePath();
      context.stroke();
      
      context.restore();
      
      // Draw player name (locked horizontal above ship)
      context.save();
      context.translate(player.position.x, player.position.y);
      context.fillStyle = isMe ? '#00FFFF' : '#FFFF00';
      context.font = '12px Arial';
      context.textAlign = 'center';
      context.fillText(player.name, 0, -20);
      context.restore();
    });

    // Draw bullets
    gameState.bullets.forEach(bullet => {
      context.save();
      context.translate(bullet.position.x, bullet.position.y);
      context.fillStyle = bullet.bouncing ? '#00FFFF' : '#FFFFFF';
      context.beginPath();
      context.arc(0, 0, bullet.radius, 0, 2 * Math.PI);
      context.fill();
      context.restore();
    });

    // Draw UFO bullets
    gameState.ufoBullets.forEach(bullet => {
      context.save();
      context.translate(bullet.position.x, bullet.position.y);
      context.fillStyle = '#FF4444';
      context.beginPath();
      context.arc(0, 0, bullet.radius, 0, 2 * Math.PI);
      context.fill();
      context.restore();
    });

    // Draw asteroids using the same Asteroid class as offline mode
    gameState.asteroids.forEach(asteroidData => {
      const asteroidInstance = getAsteroidInstance(asteroidData);
      asteroidInstance.draw(context);
    });

    // Draw powerups
    gameState.powerups.forEach(powerup => {
      const shouldFlash = powerup.lifeTimer <= 5 * 60;
      const flashProgress = shouldFlash ? 1 - (powerup.lifeTimer / (5 * 60)) : 0;
      const flashRate = 0.1 + (flashProgress * 0.7);
      const shouldDraw = !shouldFlash || Math.sin(powerup.lifeTimer * (0.1 + flashProgress * 0.4)) > (0.5 - flashRate);

      if (shouldDraw) {
        context.save();
        context.translate(powerup.position.x, powerup.position.y);
        
        const colors = {
          rapidFire: '#00FFFF',
          invulnerability: '#FFFF00',
          spreadShot: '#FF00FF',
          homingShot: '#00FF00',
          speedUp: '#FFA500',
          powerShot: '#FF0000',
          bouncingBullets: '#00FFFF',
        };
        
        context.strokeStyle = colors[powerup.type] || '#FFFFFF';
        context.lineWidth = 2;
        context.strokeRect(-15, -15, 30, 30);
        
        context.fillStyle = colors[powerup.type] || '#FFFFFF';
        context.font = 'bold 12px Arial';
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        
        const letters = {
          rapidFire: 'R',
          invulnerability: 'I',
          spreadShot: 'SS',
          homingShot: 'H',
          speedUp: 'P',
          powerShot: 'PS',
          bouncingBullets: 'BB',
        };
        
        context.fillText(letters[powerup.type] || '?', 0, 0);
        context.restore();
      }
    });

    // Draw UFOs
    gameState.ufos.forEach(ufo => {
      context.save();
      context.translate(ufo.position.x, ufo.position.y);
      context.strokeStyle = 'white';
      context.lineWidth = 2;
      context.beginPath();
      context.ellipse(0, 0, 15, 9, 0, 0, 2 * Math.PI);
      context.stroke();
      context.beginPath();
      context.arc(0, -3, 9, Math.PI, 0, false);
      context.stroke();
      context.restore();
    });

    context.restore();

    // Draw UI
    context.fillStyle = 'white';
    context.font = '20px Arial';
    context.textAlign = 'left';
    context.fillText(`Score: ${myPlayer.score}`, 20, 30);
    context.fillText(`Lives: ${myPlayer.lives}`, 20, 55);
    context.fillText(`Players: ${playerCount}`, 20, 80);

    // Draw active powerups
    let powerupY = 110;
    if (myPlayer.activePowerups && myPlayer.activePowerups.forEach) {
      myPlayer.activePowerups.forEach((powerup, type) => {
        const seconds = Math.ceil(powerup.duration / 60);
        const stackText = powerup.stack > 1 ? ` (x${powerup.stack})` : '';
        context.fillText(`${type}${stackText}: ${seconds}s`, 20, powerupY);
        powerupY += 25;
      });
    }

    // Draw UFO warning
    if (showUfoWarning) {
      context.fillStyle = `rgba(255, 0, 0, ${Math.sin(Date.now() * 0.01) * 0.5 + 0.5})`;
      context.font = 'bold 36px Arial';
      context.textAlign = 'center';
      context.fillText('UFO SWARM INCOMING!', canvas.width / 2, 100);
    }

    animationFrameRef.current = requestAnimationFrame(gameLoop);
  }, [connected, gameState, playerCount, showUfoWarning]);

  useEffect(() => {
    animationFrameRef.current = requestAnimationFrame(gameLoop);
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [gameLoop]);

  useEffect(() => {
    const handleKeyPress = (e) => {
      if (e.key === 'Escape' && onBackToTitle) {
        onBackToTitle();
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [onBackToTitle]);

  if (!connected) {
    return (
      <div style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        color: 'white',
        fontSize: '24px',
        textAlign: 'center'
      }}>
        Connecting to server...
        <p style={{ fontSize: '16px', marginTop: '20px' }}>
          Press <strong>Escape</strong> to return to Title Screen
        </p>
      </div>
    );
  }

  if (!gameState) {
    return (
      <div style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        color: 'white',
        fontSize: '24px',
        textAlign: 'center'
      }}>
        Waiting for game to start...
        <p style={{ fontSize: '16px', marginTop: '20px' }}>
          Players connected: {playerCount}
        </p>
        <p style={{ fontSize: '16px', marginTop: '10px' }}>
          Press <strong>Escape</strong> to return to Title Screen
        </p>
      </div>
    );
  }

  return <canvas ref={canvasRef} />;
};

export default MultiplayerGame;