# React Asteroids Game

A modern recreation of the classic Asteroids arcade game built with React and HTML5 Canvas.

## Game Features

### Core Gameplay
- **Classic Asteroids mechanics** - Navigate space, shoot asteroids, and survive
- **Asteroid physics** - Asteroids bounce off world boundaries and split when destroyed
- **Multi-hit system** - Larger asteroids require multiple hits to destroy
- **Score system** - Earn points for destroying asteroids (100 pts) and UFOs (500 pts)
- **Progressive waves** - Each new wave spawns more asteroids than the last

### Ship Controls
- **WASD Movement** - W: Thrust forward, S: Reverse thrust, A/D: Rotate left/right  
- **Spacebar** - Fire bullets
- **Physics-based movement** - Realistic inertia and momentum
- **Boundary collision** - Ship bounces off world walls using polygon collision detection
- **Speed limiting** - Maximum velocity cap prevents uncontrollable speeds

### Visual Features
- **Starfield background** - Randomly placed static stars for visual reference
- **Camera system** - Smooth camera follows the player ship
- **Large game world** - 3000x2000 pixel play area with visible boundaries
- **Particle effects** - Debris particles when objects are destroyed

### Power-Up System
Six different power-ups with stacking effects and duration timers:

1. **Rapid Fire (R)** - 5x faster shooting (30s duration, stacks exponentially)
2. **Invulnerability (I)** - Bounce off enemies instead of dying (10s duration)  
3. **Spread Shot (SS)** - Fire 3 bullets in a spread pattern (30s duration)
4. **Homing Shot (H)** - Bullets curve toward nearest target (30s duration)
5. **Speed Up (P)** - 2x thrust power (60s duration, stacks exponentially)
6. **Power Shot (PS)** - Larger bullets that deal double damage (30s duration)

Power-ups randomly spawn from destroyed asteroids and UFOs (20% chance).

### Enemy System
- **Classic UFOs** - Spawn periodically and shoot red bullets at the player
- **UFO Swarm Mode** - After collecting 5+ power-ups, waves of 36 UFOs spawn every 15 seconds
- **Smart targeting** - UFOs calculate trajectory to shoot directly at player position
- **Dramatic notifications** - Flashing "UFO SWARM INCOMING!" warning when waves spawn

### Game States
- **Game Over screen** - Displays when player is destroyed
- **Restart functionality** - Press Enter to reset and play again
- **Real-time UI** - Shows current score and active power-ups with remaining time
- **Clean state management** - Complete reset of all game objects on restart

## Technical Features

### Collision Detection
- **Polygon-based collision** - Accurate collision detection for irregularly shaped objects
- **Circle-polygon collision** - Optimized collision for bullets vs. polygon objects
- **Boundary detection** - Ships use polygon collision with world walls

### Performance Optimizations
- **Efficient rendering** - Objects only render when in camera view
- **Memory management** - Automatic cleanup of destroyed objects
- **Smooth animation** - 60 FPS game loop with requestAnimationFrame

### Architecture
- **Component-based design** - Modular game objects (Player, Asteroid, UFO, etc.)
- **Separation of concerns** - Dedicated modules for input, collision, and game logic
- **React integration** - Game state managed with React hooks and refs

## How to Play

1. **Movement** - Use WASD keys to pilot your ship through space
2. **Shooting** - Press spacebar to fire bullets at asteroids and UFOs  
3. **Survival** - Avoid colliding with asteroids, UFOs, and enemy bullets
4. **Power-ups** - Collect colored squares that drop from destroyed enemies
5. **Progression** - Clear all asteroids to advance to the next wave
6. **Challenge** - Survive the UFO swarm mode that activates after collecting multiple power-ups

## Installation & Setup

```bash
npm install
npm start
```

The game will open in your browser at `http://localhost:3000`.

## Controls Summary
- **W** - Thrust forward
- **S** - Reverse thrust  
- **A** - Rotate left
- **D** - Rotate right
- **Spacebar** - Fire bullets
- **Enter** - Restart game (when game over)

## Game Tips
- Use the starfield to judge your movement in the large game world
- Power-ups stack - collect multiple of the same type for stronger effects
- The Invulnerability power-up is crucial for surviving UFO swarm mode
- Homing bullets make short work of large asteroid fields
- Spread Shot combined with Rapid Fire creates devastating firepower

Enjoy piloting