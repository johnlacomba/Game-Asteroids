import { getMobileKeys } from './mobileInput';

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
  
  // removed debug logging
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
  
  // removed debug logging
}

function handleBlur() {
  // Clear all keys when window loses focus
  // removed debug logging
  Object.keys(keys).forEach(key => {
    keys[key] = false;
  });
}

function initializeInput() {
  if (initialized) return;
  
  // removed debug logging
  
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
  
  // Merge mobile keys (touch) with keyboard
  const mobile = getMobileKeys();
  const currentKeys = { ...keys };
  Object.keys(mobile).forEach(k => { if (mobile[k]) currentKeys[k] = true; });
  
  // Debug: Log current key state every few frames
  // removed random debug logging
  
  return currentKeys;
}

export function cleanup() {
  // removed debug logging
  
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