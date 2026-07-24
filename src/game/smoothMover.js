// Stardew-Valley-style smooth pixel movement with 8-way input.
// Drop-in replacement for TileMover — same constructor shape, same
// update(delta, inputDir) contract, same col/row getters.

const DIR_VECTORS = {
  up:        { dx:  0, dy: -1 },
  down:      { dx:  0, dy:  1 },
  left:      { dx: -1, dy:  0 },
  right:     { dx:  1, dy:  0 },
  upleft:    { dx: -1, dy: -1 },
  upright:   { dx:  1, dy: -1 },
  downleft:  { dx: -1, dy:  1 },
  downright: { dx:  1, dy:  1 },
}

const INV_SQRT2 = 1 / Math.sqrt(2)

// Sprites only have 4 facings — diagonal moves face the horizontal component.
const FACING_FOR_DIR = {
  up: 'up', down: 'down', left: 'left', right: 'right',
  upleft: 'left', downleft: 'left', upright: 'right', downright: 'right',
}

export class SmoothMover {
  /**
   * @param {object} opts
   * @param {import('./actor').SpriteActor} opts.actor
   * @param {number}   opts.tileSize
   * @param {function} opts.isBlocked  (col, row) => boolean
   * @param {number}   opts.startCol
   * @param {number}   opts.startRow
   * @param {number}  [opts.speed=120] pixels per second
   */
  constructor({ actor, tileSize, isBlocked, startCol, startRow, speed = 120 }) {
    this.actor = actor
    this.tileSize = tileSize
    this.isBlocked = isBlocked
    this.speed = speed
    this.locked = false

    // Place the actor at the center of the starting tile.
    const cx = startCol * tileSize + tileSize / 2
    const cy = startRow * tileSize + tileSize / 2
    this._px = cx
    this._py = cy
    actor.sprite.setPosition(cx, cy)
  }

  // ── Tile getters (computed from pixel position) ──────────────────────
  get col() { return Math.floor(this._px / this.tileSize) }
  get row() { return Math.floor(this._py / this.tileSize) }

  // ── Public API ───────────────────────────────────────────────────────

  /**
   * @param {number}      delta    frame delta in ms
   * @param {string|null} inputDir one of the DIR_VECTORS keys, or null
   */
  update(delta, inputDir) {
    if (inputDir && !this.locked) {
      const vec = DIR_VECTORS[inputDir]
      if (vec) {
        this.actor.setFacing(FACING_FOR_DIR[inputDir])

        const isDiag = vec.dx !== 0 && vec.dy !== 0
        const scale = isDiag ? INV_SQRT2 : 1
        const dt = delta / 1000                         // ms → s
        let moveX = vec.dx * this.speed * scale * dt
        let moveY = vec.dy * this.speed * scale * dt

        // Resolve each axis independently (wall-sliding).
        const newX = this._resolveAxis(this._px, this._py, moveX, 0)
        const newY = this._resolveAxis(newX, this._py, 0, moveY)

        this._px = newX
        this._py = newY
        this.actor.sprite.setPosition(this._px, this._py)
        this.actor.setMoving(true)
      }
    } else {
      this.actor.setMoving(false)
      // Still let the player face the direction even when locked
      if (inputDir) this.actor.setFacing(FACING_FOR_DIR[inputDir])
    }

    this.actor.update(delta)
  }

  teleport(col, row) {
    this._px = col * this.tileSize + this.tileSize / 2
    this._py = row * this.tileSize + this.tileSize / 2
    this.actor.sprite.setPosition(this._px, this._py)
  }

  // ── Collision helpers ────────────────────────────────────────────────

  /**
   * Try to move along one axis. Returns the new position on that axis.
   * The player's footprint is treated as a single-tile-sized box centered
   * on (_px, _py). We sample the four corners of the hitbox after the
   * proposed move and block the axis if any corner lands in a blocked tile.
   *
   * A small inset (1 px) on the perpendicular axis prevents catching on
   * exact tile boundaries — this is the secret sauce for smooth wall-sliding
   * around corners.
   */
  _resolveAxis(px, py, dx, dy) {
    const ts = this.tileSize
    const half = ts / 2
    const inset = 12  // px inset from the hitbox edge for corner checks

    const nx = px + dx
    const ny = py + dy

    // Four corners of the hitbox after the proposed move (inset slightly).
    const left   = nx - half + inset
    const right  = nx + half - inset
    const top    = ny - half + inset
    const bottom = ny + half - inset

    const cLeft   = Math.floor(left   / ts)
    const cRight  = Math.floor(right  / ts)
    const rTop    = Math.floor(top    / ts)
    const rBottom = Math.floor(bottom / ts)

    // Check every grid cell the hitbox overlaps.
    for (let c = cLeft; c <= cRight; c++) {
      for (let r = rTop; r <= rBottom; r++) {
        if (this.isBlocked(c, r)) {
          // This axis is blocked — return the original value for the moving axis.
          return dx !== 0 ? px : py
        }
      }
    }

    return dx !== 0 ? nx : ny
  }
}

/** Combines separate horizontal/vertical key states into one of the 8 direction keys, or null. */
export function combineDirection(horiz, vert) {
  if (vert && horiz) return `${vert}${horiz}`
  return vert || horiz || null
}
