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

    // Visual properties based on type
    const properties = {
      rapidFire: { letter: 'R', color: '#00FFFF' },
      invulnerability: { letter: 'I', color: '#FFFF00' },
      spreadShot: { letter: 'SS', color: '#FF00FF' },
      homingShot: { letter: 'H', color: '#00FF00' },
      speedUp: { letter: 'P', color: '#FFA500' },
      powerShot: { letter: 'PS', color: '#FF0000' },
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
  }

  draw(context) {
    context.save();
    context.translate(this.position.x, this.position.y);
    context.strokeStyle = this.visuals.color;
    context.lineWidth = 2;
    context.strokeRect(-this.radius, -this.radius, this.radius * 2, this.radius * 2);

    context.fillStyle = this.visuals.color;
    context.font = 'bold 16px Arial'; // Slightly smaller font to fit "SS" and "PS"
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(this.visuals.letter, 0, 0);
    context.restore();
  }
}