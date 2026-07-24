import { ensurePlayerTexture, FRAME_W, FRAME_H } from './spriteGen'

// Wraps a generated pixel-art spritesheet with simple 2-frame walk-cycle
// animation, driven by manual frame swaps (no Animation Manager needed
// since frames are just named regions on one canvas texture). Every actor
// (player + every NPC) gets its own generated texture (keyed per-palette),
// unlike a shared external spritesheet.
export class SpriteActor {
  constructor(scene, x, y, textureKey, palette) {
    ensurePlayerTexture(scene, textureKey, palette)
    this.scene = scene
    this.shadowOffsetY = FRAME_H / 2 - 6
    // Created before the sprite so it renders underneath (same-depth
    // objects draw in insertion order in Phaser).
    this.shadow = scene.add.ellipse(x, y + this.shadowOffsetY, 14, 6, 0x000000, 0.35)
    this.sprite = scene.add.sprite(x, y, textureKey, 'down_0')
    this.facing = 'down'
    this.stepFrame = 0
    this.animTimer = 0
    this.moving = false
    this.sprite.setDepth(this.sprite.y)
    this.shadow.setDepth(this.sprite.y - 1)

    // Always create a physics body — required for SmoothMover's pixel
    // movement (unrelated to sprite rendering; kept exactly as-is).
    scene.physics.add.existing(this.sprite)
    const bodyW = 18
    const bodyH = 16
    this.sprite.body.setSize(bodyW, bodyH)
    this.sprite.body.setOffset((FRAME_W - bodyW) / 2, FRAME_H - bodyH - 6)
    this.sprite.body.setCollideWorldBounds(true)
  }

  get x() { return this.sprite.x }
  get y() { return this.sprite.y }

  setFacing(dir) {
    if (dir && dir !== this.facing) {
      this.facing = dir
      this.sprite.setFrame(`${this.facing}_${this.stepFrame}`)
    }
  }

  setMoving(isMoving) {
    this.moving = isMoving
    if (!isMoving) {
      this.stepFrame = 0
      this.animTimer = 0
      this.sprite.setFrame(`${this.facing}_0`)
    }
  }

  update(delta) {
    this.shadow.setPosition(this.sprite.x, this.sprite.y + this.shadowOffsetY)
    this.sprite.setDepth(this.sprite.y)
    this.shadow.setDepth(this.sprite.y - 1)

    if (!this.moving) return
    this.animTimer += delta
    if (this.animTimer > 180) {
      this.animTimer = 0
      this.stepFrame = this.stepFrame === 0 ? 1 : 0
      this.sprite.setFrame(`${this.facing}_${this.stepFrame}`)
    }
  }

  destroy() {
    this.sprite.destroy()
    this.shadow.destroy()
  }
}
