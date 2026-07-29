import { VEHICLE_ATLAS_KEY } from './vehicleGen'
import { hasTopDownArt, topDownKey, headingFor } from './packs/topDownVehicles'

// House rule: this file used to be a fully procedural (Phaser Graphics)
// vehicle class (VEHICLE_TYPES + hand-drawn car/train shapes) from a prior
// round, but it had zero callers anywhere in src/ (grep-confirmed dead
// code). The Kenney Pixel Vehicle Pack atlas integration needed an
// atlas-based vehicle actor with no procedural equivalent to fall back to,
// so rather than leave this dead file sitting next to a new one, it's
// rewritten in place here - same filename, same "vehicle actor" role, now
// backed by real atlas sprite frames instead of Graphics draw calls. This
// also removes the dead procedural VEHICLE_TYPES code as a side effect.
//
// Every car frame in the atlas faces up (north) with no per-direction
// frames, so facing a travel direction means rotating the sprite at
// runtime. Phaser's sprite.rotation is clockwise-positive on screen (same
// convention as canvas ctx.rotate), so starting from the up-facing 0 angle,
// quarter turns sweep clockwise through the compass: up(0) -> right(+90deg)
// -> down(180deg) -> left(-90deg/270deg).
//
// Pixel-crisp rendering needs no per-sprite filter call here: GameCanvas.jsx
// already sets `pixelArt: true` globally in the Phaser game config, which
// applies nearest-neighbor texture sampling to every texture in the game.

const DIR_VECTORS = {
  up: [0, -1],
  right: [1, 0],
  down: [0, 1],
  left: [-1, 0],
}

// House rule: every vehicle type used to carry its own hand-picked `scale`
// (rent_bike 1.4 on a 16px-wide frame, the pico-8 cars 5 on an 8px-wide
// frame, every atmosphere car 1.2 on native widths ranging 29-38px) -
// nothing tied those numbers to each other, so on screen they landed at
// wildly different sizes (a ~22px-wide bike next to a 40px-wide car next to
// a ~46px-wide ambulance) even though they're all meant to read as "one car
// on the road." Reported by the user as "some of them are too small" /
// "make all vehicles same size", with the pico-8 car (already 40px wide,
// i.e. exactly TILE_SIZE) as the explicit size reference. Scale is now
// always derived from each sprite's own native frame width against this one
// target instead of being guessed per vehicle - uniform by construction,
// can't drift back out of sync as vehicles are added/changed.
const UNIFORM_VEHICLE_WIDTH = 40

// atan2(dx, -dy): the up vector (0,-1) resolves to angle 0, and positive
// angles sweep clockwise (dx>0 -> positive), matching Phaser's rotation
// convention above. One formula covers both the 4 cardinal facings
// setFacing() uses and the continuous (smooth, any-angle - a superset of
// 8-way) facing faceVector() uses while driving off-grid.
function angleForVector(dx, dy) {
  return Math.atan2(dx, -dy)
}

export class VehicleActor {
  /**
   * @param {Phaser.Scene} scene
   * @param {number} x
   * @param {number} y
   * @param {{spriteName: string, scale?: number, label?: string, atlasKey?: string}} options
   *   `scale` is now an optional EXTRA multiplier on top of the
   *   auto-computed uniform-width scale (default 1 = no adjustment) - it no
   *   longer sets the absolute scale directly, see UNIFORM_VEHICLE_WIDTH.
   */
  constructor(scene, x, y, { spriteName, scale = 1, label, atlasKey = VEHICLE_ATLAS_KEY, tierId } = {}) {
    this.scene = scene
    this.spriteName = spriteName
    this.angle = 0
    // TopDown Vehicles v1.17 ships a separately drawn sprite per compass
    // heading. When art exists for this tier, heading becomes a texture swap
    // and the sprite is never rotated - see topDownVehicles.js for why
    // rotating a single drawing could never look right.
    this.topDownTier = hasTopDownArt(scene, tierId) ? tierId : null

    // Created before the sprite so it renders underneath (same-depth
    // objects draw in insertion order in Phaser), mirroring SpriteActor
    // (actor.js). atlasKey defaults to the original illustrated pack for
    // back-compat, but callers now mostly pass PICO8_ATLAS_KEY (vehicleGen.js)
    // for anything that actually rotates - see that file's header comment.
    this.shadow = scene.add.ellipse(x, y, 20, 8, 0x000000, 0.35)
    this.sprite = this.topDownTier
      ? scene.add.sprite(x, y, topDownKey(this.topDownTier, 'NORTH'), 0)
      : scene.add.sprite(x, y, atlasKey, spriteName)
    // this.sprite.width is the frame's native, unscaled pixel width (Phaser
    // reads it straight from the atlas/texture) - dividing the uniform
    // target by it is what makes every vehicle land at the same on-screen
    // width regardless of how big its source art actually is.
    const uniformScale = UNIFORM_VEHICLE_WIDTH / this.sprite.width
    this.sprite.setScale(uniformScale * scale)
    // CORRECTED: this used to be `displayHeight * 0.4`, which pushed the
    // shadow ~40% of the car's length below the car - in a top-down view that
    // reads as the car hovering well above its own shadow, which is what kept
    // being reported as vehicles "still looking like they're flying" even
    // after the source art was switched to genuinely top-down frames. Looking
    // straight down, a grounded object's contact shadow is directly beneath
    // it; the 2px is just enough separation to read as contact rather than
    // as the shadow being part of the sprite.
    this.shadowOffsetY = 2
    this.shadow.setPosition(x, y + this.shadowOffsetY)
    // Sized off the uniform vehicle width rather than the frame's own
    // width/height so it stays correct at every heading: the sprite rotates
    // but this ellipse doesn't, and displayWidth/displayHeight are not
    // rotation-aware, so a footprint-shaped shadow would visibly disagree
    // with the car whenever it turned 90 degrees.
    const shadowSize = UNIFORM_VEHICLE_WIDTH * 0.8
    this.shadow.setSize(shadowSize, shadowSize * 0.55)

    this.labelObject = null
    if (label) {
      this.labelObject = scene.add
        .text(x, y - 20, label, {
          fontFamily: 'monospace',
          fontSize: '9px',
          color: '#ffffff',
          backgroundColor: 'rgba(0,0,0,0.6)',
          padding: { x: 3, y: 1 },
        })
        .setOrigin(0.5, 1)
    }

    this.sprite.setDepth(y)
    this.shadow.setDepth(y - 1)
  }

  get x() {
    return this.sprite.x
  }

  get y() {
    return this.sprite.y
  }

  setPosition(x, y) {
    this.sprite.setPosition(x, y)
    this.shadow.setPosition(x, y + this.shadowOffsetY)
    if (this.labelObject) this.labelObject.setPosition(x, y - 20)
    this.sprite.setDepth(y)
    this.shadow.setDepth(y - 1)
  }

  setFacing(dir) {
    const vector = DIR_VECTORS[dir]
    if (!vector) return
    if (this.topDownTier) {
      this.sprite.setTexture(topDownKey(this.topDownTier, headingFor(vector[0], vector[1])), 0)
      return
    }
    this.angle = angleForVector(vector[0], vector[1])
    this.sprite.setRotation(this.angle)
  }

  // Smooth rotation from a raw travel vector (e.g. diagonal movement steps),
  // used while actively driving instead of snapping to the 4 cardinals.
  faceVector(dx, dy) {
    if (dx === 0 && dy === 0) return // idle: hold last heading
    if (this.topDownTier) {
      // Swap to the sprite drawn for this heading; rotation stays 0.
      this.sprite.setTexture(topDownKey(this.topDownTier, headingFor(dx, dy)), 0)
      return
    }
    this.angle = angleForVector(dx, dy)
    this.sprite.setRotation(this.angle)
  }

  setVisible(visible) {
    this.sprite.setVisible(visible)
    this.shadow.setVisible(visible)
    if (this.labelObject) this.labelObject.setVisible(visible)
  }

  destroy() {
    this.sprite.destroy()
    this.shadow.destroy()
    if (this.labelObject) this.labelObject.destroy()
  }
}
