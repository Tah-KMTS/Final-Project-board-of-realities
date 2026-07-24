import Phaser from 'phaser'
import { playDiceSound, playDoorSound } from '../audio/sfx'

/**
 * VehicleActor - Phaser Actor representation for cars, trains, sports cars & express trains.
 * Renders procedural pixel-art vehicle graphics with headlights, shadows, path navigation,
 * and passenger boarding capabilities.
 */

export const VEHICLE_TYPES = {
  car: {
    width: 32,
    height: 18,
    speed: 120,
    color: 0x3b82f6, // Blue sedan
    roofColor: 0x1d4ed8,
    glassColor: 0x93c5fd,
    wheelColor: 0x1e293b,
    label: '🚗 City Sedan',
  },
  sports_car: {
    width: 36,
    height: 16,
    speed: 200,
    color: 0xef4444, // Red sports car
    roofColor: 0x991b1b,
    glassColor: 0xfca5a5,
    wheelColor: 0x09090b,
    label: '🏎️ Syndicate Roadster',
  },
  train: {
    width: 96,
    height: 24,
    speed: 150,
    color: 0x4a6fa5, // Express Train Locomotive
    roofColor: 0x2d4368,
    glassColor: 0xfef08a, // Glowing train windows
    wheelColor: 0x111827,
    label: '🚆 Metro Express',
  },
  express_train: {
    width: 128,
    height: 26,
    speed: 240,
    color: 0x8b5cf6, // High-speed Bullet Train
    roofColor: 0x5b21b6,
    glassColor: 0xe9d5ff,
    wheelColor: 0x0f172a,
    label: '🚄 High-Speed Shinkansen',
  },
  bicycle: {
    width: 20,
    height: 12,
    speed: 80,
    color: 0x10b981, // Emerald E-bike
    roofColor: 0x047857,
    glassColor: 0x6ee7b7,
    wheelColor: 0x334155,
    label: '🚲 E-Bicycle',
  },
}

export class VehicleActor {
  /**
   * @param {Phaser.Scene} scene
   * @param {number} x
   * @param {number} y
   * @param {string} type Key from VEHICLE_TYPES
   * @param {Object} options
   */
  constructor(scene, x, y, type = 'car', options = {}) {
    this.scene = scene
    this.type = VEHICLE_TYPES[type] ? type : 'car'
    this.config = VEHICLE_TYPES[this.type]
    
    this.speed = options.speed || this.config.speed
    this.direction = options.direction || 'right' // 'right' | 'left' | 'up' | 'down'
    this.color = options.color || this.config.color
    this.label = options.label || this.config.label
    
    this.minBounds = options.minBounds || { x: -100, y: -100 }
    this.maxBounds = options.maxBounds || { x: 1800, y: 1900 }
    this.passenger = null
    this.active = true

    // Create container at (x, y)
    this.container = scene.add.container(x, y)
    
    // Shadow under vehicle
    const shadowW = this.config.width + 4
    const shadowH = this.config.height / 2 + 2
    this.shadow = scene.add.ellipse(x, y + this.config.height / 4 + 4, shadowW, shadowH, 0x000000, 0.4)
    
    // Main vehicle graphics
    this.graphics = scene.add.graphics()
    this.container.add(this.graphics)
    
    // Direction indicator / headlights
    this.headlights = scene.add.graphics()
    this.container.add(this.headlights)

    // Optional text label above vehicle
    if (options.showLabel !== false) {
      this.labelObject = scene.add
        .text(0, -this.config.height / 2 - 12, this.label, {
          fontFamily: 'monospace',
          fontSize: '9px',
          color: '#ffffff',
          backgroundColor: 'rgba(0,0,0,0.6)',
          padding: { x: 3, y: 1 },
        })
        .setOrigin(0.5, 1)
      this.container.add(this.labelObject)
    }

    // Add physics body if scene supports physics
    if (scene.physics?.add) {
      scene.physics.add.existing(this.container)
      if (this.container.body) {
        this.container.body.setSize(this.config.width, this.config.height)
        this.container.body.setCollideWorldBounds(false)
      }
    }

    this.renderVehicle()
    this.updateFacing(this.direction)
  }

  get x() {
    return this.container.x
  }

  get y() {
    return this.container.y
  }

  renderVehicle() {
    this.graphics.clear()
    this.headlights.clear()
    const { width: w, height: h, color, roofColor, glassColor, wheelColor } = this.config

    // Draw chassis / body centered
    const hw = w / 2
    const hh = h / 2

    // Main body
    this.graphics.fillStyle(color, 1)
    this.graphics.fillRoundedRect(-hw, -hh, w, h, 4)

    // Roof / Cabin
    const cabinW = w * 0.55
    const cabinH = h * 0.7
    this.graphics.fillStyle(roofColor, 1)
    this.graphics.fillRoundedRect(-cabinW / 2, -cabinH / 2, cabinW, cabinH, 2)

    // Glass / Windshield
    this.graphics.fillStyle(glassColor, 0.95)
    this.graphics.fillRect(-cabinW * 0.35, -cabinH * 0.35, cabinW * 0.7, cabinH * 0.7)

    // Wheels (4 corners for cars/trains)
    this.graphics.fillStyle(wheelColor, 1)
    const wheelW = Math.max(4, w * 0.15)
    const wheelH = Math.max(3, h * 0.25)
    this.graphics.fillRect(-hw + 2, -hh - 1, wheelW, wheelH)
    this.graphics.fillRect(hw - wheelW - 2, -hh - 1, wheelW, wheelH)
    this.graphics.fillRect(-hw + 2, hh - wheelH + 1, wheelW, wheelH)
    this.graphics.fillRect(hw - wheelW - 2, hh - wheelH + 1, wheelW, wheelH)

    // Headlights (glowing cones / spots)
    this.headlights.fillStyle(0xfff59d, 0.85) // Yellow headlight glow
    if (this.direction === 'right') {
      this.headlights.fillRect(hw, -hh + 2, 8, 3)
      this.headlights.fillRect(hw, hh - 5, 8, 3)
    } else if (this.direction === 'left') {
      this.headlights.fillRect(-hw - 8, -hh + 2, 8, 3)
      this.headlights.fillRect(-hw - 8, hh - 5, 8, 3)
    } else if (this.direction === 'down') {
      this.headlights.fillRect(-hw + 2, hh, 3, 8)
      this.headlights.fillRect(hw - 5, hh, 3, 8)
    } else if (this.direction === 'up') {
      this.headlights.fillRect(-hw + 2, -hh - 8, 3, 8)
      this.headlights.fillRect(hw - 5, -hh - 8, 3, 8)
    }
  }

  setDirection(dir) {
    if (this.direction !== dir) {
      this.direction = dir
      this.updateFacing(dir)
      this.renderVehicle()
    }
  }

  updateFacing(dir) {
    const angleMap = { right: 0, down: 90, left: 180, up: -90 }
    const targetAngle = angleMap[dir] || 0
    this.container.setAngle(targetAngle)
    if (this.labelObject) {
      // Counter-rotate text so label stays horizontal & readable
      this.labelObject.setAngle(-targetAngle)
    }
  }

  setSpeed(speed) {
    this.speed = speed
  }

  boardPassenger(actor) {
    this.passenger = actor
    if (actor?.sprite) {
      actor.sprite.setVisible(false)
    }
    playDoorSound()
  }

  disembarkPassenger() {
    if (this.passenger) {
      if (this.passenger.sprite) {
        this.passenger.sprite.setVisible(true)
        this.passenger.sprite.setPosition(this.x + 20, this.y)
      }
      this.passenger = null
      playDoorSound()
    }
  }

  honkHorn() {
    playDiceSound()
  }

  update(delta) {
    if (!this.active) return

    const dt = delta / 1000
    let vx = 0
    let vy = 0

    switch (this.direction) {
      case 'right': vx = this.speed; break
      case 'left':  vx = -this.speed; break
      case 'down':  vy = this.speed; break
      case 'up':    vy = -this.speed; break
    }

    const nx = this.container.x + vx * dt
    const ny = this.container.y + vy * dt

    this.container.setPosition(nx, ny)
    this.shadow.setPosition(nx, ny + this.config.height / 4 + 4)

    // Depth sorting based on Y position
    this.container.setDepth(ny)
    this.shadow.setDepth(ny - 1)

    // Update passenger position if inside vehicle
    if (this.passenger && this.passenger.sprite) {
      this.passenger.sprite.setPosition(nx, ny)
    }

    // Wrap around boundaries
    if (this.container.x > this.maxBounds.x) {
      this.container.x = this.minBounds.x
    } else if (this.container.x < this.minBounds.x) {
      this.container.x = this.maxBounds.x
    }

    if (this.container.y > this.maxBounds.y) {
      this.container.y = this.minBounds.y
    } else if (this.container.y < this.minBounds.y) {
      this.container.y = this.maxBounds.y
    }
  }

  destroy() {
    this.active = false
    if (this.passenger) this.disembarkPassenger()
    this.container.destroy()
    this.shadow.destroy()
  }
}
