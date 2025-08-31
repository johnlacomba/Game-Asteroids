import React, { useEffect, useRef } from 'react';
import { useGameLoop } from '../hooks/useGameLoop';
import { handleInput } from '../core/inputController';
import Bullet from './Bullet';
import Debris from './Debris';

export default class Player {
  constructor(args) {
    this.position = args.position;
    this.velocity = { x: 0, y: 0 };
    this.rotation = 0;
    this.rotationSpeed = 6;
    this.speed = 0.15;
    this.inertia = 0.99;
    this.radius = 16; // Was 20
    this.shape = [
      { x: 0, y: -this.radius },
      { x: this.radius / 2, y: this.radius / 2 },
      { x: -this.radius / 2, y: this.radius / 2 },
    ];
    this.delete = false;
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

  destroy() {
    this.delete = true;
    const debris = [];
    // Create debris from the ship's lines
    debris.push(new Debris({ position: { ...this.position }, shape: [this.shape[0], this.shape[1]] }));
    debris.push(new Debris({ position: { ...this.position }, shape: [this.shape[1], this.shape[2]] }));
    debris.push(new Debris({ position: { ...this.position }, shape: [this.shape[2], this.shape[0]] }));
    return debris;
  }

  shoot(activePowerups) {
    const bullets = [];
    const isHoming = activePowerups.has('homingShot');
    const isPowerShot = activePowerups.has('powerShot');

    const createBullet = (rotationAngle) => {
      // Each bullet needs a DEEP COPY of the position object.
      // By creating the position object inside this function, we guarantee
      // each bullet gets a unique object in memory.
      const bulletInfo = {
        position: {
          x: this.position.x + Math.sin(this.rotation * Math.PI / 180) * this.radius,
          y: this.position.y - Math.cos(this.rotation * Math.PI / 180) * this.radius,
        },
        homing: isHoming,
        powerShot: isPowerShot,
        rotation: rotationAngle,
      };
      return new Bullet(bulletInfo);
    };

    // Main bullet (forward)
    bullets.push(createBullet(this.rotation));

    // Spread shot
    if (activePowerups.has('spreadShot')) {
      bullets.push(createBullet(this.rotation - 45));
      bullets.push(createBullet(this.rotation + 45));
    }

    return bullets;
  }

  rotate(dir) {
    if (dir === 'LEFT') {
      this.rotation -= this.rotationSpeed;
    }
    if (dir === 'RIGHT') {
      this.rotation += this.rotationSpeed;
    }
  }

  accelerate() {
    this.velocity.x -= Math.sin(-this.rotation * Math.PI / 180) * this.speed;
    this.velocity.y -= Math.cos(-this.rotation * Math.PI / 180) * this.speed;
  }

  decelerate() {
    this.velocity.x += Math.sin(-this.rotation * Math.PI / 180) * (this.speed / 2);
    this.velocity.y += Math.cos(-this.rotation * Math.PI / 180) * (this.speed / 2);
  }

  update(keys, worldWidth, worldHeight, activePowerups) {
    const speedUpPowerup = activePowerups.get('speedUp');
    const speedMultiplier = speedUpPowerup ? 2 ** speedUpPowerup.stack : 1;
    const currentSpeed = this.speed * speedMultiplier;

    if (keys.a) {
      this.rotate('LEFT');
    }
    if (keys.d) {
      this.rotate('RIGHT');
    }
    if (keys.w) {
      this.velocity.x -= Math.sin(-this.rotation * Math.PI / 180) * currentSpeed;
      this.velocity.y -= Math.cos(-this.rotation * Math.PI / 180) * currentSpeed;
    }
    if (keys.s) {
      this.velocity.x += Math.sin(-this.rotation * Math.PI / 180) * (currentSpeed / 2);
      this.velocity.y += Math.cos(-this.rotation * Math.PI / 180) * (currentSpeed / 2);
    }

    // Apply inertia
    this.velocity.x *= this.inertia;
    this.velocity.y *= this.inertia;

    // Enforce maximum speed cap
    const maxSpeed = 16;
    const currentVelocityMagnitude = Math.sqrt(this.velocity.x * this.velocity.x + this.velocity.y * this.velocity.y);
    if (currentVelocityMagnitude > maxSpeed) {
      this.velocity.x = (this.velocity.x / currentVelocityMagnitude) * maxSpeed;
      this.velocity.y = (this.velocity.y / currentVelocityMagnitude) * maxSpeed;
    }

    // Update position
    this.position.x += this.velocity.x;
    this.position.y += this.velocity.y;

    // World bounds collision using polygon vertices
    const polygon = this.getPolygon();
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;

    for (const point of polygon) {
      minX = Math.min(minX, point.x);
      maxX = Math.max(maxX, point.x);
      minY = Math.min(minY, point.y);
      maxY = Math.max(maxY, point.y);
    }

    if (minX < 0) {
      this.position.x += -minX;
      this.velocity.x *= -0.75;
    } else if (maxX > worldWidth) {
      this.position.x -= (maxX - worldWidth);
      this.velocity.x *= -0.75;
    }

    if (minY < 0) {
      this.position.y += -minY;
      this.velocity.y *= -0.75;
    } else if (maxY > worldHeight) {
      this.position.y -= (maxY - worldHeight);
      this.velocity.y *= -0.75;
    }
  }

  draw(context) {
    context.save();
    context.translate(this.position.x, this.position.y);
    context.rotate(this.rotation * Math.PI / 180);
    context.strokeStyle = '#ffffff';
    context.fillStyle = '#000000';
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(0, -this.radius);
    context.lineTo(this.radius / 2, this.radius / 2);
    context.lineTo(-this.radius / 2, this.radius / 2);
    context.closePath();
    context.fill();
    context.stroke();
    context.restore();
  }
}