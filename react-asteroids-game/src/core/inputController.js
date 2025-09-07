import { getMobileKeys, getRightJoystickVector } from './mobileInput';

const keys = {
  w: false,
  s: false,
  a: false,
  d: false,
  ' ': false, // spacebar
};

let initialized = false;

// Mouse aim state (screen coords relative to canvas center, set by consumer)
let mouse = { x: 0, y: 0, down: false };
let aimRotation = 0; // degrees

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
  window.removeEventListener('mousedown', onMouseDown, true);
  window.removeEventListener('mouseup', onMouseUp, true);
  
  // Add new listeners with capture flag for better reliability
  window.addEventListener('keydown', handleKeyDown, true);
  window.addEventListener('keyup', handleKeyUp, true);
  window.addEventListener('blur', handleBlur);
  window.addEventListener('focus', handleBlur);
  window.addEventListener('mousedown', onMouseDown, true);
  window.addEventListener('mouseup', onMouseUp, true);
  
  initialized = true;
}

function onMouseDown(e){ mouse.down = true; }
function onMouseUp(e){ mouse.down = false; }

// Consumers (MultiplayerGame) should call this each frame with their canvas-relative mouse vector
export function setMouseVector(x, y){ mouse.x = x; mouse.y = y; }

export function handleInput() {
  if (!initialized) {
    initializeInput();
  }
  
  // Merge mobile keys (touch) with keyboard
  const mobile = getMobileKeys();
  const currentKeys = { ...keys };
  Object.keys(mobile).forEach(k => { if (mobile[k]) currentKeys[k] = true; });
  // Also map mouse left button as fire (desktop)
  if (mouse.down) currentKeys[' '] = true;

  // Compute aimRotation priority: right stick > mouse > A/D rotation keys handled elsewhere
  const right = getRightJoystickVector ? getRightJoystickVector() : { x:0, y:0 };
  const rightMag = Math.hypot(right.x, right.y);
  const mouseMag = Math.hypot(mouse.x || 0, mouse.y || 0);
  if (rightMag > 0.05) {
    aimRotation = Math.atan2(right.x, -right.y) * 180 / Math.PI;
  } else if (mouseMag > 2) {
    // mouse vector y: up negative; convert to same mapping as player (0 up, +cw)
    aimRotation = Math.atan2(mouse.x, -mouse.y) * 180 / Math.PI;
  }
  
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
  window.removeEventListener('mousedown', onMouseDown, true);
  window.removeEventListener('mouseup', onMouseUp, true);
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

export function getAimRotation(){ return aimRotation; }