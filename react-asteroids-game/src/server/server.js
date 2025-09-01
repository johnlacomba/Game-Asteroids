const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

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

// Initialize stars for background
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

// Initialize asteroids
const initializeAsteroids = () => {
  gameState.asteroids = [];
  for (let i = 0; i < 8; i++) {
    gameState.asteroids.push({
      id: `asteroid_${Date.now()}_${i}`,
      position: {
        x: Math.random() * WORLD_WIDTH,
        y: Math.random() * WORLD_HEIGHT
      },
      velocity: {
        x: (Math.random() - 0.5) * 2,
        y: (Math.random() - 0.5) * 2
      },
      radius: 40 + Math.random() * 20,
      rotation: Math.random() * 360,
      rotationSpeed: (Math.random() - 0.5) * 4
    });
  }
};

// Update game state
const updateGameState = () => {
  // Update asteroids
  gameState.asteroids.forEach(asteroid => {
    asteroid.position.x += asteroid.velocity.x;
    asteroid.position.y += asteroid.velocity.y;
    asteroid.rotation += asteroid.rotationSpeed;

    // Wrap around world boundaries
    if (asteroid.position.x < -asteroid.radius) {
      asteroid.position.x = WORLD_WIDTH + asteroid.radius;
    }
    if (asteroid.position.x > WORLD_WIDTH + asteroid.radius) {
      asteroid.position.x = -asteroid.radius;
    }
    if (asteroid.position.y < -asteroid.radius) {
      asteroid.position.y = WORLD_HEIGHT + asteroid.radius;
    }
    if (asteroid.position.y > WORLD_HEIGHT + asteroid.radius) {
      asteroid.position.y = -asteroid.radius;
    }
  });

  // Update players
  gameState.players.forEach(player => {
    if (player.velocity) {
      player.position.x += player.velocity.x;
      player.position.y += player.velocity.y;
      
      // Apply damping
      player.velocity.x *= 0.98;
      player.velocity.y *= 0.98;

      // Wrap around world boundaries
      if (player.position.x < 0) player.position.x = WORLD_WIDTH;
      if (player.position.x > WORLD_WIDTH) player.position.x = 0;
      if (player.position.y < 0) player.position.y = WORLD_HEIGHT;
      if (player.position.y > WORLD_HEIGHT) player.position.y = 0;
    }
  });

  // Update bullets
  gameState.bullets = gameState.bullets.filter(bullet => {
    bullet.position.x += bullet.velocity.x;
    bullet.position.y += bullet.velocity.y;
    bullet.lifeTime = (bullet.lifeTime || 0) + 1;

    // Wrap around world boundaries
    if (bullet.position.x < 0) bullet.position.x = WORLD_WIDTH;
    if (bullet.position.x > WORLD_WIDTH) bullet.position.x = 0;
    if (bullet.position.y < 0) bullet.position.y = WORLD_HEIGHT;
    if (bullet.position.y > WORLD_HEIGHT) bullet.position.y = 0;

    return bullet.lifeTime < 300; // Remove after 5 seconds at 60 FPS
  });
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
      delete: false
    };

    gameState.players.push(newPlayer);
    
    socket.emit('playerJoined', { playerId: socket.id });
    io.emit('playerCount', gameState.players.length);
    
    console.log(`Player ${playerName} joined the game`);
  });

  socket.on('playerInput', (input) => {
    const player = gameState.players.find(p => p.id === socket.id);
    if (player && input) {
      // Update rotation
      if (input.rotation !== undefined) {
        player.rotation = input.rotation;
      }

      // Handle movement
      if (input.keys.w) {
        const radians = (player.rotation - 90) * Math.PI / 180;
        player.velocity.x += Math.cos(radians) * 0.5;
        player.velocity.y += Math.sin(radians) * 0.5;
      }

      if (input.keys.s) {
        const radians = (player.rotation - 90) * Math.PI / 180;
        player.velocity.x -= Math.cos(radians) * 0.25;
        player.velocity.y -= Math.sin(radians) * 0.25;
      }

      // Handle shooting
      if (input.keys.space && !player.lastSpaceState) {
        const radians = (player.rotation - 90) * Math.PI / 180;
        const bullet = {
          id: `bullet_${Date.now()}_${Math.random()}`,
          position: { x: player.position.x, y: player.position.y },
          velocity: {
            x: Math.cos(radians) * 8,
            y: Math.sin(radians) * 8
          },
          radius: 2,
          playerId: player.id,
          lifeTime: 0
        };
        gameState.bullets.push(bullet);
      }
      player.lastSpaceState = input.keys.space;
    }
  });

  socket.on('disconnect', () => {
    gameState.players = gameState.players.filter(player => player.id !== socket.id);
    io.emit('playerCount', gameState.players.length);
    console.log('User disconnected:', socket.id);
  });
});

// Initialize game
initializeStars();
initializeAsteroids();

// Game loop
setInterval(() => {
  updateGameState();
  
  // Convert Maps to objects for transmission
  const transmissionState = {
    ...gameState,
    players: gameState.players.map(player => ({
      ...player,
      activePowerups: Object.fromEntries(Object.entries(player.activePowerups))
    }))
  };
  
  io.emit('gameState', transmissionState);
}, 1000 / 60); // 60 FPS

// Serve React app for any other routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../../build', 'index.html'));
});

const PORT = process.env.PORT || 5001;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});