// Mobile touch input state shared with inputController
const mobileKeys = { w: false, a: false, s: false, d: false, ' ': false };
let joystickVector = { x: 0, y: 0 }; // normalized direction (x right, y down)

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

export function resetMobileKeys() {
  Object.keys(mobileKeys).forEach(k => mobileKeys[k] = false);
  joystickVector = { x:0, y:0 };
}
