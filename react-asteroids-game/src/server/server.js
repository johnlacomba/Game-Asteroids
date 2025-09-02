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
    origin: (origin, callback) => {
      // Allow all origins in dev / LAN scenario
      callback(null, true);
    },
    methods: ["GET", "POST"],
    credentials: false
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

// Simple object pools
const BULLET_POOL = [];
const ASTEROID_POOL = [];
function acquireBullet() {
  return BULLET_POOL.pop() || {};
}
function releaseBullet(b) {
  BULLET_POOL.push(b);
}
function acquireAsteroid() {
  return ASTEROID_POOL.pop() || {};
}
function releaseAsteroid(a) {
  ASTEROID_POOL.push(a);
}

// Track global leader (updated only on score/highScore changes or player add/remove)
let globalLeader = null;
// Bot configuration
const BOT_PREFIX = 'BOT_';
let nextBotId = 1;

// Player color management (avoid reds so hostile UFO bullets remain clearly distinct)
const PLAYER_COLOR_PALETTE = [
  '#00FFFF', // cyan
  '#FFFF00', // yellow
  '#00FF00', // lime
  '#00AAFF', // sky blue
  '#AAFF00', // yellow-green
  '#00FFA5', // aquamarine
  '#8888FF', // soft periwinkle
  '#FFFFFF', // white
  '#00FFD7', // teal-cyan
  '#B4FF00'  // chartreuse
];

function assignPlayerColor() {
  const used = new Set(gameState.players.map(p => p.color));
  for (const c of PLAYER_COLOR_PALETTE) {
    if (!used.has(c)) return c;
  }
  // Fallback: generate a non-red random color in HSL and convert to hex
  // Hue range excluding 330-30 => pick in [30,330)
  const hue = 30 + Math.random() * 300; // 30..330
  const s = 80; const l = 55;
  // hsl to rgb
  const h = hue / 360;
  const c = (1 - Math.abs(2 * l/100 - 1)) * (s/100);
  const x = c * (1 - Math.abs((h * 6) % 2 - 1));
  const m = l/100 - c/2;
  let r,g,b;
  if (h < 1/6) { r=c; g=x; b=0; }
  else if (h < 2/6) { r=x; g=c; b=0; }
  else if (h < 3/6) { r=0; g=c; b=x; }
  else if (h < 4/6) { r=0; g=x; b=c; }
  else if (h < 5/6) { r=x; g=0; b=c; }
  else { r=c; g=0; b=x; }
  const toHex = v => ('0' + Math.round((v + m) * 255).toString(16)).slice(-2);
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

const BOT_ADJECTIVES = ['Swift','Crimson','Azure','Lunar','Solar','Nebula','Quantum','Silent','Iron','Golden','Shadow','Hyper','Cosmic','Turbo','Electric','Frost','Ember','Phantom','Rapid','Vivid'];
const BOT_NOUNS = ['Falcon','Comet','Viper','Ranger','Warden','Nova','Specter','Rogue','Pioneer','Sentinel','Echo','Blazer','Meteor','Drifter','Guardian','Hunter','Pilot','Reactor','Striker','Voyager'];

function generateBotName(existingNames) {
  for (let attempts = 0; attempts < 20; attempts++) {
    const adj = BOT_ADJECTIVES[Math.floor(Math.random()*BOT_ADJECTIVES.length)];
    const noun = BOT_NOUNS[Math.floor(Math.random()*BOT_NOUNS.length)];
    const base = `${adj} ${noun}`;
    const name = existingNames.has(base) ? `${base} ${Math.floor(Math.random()*100)}` : base;
    const finalName = `${name} (Bot)`;
    if (!existingNames.has(finalName)) return finalName;
  }
  return `Bot ${Math.floor(Math.random()*1000)} (Bot)`; // fallback
}

function recomputeLeader() {
  globalLeader = null;
  for (const p of gameState.players) {
    const best = Math.max(p.score || 0, p.highScore || 0);
    if (!globalLeader || best > globalLeader.best) {
      globalLeader = { id: p.id, name: p.name, best };
    }
  }
}

function updateLeaderForPlayer(player) {
  const best = Math.max(player.score || 0, player.highScore || 0);
  if (!globalLeader || best > globalLeader.best) {
    globalLeader = { id: player.id, name: player.name, best };
  } else if (globalLeader.id === player.id) {
    // If leader's best decreased (rare: if we ever lower highScore), recompute fully
    if (best < globalLeader.best) {
      recomputeLeader();
    } else if (best !== globalLeader.best) {
      globalLeader.best = best; // sync name changes or improvements
    }
  }
}

function createBotPlayer() {
  const id = `${BOT_PREFIX}${nextBotId++}`;
  // Reuse spawn logic near center with some randomization
  const position = { x: Math.random()*WORLD_WIDTH, y: Math.random()*WORLD_HEIGHT };
  const velocity = { x: 0, y: 0 };
  const existing = new Set(gameState.players.map(p=>p.name));
  return {
    id,
    name: generateBotName(existing),
  color: assignPlayerColor(),
    position,
    velocity,
    rotation: Math.random()*360,
    score: 0,
    highScore: 0,
    activePowerups: {},
    speedMultiplier: 1,
    shootTimer: 0,
    spacePressed: false,
    dead: false,
    invulnerable: true,
    invulnTimer: 120,
    isBot: true
  };
}

function updateBotAI(bot) {
  if (bot.dead) return;
  // Basic timers
  if (bot.invulnerable) {
    bot.invulnTimer--;
    if (bot.invulnTimer <= 0) bot.invulnerable = false;
  }
  // Select nearest target (UFO prioritized, else asteroid)
  let target = null;
  let targetType = null;
  let bestDist = Infinity;
  gameState.ufos.forEach(u => {
    if (u.exploding) return;
    const dx = u.position.x - bot.position.x;
    const dy = u.position.y - bot.position.y;
    const d = dx*dx + dy*dy;
    if (d < bestDist) { bestDist = d; target = u; targetType = 'ufo'; }
  });
  if (!target) {
    gameState.asteroids.forEach(a => {
      const dx = a.position.x - bot.position.x;
      const dy = a.position.y - bot.position.y;
      const d = dx*dx + dy*dy;
      if (d < bestDist) { bestDist = d; target = a; targetType = 'asteroid'; }
    });
  }
  // Avoid threats (UFO bullets, asteroids, UFOs) by steering opposite if close
  let avoidVec = { x: 0, y: 0 };
  const addAvoid = (dx, dy, weight) => { avoidVec.x -= dx * weight; avoidVec.y -= dy * weight; };
  gameState.ufoBullets.forEach(b => {
    const dx = b.position.x - bot.position.x;
    const dy = b.position.y - bot.position.y;
    const d2 = dx*dx + dy*dy;
    if (d2 < 200*200) addAvoid(dx, dy, 1/(d2+1));
  });
  gameState.asteroids.forEach(a => {
    const dx = a.position.x - bot.position.x;
    const dy = a.position.y - bot.position.y;
    const d2 = dx*dx + dy*dy;
    const range = 140 + a.radius;
    if (d2 < range*range) addAvoid(dx, dy, 0.5/(d2+1));
  });
  gameState.ufos.forEach(u => {
    const dx = u.position.x - bot.position.x;
    const dy = u.position.y - bot.position.y;
    const d2 = dx*dx + dy*dy;
    if (d2 < 250*250) addAvoid(dx, dy, 0.7/(d2+1));
  });
  // Normalize avoidance
  const avLen = Math.hypot(avoidVec.x, avoidVec.y);
  if (avLen > 0) { avoidVec.x/=avLen; avoidVec.y/=avLen; }
  // Desired direction: avoidance first, else target pursuit
  let desiredDir = null;
  if (avLen > 0.1) {
    desiredDir = avoidVec;
  } else if (target) {
    desiredDir = { x: (target.position.x - bot.position.x), y: (target.position.y - bot.position.y) };
    const dl = Math.hypot(desiredDir.x, desiredDir.y) || 1;
    desiredDir.x/=dl; desiredDir.y/=dl;
  }
  if (desiredDir) {
    const targetAngle = Math.atan2(desiredDir.y, desiredDir.x) * 180 / Math.PI + 90; // ship faces up
    let diff = ((targetAngle - bot.rotation + 540) % 360) - 180;
    const turnRate = 4; // deg per frame
    if (diff > turnRate) diff = turnRate; else if (diff < -turnRate) diff = -turnRate;
    bot.rotation = (bot.rotation + diff + 360) % 360;
    // Thrust if moving toward target or evading
    const radians = (bot.rotation - 90) * Math.PI / 180;
    bot.velocity.x += Math.cos(radians) * 0.12;
    bot.velocity.y += Math.sin(radians) * 0.12;
  }
  // Fire if target roughly in front and cooldown ready
  if (target) {
    const toTarget = Math.atan2(target.position.y - bot.position.y, target.position.x - bot.position.x) * 180 / Math.PI + 90;
    let angleDiff = ((toTarget - bot.rotation + 540) % 360) - 180;
    if (Math.abs(angleDiff) < 12) {
      bot.spacePressed = true;
    } else {
      bot.spacePressed = false;
    }
  } else {
    bot.spacePressed = false;
  }
  // Mild friction
  bot.velocity.x *= 0.995;
  bot.velocity.y *= 0.995;
  // Cap speed
  const speed = Math.hypot(bot.velocity.x, bot.velocity.y);
  const maxSpeed = 6 * (bot.speedMultiplier || 1);
  if (speed > maxSpeed) { bot.velocity.x *= maxSpeed/speed; bot.velocity.y *= maxSpeed/speed; }
  // Move
  bot.position.x += bot.velocity.x;
  bot.position.y += bot.velocity.y;
  // Wrap
  if (bot.position.x < 0) bot.position.x += WORLD_WIDTH; else if (bot.position.x > WORLD_WIDTH) bot.position.x -= WORLD_WIDTH;
  if (bot.position.y < 0) bot.position.y += WORLD_HEIGHT; else if (bot.position.y > WORLD_HEIGHT) bot.position.y -= WORLD_HEIGHT;
}

// Game constants
const WORLD_WIDTH = 3000;
const WORLD_HEIGHT = 2000;
const POWERUP_SPAWN_CHANCE = 0.25; // 25% chance when asteroid is broken - matches offline mode

// Powerup constants - matching offline Powerup.js
const POWERUP_TYPES = [
  'rapidFire', 
  'spreadShot', 
  'shield', 
  'homingShot', 
  'speedUp', 
  'powerShot', 
  'bouncingBullets',
  'scoreMultiplier'
];

const POWERUP_DURATIONS = {
  rapidFire: 30 * 60,        
  spreadShot: 30 * 60,        
  shield: Infinity,   
  homingShot: 30 * 60,        
  speedUp: 60 * 60,           
  powerShot: 30 * 60,       
  bouncingBullets: 30 * 60,  
  scoreMultiplier: 30 * 60
};

// UFO constants
const UFO_RADIUS = 15;
const UFO_WAVE_SIZE = 25; // spawn roughly 25 at once
const UFO_POWERUP_DROP_CHANCE = 0.15; // 15% chance a destroyed UFO drops a powerup
// UFO spawn pacing now controlled by a dynamic timer; keep legacy chance as a fallback low value
const UFO_SPAWN_CHANCE = 0.0005; // minimal random chance safety net
let ufoSpawnCooldown = 0; // frames until next wave eligible (dynamic)
const UFO_SHOOT_INTERVAL = 180; // 3 seconds @60fps
const UFO_BULLET_SPEED = 5;

// Generate polygon for a UFO (matching client UFO.getPolygon)
const getUFOPolygon = (ufo) => {
  const r = ufo.radius;
  return [
    { x: ufo.position.x - r,       y: ufo.position.y - r / 2 },
    { x: ufo.position.x + r,       y: ufo.position.y - r / 2 },
    { x: ufo.position.x + r / 2,   y: ufo.position.y + r / 2 },
    { x: ufo.position.x - r / 2,   y: ufo.position.y + r / 2 }
  ];
};


// Helper to create a meandering UFO path fully inside borders
// Helper to pick a random point on the border (excluding corners by a small inset)
const randomBorderPoint = () => {
  const inset = 40;
  const side = Math.floor(Math.random() * 4); // 0 top,1 right,2 bottom,3 left
  switch (side) {
    case 0: return { x: inset + Math.random() * (WORLD_WIDTH - inset * 2), y: 0 }; // top
    case 1: return { x: WORLD_WIDTH, y: inset + Math.random() * (WORLD_HEIGHT - inset * 2) }; // right
    case 2: return { x: inset + Math.random() * (WORLD_WIDTH - inset * 2), y: WORLD_HEIGHT }; // bottom
    case 3: return { x: 0, y: inset + Math.random() * (WORLD_HEIGHT - inset * 2) }; // left
    default: return { x: 0, y: 0 };
  }
};

// Create a UFO whose path starts just inside one border and ends on another border so it always exits
const createUFO = () => {
  // Start slightly inside the border (so it appears fully on screen)
  const startBorderPoint = randomBorderPoint();
  const inwardOffset = 60; // move inward along interior normal so it doesn't instantly disappear
  const start = { ...startBorderPoint };
  if (start.y === 0) start.y += inwardOffset; // top
  else if (start.x === WORLD_WIDTH) start.x -= inwardOffset; // right
  else if (start.y === WORLD_HEIGHT) start.y -= inwardOffset; // bottom
  else if (start.x === 0) start.x += inwardOffset; // left

  // Choose a different border for exit
  let endBorderPoint;
  do { endBorderPoint = randomBorderPoint(); } while (Math.abs(endBorderPoint.x - startBorderPoint.x) + Math.abs(endBorderPoint.y - startBorderPoint.y) < 400);
  const end = { ...endBorderPoint }; // terminate AT the border point (vanish when reached)

  const baseDir = { x: end.x - start.x, y: end.y - start.y };
  const length = Math.sqrt(baseDir.x * baseDir.x + baseDir.y * baseDir.y) || 1;
  baseDir.x /= length; baseDir.y /= length;
  const perpDir = { x: -baseDir.y, y: baseDir.x };
  // Keep amplitude smaller so sinusoidal oscillation does not leave map
  const amplitude = 80 + Math.random() * 80;
  const frequency = 0.8 + Math.random() * 1.0;
  // Increased base speed (faster traversal ~5-8s)
  const speed = (0.0016 + Math.random() * 0.0007) * (800 / length); // normalize so long paths not too long
  return {
    id: `ufo_${Date.now()}_${Math.random()}`,
    start,
    end,
    position: { ...start },
    progress: 0,
    baseDir,
    perpDir,
    distance: length,
    amplitude,
    frequency,
    speed,
    radius: UFO_RADIUS,
  shootTimer: 0, // fire immediately on first update frame
    health: 1
  };
};

const createUFOBullet = (ufo, target) => {
  let dx = target.x - ufo.position.x;
  let dy = target.y - ufo.position.y;
  const dist = Math.sqrt(dx * dx + dy * dy) || 1;
  dx /= dist; dy /= dist;
  // Apply 0-10% inaccuracy as a random angular deviation
  const maxAngle = 0.10 * Math.PI; // ~18 degrees max
  const angleOffset = (Math.random() * 2 - 1) * maxAngle * Math.random(); // second *Math.random() biases toward small angles
  const cosA = Math.cos(angleOffset);
  const sinA = Math.sin(angleOffset);
  const ndx = dx * cosA - dy * sinA;
  const ndy = dx * sinA + dy * cosA;
  return {
    id: `ufoBullet_${Date.now()}_${Math.random()}`,
    position: { x: ufo.position.x, y: ufo.position.y },
    velocity: { x: ndx * UFO_BULLET_SPEED, y: ndy * UFO_BULLET_SPEED },
    radius: 3,
    lifeTime: 0
  };
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
  const a = acquireAsteroid();
  a.id = `asteroid_${Date.now()}_${Math.random()}`;
  a.position = position || { x: Math.random() * WORLD_WIDTH, y: Math.random() * WORLD_HEIGHT };
  a.velocity = { x: (Math.random() - 0.5) * 2, y: (Math.random() - 0.5) * 2 };
  a.radius = radius || 40 + Math.random() * 20;
  a.rotation = Math.random() * 360;
  a.rotationSpeed = (Math.random() - 0.5) * 4;
  a.shape = generateAsteroidShape();
  return a;
};

// Create a powerup at the position where an asteroid was broken
const createPowerup = (position) => {
  // Random powerup type
  const type = POWERUP_TYPES[Math.floor(Math.random() * POWERUP_TYPES.length)];
  
  // Random velocity vector
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
    if (player.activePowerups[powerupType].stack < 3) {
      player.activePowerups[powerupType].stack += 1;
    }
    // Custom stacking duration behavior for specific powerups
    if (powerupType === 'shield') {
        // Shield duration is infinite; stack increases layers. Keep a large number to avoid special cases.
        player.activePowerups[powerupType].duration = Infinity;
    } else {
      player.activePowerups[powerupType].duration = POWERUP_DURATIONS[powerupType];
    }
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
  } else if (powerupType === 'scoreMultiplier') {
    // no immediate stat; scoring logic will consult stack
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

// Add boundary wall definitions after your game constants section
const BOUNDARY_WALLS = [
  // Top wall: (x1,y1) to (x2,y2)
  { start: { x: 0, y: 0 }, end: { x: WORLD_WIDTH, y: 0 } },
  // Right wall
  { start: { x: WORLD_WIDTH, y: 0 }, end: { x: WORLD_WIDTH, y: WORLD_HEIGHT } },
  // Bottom wall
  { start: { x: WORLD_WIDTH, y: WORLD_HEIGHT }, end: { x: 0, y: WORLD_HEIGHT } },
  // Left wall
  { start: { x: 0, y: WORLD_HEIGHT }, end: { x: 0, y: 0 } }
];

// Precompute wall normals (outward) for performance
BOUNDARY_WALLS.forEach(w => {
  const vx = w.end.x - w.start.x;
  const vy = w.end.y - w.start.y;
  const len = Math.sqrt(vx * vx + vy * vy) || 1;
  const nx = -(vy / len);
  const ny = vx / len;
  w.normal = { x: nx, y: ny };
});

// Add a function to check for line segment intersection
const checkLineIntersection = (line1, line2) => {
  const x1 = line1.start.x;
  const y1 = line1.start.y;
  const x2 = line1.end.x;
  const y2 = line1.end.y;
  const x3 = line2.start.x;
  const y3 = line2.start.y;
  const x4 = line2.end.x;
  const y4 = line2.end.y;

  const denominator = (y4 - y3) * (x2 - x1) - (x4 - x3) * (y2 - y1);
  if (denominator === 0) return null;

  const ua = ((x4 - x3) * (y1 - y3) - (y4 - y3) * (x1 - x3)) / denominator;
  const ub = ((x2 - x1) * (y1 - y3) - (y2 - y1) * (x1 - x3)) / denominator;

  if (ua < 0 || ua > 1 || ub < 0 || ub > 1) return null;

  const x = x1 + ua * (x2 - x1);
  const y = y1 + ua * (y2 - y1);

  return { x, y };
};

// Add a function to calculate reflection vector
const calculateReflection = (velocity, wallNormal) => {
  const dotProduct = velocity.x * wallNormal.x + velocity.y * wallNormal.y;
  
  return {
    x: velocity.x - 2 * dotProduct * wallNormal.x,
    y: velocity.y - 2 * dotProduct * wallNormal.y
  };
};

// Add a function to check asteroid-boundary collision
const checkAsteroidBoundaryCollision = (asteroid) => {
  const asteroidPolygon = getAsteroidPolygon({
    x: asteroid.position.x,
    y: asteroid.position.y,
    size: asteroid.radius,
    rotation: asteroid.rotation,
    shape: asteroid.shape
  });
  
  let collisionWall = null;
  let closestDistance = Infinity;
  let collisionPoint = null;

  // Check each edge of the asteroid against each boundary wall
  for (let i = 0; i < asteroidPolygon.length; i++) {
    const start = asteroidPolygon[i];
    const end = asteroidPolygon[(i + 1) % asteroidPolygon.length];
    const asteroidEdge = { start, end };

    for (const wall of BOUNDARY_WALLS) {
      const intersection = checkLineIntersection(asteroidEdge, wall);
      
      if (intersection) {
        // Calculate distance from asteroid center to intersection
        const dx = asteroid.position.x - intersection.x;
        const dy = asteroid.position.y - intersection.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance < closestDistance) {
          closestDistance = distance;
          collisionWall = wall;
          collisionPoint = intersection;
        }
      }
    }
  }

  return { collisionWall, collisionPoint };
};

// Generate polygon points for a powerup
const getPowerupPolygon = (powerup) => {
  // Create an octagon shape for powerups
  const points = [];
  const segments = 8;
  const angleStep = (Math.PI * 2) / segments;
  const radius = powerup.radius;
  
  for (let i = 0; i < segments; i++) {
    const angle = i * angleStep;
    points.push({
      x: powerup.position.x + Math.cos(angle) * radius,
      y: powerup.position.y + Math.sin(angle) * radius
    });
  }
  
  return points;
};

// Check powerup-boundary collision
const checkPowerupBoundaryCollision = (powerup) => {
  const powerupPolygon = getPowerupPolygon(powerup);
  
  let collisionWall = null;
  let closestDistance = Infinity;
  let collisionPoint = null;

  // Check each edge of the powerup polygon against each boundary wall
  for (let i = 0; i < powerupPolygon.length; i++) {
    const start = powerupPolygon[i];
    const end = powerupPolygon[(i + 1) % powerupPolygon.length];
    const powerupEdge = { start, end };

    for (const wall of BOUNDARY_WALLS) {
      const intersection = checkLineIntersection(powerupEdge, wall);
      
      if (intersection) {
        // Calculate distance from powerup center to intersection
        const dx = powerup.position.x - intersection.x;
        const dy = powerup.position.y - intersection.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance < closestDistance) {
          closestDistance = distance;
          collisionWall = wall;
          collisionPoint = intersection;
        }
      }
    }
  }

  return { collisionWall, collisionPoint };
};

const updateGameState = () => {
  const deadThisFrame = new Set();
  // Simulation tick counter
  tick++;
  // Update asteroids
  // Bullet creation (handle continuous fire & powerups)
  // Update bots before handling shooting so their spacePressed is current
  gameState.players.forEach(p => { if (p.isBot) updateBotAI(p); });
  gameState.asteroids.forEach(asteroid => {
    // Calculate new position
    const newPosition = {
      x: asteroid.position.x + asteroid.velocity.x,
      y: asteroid.position.y + asteroid.velocity.y
    };
    
    // Update rotation
    asteroid.rotation += asteroid.rotationSpeed;
    
    // Check for boundary collisions using polygonal detection
    const { collisionWall, collisionPoint } = checkAsteroidBoundaryCollision({
      ...asteroid,
      position: newPosition
    });
    
    if (collisionWall) {
      // Calculate wall normal (perpendicular to wall)
      const wallVector = {
        x: collisionWall.end.x - collisionWall.start.x,
        y: collisionWall.end.y - collisionWall.start.y
      };
      
      const wallLength = Math.sqrt(wallVector.x * wallVector.x + wallVector.y * wallVector.y);
      
      // Normalize the wall vector
      wallVector.x /= wallLength;
      wallVector.y /= wallLength;
      
      // Wall normal is perpendicular to wall
      const wallNormal = {
        x: -wallVector.y, // Perpendicular
        y: wallVector.x   // Perpendicular
      };
      
      // Reflect velocity with some energy loss (80% of original energy)
      const reflection = calculateReflection(asteroid.velocity, wallNormal);
      asteroid.velocity.x = reflection.x * 0.8;
      asteroid.velocity.y = reflection.y * 0.8;
      
      // Adjust position to prevent sticking to wall
      const pushDistance = Math.min(5, asteroid.radius * 0.2);
      asteroid.position.x += wallNormal.x * pushDistance;
      asteroid.position.y += wallNormal.y * pushDistance;
    } else {
      // No collision, update position normally
      asteroid.position = newPosition;
    }

    // Safety check - if asteroid somehow escapes the boundaries, wrap it around
    // This is a fallback and should rarely be needed
    if (asteroid.position.x < -asteroid.radius) asteroid.position.x = WORLD_WIDTH - 10;
    if (asteroid.position.x > WORLD_WIDTH + asteroid.radius) asteroid.position.x = 10;
    if (asteroid.position.y < -asteroid.radius) asteroid.position.y = WORLD_HEIGHT - 10;
    if (asteroid.position.y > WORLD_HEIGHT + asteroid.radius) asteroid.position.y = 10;
  });

  // Update powerups with proper collision detection
  gameState.powerups.forEach(powerup => {
    // Calculate new position
    const newPosition = {
      x: powerup.position.x + powerup.velocity.x,
      y: powerup.position.y + powerup.velocity.y
    };
    
    // Check for boundary collisions using polygonal detection
    const tempPowerup = {
      ...powerup,
      position: newPosition
    };
    
    const { collisionWall, collisionPoint } = checkPowerupBoundaryCollision(tempPowerup);
    
    if (collisionWall) {
      // Calculate wall normal (perpendicular to wall)
      const wallVector = {
        x: collisionWall.end.x - collisionWall.start.x,
        y: collisionWall.end.y - collisionWall.start.y
      };
      
      const wallLength = Math.sqrt(wallVector.x * wallVector.x + wallVector.y * wallVector.y);
      
      // Normalize the wall vector
      wallVector.x /= wallLength;
      wallVector.y /= wallLength;
      
      // Wall normal is perpendicular to wall
      const wallNormal = {
        x: -wallVector.y, // Perpendicular
        y: wallVector.x   // Perpendicular
      };
      
      // Reflect velocity with slight energy loss (95% of original energy)
      // Powerups should bounce more elastically than asteroids
      const reflection = calculateReflection(powerup.velocity, wallNormal);
      powerup.velocity.x = reflection.x * 0.95;
      powerup.velocity.y = reflection.y * 0.95;
      
      // Adjust position to prevent sticking to wall
      const pushDistance = Math.min(3, powerup.radius * 0.2);
      powerup.position.x += wallNormal.x * pushDistance;
      powerup.position.y += wallNormal.y * pushDistance;
    } else {
      // No collision, update position normally
      powerup.position = newPosition;
    }
    
    // Decrease lifetime
    powerup.lifeTimer--;
  });

  // Remove expired powerups
  gameState.powerups = gameState.powerups.filter(powerup => powerup.lifeTimer > 0);

  // Update players
  gameState.players.forEach(player => {
    // Handle death/respawn countdown
    if (player.dead) {
      player.respawnTimer--;
      if (player.respawnTimer <= 0) {
        player.dead = false;
  player.position = { x: Math.random()*WORLD_WIDTH, y: Math.random()*WORLD_HEIGHT };
        player.velocity = { x: 0, y: 0 };
        player.invulnerable = true;
        setTimeout(() => { player.invulnerable = false; }, 2000);
      }
      return; // Skip movement while dead
    }
    if (player.velocity && !player.delete) {
      // Apply speed multiplier if speedUp powerup is active
      const speedMultiplier = player.activePowerups && player.activePowerups.speedUp 
        ? 1 + (player.activePowerups.speedUp.stack * 0.3) 
        : 1;

      // Add max speed limit - lower than in single player
      const maxSpeed = 4; // Set a reasonable max speed
      const currentSpeed = Math.sqrt(
        player.velocity.x * player.velocity.x + 
        player.velocity.y * player.velocity.y
      );
      
      // If exceeding max speed, normalize velocity vector to max speed
      if (currentSpeed > maxSpeed) {
        player.velocity.x = (player.velocity.x / currentSpeed) * maxSpeed;
        player.velocity.y = (player.velocity.y / currentSpeed) * maxSpeed;
      }

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
        if (type === 'shield') return; // no duration decrement
        player.activePowerups[type].duration--;
        if (player.activePowerups[type].duration <= 0) {
          if (type === 'speedUp') player.speedMultiplier = 1;
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
    if (bullet.bouncing) {
      // Track bounce count
      if (bullet.bounceCount === undefined) bullet.bounceCount = 0;

      // Determine allowed bounces from owner's bouncingBullets stack (1/2/3) default 1
      let allowedBounces = 1;
      if (bullet.playerId) {
        const owner = gameState.players.find(p => p.id === bullet.playerId);
        if (owner && owner.activePowerups && owner.activePowerups.bouncingBullets) {
          const stack = owner.activePowerups.bouncingBullets.stack || 1;
            allowedBounces = Math.min(3, Math.max(1, stack));
        }
      }

      let bounced = false;
      if (bullet.position.x <= 0 || bullet.position.x >= WORLD_WIDTH) { bullet.velocity.x *= -1; bounced = true; }
      if (bullet.position.y <= 0 || bullet.position.y >= WORLD_HEIGHT) { bullet.velocity.y *= -1; bounced = true; }
      if (bounced) bullet.bounceCount++;
      // Expire if exceeded allowed bounces
      if (bullet.bounceCount > allowedBounces) return false;
      return bullet.lifeTime < 600;
    }
    return isValidPosition(bullet.position, bullet.radius) && bullet.lifeTime < 300;
  });

  // Process shooting for all players who are holding spacebar (skip dead)
  gameState.players.forEach(player => {
    if (!player.delete && !player.dead && player.spacePressed) {
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
            
            const b = acquireBullet();
            b.id = `bullet_${Date.now()}_${Math.random()}`;
            b.position = { x: player.position.x, y: player.position.y };
            let speed = 8;
            if (player.activePowerups && player.activePowerups.powerShot) {
              const psStack = player.activePowerups.powerShot.stack || 1;
              speed *= (1 + 0.33 * (psStack - 1));
            }
            b.velocity = { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed };
            b.radius = player.activePowerups && player.activePowerups.powerShot ? 4 : 2;
            b.playerId = player.id;
            b.lifeTime = 0;
            b.bouncing = !!(player.activePowerups && player.activePowerups.bouncingBullets !== undefined);
            b.homing = !!(player.activePowerups && player.activePowerups.homingShot !== undefined);
            gameState.bullets.push(b);
          }
        } else {
          // Regular shot
          const b = acquireBullet();
          b.id = `bullet_${Date.now()}_${Math.random()}`;
          b.position = { x: player.position.x, y: player.position.y };
          let speed = 8;
          if (player.activePowerups && player.activePowerups.powerShot) {
            const psStack = player.activePowerups.powerShot.stack || 1;
            speed *= (1 + 0.33 * (psStack - 1));
          }
          b.velocity = { x: Math.cos(radians) * speed, y: Math.sin(radians) * speed };
          b.radius = player.activePowerups && player.activePowerups.powerShot ? 4 : 2;
          b.playerId = player.id;
          b.lifeTime = 0;
          b.bouncing = !!(player.activePowerups && player.activePowerups.bouncingBullets !== undefined);
          b.homing = !!(player.activePowerups && player.activePowerups.homingShot !== undefined);
          gameState.bullets.push(b);
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

  // Handle homing bullets - EXACTLY matching Bullet.js from offline mode
  gameState.bullets.forEach(bullet => {
    if (bullet.homing) {
      // Honor optional homing delay (used by replicated bouncing bullets)
  // removed homing delay logic
      // Find the nearest asteroid - exactly matching offline logic
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
      
      // If there's an asteroid within range, adjust trajectory
      if (closestAsteroid && closestDistance < 500) { // 500px is the homing range in Bullet.js
        const dx = closestAsteroid.position.x - bullet.position.x;
        const dy = closestAsteroid.position.y - bullet.position.y;
        const angle = Math.atan2(dy, dx);
        
        // Get the player who fired this bullet
        const player = gameState.players.find(p => p.id === bullet.playerId);
        
        // Match the exact Bullet.js homing strength calculation
        // In offline mode it's 0.2 base + 0.1 per stack level after the first
  const stackLevel = player?.activePowerups?.homingShot?.stack || 1;
  // Base 0.2 then +0.15 per extra stack (1=>0.2, 2=>0.35, 3=>0.5)
  const homingStrength = 0.2 + ((stackLevel - 1) * 0.15);
        
        bullet.velocity.x += Math.cos(angle) * homingStrength;
        bullet.velocity.y += Math.sin(angle) * homingStrength;
        
        // Normalize velocity to maintain constant speed (exactly as in Bullet.js)
        const speed = 8;
        const currentSpeed = Math.sqrt(bullet.velocity.x * bullet.velocity.x + bullet.velocity.y * bullet.velocity.y);
        bullet.velocity.x = (bullet.velocity.x / currentSpeed) * speed;
        bullet.velocity.y = (bullet.velocity.y / currentSpeed) * speed;
      }
    }
  });

  // Spatial grid for bullet-asteroid collisions
  const CELL_SIZE2 = 200;
  const asteroidGrid2 = new Map();
  for (let ai = 0; ai < gameState.asteroids.length; ai++) {
    const a = gameState.asteroids[ai];
    const cx = Math.floor(a.position.x / CELL_SIZE2);
    const cy = Math.floor(a.position.y / CELL_SIZE2);
    const key = cx + ':' + cy;
    let arr = asteroidGrid2.get(key);
    if (!arr) { arr = []; asteroidGrid2.set(key, arr); }
    arr.push(ai);
  }
  const gatherAsteroids2 = (x, y) => {
    const cx = Math.floor(x / CELL_SIZE2);
    const cy = Math.floor(y / CELL_SIZE2);
    const result = new Set();
    for (let ox = -1; ox <= 1; ox++) {
      for (let oy = -1; oy <= 1; oy++) {
        const key = (cx + ox) + ':' + (cy + oy);
        const arr = asteroidGrid2.get(key);
        if (arr) arr.forEach(i => result.add(i));
      }
    }
    return result;
  };
  for (let bi = gameState.bullets.length - 1; bi >= 0; bi--) {
    const bullet = gameState.bullets[bi];
    const candidateAsteroids = gatherAsteroids2(bullet.position.x, bullet.position.y);
    let hit = false;
    for (const j of candidateAsteroids) {
      const asteroid = gameState.asteroids[j];
      if (!asteroid) continue;
      const asteroidForCollision = { x: asteroid.position.x, y: asteroid.position.y, size: asteroid.radius, rotation: asteroid.rotation, shape: asteroid.shape };
      const bulletCircle = { x: bullet.position.x, y: bullet.position.y, radius: bullet.radius };
      const asteroidPolygon = getAsteroidPolygon(asteroidForCollision);
      if (checkCirclePolygonCollision(bulletCircle, asteroidPolygon)) {
        const player = gameState.players.find(p => p.id === bullet.playerId);
        if (player) {
          let base = Math.floor(100 + asteroid.radius * 2);
          if (bullet.radius > 2) base += 50;
          // Apply score multiplier: 1x base, +0.5x per extra stack (1=>1x,2=>1.5x,3=>2x)
          let mult = 1;
          const sm = player.activePowerups?.scoreMultiplier;
          if (sm) {
            const s = sm.stack || 1;
            mult = 1 + 0.5 * (s - 1); // 1,1.5,2
          }
          const scoreDelta = Math.floor(base * mult);
          player.score += scoreDelta;
          if (player.score > (player.highScore || 0)) player.highScore = player.score;
          updateLeaderForPlayer(player);
        }
        if (!bullet.bouncing) { gameState.bullets.splice(bi, 1); releaseBullet(bullet); }
        if (Math.random() < POWERUP_SPAWN_CHANCE) { gameState.powerups.push(createPowerup(asteroid.position)); }
        if (asteroid.radius > 20) {
          for (let k = 0; k < 2; k++) gameState.asteroids.push(createAsteroid({ position: { ...asteroid.position }, radius: asteroid.radius * 0.6 }));
        }
        gameState.asteroids.splice(j, 1); releaseAsteroid(asteroid);
        hit = true; break;
      }
    }
    if (hit) continue;
  }

  // Check player-powerup collisions using polygonal detection
  gameState.players.forEach(player => {
    if (player.delete) return;
    
    const playerPolygon = getShipPolygon({
      x: player.position.x,
      y: player.position.y,
      rotation: player.rotation
    });
    
    for (let i = gameState.powerups.length - 1; i >= 0; i--) {
      const powerup = gameState.powerups[i];
      const powerupPolygon = getPowerupPolygon(powerup);
      
      // Check if player polygon and powerup polygon intersect
      if (checkPolygonCollision(playerPolygon, powerupPolygon)) {
        // Apply powerup effect
        applyPowerup(player, powerup.type);
        
        // Remove powerup from the world
        gameState.powerups.splice(i, 1);
      }
    }
  });

  // Build spatial grid for asteroids (simple uniform grid)
  const CELL_SIZE = 200;
  const asteroidGrid = new Map(); // key => array of asteroid indices
  for (let ai = 0; ai < gameState.asteroids.length; ai++) {
    const a = gameState.asteroids[ai];
    const cx = Math.floor(a.position.x / CELL_SIZE);
    const cy = Math.floor(a.position.y / CELL_SIZE);
    const key = cx + ':' + cy;
    let arr = asteroidGrid.get(key);
    if (!arr) { arr = []; asteroidGrid.set(key, arr); }
    arr.push(ai);
  }

  // Helper to gather nearby asteroid indices for a position
  const gatherAsteroids = (x, y) => {
    const cx = Math.floor(x / CELL_SIZE);
    const cy = Math.floor(y / CELL_SIZE);
    const result = new Set();
    for (let ox = -1; ox <= 1; ox++) {
      for (let oy = -1; oy <= 1; oy++) {
        const key = (cx + ox) + ':' + (cy + oy);
        const arr = asteroidGrid.get(key);
        if (arr) arr.forEach(i => result.add(i));
      }
    }
    return result;
  };

  // Check player-asteroid collisions using spatial grid (shield absorbs, else death)
  const playersKnockedThisFrame = new Set();
  gameState.players.forEach(player => {
    if (player.dead) return;
  const shieldStacks = player.activePowerups?.shield?.stack || 0;
  const hasShield = shieldStacks > 0;
  if (player.invulnerable && !hasShield) return; // respawn invuln still pass-through
    
    const playerForCollision = {
      x: player.position.x,
      y: player.position.y,
      rotation: player.rotation
    };
    
    const playerPolygon = getShipPolygon(playerForCollision);
    
    const candidateIdxs = gatherAsteroids(player.position.x, player.position.y);
    for (const i of candidateIdxs) {
      const asteroid = gameState.asteroids[i];
      if (!asteroid) continue;
      
      const asteroidForCollision = {
        x: asteroid.position.x,
        y: asteroid.position.y,
        size: asteroid.radius,
        rotation: asteroid.rotation,
        shape: asteroid.shape
      };
      
      const asteroidPolygon = getAsteroidPolygon(asteroidForCollision);
      
      if (checkPolygonCollision(playerPolygon, asteroidPolygon)) {
    if (hasShield) {
          if (!playersKnockedThisFrame.has(player.id)) {
            // Momentum transfer: impart player's current velocity into asteroid; damp player.
            const pvx = player.velocity.x || 0; const pvy = player.velocity.y || 0;
            asteroid.velocity.x += pvx;
            asteroid.velocity.y += pvy;
            player.velocity.x *= 0.2;
            player.velocity.y *= 0.2;
            // Positional separation along collision normal to avoid immediate re-collision
            const dx = asteroid.position.x - player.position.x;
            const dy = asteroid.position.y - player.position.y;
            const dist = Math.sqrt(dx * dx + dy * dy) || 1;
            const nx = dx / dist; const ny = dy / dist;
            player.position.x -= nx * 8; player.position.y -= ny * 8;
            asteroid.position.x += nx * 8; asteroid.position.y += ny * 8;
            playersKnockedThisFrame.add(player.id);
      // Consume one shield layer
      player.activePowerups.shield.stack -= 1;
      if (player.activePowerups.shield.stack <= 0) delete player.activePowerups.shield;
          }
    } else if (!player.dead && !player.invulnerable) {
            player.highScore = Math.max(player.highScore || 0, player.score || 0);
            player.score = 0;
            player.activePowerups = {};
            player.speedMultiplier = 1;
            player.shootTimer = 0;
            player.dead = true;
            deadThisFrame.add(player.id);
            player.deathPosition = { x: player.position.x, y: player.position.y };
            player.respawnTimer = 120;
            player.velocity = { x: 0, y: 0 };
            updateLeaderForPlayer(player);
        }
        break;
      }
    }
  });

  while (gameState.asteroids.length < 4) {
    gameState.asteroids.push(createAsteroid());
  }

  // Spawn UFO wave when none active (dynamic size & cadence based on total active powerup stacks)
  if (gameState.ufos.length === 0) {
    // Count total stacks
    let totalStacks = 0;
    for (const p of gameState.players) {
      const ap = p.activePowerups;
      if (!ap) continue;
      for (const key in ap) {
        if (ap[key] && ap[key].stack) totalStacks += ap[key].stack;
      }
    }
    // Dynamic size: each stack adds 1.2 UFOs, capped to reach 2500 max
    const EXTRA_PER_STACK = 1.2;
    const MAX_EXTRA = 2475; // 25 base + 2475 = 2500
    const extra = Math.min(MAX_EXTRA, Math.floor(totalStacks * EXTRA_PER_STACK));
    const waveSize = Math.min(2500, UFO_WAVE_SIZE + extra);

    // Dynamic cadence: base interval long, shrinks toward 180 frames (~3s) as stacks rise
    // Use a diminishing function so large stacks rapidly approach the floor but never exceed it
    const BASE_INTERVAL = 1800; // 30 seconds at 60fps starting point
    const MIN_INTERVAL = 180;  // 3 seconds target
    // Scale factor: more stacks => smaller interval; choose k so ~200 total stacks ~ near min
    const k = 0.02; // tuning coefficient
    const interval = Math.max(MIN_INTERVAL, Math.floor(BASE_INTERVAL / (1 + k * totalStacks)));
    if (ufoSpawnCooldown > 0) ufoSpawnCooldown--; // tick down
    if (ufoSpawnCooldown <= 0 || Math.random() < UFO_SPAWN_CHANCE) {
      if (waveSize > 0) {
        for (let i = 0; i < waveSize; i++) gameState.ufos.push(createUFO());
        if (io.emit) io.emit('ufoSwarmIncoming');
      }
      ufoSpawnCooldown = interval; // reset based on current stack intensity
    }
  }

  // Update UFOs (meandering path)
  gameState.ufos = gameState.ufos.filter(ufo => {
    if (ufo.exploding) {
      ufo.explosionTimer--;
      if (ufo.explosionTimer <= 0) return false;
      return true; // keep until timer finishes (position frozen)
    }
    // If UFO has been knocked, integrate its knock velocity instead of pathing
    if (ufo.knocked) {
      if (!ufo.knockVelocity) ufo.knockVelocity = { x: 0, y: 0 };
      ufo.position.x += ufo.knockVelocity.x;
      ufo.position.y += ufo.knockVelocity.y;
      // Light damping
      ufo.knockVelocity.x *= 0.99;
      ufo.knockVelocity.y *= 0.99;
      if (ufo.knockTimer !== undefined) {
        ufo.knockTimer--;
        if (ufo.knockTimer <= 0) return false; // despawn after timer
      }
      // Clamp inside world (keeps it on screen after impact)
      const kr = ufo.radius || UFO_RADIUS;
      if (ufo.position.x < kr) ufo.position.x = kr;
      if (ufo.position.x > WORLD_WIDTH - kr) ufo.position.x = WORLD_WIDTH - kr;
      if (ufo.position.y < kr) ufo.position.y = kr;
      if (ufo.position.y > WORLD_HEIGHT - kr) ufo.position.y = WORLD_HEIGHT - kr;
      // Still allow shooting while knocked
      ufo.shootTimer--;
      if (ufo.shootTimer <= 0) {
        let nearest = null; let nd = Infinity;
        gameState.players.forEach(p => {
          if (p.delete) return;
          const dx = p.position.x - ufo.position.x;
          const dy = p.position.y - ufo.position.y;
          const d = dx * dx + dy * dy;
          if (d < nd) { nd = d; nearest = p; }
        });
        if (nearest) {
          gameState.ufoBullets.push(createUFOBullet(ufo, nearest.position));
        }
        ufo.shootTimer = UFO_SHOOT_INTERVAL;
      }
      return true;
    }
    // Advance along path; speed is already per-frame fraction of full path
    ufo.progress += ufo.speed; 
    if (ufo.progress >= 1) return false; // terminate exactly at border end
    const t = Math.min(1, ufo.progress);
    // Base linear interpolation
    const linX = ufo.start.x + (ufo.end.x - ufo.start.x) * t;
    const linY = ufo.start.y + (ufo.end.y - ufo.start.y) * t;
    // Sinusoidal offset along perpendicular
    const sine = Math.sin(t * Math.PI * 2 * ufo.frequency);
  ufo.position.x = linX + ufo.perpDir.x * sine * ufo.amplitude;
  ufo.position.y = linY + ufo.perpDir.y * sine * ufo.amplitude;
  // Clamp UFO inside world bounds so it never leaves the map
  const clampR = ufo.radius || UFO_RADIUS;
  if (ufo.position.x < clampR) ufo.position.x = clampR;
  if (ufo.position.x > WORLD_WIDTH - clampR) ufo.position.x = WORLD_WIDTH - clampR;
  if (ufo.position.y < clampR) ufo.position.y = clampR;
  if (ufo.position.y > WORLD_HEIGHT - clampR) ufo.position.y = WORLD_HEIGHT - clampR;
    // Shooting
    ufo.shootTimer--;
    if (ufo.shootTimer <= 0) {
      // Find nearest player
      let nearest = null; let nd = Infinity;
      gameState.players.forEach(p => {
        if (p.delete) return;
        const dx = p.position.x - ufo.position.x;
        const dy = p.position.y - ufo.position.y;
        const d = dx * dx + dy * dy;
        if (d < nd) { nd = d; nearest = p; }
      });
      if (nearest) {
        gameState.ufoBullets.push(createUFOBullet(ufo, nearest.position));
      }
      ufo.shootTimer = UFO_SHOOT_INTERVAL;
    }
    return true;
  });

  // Update UFO bullets (collide with map borders and vanish)
  gameState.ufoBullets = gameState.ufoBullets.filter(b => {
    b.position.x += b.velocity.x;
    b.position.y += b.velocity.y;
    const r = b.radius || 0;
    // Remove if outside world bounds (treat as collision)
    if (b.position.x - r <= 0 || b.position.x + r >= WORLD_WIDTH || b.position.y - r <= 0 || b.position.y + r >= WORLD_HEIGHT) {
      return false;
    }
    return true;
  });

  // Player bullets hitting UFOs (circle vs polygon) - iterate UFOs then nearby bullets
  // Build bullet grid for efficiency in large bullet counts
  const bulletGrid = new Map();
  for (let bi = 0; bi < gameState.bullets.length; bi++) {
    const b = gameState.bullets[bi];
    const cx = Math.floor(b.position.x / CELL_SIZE);
    const cy = Math.floor(b.position.y / CELL_SIZE);
    const key = cx + ':' + cy;
    let arr = bulletGrid.get(key);
    if (!arr) { arr = []; bulletGrid.set(key, arr); }
    arr.push(bi);
  }
  const gatherBullets = (x, y) => {
    const cx = Math.floor(x / CELL_SIZE);
    const cy = Math.floor(y / CELL_SIZE);
    const result = new Set();
    for (let ox = -1; ox <= 1; ox++) {
      for (let oy = -1; oy <= 1; oy++) {
        const key = (cx + ox) + ':' + (cy + oy);
        const arr = bulletGrid.get(key);
        if (arr) arr.forEach(i => result.add(i));
      }
    }
    return result;
  };
  for (let j = gameState.ufos.length - 1; j >= 0; j--) {
    const ufo = gameState.ufos[j];
    if (ufo.exploding) continue;
    const ufoPoly = getUFOPolygon(ufo);
    const candidateBullets = gatherBullets(ufo.position.x, ufo.position.y);
    for (const bi of candidateBullets) {
      const bullet = gameState.bullets[bi];
      if (!bullet) continue;
      const bulletCircle = { x: bullet.position.x, y: bullet.position.y, radius: bullet.radius };
      if (checkCirclePolygonCollision(bulletCircle, ufoPoly)) {
        if (!bullet.bouncing) {
          gameState.bullets.splice(bi, 1);
        }
        ufo.health -= 1;
        if (ufo.health <= 0) {
          // Chance to drop powerup when destroyed by bullet
          if (Math.random() < UFO_POWERUP_DROP_CHANCE) {
            gameState.powerups.push(createPowerup({ ...ufo.position }));
          }
          ufo.exploding = true;
          ufo.explosionTimer = 45;
        }
        break;
      }
    }
  }

  // Player ship polygon vs UFO polygon collisions (shield absorbs once per layer)
  gameState.players.forEach(player => {
    if (player.dead) return;
  const shieldStacks = player.activePowerups?.shield?.stack || 0;
  const playerHasShield = shieldStacks > 0;
  const playerHasAnyInvuln = player.invulnerable || playerHasShield;
    const playerPoly = getShipPolygon({ x: player.position.x, y: player.position.y, rotation: player.rotation });
    for (let j = gameState.ufos.length - 1; j >= 0; j--) {
      const ufo = gameState.ufos[j];
      if (ufo.exploding) continue;
      const ufoPoly = getUFOPolygon(ufo);
      if (checkPolygonCollision(playerPoly, ufoPoly)) {
  if (!playersKnockedThisFrame.has(player.id)) {
          // Strong knock impulse always applied to UFO
          const dx = ufo.position.x - player.position.x;
          const dy = ufo.position.y - player.position.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const nx = dx / dist; const ny = dy / dist;
          const baseImpulse = 12.5; // reduced impulse (was 25)
          const pvx = player.velocity.x || 0; const pvy = player.velocity.y || 0;
          ufo.knocked = true;
          ufo.knockVelocity = {
            x: nx * baseImpulse + pvx * 0.5,
            y: ny * baseImpulse + pvy * 0.5
          };
          ufo.knockTimer = 300; // ~5s at 60Hz then despawn
          // Separate player backwards
          player.position.x -= nx * 14;
          player.position.y -= ny * 14;
          // Damp player
          player.velocity.x *= 0.2;
          player.velocity.y *= 0.2;
          playersKnockedThisFrame.add(player.id);
        }
        // Handle player death if no invulnerability powerup
        if (playerHasShield) {
          if (!playersKnockedThisFrame.has(player.id)) {
            // Consume shield layer
            player.activePowerups.shield.stack -= 1;
            if (player.activePowerups.shield.stack <= 0) delete player.activePowerups.shield;
          }
        } else if (!playerHasAnyInvuln && !player.dead) {
          player.highScore = Math.max(player.highScore || 0, player.score || 0);
          player.score = 0;
          player.activePowerups = {};
          player.speedMultiplier = 1;
          player.shootTimer = 0;
          player.dead = true;
          deadThisFrame.add(player.id);
          player.deathPosition = { x: player.position.x, y: player.position.y };
          player.respawnTimer = 120;
          player.velocity = { x: 0, y: 0 };
          updateLeaderForPlayer(player);
        }
        break;
      }
    }
  });

  // UFO bullets hitting players
  for (let i = gameState.ufoBullets.length - 1; i >= 0; i--) {
    const bullet = gameState.ufoBullets[i];
    for (const player of gameState.players) {
      if (player.dead || player.invulnerable) continue; // allow shield to absorb
      const dx = bullet.position.x - player.position.x;
      const dy = bullet.position.y - player.position.y;
      if (dx * dx + dy * dy < (20) * (20)) { // ship approx radius 20
        gameState.ufoBullets.splice(i, 1);
        if (!player.dead) {
          if (player.activePowerups && player.activePowerups.shield && player.activePowerups.shield.stack > 0) {
            player.activePowerups.shield.stack -= 1;
            if (player.activePowerups.shield.stack <= 0) delete player.activePowerups.shield;
          } else {
            player.highScore = Math.max(player.highScore || 0, player.score || 0);
            player.score = 0;
            player.activePowerups = {};
            player.speedMultiplier = 1;
            player.shootTimer = 0;
            player.dead = true;
            deadThisFrame.add(player.id);
            player.deathPosition = { x: player.position.x, y: player.position.y };
            player.respawnTimer = 120;
            player.velocity = { x: 0, y: 0 };
            updateLeaderForPlayer(player);
          }
        }
        break;
      }
    }
  }
  // Remove bullets spawned this same frame by players who died this frame
  if (deadThisFrame.size) {
    gameState.bullets = gameState.bullets.filter(b => !(deadThisFrame.has(b.playerId) && b.lifeTime === 0));
  }
};

// Track host socket id (first client that declares itself host)
let hostSocketId = null;

// Socket connection handling
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('joinGame', (playerName, opts = {}) => {
    const newPlayer = {
      id: socket.id,
      name: playerName,
  color: assignPlayerColor(),
  position: { x: Math.random()*WORLD_WIDTH, y: Math.random()*WORLD_HEIGHT },
      velocity: { x: 0, y: 0 },
      rotation: 0,
      score: 0,
  highScore: 0,
  lives: Infinity, // UI convenience; not decremented anymore
      activePowerups: {},
      delete: false,
  dead: false,
  respawnTimer: 0,
  deathPosition: null,
      shootTimer: 0,
      invulnerable: false,
      spacePressed: false
    };
    gameState.players.push(newPlayer);
    if (opts.isHost && !hostSocketId) {
      hostSocketId = socket.id;
      console.log('Host registered:', hostSocketId);
    }
  updateLeaderForPlayer(newPlayer);
    socket.emit('playerJoined', { playerId: socket.id });
    io.emit('playerCount', gameState.players.length);
    console.log(`Player ${playerName} joined the game`);
  });

  socket.on('playerInput', (input) => {
    const player = gameState.players.find(p => p.id === socket.id);
  if (player && input && !player.delete && !player.dead) {
      if (input.rotation !== undefined) player.rotation = input.rotation;
      if (input.keys.w) {
        const radians = (player.rotation - 90) * Math.PI / 180;
        // Reduce acceleration by half (from 0.3 to 0.15)
        player.velocity.x += Math.cos(radians) * 0.15;
        player.velocity.y += Math.sin(radians) * 0.15;
      }
      if (input.keys.s) {
        const radians = (player.rotation - 90) * Math.PI / 180;
        // Also reduce reverse thrust by half (from 0.15 to 0.075)
        player.velocity.x -= Math.cos(radians) * 0.075;
        player.velocity.y -= Math.sin(radians) * 0.075;
      }
      // Track spacebar state but don't create bullets here
      player.spacePressed = input.keys.space;
    }
  });

  // Admin command: add bot
  socket.on('addBot', () => {
    const bot = createBotPlayer();
    gameState.players.push(bot);
    updateLeaderForPlayer(bot);
    io.emit('playerCount', gameState.players.length);
    console.log('Bot added');
  });

  // Remove a bot by id (admin functionality - trusts client; could tighten with auth)
  socket.on('removeBot', (botId) => {
    const before = gameState.players.length;
    gameState.players = gameState.players.filter(p => !(p.id === botId && p.isBot));
    if (before !== gameState.players.length) {
      if (globalLeader && !gameState.players.find(p=>p.id===globalLeader.id)) recomputeLeader();
      io.emit('playerCount', gameState.players.length);
      console.log('Bot removed', botId);
    }
  });

  socket.on('disconnect', () => {
    gameState.players = gameState.players.filter(player => player.id !== socket.id);
    if (globalLeader && globalLeader.id === socket.id) {
      recomputeLeader();
    }
    io.emit('playerCount', gameState.players.length);
    console.log('User disconnected:', socket.id);
    if (socket.id === hostSocketId) {
      console.log('Host disconnected. Server shutting down...');
      setTimeout(() => process.exit(0), 250);
    }
  });
});

// Endpoint to signal host disconnect explicitly (navigator.sendBeacon / fetch keepalive)
app.post('/hostDisconnect', (req, res) => {
  if (hostSocketId) {
    console.log('Host disconnect endpoint called. Shutting down.');
    res.json({ shuttingDown: true });
    setTimeout(() => process.exit(0), 250);
  } else {
    res.json({ shuttingDown: false, reason: 'No host set' });
  }
});

// Initialize game and start loop
initializeStars();
initializeAsteroids();
// Simulation and broadcast both at 60Hz
let tick = 0;
setInterval(updateGameState, 1000 / 60);
setInterval(() => {
  const objectCounts = {
    players: gameState.players.length,
    asteroids: gameState.asteroids.length,
    bullets: gameState.bullets.length,
    ufoBullets: gameState.ufoBullets.length,
    ufos: gameState.ufos.length,
    powerups: gameState.powerups.length,
    stars: gameState.stars.length
  };
  const objectCount = Object.values(objectCounts).reduce((a,b)=>a+b,0);
  // Build a serializable shallow snapshot (avoid leaking pooled object references / unexpected props)
  const snapshot = {
  players: gameState.players.map(p=>({ id:p.id,name:p.name,isBot:!!p.isBot,color:p.color,position:p.position,velocity:p.velocity,rotation:p.rotation,score:p.score,highScore:p.highScore,dead:p.dead,deathPosition:p.deathPosition,invulnerable:p.invulnerable,activePowerups:p.activePowerups || {} })),
    asteroids: gameState.asteroids.map(a=>({ id:a.id,position:a.position,velocity:a.velocity,radius:a.radius,angle:a.angle,spin:a.spin })),
    ufos: gameState.ufos.map(u=>({ id:u.id, position:u.position, velocity:u.velocity, radius:u.radius, exploding:u.exploding, explosionTimer:u.explosionTimer })),
  bullets: gameState.bullets.map(b=>({ id:b.id, position:b.position, velocity:b.velocity, radius:b.radius, playerId:b.playerId, lifeTime:b.lifeTime, bouncing:!!b.bouncing, homing:!!b.homing })),
    ufoBullets: gameState.ufoBullets.map(b=>({ id:b.id, position:b.position, velocity:b.velocity, radius:b.radius, lifeTime:b.lifeTime })),
    powerups: gameState.powerups.map(pw=>({ id:pw.id, type:pw.type, position:pw.position, lifeTimer:pw.lifeTimer })),
    stars: gameState.stars, // already simple
  };
  io.emit('gameState', { ...snapshot, leader: globalLeader, tick, serverTime: Date.now(), objectCount, objectCounts });
  // Diagnostic: emit separate minimal bullet diagnostics for bouncing replication debugging
  // removed bulletDiag debug emission
}, 1000 / 60);

// Serve React app for any other routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../../build', 'index.html'));
});

const PORT = process.env.PORT || 5001;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});