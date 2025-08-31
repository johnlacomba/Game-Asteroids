import React from 'react';

export default class Asteroid {
  constructor(args) {
    this.position = args.position;
    this.velocity = {
      x: Math.random() * 2 - 1,
      y: Math.random() * 2 - 1,
    };
    this.rotation = 0;
    this.rotationSpeed = Math.random() * 0.5 - 0.25;
    this.radius = args.size || 50;
    this.hitPoints = Math.floor(this.radius / 12) + 1; // ~5 hits for default size
    this.delete = false;

    // Generate a misshapen polygon shape
    this.shape = [];
    const sides = Math.floor(Math.random() * 5) + 7; // 7 to 11 sides
    for (let i = 0; i < sides; i++) {
      const angle = (i / sides) * 2 * Math.PI;
      const distance = this.radius * (0.8 + Math.random() * 0.4);
      this.shape.push({
        x: Math.cos(angle) * distance,
        y: Math.sin(angle) * distance,
      });
    }
  }

  getPolygon() {
    const angle = this.rotation * Math.PI / 180;
    return this.shape.map(point => {
      const rotatedX = point.x * Math.cos(angle) - point.y * Math.sin(angle);
      const rotatedY = point.x * Math.sin(angle) + point.y * Math.cos(angle);
      return {
        x: rotatedX + this.position.x,
        y: rotatedY + this.position.y,
      };
    });
  }

  hit() {
    this.hitPoints--;
    if (this.hitPoints <= 0) {
      this.destroy();
    }
  }

  destroy() {
    this.delete = true;
  }

  update(worldWidth, worldHeight) {
    this.position.x += this.velocity.x;
    this.position.y += this.velocity.y;
    this.rotation += this.rotationSpeed;

    // World bounds collision (bounce)
    if (this.position.x < this.radius) {
      this.position.x = this.radius;
      this.velocity.x *= -1;
    } else if (this.position.x > worldWidth - this.radius) {
      this.position.x = worldWidth - this.radius;
      this.velocity.x *= -1;
    }
    if (this.position.y < this.radius) {
      this.position.y = this.radius;
      this.velocity.y *= -1;
    } else if (this.position.y > worldHeight - this.radius) {
      this.position.y = worldHeight - this.radius;
      this.velocity.y *= -1;
    }
  }

  draw(context) {
    context.save();
    context.translate(this.position.x, this.position.y);
    context.rotate(this.rotation * Math.PI / 180);
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