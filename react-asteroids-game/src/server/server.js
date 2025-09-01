const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

// Import collision functions from the adapter
const {
  checkPolygonCollision,
  checkCirclePolygonCollision,
  getShipPolygon,
  getAsteroidPolygon
} = require('./collisionAdapter');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

// Serve static files from React build
app.use(express.static(path.join(__dirname, '../../build')));

// Game state
let gameState = {
  players: [],
  bullets: [],
  ufoBullets: [],
  asteroids: [],
  powerups: [],
  ufos: [],
  stars: []
};

// Game constants
const WORLD_WIDTH = 3000;
const WORLD_HEIGHT = 2000;
const POWERUP_SPAWN_CHANCE = 0.25; // 25% chance when asteroid is broken - matches offline mode

// Powerup constants - matching offline Powerup.js
const POWERUP_TYPES = [
  'rapidFire', 
  'spreadShot', 
  'invulnerability', 
  'homingShot', 
  'speedUp', 
  'powerShot', 
  'bouncingBullets'
];

const POWERUP_DURATIONS = {
  rapidFire: 30 * 60,        
  spreadShot: 30 * 60,        
  invulnerability: 10 * 60,   
  homingShot: 30 * 60,        
  speedUp: 60 * 60,           
  powerShot: 30 * 60,       
  bouncingBullets: 30 * 60   
};

const isValidPosition = (position, radius = 0) => {
  return position.x >= radius && 
         position.x <= WORLD_WIDTH - radius && 
         position.y >= radius && 
         position.y <= WORLD_HEIGHT - radius;
};

// Generate asteroid shape
const generateAsteroidShape = () => {
  const numPoints = 8 + Math.floor(Math.random() * 5);
  const shape = [];
  for (let i = 0; i < numPoints; i++) {
    shape.push(0.7 + Math.random() * 0.6);
  }
  return shape;
};

const createAsteroid = (options = {}) => {
  const { position, radius } = options;
  return {
    id: `asteroid_${Date.now()}_${Math.random()}`,
    position: position || { x: Math.random() * WORLD_WIDTH, y: Math.random() * WORLD_HEIGHT },
    velocity: { x: (Math.random() - 0.5) * 2, y: (Math.random() - 0.5) * 2 },
    radius: radius || 40 + Math.random() * 20,
    rotation: Math.random() * 360,
    rotationSpeed: (Math.random() - 0.5) * 4,
    shape: generateAsteroidShape()
  };
};

// Create a powerup at the position where an asteroid was broken - matches Powerup.js constructor
const createPowerup = (position) => {
  // Random powerup type
  const type = POWERUP_TYPES[Math.floor(Math.random() * POWERUP_TYPES.length)];
  
  // Random velocity vector - exactly like Powerup.js constructor
  const speed = 1 + Math.random() * 2;
  const angle = Math.random() * Math.PI * 2;
  
  return {
    id: `powerup_${Date.now()}_${Math.random()}`,
    position: { ...position }, // Create at the asteroid's position
    velocity: {
      x: Math.cos(angle) * speed,
      y: Math.sin(angle) * speed
    },
    type: type,
    radius: 15,  // For collision detection
    lifeTimer: 20 * 60  // 20 seconds at 60fps
  };
};

// Apply powerup effect to a player - matches offline implementation
const applyPowerup = (player, powerupType) => {
  // Initialize activePowerups if not exists
  if (!player.activePowerups) {
    player.activePowerups = {};
  }

  // If powerup already active, stack it or refresh duration
  if (player.activePowerups[powerupType]) {
    // Stack effect (max 3 times)
    if (player.activePowerups[powerupType].stack < 3) {
      player.activePowerups[powerupType].stack += 1;
    }
    // Refresh duration
    player.activePowerups[powerupType].duration = POWERUP_DURATIONS[powerupType];
  } else {
    // Apply new powerup
    player.activePowerups[powerupType] = {
      duration: POWERUP_DURATIONS[powerupType],
      stack: 1
    };
  }

  // Apply immediate effects based on powerup type
  if (powerupType === 'speedUp') {
    // Increase player movement speed
    player.speedMultiplier = (player.speedMultiplier || 1) * 1.5;
  }
};

const initializeStars = () => {
  gameState.stars = [];
  for (let i = 0; i < 200; i++) {
    gameState.stars.push({
      x: Math.random() * WORLD_WIDTH,
      y: Math.random() * WORLD_HEIGHT,
      radius: Math.random() * 2 + 0.5
    });
  }
};

const initializeAsteroids = () => {
  gameState.asteroids = [];
  for (let i = 0; i < 8; i++) {
    gameState.asteroids.push(createAsteroid());
  }
};

const updateGameState = () => {
  // Update asteroids
  gameState.asteroids.forEach(asteroid => {
    asteroid.position.x += asteroid.velocity.x;
    asteroid.position.y += asteroid.velocity.y;
    asteroid.rotation += asteroid.rotationSpeed;
    if (asteroid.position.x < -asteroid.radius) asteroid.position.x = WORLD_WIDTH + asteroid.radius;
    if (asteroid.position.x > WORLD_WIDTH + asteroid.radius) asteroid.position.x = -asteroid.radius;
    if (asteroid.position.y < -asteroid.radius) asteroid.position.y = WORLD_HEIGHT + asteroid.radius;
    if (asteroid.position.y > WORLD_HEIGHT + asteroid.radius) asteroid.position.y = -asteroid.radius;
  });

  // Update powerups - matches Powerup.update() method
  gameState.powerups.forEach(powerup => {
    // Update position based on velocity
    powerup.position.x += powerup.velocity.x;
    powerup.position.y += powerup.velocity.y;
    
    // Bounce off boundaries
    if (powerup.position.x <= 0 || powerup.position.x >= WORLD_WIDTH) {
      powerup.velocity.x *= -0.8;
      powerup.position.x = Math.max(0, Math.min(WORLD_WIDTH, powerup.position.x));
    }
    
    if (powerup.position.y <= 0 || powerup.position.y >= WORLD_HEIGHT) {
      powerup.velocity.y *= -0.8;
      powerup.position.y = Math.max(0, Math.min(WORLD_HEIGHT, powerup.position.y));
    }
    
    // Apply friction
    powerup.velocity.x *= 0.99;
    powerup.velocity.y *= 0.99;
    
    // Decrease lifetime
    powerup.lifeTimer--;
  });

  // Remove expired powerups
  gameState.powerups = gameState.powerups.filter(powerup => powerup.lifeTimer > 0);

  // Update players
  gameState.players.forEach(player => {
    if (player.velocity && !player.delete) {
      // Apply speed multiplier if speedUp powerup is active
      const speedMultiplier = player.activePowerups && player.activePowerups.speedUp 
        ? 1 + (player.activePowerups.speedUp.stack * 0.3) 
        : 1;

      const newPosition = { 
        x: player.position.x + player.velocity.x * speedMultiplier, 
        y: player.position.y + player.velocity.y * speedMultiplier 
      };

      if (isValidPosition(newPosition, 10)) {
        player.position = newPosition;
      } else {
        if (newPosition.x <= 10 || newPosition.x >= WORLD_WIDTH - 10) player.velocity.x *= -0.3;
        if (newPosition.y <= 10 || newPosition.y >= WORLD_HEIGHT - 10) player.velocity.y *= -0.3;
        player.position.x = Math.max(10, Math.min(WORLD_WIDTH - 10, player.position.x));
        player.position.y = Math.max(10, Math.min(WORLD_HEIGHT - 10, player.position.y));
      }
      player.velocity.x *= 0.99;
      player.velocity.y *= 0.99;
    }

    // Update active powerups
    if (player.activePowerups) {
      Object.keys(player.activePowerups).forEach(type => {
        player.activePowerups[type].duration--;
        
        // Remove expired powerups
        if (player.activePowerups[type].duration <= 0) {
          if (type === 'speedUp') {
            // Reset speed multiplier when speedUp expires
            player.speedMultiplier = 1;
          }
          delete player.activePowerups[type];
        }
      });
    }
  });

  // Update bullets
  gameState.bullets = gameState.bullets.filter(bullet => {
    bullet.position.x += bullet.velocity.x;
    bullet.position.y += bullet.velocity.y;
    bullet.lifeTime = (bullet.lifeTime || 0) + 1;
    
    // Handle bouncing bullets - matches offline mode
    if (bullet.bouncing) {
      if (bullet.position.x <= 0 || bullet.position.x >= WORLD_WIDTH) {
        bullet.velocity.x *= -1;
        bullet.bounceCount = (bullet.bounceCount || 0) + 1;
      }
      if (bullet.position.y <= 0 || bullet.position.y >= WORLD_HEIGHT) {
        bullet.velocity.y *= -1;
        bullet.bounceCount = (bullet.bounceCount || 0) + 1;
      }
      
      // Limit bounce count to prevent eternal bullets
      return bullet.lifeTime < 600 && (bullet.bounceCount || 0) < 5;
    }
    
    return isValidPosition(bullet.position, bullet.radius) && bullet.lifeTime < 300;
  });

  // Process shooting for all players who are holding spacebar
  gameState.players.forEach(player => {
    if (!player.delete && player.spacePressed) {
      // Initialize shooting timer if not exists
      if (player.shootTimer === undefined) {
        player.shootTimer = 0;
      }

      // Get fire rate from rapid fire powerup if active
      let fireRate = 10; // Default fire rate (10 frames between shots)
      if (player.activePowerups && player.activePowerups.rapidFire) {
        fireRate = Math.max(2, 10 - player.activePowerups.rapidFire.stack * 2);
      }

      // Check if player can shoot (timer at or below 0)
      if (player.shootTimer <= 0) {
        const radians = (player.rotation - 90) * Math.PI / 180;
        
        // Check for spread shot powerup
        if (player.activePowerups && player.activePowerups.spreadShot) {
          const spreadCount = 2 + player.activePowerups.spreadShot.stack;
          const spreadAngle = 10 + player.activePowerups.spreadShot.stack * 5;
          
          for (let i = 0; i < spreadCount; i++) {
            const angle = radians + ((i - (spreadCount - 1) / 2) * (spreadAngle * Math.PI / 180));
            
            gameState.bullets.push({
              id: `bullet_${Date.now()}_${Math.random()}`,
              position: { x: player.position.x, y: player.position.y },
              velocity: {
                x: Math.cos(angle) * 8,
                y: Math.sin(angle) * 8
              },
              radius: player.activePowerups && player.activePowerups.powerShot ? 4 : 2,
              playerId: player.id,
              lifeTime: 0,
              bouncing: player.activePowerups && player.activePowerups.bouncingBullets !== undefined
            });
          }
        } else {
          // Regular shot
          gameState.bullets.push({
            id: `bullet_${Date.now()}_${Math.random()}`,
            position: { x: player.position.x, y: player.position.y },
            velocity: {
              x: Math.cos(radians) * 8,
              y: Math.sin(radians) * 8
            },
            radius: player.activePowerups && player.activePowerups.powerShot ? 4 : 2,
            playerId: player.id,
            lifeTime: 0,
            bouncing: player.activePowerups && player.activePowerups.bouncingBullets !== undefined
          });
        }
        
        // Reset shoot timer based on fire rate
        player.shootTimer = fireRate;
      } else {
        // Count down the shoot timer
        player.shootTimer--;
      }
    } else if (!player.spacePressed) {
      // Reset shoot timer when not pressing space
      player.shootTimer = 0;
    }
  });

  // Handle homing bullets - matches offline mode
  gameState.bullets.forEach(bullet => {
    // Check if bullet has homing property and belongs to a player
    if (bullet.homing && bullet.playerId) {
      const player = gameState.players.find(p => p.id === bullet.playerId);
      
      // Only players with homingShot powerup have homing bullets
      if (player && player.activePowerups && player.activePowerups.homingShot) {
        // Find nearest asteroid to target
        let closestAsteroid = null;
        let closestDistance = Infinity;
        
        gameState.asteroids.forEach(asteroid => {
          const dx = asteroid.position.x - bullet.position.x;
          const dy = asteroid.position.y - bullet.position.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          
          if (distance < closestDistance) {
            closestDistance = distance;
            closestAsteroid = asteroid;
          }
        });
        
        // If there's an asteroid in range, adjust bullet trajectory
        if (closestAsteroid && closestDistance < 300) {
          const homingStrength = 0.2 + (player.activePowerups.homingShot.stack * 0.1);
          const dx = closestAsteroid.position.x - bullet.position.x;
          const dy = closestAsteroid.position.y - bullet.position.y;
          const angle = Math.atan2(dy, dx);
          
          // Gradually adjust velocity toward target
          bullet.velocity.x += Math.cos(angle) * homingStrength;
          bullet.velocity.y += Math.sin(angle) * homingStrength;
          
          // Normalize velocity to maintain speed
          const speed = 8; // Original bullet speed
          const currentSpeed = Math.sqrt(bullet.velocity.x * bullet.velocity.x + bullet.velocity.y * bullet.velocity.y);
          bullet.velocity.x = (bullet.velocity.x / currentSpeed) * speed;
          bullet.velocity.y = (bullet.velocity.y / currentSpeed) * speed;
        }
      }
    }
  });

  // Check bullet-asteroid collisions using proper collision detection
  for (let i = gameState.bullets.length - 1; i >= 0; i--) {
    const bullet = gameState.bullets[i];
    for (let j = gameState.asteroids.length - 1; j >= 0; j--) {
      const asteroid = gameState.asteroids[j];
      
      // Format for collision detection
      const asteroidForCollision = {
        x: asteroid.position.x,
        y: asteroid.position.y,
        size: asteroid.radius,
        rotation: asteroid.rotation,
        shape: asteroid.shape
      };
      
      const bulletCircle = {
        x: bullet.position.x,
        y: bullet.position.y,
        radius: bullet.radius
      };
      
      const asteroidPolygon = getAsteroidPolygon(asteroidForCollision);
      if (checkCirclePolygonCollision(bulletCircle, asteroidPolygon)) {
        const player = gameState.players.find(p => p.id === bullet.playerId);
        if (player) {
          // Apply score based on asteroid size
          player.score += Math.floor(100 + asteroid.radius * 2);
          
          // Apply bonus score for power shot
          if (bullet.radius > 2) {
            player.score += 50;
          }
        }
        
        // Only remove non-bouncing bullets
        if (!bullet.bouncing) {
          gameState.bullets.splice(i, 1);
        }
        
        // Chance to spawn powerup from broken asteroid
        if (Math.random() < POWERUP_SPAWN_CHANCE) {
          gameState.powerups.push(createPowerup(asteroid.position));
        }
        
        // Split asteroid if large enough
        if (asteroid.radius > 20) {
          for (let k = 0; k < 2; k++) {
            gameState.asteroids.push(createAsteroid({
              position: { ...asteroid.position },
              radius: asteroid.radius * 0.6
            }));
          }
        }
        
        gameState.asteroids.splice(j, 1);
        break;
      }
    }
  }

  // Check player-powerup collisions
  gameState.players.forEach(player => {
    if (player.delete) return;
    
    for (let i = gameState.powerups.length - 1; i >= 0; i--) {
      const powerup = gameState.powerups[i];
      
      const distance = Math.sqrt(
        Math.pow(player.position.x - powerup.position.x, 2) +
        Math.pow(player.position.y - powerup.position.y, 2)
      );
      
      // If player touches powerup (within 20 pixels)
      if (distance < 20) {
        // Apply powerup effect
        applyPowerup(player, powerup.type);
        
        // Remove powerup from the world
        gameState.powerups.splice(i, 1);
      }
    }
  });

  // Check player-asteroid collisions
  gameState.players.forEach(player => {
    if (player.delete || player.invulnerable) return;
    
    // Skip collision check if player has invulnerability powerup
    if (player.activePowerups && player.activePowerups.invulnerability) {
      return;
    }
    
    const playerForCollision = {
      x: player.position.x,
      y: player.position.y,
      rotation: player.rotation
    };
    
    const playerPolygon = getShipPolygon(playerForCollision);
    
    for (let i = gameState.asteroids.length - 1; i >= 0; i--) {
      const asteroid = gameState.asteroids[i];
      
      const asteroidForCollision = {
        x: asteroid.position.x,
        y: asteroid.position.y,
        size: asteroid.radius,
        rotation: asteroid.rotation,
        shape: asteroid.shape
      };
      
      const asteroidPolygon = getAsteroidPolygon(asteroidForCollision);
      
      if (checkPolygonCollision(playerPolygon, asteroidPolygon)) {
        player.lives = Math.max(0, player.lives - 1);
        if (player.lives <= 0) {
          player.delete = true;
        } else {
          player.position = { x: WORLD_WIDTH / 2, y: WORLD_HEIGHT / 2 };
          player.velocity = { x: 0, y: 0 };
          // Add brief invulnerability on respawn
          player.invulnerable = true;
          setTimeout(() => { player.invulnerable = false; }, 2000);
        }
        break;
      }
    }
  });

  while (gameState.asteroids.length < 4) {
    gameState.asteroids.push(createAsteroid());
  }
};

// Socket connection handling
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('joinGame', (playerName) => {
    const newPlayer = {
      id: socket.id,
      name: playerName,
      position: { x: WORLD_WIDTH / 2, y: WORLD_HEIGHT / 2 },
      velocity: { x: 0, y: 0 },
      rotation: 0,
      score: 0,
      lives: 3,
      activePowerups: {},
      delete: false,
      shootTimer: 0,
      invulnerable: false,
      spacePressed: false
    };
    gameState.players.push(newPlayer);
    socket.emit('playerJoined', { playerId: socket.id });
    io.emit('playerCount', gameState.players.length);
    console.log(`Player ${playerName} joined the game`);
  });

  socket.on('playerInput', (input) => {
    const player = gameState.players.find(p => p.id === socket.id);
    if (player && input && !player.delete) {
      if (input.rotation !== undefined) player.rotation = input.rotation;
      if (input.keys.w) {
        const radians = (player.rotation - 90) * Math.PI / 180;
        player.velocity.x += Math.cos(radians) * 0.3;
        player.velocity.y += Math.sin(radians) * 0.3;
      }
      if (input.keys.s) {
        const radians = (player.rotation - 90) * Math.PI / 180;
        player.velocity.x -= Math.cos(radians) * 0.15;
        player.velocity.y -= Math.sin(radians) * 0.15;
      }
      // Track spacebar state but don't create bullets here
      player.spacePressed = input.keys.space;
    }
  });

  socket.on('disconnect', () => {
    gameState.players = gameState.players.filter(player => player.id !== socket.id);
    io.emit('playerCount', gameState.players.length);
    console.log('User disconnected:', socket.id);
  });
});

// Initialize game and start loop
initializeStars();
initializeAsteroids();
setInterval(() => {
  updateGameState();
  io.emit('gameState', gameState);
}, 1000 / 60);

// Serve React app for any other routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../../build', 'index.html'));
});

const PORT = process.env.PORT || 5001;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});