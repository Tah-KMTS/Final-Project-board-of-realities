import { getActorRenderInfo } from './spriteGen'

// Wraps either the shared Cute Fantasy sheet or a per-actor procedural
// canvas texture (decided by spriteGen.js's getActorRenderInfo, matching
// whichever rendering mode tileGen.js is also using) with simple 2-frame
// walk-cycle animation, driven by manual frame swaps.
export class SpriteActor {
  constructor(scene, x, y, textureKey, palette) {
    const info = getActorRenderInfo(scene, textureKey, palette)
    this.scene = scene
    this.info = info
    this.shadowOffsetY = (info.frameH * info.scale) / 2 - 8
    // Created before the sprite so it renders underneath (same-depth
    // objects draw in insertion order in Phaser).
    this.shadow = scene.add.ellipse(x, y + this.shadowOffsetY, 16, 7, 0x000000, 0.35)
    this.sprite = scene.add.sprite(x, y, info.textureKey, info.frameName('down', 0))
    this.sprite.setScale(info.scale)
    if (info.tint != null) this.sprite.setTint(info.tint)
    this.facing = 'down'
    this.stepFrame = 0
    this.animTimer = 0
    this.moving = false
    this.sprite.setDepth(this.sprite.y)
    this.shadow.setDepth(this.sprite.y - 1)

    // Always create physics body — required for smooth pixel movement.
    scene.physics.add.existing(this.sprite)
    const bodyW = 18
    const bodyH = 16
    this.sprite.body.setSize(bodyW / info.scale, bodyH / info.scale)
    this.sprite.body.setOffset(
      (info.frameW - bodyW / info.scale) / 2,
      info.frameH - bodyH / info.scale - 6
    )
    this.sprite.body.setCollideWorldBounds(true)
  }

  get x() { return this.sprite.x }
  get y() { return this.sprite.y }

  applyFrame() {
    this.sprite.setFrame(this.info.frameName(this.facing, this.stepFrame))
    this.sprite.setFlipX(this.info.flipX(this.facing))
  }

  setFacing(dir) {
    if (dir && dir !== this.facing) {
      this.facing = dir
      this.applyFrame()
    }
  }

  setMoving(isMoving) {
    this.moving = isMoving
    if (!isMoving) {
      this.stepFrame = 0
      this.animTimer = 0
      this.applyFrame()
    }
  }

  update(delta) {
    this.shadow.setPosition(this.sprite.x, this.sprite.y + this.shadowOffsetY)
    this.sprite.setDepth(this.sprite.y)
    this.shadow.setDepth(this.sprite.y - 1)

    if (!this.moving) return
    this.animTimer += delta
    if (this.animTimer > 150) {
      this.animTimer = 0
      this.stepFrame = this.stepFrame === 0 ? 1 : 0
      this.applyFrame()
    }
  }

  destroy() {
    this.sprite.destroy()
    this.shadow.destroy()
  }
}
