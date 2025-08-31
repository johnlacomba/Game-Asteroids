const keys = {
  w: false,
  a: false,
  s: false,
  d: false,
  ' ': false,
};

const handleKeyDown = (event) => {
  if (keys.hasOwnProperty(event.key.toLowerCase())) {
    event.preventDefault();
    keys[event.key.toLowerCase()] = true;
  }
};

const handleKeyUp = (event) => {
  if (keys.hasOwnProperty(event.key.toLowerCase())) {
    event.preventDefault();
    keys[event.key.toLowerCase()] = false;
  }
};

// Set up the event listeners
window.addEventListener('keydown', handleKeyDown);
window.addEventListener('keyup', handleKeyUp);

// This function is what Game.js will import
export const handleInput = () => {
  return keys;
};