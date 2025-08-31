import React from 'react';

export default class Bullet {
  constructor(args) {
    this.position = args.position;
    this.owner = args.owner || 'player'; // 'player' or 'ufo'

    if (args.velocity) {
      this.velocity = args.velocity;
    } else {
      const speed = 5;
      this.velocity = {
        x: -Math.sin(-args.rotation * Math.PI / 180) * speed,
        y: -Math.cos(-args.rotation * Math.PI / 180) * speed
      };
    }
    this.radius = 2;
    this.delete = false; // Flag for removal
  }

  update(width, height) {
    this.position.x += this.velocity.x;
    this.position.y += this.velocity.y;

    // Check if bullet is off-screen
    if (this.position.x < 0 || this.position.x > width || this.position.y < 0 || this.position.y > height) {
      this.delete = true;
    }
  }

  draw(context) {
    context.save();
    context.translate(this.position.x, this.position.y);
    context.fillStyle = '#ffffff';
    context.beginPath();
    context.arc(0, 0, this.radius, 0, 2 * Math.PI);
    context.fill();
    context.restore();
  }
}