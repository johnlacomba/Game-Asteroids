// Helper function to project a polygon onto an axis and return a min/max range.
const projectPolygon = (axis, polygon) => {
  let min = Infinity;
  let max = -Infinity;
  for (const p of polygon) {
    const dotProduct = p.x * axis.x + p.y * axis.y;
    min = Math.min(min, dotProduct);
    max = Math.max(max, dotProduct);
  }
  return { min, max };
};

// Helper function to check if two 1D ranges overlap.
const overlap = (p1, p2) => {
  return p1.max >= p2.min && p2.max >= p1.min;
};

// Main SAT collision detection function
export const checkPolygonCollision = (poly1, poly2) => {
  const getAxes = (polygon) => {
    const axes = [];
    for (let i = 0; i < polygon.length; i++) {
      const p1 = polygon[i];
      const p2 = polygon[i + 1 === polygon.length ? 0 : i + 1];
      const edge = { x: p1.x - p2.x, y: p1.y - p2.y };
      // Get the perpendicular vector (the normal)
      const normal = { x: -edge.y, y: edge.x };
      axes.push(normal);
    }
    return axes;
  };

  const axes1 = getAxes(poly1);
  const axes2 = getAxes(poly2);

  // Loop over all axes
  for (const axis of [...axes1, ...axes2]) {
    const p1 = projectPolygon(axis, poly1);
    const p2 = projectPolygon(axis, poly2);
    // If there is no overlap on any axis, there is no collision
    if (!overlap(p1, p2)) {
      return false;
    }
  }

  // If all axes have overlap, the polygons are colliding
  return true;
};

// Helper for point-in-polygon test using ray-casting
const pointInPolygon = (point, polygon) => {
  let isInside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x, yi = polygon[i].y;
    const xj = polygon[j].x, yj = polygon[j].y;

    const intersect = ((yi > point.y) !== (yj > point.y))
        && (point.x < (xj - xi) * (point.y - yi) / (yj - yi) + xi);
    if (intersect) {
      isInside = !isInside;
    }
  }
  return isInside;
};

// Circle-to-Polygon collision for bullets vs asteroids
export const checkCirclePolygonCollision = (circle, polygon) => {
  // 1. Check if the circle's center is inside the polygon.
  if (pointInPolygon(circle.position, polygon)) {
    return true;
  }

  // 2. If not, check if any edge of the polygon is close to the circle.
  for (let i = 0; i < polygon.length; i++) {
    const p1 = polygon[i];
    const p2 = polygon[i + 1 === polygon.length ? 0 : i + 1];

    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const lenSq = dx * dx + dy * dy;

    // Find the projection of the circle's center onto the line segment
    let t = ((circle.position.x - p1.x) * dx + (circle.position.y - p1.y) * dy) / lenSq;
    t = Math.max(0, Math.min(1, t)); // Clamp t to the segment [0, 1]

    const closestX = p1.x + t * dx;
    const closestY = p1.y + t * dy;

    // Check the distance from the closest point to the circle's center
    const distSq = (circle.position.x - closestX) ** 2 + (circle.position.y - closestY) ** 2;

    if (distSq < circle.radius * circle.radius) {
      return true; // Collision detected
    }
  }

  return false; // No collision
};