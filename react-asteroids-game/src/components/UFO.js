import Bullet from './Bullet';

export default class UFO {
  constructor(args) {
    this.position = args.position;
    this.velocity = args.velocity;
    this.radius = 25;
    this.delete = false;

    // For the winding path
    this.pathPhase = Math.random() * 2 * Math.PI; // Random start in the sine wave
    this.pathAmplitude = Math.random() * 3 + 2;   // How much it winds
    this.pathFrequency = 0.05;                    // How fast it winds

    this.shootTimer = 0;
    this.shootCooldown = 120; // Shoots every 2 seconds (120 frames)

    // UFO shape (dome + saucer)
    this.shape = [
      { x: -this.radius, y: 0 },
      { x: -this.radius / 2, y: -this.radius / 3 },
      { x: this.radius / 2, y: -this.radius / 3 },
      { x: this.radius, y: 0 },
      { x: this.radius * 0.7, y: this.radius / 2 },
      { x: -this.radius * 0.7, y: this.radius / 2 },
    ];
  }

  getPolygon() {
    // No rotation for the UFO, just translation
    return this.shape.map(point => ({
      x: point.x + this.position.x,
      y: point.y + this.position.y,
    }));
  }

  destroy() {
    this.delete = true;
  }

  shoot(playerPosition) {
    const dx = playerPosition.x - this.position.x;
    const dy = playerPosition.y - this.position.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const speed = 4;

    const velocity = {
      x: (dx / distance) * speed,
      y: (dy / distance) * speed,
    };

    return new Bullet({
      position: { ...this.position },
      velocity: velocity,
      owner: 'ufo',
    });
  }

  update(width, height, playerPosition) {
    const bullets = [];
    this.shootTimer++;
    if (this.shootTimer >= this.shootCooldown) {
      bullets.push(this.shoot(playerPosition));
      this.shootTimer = 0;
    }

    // Calculate the perpendicular vector to the velocity for the sine wave
    const perpendicular = { x: -this.velocity.y, y: this.velocity.x };
    const perpendicularMag = Math.sqrt(perpendicular.x * perpendicular.x + perpendicular.y * perpendicular.y);
    const normalizedPerpendicular = {
      x: perpendicular.x / perpendicularMag,
      y: perpendicular.y / perpendicularMag,
    };

    // Calculate the winding offset
    const offset = Math.sin(this.pathPhase) * this.pathAmplitude;
    this.pathPhase += this.pathFrequency;

    // Update position with base velocity and winding offset
    this.position.x += this.velocity.x + normalizedPerpendicular.x * offset;
    this.position.y += this.velocity.y + normalizedPerpendicular.y * offset;

    // Check if UFO is way off-screen to be deleted
    const margin = this.radius * 2;
    if (
      this.position.x < -margin ||
      this.position.x > width + margin ||
      this.position.y < -margin ||
      this.position.y > height + margin
    ) {
      this.delete = true;
    }
    return bullets;
  }

  draw(context) {
    context.save();
    context.translate(this.position.x, this.position.y);
    context.strokeStyle = '#ffffff';
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(this.shape[0].x, this.shape[0].y);
    for (let i = 1; i < this.shape.length; i++) {
      context.lineTo(this.shape[i].x, this.shape[i].y);
    }
    context.closePath();
    context.stroke();
    context.restore();
  }
}