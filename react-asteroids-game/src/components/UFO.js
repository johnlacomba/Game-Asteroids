import Bullet from './Bullet';

export default class UFO {
  constructor(args) {
    this.position = args.position;
    this.velocity = args.velocity;
    this.radius = 15;
    this.delete = false;
    this.shootCooldown = 0;
    this.SHOOT_INTERVAL = 120; // Shoot every 2 seconds at 60fps
  }

  getPolygon() {
    return [
      { x: this.position.x - this.radius, y: this.position.y - this.radius/2 },
      { x: this.position.x + this.radius, y: this.position.y - this.radius/2 },
      { x: this.position.x + this.radius/2, y: this.position.y + this.radius/2 },
      { x: this.position.x - this.radius/2, y: this.position.y + this.radius/2 },
    ];
  }

  destroy() {
    this.delete = true;
  }

  update(worldWidth, worldHeight, playerPosition) {
    // UFOs pass through world boundaries (don't bounce)
    this.position.x += this.velocity.x;
    this.position.y += this.velocity.y;

    // Mark for deletion if far outside world boundaries
    const buffer = 200;
    if (this.position.x < -buffer || this.position.x > worldWidth + buffer ||
        this.position.y < -buffer || this.position.y > worldHeight + buffer) {
      this.delete = true;
    }

    const bullets = [];

    // Shooting logic
    if (this.shootCooldown > 0) {
      this.shootCooldown--;
    }

    if (this.shootCooldown <= 0 && playerPosition) {
      // Calculate angle to player
      const dx = playerPosition.x - this.position.x;
      const dy = playerPosition.y - this.position.y;
      const angle = Math.atan2(dy, dx) * 180 / Math.PI;

      // Create bullet aimed at player
      const bullet = new Bullet({
        position: { x: this.position.x, y: this.position.y },
        rotation: angle + 90, // Add 90 degrees to match bullet's coordinate system
        owner: 'ufo'
      });

      bullets.push(bullet);
      this.shootCooldown = this.SHOOT_INTERVAL;
    }

    return bullets;
  }

  draw(context) {
    context.save();
    context.translate(this.position.x, this.position.y);
    
    // Draw UFO body (oval)
    context.strokeStyle = 'white';
    context.lineWidth = 2;
    context.beginPath();
    context.ellipse(0, 0, this.radius, this.radius * 0.6, 0, 0, 2 * Math.PI);
    context.stroke();
    
    // Draw UFO dome (top half circle)
    context.beginPath();
    context.arc(0, -this.radius * 0.2, this.radius * 0.6, Math.PI, 0, false);
    context.stroke();

    context.restore();
  }
}