# React Asteroids (Single & Multiplayer)

A modern, extensible Asteroids-like built with React, HTML5 Canvas and a Node.js authoritative multiplayer server (Socket.IO). Includes advanced powerups, dynamic UFO swarms, bots, bouncing / homing / spread / power shots, score multipliers, player color identity, and a real‑time scoreboard.

## Feature Overview

### Core Mechanics
- Classic asteroid field with polygon collision & splitting fragments
- Large 3000x2000 bounded world (visible border) with starfield parallax
- Multi-hit asteroids (radius influences score reward and HP)
- Immediate high score updates (no death wait)
- Dynamic UFO swarms tied to global powerup intensity
- Randomized spawn & respawn positions for ships

### Multiplayer (Authoritative Server)
- Real-time 60Hz server tick, client-side interpolation
- Unique per-player ship & bullet colors (non-red palette; enemy/UFO bullets remain red)
- Live scoreboard overlay (hold Tab) showing players & high scores
- Add Bot (+ Bot) and per-bot removal ( - ) buttons inside scoreboard
- Randomly named AI bots with adaptive avoidance & targeting
- LAN-friendly (dynamic host resolution & permissive CORS for development)

### Bots / AI
- Name generation (adjective + noun + (Bot))
- Threat avoidance (asteroids, UFOs, bullets) & target prioritization
- Firing logic with angle tolerance & powerup benefits

### Powerups (All Stack up to x3)
Each has duration; stacking refreshes time & increases potency where applicable.

| Powerup | Label | Effect (Stacking) | Duration (s) | Color |
|---------|-------|-------------------|--------------|-------|
| Rapid Fire | R | Faster fire rate (down to 2f) | 30 | #00E5FF |
| Spread Shot | SS | More simultaneous spread bullets | 30 | #C070FF |
| Invulnerability | I | Collision bounce / push (duration scales 10/20/30s) | 10–30 | #F2FF00 |
| Homing Shot | H | Bullet steering strength (0.2 / 0.35 / 0.5) | 30 | #00FF7A |
| Speed Up | P | Movement speed multiplier (+30% per stack) | 60 | #00B0FF |
| Power Shot | PS | Larger & faster bullets (+33% speed per extra stack) | 30 | #FF8C00 |
| Bouncing Bullets | BB | Bullets reflect off walls (1 / 2 / 3 bounces) | 30 | #7DFFB5 |
| Score Multiplier | SM | Score x1 / x1.5 / x2 | 30 | #FFD700 |

Powerups drop from asteroids (25% server / 15% single-player) & UFOs (chance on destruction).

### Weapon Systems
- Rapid, spread, homing, large (power), and bouncing bullet combinations
- Homing normalization (constant speed) to prevent runaway acceleration
- Power Shot increases bullet radius & speed but keeps owner color
- Bouncing bullets obey stack-based bounce limit & lifetime cap

### UFO System
- Sinusoidal pathing between random border points; guaranteed map exit
- Waves triggered by: none active & probabilistic + spawn cooldown logic
- Dynamic wave size scales with total active player powerup stacks (up to 2500 UFOs)
- Immediate first-frame firing (shootTimer=0) and regular intervals thereafter
- Knock-back physics when colliding with player ships during invulnerability

### Scoring
- Asteroid score = 100 + size bonus (multiplied by score multiplier if active)
- PowerShot bonus (+50) folded into base before multiplier
- UFO score 500 (also affected by multiplier)
- High score updates instantly; global leader tracked and broadcast

### UI / UX
- Tab scoreboard overlay (centered panel) with interactive buttons
- On-canvas powerup timers with stack counts
- Per-player name labels colored to match ship/bullets
- UFO swarm incoming warning flash
- Minimal debug noise (clean console)

### Controls
| Key | Action |
|-----|--------|
| W | Thrust forward |
| S | Reverse thrust |
| A / D | Rotate left / right |
| Space | Shoot |
| Tab (hold) | Show scoreboard (Add/Remove Bots) |
| Escape | Return to title (multiplayer) |
| Enter | Restart (single-player game over) |

### Visual & Effects
- Starfield backdrop (200–400 stars) for inertial reference
- Debris fragments for ship & UFO destruction
- World border outline & camera centering logic (death camera lock)

### Single vs Multiplayer Differences
| Aspect | Single Player | Multiplayer |
|--------|---------------|-------------|
| Powerup drop chance | 15% | 25% (asteroids) + UFO drop chance |
| Wave logic | Progressive asteroid waves | Continuous field replenishment |
| Bots | N/A | Optional AI bots (Add/Remove) |
| Score persistence | Session only | Global leader broadcast each tick |
| Spawn | Center start | Random map spawn / respawn |
| Input sync | Local only | Socket event per frame (rotation + key states) |

### Technical Highlights
- Authoritative server (Node + Express + Socket.IO)
- 60 FPS simulation & broadcast loop
- Object pooling (bullets, asteroids) to reduce GC churn
- Spatial partitioning grids for bullet/asteroid/UFO collision efficiency
- Polygon / circle hybrid collision adapter shared with client
- Player color allocation with fallback non-red HSL generator
- LAN-friendly: dynamic hostname socket initialization & permissive CORS (dev)

### Game States
- **Game Over screen** - Displays when player is destroyed
- **Restart functionality** - Press Enter to reset and play again
- **Real-time UI** - Shows current score and active power-ups with remaining time
- **Clean state management** - Complete reset of all game objects on restart

### Performance & Architecture
- Component-based React front-end with Canvas rendering layer
- requestAnimationFrame render interpolation between server snapshots
- Debris & bullet lifetime pruning + pooling
- Clean separation: core engine, input controller, collision adapter, server loop

## Getting Started

### Prerequisites
- Node.js 16+ recommended

### Install & Run (Development)
```bash
npm install
npm run dev   # runs Express server (port 5001) + React dev server (port 3000) concurrently
```

Open http://localhost:3000 (or http://<your-lan-ip>:3000 on another machine) and choose Multiplayer.

### Production Build
```bash
npm run build
npm run server  # serves gameState API / sockets; ensure you host build/ statics separately or adjust server
```

To deploy a combined build, copy the build/ folder to a static host and run the server for sockets (adjust CORS / origin as needed).

## Bot Management (Multiplayer)
- Hold Tab -> Click "+ Bot" to add an AI
- Click the red minus box next to a bot to remove it

## Known / Design Notes
- High UFO wave sizes (hundreds+) can stress clients; adjust caps if targeting low-end hardware
- Score multiplier applies after PowerShot bonus to ensure predictable scaling
- Server trust model is lax (no auth for bot removal); tighten before public deployment

## Controls Quick Reference
See table above.

## Tips
- Stack score multiplier before large UFO/asteroid clears
- Use invulnerability knock-back offensively to shove asteroids
- Bouncing + homing can cover wide space with lower aim burden
- Add bots to increase total powerup stacks and escalate UFO waves for challenge
- Remove idle bots to reduce swarm scaling

Enjoy and extend!