export default class Debris {
  constructor(args) {
    this.position = args.position;
    this.velocity = {
      x: Math.random() * 3 - 1.5,
      y: Math.random() * 3 - 1.5,
    };
    this.shape = args.shape; // The line segment
    this.lifeSpan = 60; // 60 frames = ~1 second
    this.inertia = 0.98;
    this.delete = false;
  }

  update() {
    this.lifeSpan--;
    if (this.lifeSpan <= 0) {
      this.delete = true;
    }

    this.position.x += this.velocity.x;
    this.position.y += this.velocity.y;
    this.velocity.x *= this.inertia;
    this.velocity.y *= this.inertia;
  }

  draw(context) {
    context.save();
    context.translate(this.position.x, this.position.y);
    context.strokeStyle = `rgba(255, 255, 255, ${this.lifeSpan / 60})`;
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(this.shape[0].x, this.shape[0].y);
    context.lineTo(this.shape[1].x, this.shape[1].y);
    context.stroke();
    context.restore();
  }
}