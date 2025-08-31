import React, { useEffect, useRef, useState } from 'react';
import Player from './Player';
import Asteroid from './Asteroid';
import Debris from './Debris';
import UFO from './UFO';
import { handleInput } from '../core/inputController';
import { checkPolygonCollision, checkCirclePolygonCollision } from '../core/collision';

const Game = () => {
  const canvasRef = useRef(null);
  const bulletsRef = useRef([]);
  const ufoBulletsRef = useRef([]);
  const asteroidsRef = useRef([]);
  const debrisRef = useRef([]);
  const ufoRef = useRef(null);
  const playerRef = useRef(null);
  const starsRef = useRef([]); // Ref to store star positions
  const shootCooldownRef = useRef(0);
  const waveCountRef = useRef(30);
  const [isGameOver, setIsGameOver] = useState(false);
  const [resetKey, setResetKey] = useState(0);
  const gameOverRef = useRef(false);
  const scoreRef = useRef(0);
  const ufoSpawnTimerRef = useRef(0);
  const UFO_SPAWN_TIME = 30 * 60;
  const SHOOT_COOLDOWN = 15;
  const WORLD_WIDTH = 3000;
  const WORLD_HEIGHT = 2000;

  useEffect(() => {
    const handleRestart = (e) => {
      if (e.key === 'Enter') {
        // Clear all game object arrays
        asteroidsRef.current = [];
        bulletsRef.current = [];
        ufoBulletsRef.current = [];
        debrisRef.current = [];
        ufoRef.current = null;

        // Reset game state refs
        scoreRef.current = 0;
        gameOverRef.current = false;
        waveCountRef.current = 30;
        ufoSpawnTimerRef.current = 0;
        shootCooldownRef.current = 0;

        // Trigger a full re-initialization of the game
        setIsGameOver(false);
        setResetKey(prev => prev + 1);
      }
    };

    if (isGameOver) {
      window.addEventListener('keydown', handleRestart);
    }

    return () => {
      window.removeEventListener('keydown', handleRestart);
    };
  }, [isGameOver]);

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
      ufoRef.current = new UFO({ position, velocity });
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

      // Only handle player input if the game is not over
      if (!gameOverRef.current) {
        if (shootCooldownRef.current > 0) {
          shootCooldownRef.current--;
        }
        const keys = handleInput();
        // Handle shooting
        if (keys[' '] && shootCooldownRef.current <= 0) {
          bulletsRef.current.push(currentPlayer.shoot());
          shootCooldownRef.current = SHOOT_COOLDOWN;
        }
        // Update player
        currentPlayer.update(keys, WORLD_WIDTH, WORLD_HEIGHT);
      }

      // UFO Spawn Logic
      if (!gameOverRef.current) {
        ufoSpawnTimerRef.current++;
        if (!ufoRef.current && ufoSpawnTimerRef.current > UFO_SPAWN_TIME) {
          spawnUFO();
          ufoSpawnTimerRef.current = 0;
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
      }

      // Update and draw UFO
      if (ufoRef.current) {
        const newUfoBullets = ufoRef.current.update(WORLD_WIDTH, WORLD_HEIGHT, currentPlayer.position);
        ufoBulletsRef.current.push(...newUfoBullets);

        ufoRef.current.draw(context);
        if (ufoRef.current.delete) {
          ufoRef.current = null;
        }
      }

      // Update and draw asteroids, bullets, and debris
      asteroidsRef.current.forEach(asteroid => asteroid.update(WORLD_WIDTH, WORLD_HEIGHT));
      asteroidsRef.current.forEach(asteroid => asteroid.draw(context));

      bulletsRef.current.forEach(bullet => bullet.update(WORLD_WIDTH, WORLD_HEIGHT));
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

      // Collision Detection: Bullets with Asteroids
      bulletsRef.current.forEach(bullet => {
        asteroidsRef.current.forEach(asteroid => {
          if (checkCirclePolygonCollision(bullet, asteroid.getPolygon())) {
            bullet.delete = true;
            if (asteroid.hitPoints - 1 <= 0) {
              scoreRef.current += 100;
            }
            asteroid.hit();
          }
        });
      });

      // Collision Detection: Bullets with UFO
      if (ufoRef.current) {
        const ufoPolygon = ufoRef.current.getPolygon();
        bulletsRef.current.forEach(bullet => {
          if (!bullet.delete && checkCirclePolygonCollision(bullet, ufoPolygon)) {
            bullet.delete = true;
            ufoRef.current.destroy();
            scoreRef.current += 500; // UFO is worth more points
          }
        });
      }

      // Collision Detection: UFO Bullets with Player
      if (!gameOverRef.current) {
        const playerPolygon = currentPlayer.getPolygon();
        ufoBulletsRef.current.forEach(bullet => {
          if (checkCirclePolygonCollision(bullet, playerPolygon)) {
            bullet.delete = true;
            debrisRef.current = debrisRef.current.concat(currentPlayer.destroy());
            gameOverRef.current = true;
            setIsGameOver(true);
          }
        });
      }

      // Collision Detection: Player with Asteroids (only if game not over)
      if (!gameOverRef.current) {
        const playerPolygon = currentPlayer.getPolygon();
        asteroidsRef.current.forEach(asteroid => {
          if (checkPolygonCollision(playerPolygon, asteroid.getPolygon())) {
            debrisRef.current = debrisRef.current.concat(currentPlayer.destroy());
            gameOverRef.current = true;
            setIsGameOver(true);
          }
        });
      }

      // Collision Detection: Player with UFO
      if (!gameOverRef.current && ufoRef.current) {
        const playerPolygon = currentPlayer.getPolygon();
        const ufoPolygon = ufoRef.current.getPolygon();
        if (checkPolygonCollision(playerPolygon, ufoPolygon)) {
          debrisRef.current = debrisRef.current.concat(currentPlayer.destroy());
          gameOverRef.current = true;
          setIsGameOver(true);
          ufoRef.current.destroy(); // Also destroy the UFO
        }
      }

      // Handle asteroid splitting
      const newAsteroids = [];
      asteroidsRef.current.forEach(asteroid => {
        // Check if a large asteroid is destroyed
        if (asteroid.delete && asteroid.radius >= 50) {
          // Split into two smaller asteroids
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
      asteroidsRef.current = asteroidsRef.current.filter(a => !a.delete).concat(newAsteroids);

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
  }, [resetKey]); // Add resetKey to dependency array

  return (
    <>
      {isGameOver && (
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', color: 'white', fontSize: '48px', textAlign: 'center' }}>
          GAME OVER
          <p style={{ fontSize: '24px', marginTop: '20px' }}>Press Enter to Restart</p>
        </div>
      )}
      <canvas ref={canvasRef} />
    </>
  );
};

export default Game;