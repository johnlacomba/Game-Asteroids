/**
 * Core collision detection utilities
 */

// Helper function: Check if a point is inside a polygon
const pointInPolygon = (point, polygon) => {
  let isInside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x, yi = polygon[i].y;
    const xj = polygon[j].x, yj = polygon[j].y;
    const intersect = ((yi > point.y) !== (yj > point.y))
        && (point.x < (xj - xi) * (point.y - yi) / (yj - yi) + xi);
    if (intersect) isInside = !isInside;
  }
  return isInside;
};

// Ship polygon generator - moved to top to ensure it's defined first
export const getShipPolygon = (ship) => {
  const angle = (ship.rotation - 90) * (Math.PI / 180);
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const points = [
    { x: 0, y: -10 },
    { x: -8, y: 10 },
    { x: 0, y: 5 },
    { x: 8, y: 10 }
  ];
  return points.map(p => ({
    x: p.x * cos - p.y * sin + ship.x,
    y: p.x * sin + p.y * cos + ship.y,
  }));
};

// Asteroid polygon generator
export const getAsteroidPolygon = (asteroid) => {
  const points = [];
  const angleStep = (Math.PI * 2) / asteroid.shape.length;
  for (let i = 0; i < asteroid.shape.length; i++) {
    const angle = i * angleStep + asteroid.rotation * (Math.PI / 180);
    const length = asteroid.size * asteroid.shape[i];
    points.push({
      x: asteroid.x + Math.cos(angle) * length,
      y: asteroid.y + Math.sin(angle) * length,
    });
  }
  return points;
};

// Check if two polygons are colliding
export const checkPolygonCollision = (poly1, poly2) => {
  for (let i = 0; i < poly1.length; i++) {
    if (pointInPolygon(poly1[i], poly2)) return true;
  }
  for (let i = 0; i < poly2.length; i++) {
    if (pointInPolygon(poly2[i], poly1)) return true;
  }
  return false;
};

// Check if a circle is colliding with a polygon
export const checkCirclePolygonCollision = (circle, polygon) => {
  if (pointInPolygon({ x: circle.x, y: circle.y }, polygon)) {
    return true;
  }
  for (let i = 0; i < polygon.length; i++) {
    const start = polygon[i];
    const end = polygon[(i + 1) % polygon.length];
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const lengthSq = dx * dx + dy * dy;
    const t = Math.max(0, Math.min(1, ((circle.x - start.x) * dx + (circle.y - start.y) * dy) / lengthSq));
    const closestX = start.x + t * dx;
    const closestY = start.y + t * dy;
    const distSq = (circle.x - closestX) ** 2 + (circle.y - closestY) ** 2;
    if (distSq < circle.radius ** 2) {
      return true;
    }
  }
  return false;
};

// Add CommonJS exports for server compatibility
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    checkPolygonCollision,
    checkCirclePolygonCollision,
    getShipPolygon,
    getAsteroidPolygon
  };
}