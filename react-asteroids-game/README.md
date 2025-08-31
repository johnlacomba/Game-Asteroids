# React Asteroids Game

## Overview
This project is an open-world style Roguelike Asteroids game built with React. Players control a spaceship, navigating through an asteroid field while collecting randomized items and power-ups. The game features smooth movement and shooting mechanics, providing an engaging gameplay experience.

## Features
- Open-world exploration
- Randomized items and power-ups
- Player movement controlled with W, A, S, D keys
- Shooting mechanics using the spacebar
- Dynamic asteroid generation

## Project Structure
```
react-asteroids-game
├── public
│   └── index.html
├── src
│   ├── components
│   │   ├── Game.js
│   │   ├── Player.js
│   │   ├── Asteroid.js
│   │   └── Bullet.js
│   ├── hooks
│   │   └── useGameLoop.js
│   ├── core
│   │   ├── inputController.js
│   │   └── gameEngine.js
│   ├── App.js
│   ├── index.css
│   └── index.js
├── package.json
└── README.md
```

## Installation
1. Clone the repository:
   ```
   git clone <repository-url>
   ```
2. Navigate to the project directory:
   ```
   cd react-asteroids-game
   ```
3. Install the dependencies:
   ```
   npm install
   ```

## Running the Game
To start the game, run:
```
npm start
```
This will launch the game in your default web browser.

## Controls
- **W**: Move Up
- **A**: Move Left
- **S**: Move Down
- **D**: Move Right
- **Spacebar**: Shoot Bullets

## Contributing
Contributions are welcome! Please open an issue or submit a pull request for any enhancements or bug fixes.

## License
This project is licensed under the MIT License. See the LICENSE file for details.