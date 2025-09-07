import React, { useEffect, useRef, useState } from 'react';
import Player from './Player';
import Asteroid from './Asteroid';
import Debris from './Debris';
import UFO from './UFO';
import Powerup from './Powerup';
import { handleInput } from '../core/inputController';
import { handleInput, setMouseVector, getAimRotation } from '../core/inputController';
import { checkPolygonCollision, checkCirclePolygonCollision } from '../core/collision';

const Game = ({ onBackToTitle }) => {
  const canvasRef = useRef(null);
  const bulletsRef = useRef([]);
  const ufoBulletsRef = useRef([]);
  const asteroidsRef = useRef([]);
  const debrisRef = useRef([]);
  const powerupsRef = useRef([]);
  const ufoRef = useRef(null);
  const ufosRef = useRef([]);
  const playerRef = useRef(null);
  const starsRef = useRef([]);
  const shootCooldownRef = useRef(0);
  const waveCountRef = useRef(30);
  const [isGameOver, setIsGameOver] = useState(false);
  const [resetKey, setResetKey] = useState(0);
  const gameOverRef = useRef(false);
  const scoreRef = useRef(0);
  const activePowerupsRef = useRef(new Map());
  const ufoSpawnTimerRef = useRef(0);
  const ufoWaveTimerRef = useRef(0);
  const totalPowerupsCollectedRef = useRef(0);
  const ufoSwarmFlashTimerRef = useRef(0);
  const UFO_SPAWN_TIME = 30 * 60;
  const UFO_WAVE_INTERVAL = 15 * 60;
  const BASE_SHOOT_COOLDOWN = 15;
  const WORLD_WIDTH = 3000;
  const WORLD_HEIGHT = 2000;
  const POWERUP_TYPES = ['rapidFire', 'shield', 'spreadShot', 'homingShot', 'speedUp', 'powerShot', 'bouncingBullets', 'scoreMultiplier'];
  const POWERUP_THRESHOLD = 5;
  const UFO_SWARM_SIZE = 36;
  const UFO_FLASH_DURATION = 120;

  useEffect(() => {
    const handleRestart = (e) => {
      if (e.key === 'Enter') {
        // Clear all game object arrays
        asteroidsRef.current = [];
        bulletsRef.current = [];
        ufoBulletsRef.current = [];
        debrisRef.current = [];
        powerupsRef.current = [];
        ufoRef.current = null;
        ufosRef.current = [];

        // Reset game state refs
        scoreRef.current = 0;
        gameOverRef.current = false;
        waveCountRef.current = 30;
        activePowerupsRef.current.clear();
        ufoSpawnTimerRef.current = 0;
        ufoWaveTimerRef.current = 0;
        totalPowerupsCollectedRef.current = 0;
        ufoSwarmFlashTimerRef.current = 0;
        shootCooldownRef.current = 0;

        // Trigger a full re-initialization of the game
        setIsGameOver(false);
        setResetKey(prev => prev + 1);
      } else if (e.key === 'Escape') {
        // Return to title screen
        if (onBackToTitle) {
          onBackToTitle();
        }
      }
    };

    if (isGameOver) {
      window.addEventListener('keydown', handleRestart);
    }

    return () => {
      window.removeEventListener('keydown', handleRestart);
    };
  }, [isGameOver, onBackToTitle]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');
    canvas.width = 1024;
    canvas.height = 768;

    // Generate background stars if they don't exist yet
    if (starsRef.current.length === 0) {
      const starCount = 400;
      for (let i = 0; i < starCount; i++) {
        starsRef.current.push({
          x: Math.random() * WORLD_WIDTH,
          y: Math.random() * WORLD_HEIGHT,
          radius: Math.random() * 1.2,
        });
      }
    }

    // Initialize Player
    const player = new Player({
      position: { x: WORLD_WIDTH / 2, y: WORLD_HEIGHT / 2 },
    });
    playerRef.current = player;

    const spawnPowerup = (position) => {
      if (Math.random() < 0.15) { // Changed from 0.2 (20%) to 0.15 (15%)
        const type = POWERUP_TYPES[Math.floor(Math.random() * POWERUP_TYPES.length)];
        powerupsRef.current.push(new Powerup({ position, type }));
      }
    };

    const activatePowerup = (type) => {
      const durations = {
        rapidFire: 30 * 60,
  shield: Infinity,
        spreadShot: 30 * 60,
        homingShot: 30 * 60,
        speedUp: 60 * 60,
        powerShot: 30 * 60,
        bouncingBullets: 30 * 60,
        scoreMultiplier: 30 * 60,
      };
      
      const existing = activePowerupsRef.current.get(type);
      const stack = existing ? existing.stack + 1 : 1;

      activePowerupsRef.current.set(type, {
        duration: durations[type],
        stack: stack,
      });

      // Increment total powerups collected
      totalPowerupsCollectedRef.current++;
    };

    const spawnUFO = () => {
      const side = Math.floor(Math.random() * 4);
      let position, velocity;
      const speed = 1.5;

      switch (side) {
        case 0: // Top
          position = { x: Math.random() * WORLD_WIDTH, y: -50 };
          velocity = { x: Math.random() * 2 - 1, y: speed };
          break;
        case 1: // Right
          position = { x: WORLD_WIDTH + 50, y: Math.random() * WORLD_HEIGHT };
          velocity = { x: -speed, y: Math.random() * 2 - 1 };
          break;
        case 2: // Bottom
          position = { x: Math.random() * WORLD_WIDTH, y: WORLD_HEIGHT + 50 };
          velocity = { x: Math.random() * 2 - 1, y: -speed };
          break;
        case 3: // Left
        default:
          position = { x: -50, y: Math.random() * WORLD_HEIGHT };
          velocity = { x: speed, y: Math.random() * 2 - 1 };
          break;
      }
      return new UFO({ position, velocity });
    };

    const spawnUFOWave = () => {
      // Spawn all UFOs at once
      for (let i = 0; i < UFO_SWARM_SIZE; i++) {
        ufosRef.current.push(spawnUFO());
      }
      // Trigger flash notification
      ufoSwarmFlashTimerRef.current = UFO_FLASH_DURATION;
    };

    const spawnAsteroids = (count) => {
      const safeRadius = 200;
      for (let i = 0; i < count; i++) {
        let asteroidPosition;
        let isSafe = false;
        while (!isSafe) {
          asteroidPosition = {
            x: Math.random() * WORLD_WIDTH,
            y: Math.random() * WORLD_HEIGHT,
          };
  
          const dx = asteroidPosition.x - player.position.x;
          const dy = asteroidPosition.y - player.position.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
  
          if (distance > safeRadius) {
            isSafe = true;
          }
        }
        asteroidsRef.current.push(new Asteroid({
          position: asteroidPosition
        }));
      }
    };

    // Initial spawn
    spawnAsteroids(waveCountRef.current);

    let animationFrameId;

    const gameLoop = () => {
      const currentPlayer = playerRef.current;
        // Mouse aim: set player rotation from aim and disable A/D rotation while aiming
        const aimRot = getAimRotation && getAimRotation();
        if (typeof aimRot === 'number' && !Number.isNaN(aimRot)) {
          currentPlayer.rotation = aimRot;
          keys = { ...keys, a: false, d: false };
        }

      // Update active powerups
      activePowerupsRef.current.forEach((powerup, type) => {
        if (powerup.duration - 1 <= 0) {
          activePowerupsRef.current.delete(type);
        } else {
          powerup.duration--;
        }
      });

      // Update UFO swarm flash timer
      if (ufoSwarmFlashTimerRef.current > 0) {
        ufoSwarmFlashTimerRef.current--;
      }

      // Only handle player input if the game is not over
      if (!gameOverRef.current) {
        if (shootCooldownRef.current > 0) {
          shootCooldownRef.current--;
        }
  const keys = handleInput();
  // aimRotation is computed in inputController from mouse or right-stick
  let aimRotation;
  try { const { getAimRotation } = require('../core/inputController'); aimRotation = getAimRotation(); } catch(e) {}
  const aimActive = typeof aimRotation === 'number' && !Number.isNaN(aimRotation);
        
        const rapidFirePowerup = activePowerupsRef.current.get('rapidFire');
        const rapidFireMultiplier = rapidFirePowerup ? 5 ** rapidFirePowerup.stack : 1;
        const shootCooldown = BASE_SHOOT_COOLDOWN / rapidFireMultiplier;

        // Handle shooting
        if (keys[' '] && shootCooldownRef.current <= 0) {
          const newBullets = currentPlayer.shoot(activePowerupsRef.current, aimActive ? aimRotation : undefined);
          bulletsRef.current.push(...newBullets);
          shootCooldownRef.current = shootCooldown;
        }
  // Update player (movement independent of aim)
  currentPlayer.update(keys, WORLD_WIDTH, WORLD_HEIGHT, activePowerupsRef.current, { aimRotation, aimActive });
      }

      // UFO Spawn Logic - Check if we should switch to wave mode
      if (!gameOverRef.current) {
        if (totalPowerupsCollectedRef.current >= POWERUP_THRESHOLD) {
          // Switch to overwhelming UFO wave mode
          ufoWaveTimerRef.current++;
          if (ufoWaveTimerRef.current >= UFO_WAVE_INTERVAL) {
            spawnUFOWave();
            ufoWaveTimerRef.current = 0;
          }
        } else {
          // Normal single UFO spawning
          ufoSpawnTimerRef.current++;
          if (!ufoRef.current && ufoSpawnTimerRef.current > UFO_SPAWN_TIME) {
            ufoRef.current = spawnUFO();
            ufoSpawnTimerRef.current = 0;
          }
        }
      }

      context.fillStyle = 'black';
      context.fillRect(0, 0, canvas.width, canvas.height);

      // --- Camera and World Rendering ---
      context.save();

      // Center camera on player
      const cameraX = currentPlayer.position.x - canvas.width / 2;
      const cameraY = currentPlayer.position.y - canvas.height / 2;
      context.translate(-cameraX, -cameraY);

      // Draw background stars
      context.fillStyle = 'white';
      starsRef.current.forEach(star => {
        context.beginPath();
        context.arc(star.x, star.y, star.radius, 0, 2 * Math.PI);
        context.fill();
      });

      // Draw world border
      context.strokeStyle = 'white';
      context.lineWidth = 4;
      context.strokeRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

      // Draw player if it has not been destroyed
      if (!currentPlayer.delete) {
        currentPlayer.draw(context);
        // Shield visual layers (mirror multiplayer implementation)
        const shield = activePowerupsRef.current.get && activePowerupsRef.current.get('shield');
        if (shield && shield.stack) {
          context.save();
          const layers = Math.min(3, shield.stack);
            for (let i = 0; i < layers; i++) {
              context.beginPath();
              const radius = 16 + i * 5; // base radius just outside ship
              context.strokeStyle = 'rgba(58,140,255,' + (0.6 - i * 0.15) + ')';
              context.lineWidth = 2;
              context.arc(currentPlayer.position.x, currentPlayer.position.y, radius, 0, Math.PI * 2);
              context.stroke();
            }
          context.restore();
        }
      }

      // Update and draw single UFO (legacy mode)
      if (ufoRef.current) {
        const newUfoBullets = ufoRef.current.update(WORLD_WIDTH, WORLD_HEIGHT, currentPlayer.position);
        ufoBulletsRef.current.push(...newUfoBullets);

        ufoRef.current.draw(context);
        if (ufoRef.current.delete) {
          ufoRef.current = null;
        }
      }

      // Update and draw UFO swarm
      ufosRef.current.forEach(ufo => {
        const newUfoBullets = ufo.update(WORLD_WIDTH, WORLD_HEIGHT, currentPlayer.position);
        ufoBulletsRef.current.push(...newUfoBullets);
        ufo.draw(context);
      });

      // Update and draw powerups
      powerupsRef.current.forEach(p => p.update(WORLD_WIDTH, WORLD_HEIGHT));
      powerupsRef.current.forEach(p => p.draw(context));

      // Update and draw asteroids, bullets, and debris
      asteroidsRef.current.forEach(asteroid => asteroid.update(WORLD_WIDTH, WORLD_HEIGHT));
      asteroidsRef.current.forEach(asteroid => asteroid.draw(context));

      const homingTargets = [...asteroidsRef.current, ...(ufoRef.current ? [ufoRef.current] : []), ...ufosRef.current];
      bulletsRef.current.forEach(bullet => bullet.update(WORLD_WIDTH, WORLD_HEIGHT, homingTargets));
      bulletsRef.current.forEach(bullet => bullet.draw(context));

      ufoBulletsRef.current.forEach(bullet => bullet.update(WORLD_WIDTH, WORLD_HEIGHT));
      ufoBulletsRef.current.forEach(bullet => bullet.draw(context));

      debrisRef.current.forEach(d => d.update());
      debrisRef.current.forEach(d => d.draw(context));

      // --- End Camera ---
      context.restore();

      // --- UI Rendering (fixed on screen) ---
      // Draw Score
      context.fillStyle = 'white';
      context.font = '24px Arial';
      context.textAlign = 'left';
      context.textBaseline = 'top';
      context.fillText(`Score: ${scoreRef.current}`, 20, 20);

      // Draw UFO Swarm Flash Notification (if active)
      if (ufoSwarmFlashTimerRef.current > 0) {
        const flashIntensity = Math.sin((UFO_FLASH_DURATION - ufoSwarmFlashTimerRef.current) * 0.3) * 0.5 + 0.5;
        const alpha = flashIntensity;
        context.fillStyle = `rgba(255, 0, 0, ${alpha})`;
        context.font = 'bold 36px Arial';
        context.textAlign = 'center';
        context.fillText('UFO SWARM INCOMING!', canvas.width / 2, 50);
        context.textAlign = 'left'; // Reset alignment
        context.font = '24px Arial'; // Reset font
        context.fillStyle = 'white'; // Reset color
      }

      // Draw Active Powerups
      let powerupY = 50;
      activePowerupsRef.current.forEach((powerup, type) => {
        const stackText = powerup.stack > 1 ? ` (x${powerup.stack})` : '';
        if (type === 'shield') {
          context.fillText(`${type}${stackText}`, 20, powerupY);
        } else {
          const seconds = Math.ceil(powerup.duration / 60);
          context.fillText(`${type}${stackText}: ${seconds}s`, 20, powerupY);
        }
        powerupY += 25;
      });

      // Collision Detection: Bullets with Asteroids
      bulletsRef.current.forEach(bullet => {
        asteroidsRef.current.forEach(asteroid => {
          if (checkCirclePolygonCollision(bullet, asteroid.getPolygon())) {
            bullet.delete = true;
            const damage = bullet.damage || 1;
            let hitPointsRemaining = asteroid.hitPoints - damage;
            
            if (hitPointsRemaining <= 0) {
              let mult = 1;
              const sm = activePowerupsRef.current.get('scoreMultiplier');
              if (sm) mult = 1 + 0.5 * (sm.stack - 1);
              scoreRef.current += Math.floor(100 * mult);
              spawnPowerup(asteroid.position);
              asteroid.destroy();
            } else {
              for (let i = 0; i < damage; i++) {
                asteroid.hit();
                if (asteroid.delete) break;
              }
            }
          }
        });
      });

      // Collision Detection: Bullets with UFOs (both single and swarm)
      const allUfos = [...(ufoRef.current ? [ufoRef.current] : []), ...ufosRef.current];
      allUfos.forEach(ufo => {
        const ufoPolygon = ufo.getPolygon();
        bulletsRef.current.forEach(bullet => {
          if (!bullet.delete && checkCirclePolygonCollision(bullet, ufoPolygon)) {
            bullet.delete = true;
            ufo.destroy();
            let mult = 1;
            const sm = activePowerupsRef.current.get('scoreMultiplier');
            if (sm) mult = 1 + 0.5 * (sm.stack - 1);
            scoreRef.current += Math.floor(500 * mult);
            spawnPowerup(ufo.position);
          }
        });
      });

      // Collision Detection: UFO Bullets with Player
      if (!gameOverRef.current) {
        const playerPolygon = currentPlayer.getPolygon();
        ufoBulletsRef.current.forEach(bullet => {
          if (checkCirclePolygonCollision(bullet, playerPolygon)) {
            if (activePowerupsRef.current.has('shield')) {
              bullet.delete = true;
              const shield = activePowerupsRef.current.get('shield');
              if (shield) {
                shield.stack -= 1;
                if (shield.stack <= 0) activePowerupsRef.current.delete('shield');
              }
            } else {
              bullet.delete = true;
              debrisRef.current = debrisRef.current.concat(currentPlayer.destroy());
              gameOverRef.current = true;
              setIsGameOver(true);
            }
          }
        });
      }

      // Collision Detection: Player with Powerups
      if (!gameOverRef.current) {
        const playerPolygon = currentPlayer.getPolygon();
        powerupsRef.current.forEach(powerup => {
          if (checkPolygonCollision(playerPolygon, powerup.getPolygon())) {
            powerup.destroy();
            activatePowerup(powerup.type);
          }
        });
      }

      // Collision Detection: Player with Asteroids
      if (!gameOverRef.current) {
        const playerPolygon = currentPlayer.getPolygon();
        asteroidsRef.current.forEach(asteroid => {
          if (checkPolygonCollision(playerPolygon, asteroid.getPolygon())) {
            if (activePowerupsRef.current.has('shield')) {
              const tempV = { ...currentPlayer.velocity };
              currentPlayer.velocity = asteroid.velocity;
              asteroid.velocity = tempV;
              const shield = activePowerupsRef.current.get('shield');
              if (shield) { shield.stack -=1; if (shield.stack<=0) activePowerupsRef.current.delete('shield'); }
            } else {
              debrisRef.current = debrisRef.current.concat(currentPlayer.destroy());
              gameOverRef.current = true;
              setIsGameOver(true);
            }
          }
        });
      }

      // Collision Detection: Player with UFOs
      if (!gameOverRef.current) {
        const playerPolygon = currentPlayer.getPolygon();
        allUfos.forEach(ufo => {
          const ufoPolygon = ufo.getPolygon();
          if (checkPolygonCollision(playerPolygon, ufoPolygon)) {
            if (activePowerupsRef.current.has('shield')) {
              const tempV = { ...currentPlayer.velocity };
              currentPlayer.velocity = ufo.velocity;
              ufo.velocity = tempV;
              const shield = activePowerupsRef.current.get('shield');
              if (shield) { shield.stack -=1; if (shield.stack<=0) activePowerupsRef.current.delete('shield'); }
            } else {
              debrisRef.current = debrisRef.current.concat(currentPlayer.destroy());
              gameOverRef.current = true;
              setIsGameOver(true);
              ufo.destroy();
            }
          }
        });
      }

      // Handle asteroid splitting
      const newAsteroids = [];
      asteroidsRef.current.forEach(asteroid => {
        if (asteroid.delete && asteroid.radius >= 50) {
          newAsteroids.push(new Asteroid({
            position: { ...asteroid.position },
            size: asteroid.radius / 2
          }));
          newAsteroids.push(new Asteroid({
            position: { ...asteroid.position },
            size: asteroid.radius / 2
          }));
        }
      });

      // Remove deleted items and add new ones
      bulletsRef.current = bulletsRef.current.filter(b => !b.delete);
      ufoBulletsRef.current = ufoBulletsRef.current.filter(b => !b.delete);
      debrisRef.current = debrisRef.current.filter(d => !d.delete);
      powerupsRef.current = powerupsRef.current.filter(p => !p.delete);
      asteroidsRef.current = asteroidsRef.current.filter(a => !a.delete).concat(newAsteroids);
      ufosRef.current = ufosRef.current.filter(u => !u.delete);

      // Check for next wave (only if game not over)
      if (!gameOverRef.current && asteroidsRef.current.length === 0) {
        waveCountRef.current++;
        spawnAsteroids(waveCountRef.current);
      }

      animationFrameId = window.requestAnimationFrame(gameLoop);
    };

    gameLoop();

    return () => {
      window.cancelAnimationFrame(animationFrameId);
    };
  }, [resetKey]);

  return (
    <>
      {isGameOver && (
        <div style={{ 
          position: 'absolute', 
          top: '50%', 
          left: '50%', 
          transform: 'translate(-50%, -50%)', 
          color: 'white', 
          fontSize: '48px', 
          textAlign: 'center',
          zIndex: 1000,
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          padding: '40px',
          borderRadius: '10px'
        }}>
          GAME OVER
          <p style={{ fontSize: '24px', marginTop: '20px' }}>
            Press <strong>Enter</strong> to Restart
          </p>
          <p style={{ fontSize: '20px', marginTop: '10px', color: '#AAAAAA' }}>
            Press <strong>Escape</strong> to return to Title Screen
          </p>
          <p style={{ fontSize: '18px', marginTop: '20px', color: '#00FFFF' }}>
            Final Score: {scoreRef.current}
          </p>
        </div>
      )}
      <canvas ref={canvasRef} />
    </>
  );
};

  useEffect(() => {
    const onMouseMove = (e) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const cx = e.clientX - rect.left;
      const cy = e.clientY - rect.top;
      const mx = cx - rect.width/2;
      const my = cy - rect.height/2;
      setMouseVector(mx, my);
    };
    window.addEventListener('mousemove', onMouseMove);
    return () => window.removeEventListener('mousemove', onMouseMove);
  }, []);

export default Game;