import { ensurePlayerTexture, FRAME_W, FRAME_H } from './spriteGen'

// Wraps a generated pixel-art spritesheet with simple 2-frame walk-cycle
// animation, driven by manual frame swaps (no Animation Manager needed
// since frames are just named regions on one canvas texture).
export class SpriteActor {
  constructor(scene, x, y, textureKey, palette, { withPhysics = false } = {}) {
    ensurePlayerTexture(scene, textureKey, palette)
    this.scene = scene
    this.sprite = scene.add.sprite(x, y, textureKey, 'down_0')
    this.facing = 'down'
    this.stepFrame = 0
    this.animTimer = 0
    this.moving = false

    if (withPhysics) {
      scene.physics.add.existing(this.sprite)
      const bodyW = 18
      const bodyH = 16
      this.sprite.body.setSize(bodyW, bodyH)
      this.sprite.body.setOffset((FRAME_W - bodyW) / 2, FRAME_H - bodyH - 6)
      this.sprite.body.setCollideWorldBounds(true)
    }
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
  }
}
