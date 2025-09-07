// Mobile touch input state shared with inputController
const mobileKeys = { w: false, a: false, s: false, d: false, ' ': false };
let joystickVector = { x: 0, y: 0 }; // left stick: movement (x right, y down)
let rightJoystickVector = { x: 0, y: 0 }; // right stick: aim (x right, y down)

export function setMobileKey(key, value) {
  if (key in mobileKeys) mobileKeys[key] = value;
}

export function getMobileKeys() {
  return { ...mobileKeys };
}

export function setJoystickVector(x, y) {
  joystickVector = { x, y };
}

export function getJoystickVector() {
  return { ...joystickVector };
}

// Right stick (aim) helpers
export function setRightJoystickVector(x, y) {
  rightJoystickVector = { x, y };
}

export function getRightJoystickVector() {
  return { ...rightJoystickVector };
}

export function resetMobileKeys() {
  Object.keys(mobileKeys).forEach(k => mobileKeys[k] = false);
  joystickVector = { x:0, y:0 };
  rightJoystickVector = { x:0, y:0 };
}
