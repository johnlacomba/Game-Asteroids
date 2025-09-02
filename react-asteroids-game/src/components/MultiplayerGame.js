import React, { useEffect, useRef, useState, useCallback } from 'react';
import io from 'socket.io-client';
import { handleInput, cleanup } from '../core/inputController';
import { getJoystickVector } from '../core/mobileInput';
import Asteroid from './Asteroid';
import UFO from './UFO';
import Debris from './Debris';

const MultiplayerGame = ({ onBackToTitle, playerName, serverAddress, isHost }) => {
  const canvasRef = useRef(null);
  const socketRef = useRef(null);
  const playerIdRef = useRef(null);
  const [gameState, setGameState] = useState(null);
  const previousStateRef = useRef(null);
  const lastReceiveTimeRef = useRef(0);
  const serverTickIntervalMs = 1000 / 60; // matches server broadcast (updated from 30Hz)
  const [connected, setConnected] = useState(false);
  // Removed player count display
  const [showUfoWarning, setShowUfoWarning] = useState(false);
  const animationFrameRef = useRef(null);
  const rotationRef = useRef(0);
  const showScoreboardRef = useRef(false);
  const scoreboardHitRegionsRef = useRef([]); // store clickable scoreboard buttons (bot remove, add bot)
  const followedPlayerIdRef = useRef(null); // camera follow target (other player)
  
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
  // Dynamic base URL for LAN: use current hostname; assume server port 5001 unless overridden
  const host = serverAddress || window.location.hostname;
  const port = 5001; // keep in sync with server PORT
  socketRef.current = io(`http://${host}:${port}`);

    socketRef.current.on('connect', () => {
      setConnected(true);
      const finalName = (playerName && playerName.trim().slice(0,20)) || `Player ${Math.floor(Math.random() * 1000)}`;
      socketRef.current.emit('joinGame', finalName, { isHost: !!isHost });
    });

    socketRef.current.on('playerJoined', (data) => {
      playerIdRef.current = data.playerId;
    });

  socketRef.current.on('gameState', (state) => {
      previousStateRef.current = gameState || state;
      if (state.players) {
        state.players = state.players.map(player => ({
          ...player,
          activePowerups: new Map(Object.entries(player.activePowerups || {}))
        }));
      }
      lastReceiveTimeRef.current = performance.now();
      
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

  // removed bulletDiag and bulletReplicated handlers

    const handleUnload = () => {
      if (isHost) {
        try { navigator.sendBeacon && navigator.sendBeacon(`http://${host}:${port}/hostDisconnect`); } catch(e) {}
      }
    };
    window.addEventListener('beforeunload', handleUnload);
    return () => {
      window.removeEventListener('beforeunload', handleUnload);
      if (socketRef.current) socketRef.current.disconnect();
      cleanup();
      if (isHost) {
        // Secondary attempt if component unmounts without beforeunload
        try { fetch(`http://${host}:${port}/hostDisconnect`, { method:'POST', keepalive:true }); } catch(e) {}
      }
    };
  }, [playerName, serverAddress, isHost]);

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

    // Interpolate snapshot
    let renderState = gameState;
    if (previousStateRef.current && previousStateRef.current !== gameState) {
      const dt = performance.now() - lastReceiveTimeRef.current;
      const t = Math.min(1, dt / serverTickIntervalMs);
      const interp = (prevArr, curArr) => curArr.map(obj => {
        const prev = prevArr.find(o => o.id === obj.id) || obj;
  // Skip interpolation only for very new bullets for minor smoothing
  if (obj.lifeTime !== undefined && obj.lifeTime <= 2) return obj;
        if (obj.position && prev.position) {
          return { ...obj, position: { x: prev.position.x + (obj.position.x - prev.position.x) * t, y: prev.position.y + (obj.position.y - prev.position.y) * t } };
        }
        return obj;
      });
      renderState = { ...gameState };
      if (gameState.players) renderState.players = interp(previousStateRef.current.players || [], gameState.players);
      if (gameState.asteroids) renderState.asteroids = interp(previousStateRef.current.asteroids || [], gameState.asteroids);
      if (gameState.ufos) renderState.ufos = interp(previousStateRef.current.ufos || [], gameState.ufos);
      if (gameState.bullets) renderState.bullets = interp(previousStateRef.current.bullets || [], gameState.bullets);
      if (gameState.ufoBullets) renderState.ufoBullets = interp(previousStateRef.current.ufoBullets || [], gameState.ufoBullets);
      if (gameState.powerups) renderState.powerups = interp(previousStateRef.current.powerups || [], gameState.powerups);
      if (gameState.stars) renderState.stars = interp(previousStateRef.current.stars || [], gameState.stars);
    }

    // Handle input EVERY FRAME - same as offline mode
    const keys = handleInput();
    
    if (keys.a) {
      rotationRef.current -= 5;
    }
    if (keys.d) {
      rotationRef.current += 5;
    }

    // Joystick aim support
    let joy = { x: 0, y: 0 };
    try { joy = getJoystickVector(); } catch (e) {}
    const joyMag = Math.hypot(joy.x, joy.y);
    if (joyMag > 0.05) {
      const desired = Math.atan2(joy.x, -joy.y) * 180 / Math.PI; // matches Player.js mapping
      let delta = desired - rotationRef.current;
      delta = ((delta + 180) % 360 + 360) % 360 - 180;
      const step = Math.sign(delta) * Math.min(Math.abs(delta), 5);
      rotationRef.current += step;
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
  currentInput.keys.w = (joyMag > 0.1) || keys.w || false;
  currentInput.keys.s = (! (joyMag > 0.1) && keys.s) || false;
    
    socketRef.current.emit('playerInput', currentInput);

    // Resolve myPlayer reference (may be missing causing undefined errors)
    const myPlayer = renderState.players && renderState.players.find(p => p.id === playerIdRef.current) || (renderState.players ? renderState.players[0] : null);
    if (!myPlayer) {
      animationFrameRef.current = requestAnimationFrame(gameLoop);
      return;
    }

    // Clear canvas
    context.fillStyle = 'black';
    context.fillRect(0, 0, canvas.width, canvas.height);

    // Set up camera (optionally follow another player selected from scoreboard)
    context.save();
    let followed = null;
    if (followedPlayerIdRef.current && renderState.players) {
      followed = renderState.players.find(p => p.id === followedPlayerIdRef.current) || null;
      // Auto-cancel if target disappeared
      if (!followed) followedPlayerIdRef.current = null;
    }
    const cameraPlayer = followed || myPlayer;
    const camTarget = (cameraPlayer.dead && cameraPlayer.deathPosition) ? cameraPlayer.deathPosition : cameraPlayer.position;
    const cameraX = camTarget.x - canvas.width / 2;
    const cameraY = camTarget.y - canvas.height / 2;
    context.translate(-cameraX, -cameraY);

    // Draw stars
    context.fillStyle = 'white';
  renderState.stars.forEach(star => {
      context.beginPath();
      context.arc(star.x, star.y, star.radius, 0, 2 * Math.PI);
      context.fill();
    });

    // Draw world border
    context.strokeStyle = 'white';
    context.lineWidth = 4;
    context.strokeRect(0, 0, 3000, 2000);

    // Draw players (skip drawing ship geometry if dead so debris is visible)
    renderState.players.forEach(player => {
      const shipColor = player.color || '#CCCCCC';
      context.save();
      context.translate(player.position.x, player.position.y);
      context.rotate(player.rotation * Math.PI / 180);
      context.strokeStyle = shipColor;
      context.lineWidth = 2;
      context.beginPath();
      context.moveTo(0, -10);
      context.lineTo(-8, 10);
      context.lineTo(0, 5);
      context.lineTo(8, 10);
      context.closePath();
      if (!player.dead) context.stroke();
      // Shield visuals (uses activePowerups map entries)
      const shield = player.activePowerups && player.activePowerups.get && player.activePowerups.get('shield');
      if (!player.dead && shield && shield.stack) {
        context.save();
        const layers = Math.min(3, shield.stack);
        for (let i=0;i<layers;i++) {
          context.beginPath();
          const radius = 16 + i*5; // base radius just outside ship
          context.strokeStyle = 'rgba(58,140,255,' + (0.6 - i*0.15) + ')';
          context.lineWidth = 2;
          context.arc(0,0,radius,0,Math.PI*2);
          context.stroke();
        }
        context.restore();
      }
      context.restore();
      // Name label
      context.save();
      context.translate(player.position.x, player.position.y);
      context.fillStyle = shipColor;
      context.font = '12px Arial';
      context.textAlign = 'center';
      context.fillText(player.name, 0, -20);
      context.restore();
    });

    // Draw bullets (match owning player's color; keep bouncing same color, just larger radius already handled server side)
    renderState.bullets.forEach(bullet => {
      const owner = renderState.players.find(p => p.id === bullet.playerId);
      const color = owner && owner.color ? owner.color : '#FFFFFF';
      context.save();
      context.translate(bullet.position.x, bullet.position.y);
      context.fillStyle = color;
      context.beginPath();
      context.arc(0, 0, bullet.radius, 0, 2 * Math.PI);
      context.fill();
      context.restore();
    });

    // Draw UFO bullets
  renderState.ufoBullets.forEach(bullet => {
      context.save();
      context.translate(bullet.position.x, bullet.position.y);
      context.fillStyle = '#FF4444';
      context.beginPath();
      context.arc(0, 0, bullet.radius, 0, 2 * Math.PI);
      context.fill();
      context.restore();
    });

    // Draw asteroids using the same Asteroid class as offline mode
  renderState.asteroids.forEach(asteroidData => {
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
          rapidFire: '#00E5FF',       // bright cyan
          shield: '#3A8CFF', // blue shield
          spreadShot: '#C070FF',      // lavender
          homingShot: '#00FF7A',      // spring green
          speedUp: '#00B0FF',         // sky blue
          powerShot: '#FF8C00',       // orange (still non-red)
          bouncingBullets: '#7DFFB5', // mint
          scoreMultiplier: '#FFD700', // gold
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
          shield: 'SH',
          spreadShot: 'SS',
          homingShot: 'H',
          speedUp: 'P',
          powerShot: 'PS',
          bouncingBullets: 'BB',
          scoreMultiplier: 'SM'
        };
        
        context.fillText(letters[powerup.type] || '?', 0, 0);
        context.restore();
      }
    });

    // Draw UFOs & spawn explosion debris when exploding
    if (renderState.ufos) {
      renderState.ufos.forEach(ufoData => {
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
  if (myPlayer) {
    context.fillText(`Score: ${myPlayer.score}`, 20, 30);
    context.fillText(`High: ${myPlayer.highScore || 0}`, 20, 55);
  }
    if (gameState.leader) {
      context.fillText(`Top: ${gameState.leader.name} ${gameState.leader.best}`, 20, 80);
    }
    // Top-right object count
    if (typeof gameState.objectCount === 'number') {
      context.textAlign = 'right';
      context.fillText(`Objects: ${gameState.objectCount}`, canvas.width - 20, 30);
      context.textAlign = 'left';
    }

  // Draw active powerups
  let powerupY = gameState.leader ? 105 : 80;
    if (myPlayer && myPlayer.activePowerups && myPlayer.activePowerups.forEach) {
      myPlayer.activePowerups.forEach((powerup, type) => {
        const stackText = powerup.stack > 1 ? ` (x${powerup.stack})` : '';
        if (type === 'shield') {
          context.fillText(`${type}${stackText}`, 20, powerupY);
        } else {
          const seconds = Math.ceil(powerup.duration / 60);
          context.fillText(`${type}${stackText}: ${seconds}s`, 20, powerupY);
        }
        powerupY += 25;
      });
    }

    // Scoreboard overlay when Tab held
    if (showScoreboardRef.current && renderState.players) {
      const sortedPlayers = [...renderState.players].sort((a,b)=> (b.highScore||0) - (a.highScore||0));
      const boxWidth = 360;
      const rowHeight = 22;
      const headerHeight = 30;
      const rows = Math.min(sortedPlayers.length, 25);
      const instructionsHeight = 18; // extra space for instructions line
      const boxHeight = headerHeight + rows*rowHeight + 12 + instructionsHeight;
      context.save();
      context.globalAlpha = 0.85;
      context.fillStyle = '#000';
      context.fillRect((canvas.width-boxWidth)/2, 100, boxWidth, boxHeight);
      context.globalAlpha = 1;
      context.strokeStyle = '#FFFFFF';
      context.strokeRect((canvas.width-boxWidth)/2, 100, boxWidth, boxHeight);
      context.fillStyle = '#FFFFFF';
      context.font = '16px Arial';
      context.textAlign = 'center';
      context.fillText('Players (High Scores)', canvas.width/2, 122);
      context.textAlign = 'left';
      context.font = '13px Arial';
      let y = 142;
      scoreboardHitRegionsRef.current = [];
      // Add Bot button (top-right inside box)
      const addBtnW = 60; const addBtnH = 18;
      const addBtnX = (canvas.width + boxWidth)/2 - addBtnW - 12;
      const addBtnY = 106; // slightly below top border
      context.strokeStyle = '#55FF55';
      context.lineWidth = 1.5;
      context.strokeRect(addBtnX, addBtnY, addBtnW, addBtnH);
      context.fillStyle = '#55FF55';
      context.font = '12px Arial';
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.fillText('+ Bot', addBtnX + addBtnW/2, addBtnY + addBtnH/2 + 0.5);
      context.textAlign = 'left';
      context.textBaseline = 'alphabetic';
      scoreboardHitRegionsRef.current.push({ x: addBtnX, y: addBtnY, w: addBtnW, h: addBtnH, action: 'addBot' });
      sortedPlayers.slice(0, rows).forEach(p => {
        const isMe = p.id === playerIdRef.current;
        context.fillStyle = p.color || (isMe ? '#FFFFFF' : '#AAAAAA');
        const name = p.name || 'Player';
        context.fillText(name, (canvas.width-boxWidth)/2 + 14, y);
        context.textAlign = 'right';
        context.fillText(String(p.highScore || 0), (canvas.width+boxWidth)/2 - 14, y);
        context.textAlign = 'left';
        // Click region for following this player (avoid overlapping with score / remove bot button area)
        const nameRegionX = (canvas.width - boxWidth)/2 + 10;
        const nameRegionY = y - 16; // approximate row top (baseline - ascent)
        const nameRegionW = boxWidth - 120; // leave room for score + buttons
        const nameRegionH = rowHeight;
        scoreboardHitRegionsRef.current.push({ x: nameRegionX, y: nameRegionY, w: nameRegionW, h: nameRegionH, action: 'followPlayer', playerId: p.id });
        // Draw remove button for bots
        if (p.isBot) {
          const btnX = (canvas.width+boxWidth)/2 - 80; // shifted further left to avoid score overlap
          const btnY = y - 12; // align with text line
            const w = 14; const h = 14;
          context.strokeStyle = '#FF5555';
          context.lineWidth = 1.5;
          context.strokeRect(btnX, btnY, w, h);
          context.beginPath();
          context.moveTo(btnX+3, btnY + h/2);
          context.lineTo(btnX + w - 3, btnY + h/2);
          context.stroke();
          scoreboardHitRegionsRef.current.push({ x: btnX, y: btnY, w, h, action: 'removeBot', botId: p.id });
        }
        y += rowHeight;
      });
      context.restore();
  // Instructions line (always at bottom of box)
  context.save();
  context.font = '11px Arial';
  context.fillStyle = '#BBBBBB';
  context.textAlign = 'center';
  context.fillText('Click a player name to follow (Esc to stop)', canvas.width/2, 100 + boxHeight - 8);
  context.restore();
    }

    // Draw UFO warning
    if (showUfoWarning) {
      context.fillStyle = `rgba(255, 0, 0, ${Math.sin(Date.now() * 0.01) * 0.5 + 0.5})`;
      context.font = 'bold 36px Arial';
      context.textAlign = 'center';
      context.fillText('UFO SWARM INCOMING!', canvas.width / 2, 100);
    }

    // Follow overlay (when camera locked to another player)
    if (followedPlayerIdRef.current && followedPlayerIdRef.current !== playerIdRef.current && renderState.players) {
      const target = renderState.players.find(p => p.id === followedPlayerIdRef.current);
      if (target) {
        context.save();
        context.font = '14px Arial';
        context.fillStyle = '#CCCCCC';
        context.textAlign = 'center';
        context.fillText(`Following ${target.name} (Esc to stop)`, canvas.width/2, 70);
        context.restore();
      }
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
    // Mouse click handler for scoreboard actions (remove/add bot, follow player)
    const handleClick = (e) => {
      if (!showScoreboardRef.current) return;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const cx = e.clientX - rect.left;
      const cy = e.clientY - rect.top;
      // Scoreboard is drawn in screen space, so direct coords
      for (const region of scoreboardHitRegionsRef.current) {
        if (cx >= region.x && cx <= region.x + region.w && cy >= region.y && cy <= region.y + region.h) {
          if (socketRef.current) {
            if (region.action === 'removeBot' && region.botId) {
              socketRef.current.emit('removeBot', region.botId);
            } else if (region.action === 'addBot') {
              socketRef.current.emit('addBot');
            } else if (region.action === 'followPlayer' && region.playerId) {
              // Only follow if not myself
              if (region.playerId !== playerIdRef.current) {
                followedPlayerIdRef.current = region.playerId;
              }
            }
          }
          break;
        }
      }
    };
    window.addEventListener('click', handleClick);
    return () => window.removeEventListener('click', handleClick);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        // If currently following someone else, stop following; else exit to title
        if (followedPlayerIdRef.current && followedPlayerIdRef.current !== playerIdRef.current) {
          followedPlayerIdRef.current = null;
          return; // do not exit game
        } else if (onBackToTitle) {
          onBackToTitle();
          return;
        }
      }
      if (e.key === 'Tab') { e.preventDefault(); showScoreboardRef.current = true; }
    };
    const handleKeyUp = (e) => {
      if (e.key === 'Tab') { e.preventDefault(); showScoreboardRef.current = false; }
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => { window.removeEventListener('keydown', handleKeyDown); window.removeEventListener('keyup', handleKeyUp); };
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

  return (
    <div style={{ position: 'relative' }}>
      <canvas ref={canvasRef} width={window.innerWidth} height={window.innerHeight} style={{ display: 'block', background: 'black' }} />
    </div>
  );
};

export default MultiplayerGame;