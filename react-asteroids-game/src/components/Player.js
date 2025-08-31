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

  shoot() {
    const bulletPosition = {
      x: this.position.x - Math.sin(-this.rotation * Math.PI / 180) * this.radius,
      y: this.position.y - Math.cos(-this.rotation * Math.PI / 180) * this.radius,
    };
    return new Bullet({ position: bulletPosition, rotation: this.rotation });
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

  update(keys, width, height) {
    if (keys.a) {
      this.rotate('LEFT');
    }
    if (keys.d) {
      this.rotate('RIGHT');
    }
    if (keys.w) {
      this.accelerate();
    }
    if (keys.s) {
      this.decelerate();
    }

    // Apply inertia
    this.velocity.x *= this.inertia;
    this.velocity.y *= this.inertia;

    // Update position
    this.position.x += this.velocity.x;
    this.position.y += this.velocity.y;

    // Screen wrap
    if (this.position.x > width + this.radius) {
      this.position.x = -this.radius;
    } else if (this.position.x < -this.radius) {
      this.position.x = width + this.radius;
    }
    if (this.position.y > height + this.radius) {
      this.position.y = -this.radius;
    } else if (this.position.y < -this.radius) {
      this.position.y = height + this.radius;
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