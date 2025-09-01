export default class Powerup {
  constructor(args) {
    this.position = args.position;
    this.velocity = {
      x: Math.random() * 2 - 1,
      y: Math.random() * 2 - 1,
    };
    this.type = args.type;
    this.radius = 15;
    this.delete = false;
    this.lifeTimer = 10 * 60; // Changed from 15 to 10 seconds at 60fps
    this.maxLife = 10 * 60; // Changed from 15 to 10 seconds
    this.flashDuration = 5 * 60; // Flash for last 5 seconds (unchanged)

    // Visual properties based on type
    const properties = {
      rapidFire: { letter: 'R', color: '#00FFFF' },
      invulnerability: { letter: 'I', color: '#FFFF00' },
      spreadShot: { letter: 'SS', color: '#FF00FF' },
      homingShot: { letter: 'H', color: '#00FF00' },
      speedUp: { letter: 'P', color: '#FFA500' },
      powerShot: { letter: 'PS', color: '#FF0000' },
      bouncingBullets: { letter: 'BB', color: '#00FFFF' },
    };
    this.visuals = properties[this.type];
  }

  getPolygon() {
    // A simple square polygon for collision
    return [
      { x: this.position.x - this.radius, y: this.position.y - this.radius },
      { x: this.position.x + this.radius, y: this.position.y - this.radius },
      { x: this.position.x + this.radius, y: this.position.y + this.radius },
      { x: this.position.x - this.radius, y: this.position.y + this.radius },
    ];
  }

  destroy() {
    this.delete = true;
  }

  update(worldWidth, worldHeight) {
    this.position.x += this.velocity.x;
    this.position.y += this.velocity.y;

    // World bounds collision (bounce)
    if (this.position.x < this.radius || this.position.x > worldWidth - this.radius) {
      this.velocity.x *= -1;
    }
    if (this.position.y < this.radius || this.position.y > worldHeight - this.radius) {
      this.velocity.y *= -1;
    }

    // Update life timer
    this.lifeTimer--;
    if (this.lifeTimer <= 0) {
      this.destroy();
    }
  }

  draw(context) {
    context.save();
    context.translate(this.position.x, this.position.y);

    // Calculate if we should flash and how fast
    let shouldDraw = true;
    if (this.lifeTimer <= this.flashDuration) {
      // Calculate flash rate - increases as time runs out
      const timeLeft = this.lifeTimer;
      const flashProgress = 1 - (timeLeft / this.flashDuration); // 0 to 1 as time runs out
      
      // Flash rate increases from 0.1 (slow) to 0.8 (very fast)
      const flashRate = 0.1 + (flashProgress * 0.7);
      
      // Use sine wave for smooth flashing, frequency increases over time
      const flashFrequency = 0.1 + (flashProgress * 0.4); // Frequency increases
      shouldDraw = Math.sin(this.lifeTimer * flashFrequency) > (0.5 - flashRate);
    }

    if (shouldDraw) {
      context.strokeStyle = this.visuals.color;
      context.lineWidth = 2;
      context.strokeRect(-this.radius, -this.radius, this.radius * 2, this.radius * 2);

      context.fillStyle = this.visuals.color;
      context.font = 'bold 16px Arial';
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.fillText(this.visuals.letter, 0, 0);
    }

    context.restore();
  }
}