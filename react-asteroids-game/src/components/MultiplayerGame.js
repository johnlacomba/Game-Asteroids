import React, { useEffect, useRef, useState, useCallback } from 'react';
import io from 'socket.io-client';
import { handleInput, cleanup } from '../core/inputController';
import Asteroid from './Asteroid';
import UFO from './UFO';
import Debris from './Debris';

const MultiplayerGame = ({ onBackToTitle }) => {
  const canvasRef = useRef(null);
  const socketRef = useRef(null);
  const playerIdRef = useRef(null);
  const [gameState, setGameState] = useState(null);
  const [connected, setConnected] = useState(false);
  // Removed player count display
  const [showUfoWarning, setShowUfoWarning] = useState(false);
  const animationFrameRef = useRef(null);
  const rotationRef = useRef(0);
  
  // Cache for asteroid & UFO instances
  const asteroidInstancesRef = useRef(new Map());
  const ufoInstancesRef = useRef(new Map());
  // Debris per player id
  const debrisMapRef = useRef(new Map()); // id -> array of Debris
  const prevDeadRef = useRef(new Map()); // id -> boolean
  // UFO explosion debris
  const ufoDebrisMapRef = useRef(new Map()); // ufoId -> Debris[]
  const processedExplodingUFORef = useRef(new Set());

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

  const getUFOInstance = (ufoData) => {
    const key = ufoData.id;
    if (!ufoInstancesRef.current.has(key)) {
      const ufoInstance = new UFO({ position: ufoData.position, velocity: { x: 0, y: 0 } });
      ufoInstance.position = ufoData.position;
      ufoInstance.id = ufoData.id;
      ufoInstancesRef.current.set(key, ufoInstance);
    } else {
      const inst = ufoInstancesRef.current.get(key);
      inst.position = ufoData.position;
    }
    return ufoInstancesRef.current.get(key);
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
      // Clean up UFO instances that no longer exist
      if (state.ufos) {
        const serverUfoIds = new Set(state.ufos.map(u => u.id));
        ufoInstancesRef.current.forEach((instance, id) => {
          if (!serverUfoIds.has(id)) {
            ufoInstancesRef.current.delete(id);
          }
        });
      }
      
      setGameState(state);
    });

  // playerCount no longer tracked/displayed

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

    // Handle input EVERY FRAME - same as offline mode
    const keys = handleInput();
    
    if (keys.a) {
      rotationRef.current -= 5;
    }
    if (keys.d) {
      rotationRef.current += 5;
    }

    rotationRef.current = ((rotationRef.current % 360) + 360) % 360;

    // Always send input every frame, don't check if it changed
    const currentInput = {
      keys: {
        w: keys.w || false,
        s: keys.s || false,
        a: keys.a || false,
        d: keys.d || false,
        space: keys[' '] || false
      },
      rotation: rotationRef.current
    };
    
    socketRef.current.emit('playerInput', currentInput);

    // Clear canvas
    context.fillStyle = 'black';
    context.fillRect(0, 0, canvas.width, canvas.height);

    // Set up camera
    context.save();
  // If dead, lock camera on death position
  const camTarget = (myPlayer.dead && myPlayer.deathPosition) ? myPlayer.deathPosition : myPlayer.position;
  const cameraX = camTarget.x - canvas.width / 2;
  const cameraY = camTarget.y - canvas.height / 2;
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

    // Draw players (skip drawing ship geometry if dead so debris is visible)
  gameState.players.forEach(player => {
      
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
  if (!player.dead) context.stroke();
      
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

    // Draw UFOs & spawn explosion debris when exploding
    if (gameState.ufos) {
      gameState.ufos.forEach(ufoData => {
        if (ufoData.exploding) {
          if (!processedExplodingUFORef.current.has(ufoData.id)) {
            // Create debris pieces similar to ship but with more segments
            const r = ufoData.radius || 15;
            const segments = [];
            // Rectangle points (relative)
            const p1 = { x: -r, y: -r/2 };
            const p2 = { x: r, y: -r/2 };
            const p3 = { x: r/2, y: r/2 };
            const p4 = { x: -r/2, y: r/2 };
            // Edge segments
            segments.push([p1, p2], [p2, p3], [p3, p4], [p4, p1]);
            // Diagonals / interior breakup
            segments.push([p1, p3], [p2, p4]);
            // Dome approximation (top arc broken into 3 small chords)
            const domeA = { x: -r * 0.6, y: -r/2 };
            const domeB = { x: 0, y: -r * 0.8 };
            const domeC = { x: r * 0.6, y: -r/2 };
            segments.push([domeA, domeB], [domeB, domeC]);
            // Smaller interior cross
            segments.push([{ x: -r/2, y: 0 }, { x: r/2, y: 0 }]);
            // Create Debris pieces
            const debrisPieces = segments.map(seg => new Debris({
              position: { x: ufoData.position.x, y: ufoData.position.y },
              shape: seg
            }));
            ufoDebrisMapRef.current.set(ufoData.id, debrisPieces);
            processedExplodingUFORef.current.add(ufoData.id);
          }
          // Do not draw intact UFO while exploding; debris will render below
        } else {
          const ufoInst = getUFOInstance(ufoData);
          ufoInst.draw(context);
        }
      });
    }

    // Debris: spawn on new deaths & draw/update within world transform
    const shipSegments = [
      [{ x: 0, y: -10 }, { x: -8, y: 10 }],
      [{ x: -8, y: 10 }, { x: 0, y: 5 }],
      [{ x: 0, y: 5 }, { x: 8, y: 10 }],
      [{ x: 8, y: 10 }, { x: 0, y: -10 }]
    ];
    gameState.players.forEach(player => {
      const wasDead = prevDeadRef.current.get(player.id) || false;
      if (player.dead && !wasDead && player.deathPosition) {
        const debrisPieces = shipSegments.map(seg => new Debris({
          position: { x: player.deathPosition.x, y: player.deathPosition.y },
          shape: seg
        }));
        debrisMapRef.current.set(player.id, debrisPieces);
      }
      prevDeadRef.current.set(player.id, player.dead);
    });
    // Remove debris for players no longer present
    const currentIds = new Set(gameState.players.map(p => p.id));
    Array.from(debrisMapRef.current.keys()).forEach(id => { if (!currentIds.has(id)) debrisMapRef.current.delete(id); });
    // Update/draw debris (world space)
    debrisMapRef.current.forEach((pieces, pid) => {
      pieces.forEach(piece => { piece.update(); piece.draw(context); });
      const remaining = pieces.filter(p => !p.delete);
      if (remaining.length === 0) debrisMapRef.current.delete(pid); else debrisMapRef.current.set(pid, remaining);
    });

    // Update & draw UFO explosion debris
    ufoDebrisMapRef.current.forEach((pieces, uid) => {
      pieces.forEach(piece => { piece.update(); piece.draw(context); });
      const remaining = pieces.filter(p => !p.delete);
      if (remaining.length === 0) {
        ufoDebrisMapRef.current.delete(uid);
      } else {
        ufoDebrisMapRef.current.set(uid, remaining);
      }
    });

    context.restore();

    // Draw UI (screen space)
    context.fillStyle = 'white';
    context.font = '20px Arial';
    context.textAlign = 'left';
  context.fillText(`Score: ${myPlayer.score}`, 20, 30);
    context.fillText(`High: ${myPlayer.highScore || 0}`, 20, 55);
    if (gameState.leader) {
      context.fillText(`Top: ${gameState.leader.name} ${gameState.leader.best}`, 20, 80);
    }

    // Draw active powerups
  let powerupY = gameState.leader ? 105 : 80;
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
  }, [connected, gameState, showUfoWarning]);

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
        
        <p style={{ fontSize: '16px', marginTop: '10px' }}>
          Press <strong>Escape</strong> to return to Title Screen
        </p>
      </div>
    );
  }

  return <canvas ref={canvasRef} />;
};

export default MultiplayerGame;