import React from 'react';

export default class Bullet {
  constructor(args) {
    this.position = args.position;
    this.owner = args.owner || 'player';
    this.homing = args.homing || false;
    this.powerShot = args.powerShot || false;
    this.bouncing = args.bouncing || false;

    // Corrected velocity calculation.
    const speed = 5;
    const angle = args.rotation * Math.PI / 180; // Convert to radians
    this.velocity = {
      x: Math.sin(angle) * speed,
      y: -Math.cos(angle) * speed
    };
    
    this.radius = this.powerShot ? 4 : 2; // Double size for power shot
    this.damage = this.powerShot ? 2 : 1; // Double damage for power shot
    this.delete = false; // Flag for removal
    this.bounceCount = 0; // Track number of bounces
    this.maxBounces = 5; // Limit bounces to prevent infinite bullets
  }

  update(width, height, targets = []) {
    // Only player bullets can home
    if (this.homing && this.owner === 'player' && targets.length > 0) {
      let nearestTarget = null;
      let minDistance = Infinity;

      for (const target of targets) {
        const dx = target.position.x - this.position.x;
        const dy = target.position.y - this.position.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance < minDistance) {
          minDistance = distance;
          nearestTarget = target;
        }
      }

      if (nearestTarget) {
        // --- Gradual Homing Logic ---
        const speed = 5;
        const homingStrength = 0.08; // How strongly it homes (0.0 to 1.0)

        // 1. Calculate the desired direction to the target
        const dx = nearestTarget.position.x - this.position.x;
        const dy = nearestTarget.position.y - this.position.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance > 0) {
          // 2. Calculate the desired velocity (pointing directly at target)
          const desiredVelocity = {
            x: (dx / distance) * speed,
            y: (dy / distance) * speed
          };

          // 3. Gradually steer the current velocity toward the desired velocity
          this.velocity.x += (desiredVelocity.x - this.velocity.x) * homingStrength;
          this.velocity.y += (desiredVelocity.y - this.velocity.y) * homingStrength;

          // 4. Maintain constant speed (normalize the velocity)
          const currentSpeed = Math.sqrt(this.velocity.x * this.velocity.x + this.velocity.y * this.velocity.y);
          if (currentSpeed > 0) {
            this.velocity.x = (this.velocity.x / currentSpeed) * speed;
            this.velocity.y = (this.velocity.y / currentSpeed) * speed;
          }
        }
      }
    }

    this.position.x += this.velocity.x;
    this.position.y += this.velocity.y;

    // Check if bullet hits world boundaries
    if (this.bouncing && this.owner === 'player' && this.bounceCount < this.maxBounces) {
      let bounced = false;
      
      // Check horizontal boundaries
      if (this.position.x <= 0 || this.position.x >= width) {
        this.velocity.x *= -1;
        this.position.x = Math.max(0, Math.min(width, this.position.x));
        bounced = true;
      }
      
      // Check vertical boundaries
      if (this.position.y <= 0 || this.position.y >= height) {
        this.velocity.y *= -1;
        this.position.y = Math.max(0, Math.min(height, this.position.y));
        bounced = true;
      }
      
      if (bounced) {
        this.bounceCount++;
      }
    } else {
      // Normal bullet behavior - delete when off-screen
      if (
        this.position.x < 0 ||
        this.position.x > width ||
        this.position.y < 0 ||
        this.position.y > height
      ) {
        this.delete = true;
      }
    }

    // Delete bouncing bullets after max bounces
    if (this.bouncing && this.bounceCount >= this.maxBounces) {
      this.delete = true;
    }
  }

  draw(context) {
    context.save();
    context.translate(this.position.x, this.position.y);
    
    // Different colors for different bullet types
    if (this.owner === 'ufo') {
      context.fillStyle = '#FF4444'; // Red for UFO bullets
    } else if (this.bouncing) {
      context.fillStyle = '#00FFFF'; // Cyan for bouncing bullets
    } else {
      context.fillStyle = '#FFFFFF'; // White for normal player bullets
    }
    
    context.beginPath();
    context.arc(0, 0, this.radius, 0, 2 * Math.PI);
    context.fill();
    context.restore();
  }
}