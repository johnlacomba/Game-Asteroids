const keys = {
  w: false,
  s: false,
  a: false,
  d: false,
  ' ': false, // spacebar
};

let initialized = false;

function handleKeyDown(e) {
  // Prevent default to stop page scrolling
  if (['w', 's', 'a', 'd', ' '].includes(e.key.toLowerCase()) || e.code === 'Space') {
    e.preventDefault();
  }
  
  const key = e.key.toLowerCase();
  
  // Handle regular keys
  if (key in keys) {
    keys[key] = true;
  }
  
  // Handle spacebar specifically
  if (e.code === 'Space') {
    keys[' '] = true;
  }
  
  // Debug logging to see what keys are being pressed
  console.log('Key pressed:', e.key, 'Code:', e.code, 'Current keys:', {...keys});
}

function handleKeyUp(e) {
  const key = e.key.toLowerCase();
  
  // Handle regular keys
  if (key in keys) {
    keys[key] = false;
  }
  
  // Handle spacebar specifically
  if (e.code === 'Space') {
    keys[' '] = false;
  }
  
  // Debug logging
  console.log('Key released:', e.key, 'Code:', e.code, 'Current keys:', {...keys});
}

function handleBlur() {
  // Clear all keys when window loses focus
  console.log('Window lost focus, clearing all keys');
  Object.keys(keys).forEach(key => {
    keys[key] = false;
  });
}

function initializeInput() {
  if (initialized) return;
  
  console.log('Initializing input controller');
  
  // Remove existing listeners first to prevent duplicates
  window.removeEventListener('keydown', handleKeyDown, true);
  window.removeEventListener('keyup', handleKeyUp, true);
  window.removeEventListener('blur', handleBlur);
  window.removeEventListener('focus', handleBlur); // Also clear on focus to reset state
  
  // Add new listeners with capture flag for better reliability
  window.addEventListener('keydown', handleKeyDown, true);
  window.addEventListener('keyup', handleKeyUp, true);
  window.addEventListener('blur', handleBlur);
  window.addEventListener('focus', handleBlur);
  
  initialized = true;
}

export function handleInput() {
  if (!initialized) {
    initializeInput();
  }
  
  // Return a copy to prevent external modification
  const currentKeys = { ...keys };
  
  // Debug: Log current key state every few frames
  if (Math.random() < 0.01) { // 1% chance to log
    console.log('Current input state:', currentKeys);
  }
  
  return currentKeys;
}

export function cleanup() {
  console.log('Cleaning up input controller');
  
  if (initialized) {
    window.removeEventListener('keydown', handleKeyDown, true);
    window.removeEventListener('keyup', handleKeyUp, true);
    window.removeEventListener('blur', handleBlur);
    window.removeEventListener('focus', handleBlur);
  }
  
  initialized = false;
  
  // Clear all keys
  Object.keys(keys).forEach(key => {
    keys[key] = false;
  });
}

// Export for debugging
export function getKeyState() {
  return { ...keys };
}