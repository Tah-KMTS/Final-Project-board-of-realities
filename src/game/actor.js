import { PLAYER_SHEET_KEY, ensurePlayerFrames, tintFromPalette, FRAME_W, FRAME_H, PLAYER_DISPLAY_SCALE } from './spriteGen'

// Wraps the shared Cute Fantasy player spritesheet with simple 2-frame
// walk-cycle animation, driven by manual frame swaps (named regions on one
// shared texture - see spriteGen.js). Every actor (player + every NPC)
// points at the same texture; palette-based differentiation is a per-sprite
// tint instead of a per-actor generated canvas.
//
// The sheet has no dedicated right-facing row, so "right" reuses the
// left-facing frames mirrored via sprite.flipX - the only direction that
// needs this trick.
export class SpriteActor {
  constructor(scene, x, y, textureKey, palette) {
    ensurePlayerFrames(scene)
    this.scene = scene
    this.shadowOffsetY = (FRAME_H * PLAYER_DISPLAY_SCALE) / 2 - 8
    // Created before the sprite so it renders underneath (same-depth
    // objects draw in insertion order in Phaser).
    this.shadow = scene.add.ellipse(x, y + this.shadowOffsetY, 16, 7, 0x000000, 0.35)
    this.sprite = scene.add.sprite(x, y, PLAYER_SHEET_KEY, 'down_0')
    this.sprite.setScale(PLAYER_DISPLAY_SCALE)
    if (palette) this.sprite.setTint(tintFromPalette(palette))
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
    this.sprite.body.setSize(bodyW / PLAYER_DISPLAY_SCALE, bodyH / PLAYER_DISPLAY_SCALE)
    this.sprite.body.setOffset(
      (FRAME_W - bodyW / PLAYER_DISPLAY_SCALE) / 2,
      FRAME_H - bodyH / PLAYER_DISPLAY_SCALE - 6
    )
    this.sprite.body.setCollideWorldBounds(true)
  }

  get x() { return this.sprite.x }
  get y() { return this.sprite.y }

  // The sheet only has down/left/up art - "right" borrows the left frames
  // mirrored, so frame lookups always resolve through this helper instead
  // of using `this.facing` directly as a frame-name prefix.
  frameDir() {
    return this.facing === 'right' ? 'left' : this.facing
  }

  applyFrame() {
    this.sprite.setFrame(`${this.frameDir()}_${this.stepFrame}`)
    this.sprite.setFlipX(this.facing === 'right')
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
