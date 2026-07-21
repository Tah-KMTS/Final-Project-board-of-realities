// GBA-Pokemon-style movement, extended with diagonals: the player is always
// exactly on one grid tile and a directional press slides them one full
// tile (or one diagonal tile) over a fixed duration, then snaps to the new
// tile center - no free-roam sub-tile positioning.
const DIRECTIONS = {
  up: { dx: 0, dy: -1 },
  down: { dx: 0, dy: 1 },
  left: { dx: -1, dy: 0 },
  right: { dx: 1, dy: 0 },
  upleft: { dx: -1, dy: -1 },
  upright: { dx: 1, dy: -1 },
  downleft: { dx: -1, dy: 1 },
  downright: { dx: 1, dy: 1 },
}

// Sprites only have 4 facings, so diagonal moves face the horizontal
// component (a common convention in tile games without 8-way sprites).
const FACING_FOR_DIR = {
  up: 'up', down: 'down', left: 'left', right: 'right',
  upleft: 'left', downleft: 'left', upright: 'right', downright: 'right',
}

export class TileMover {
  constructor({ actor, tileSize, isBlocked, startCol, startRow, stepDurationMs = 160 }) {
    this.actor = actor
    this.tileSize = tileSize
    this.isBlocked = isBlocked
    this.stepDurationMs = stepDurationMs
    this.col = startCol
    this.row = startRow
    const { x, y } = this.tileCenter(startCol, startRow)
    this.fromX = x
    this.fromY = y
    this.toX = x
    this.toY = y
    this.elapsed = 0
    this.moving = false
    this.locked = false
    actor.sprite.setPosition(x, y)
  }

  tileCenter(col, row) {
    return { x: col * this.tileSize + this.tileSize / 2, y: row * this.tileSize + this.tileSize / 2 }
  }

  tryStartStep(dir) {
    if (this.moving || this.locked || !dir) return false
    const { dx, dy } = DIRECTIONS[dir]
    const nextCol = this.col + dx
    const nextRow = this.row + dy
    this.actor.setFacing(FACING_FOR_DIR[dir])

    if (this.isBlocked(nextCol, nextRow)) {
      this.actor.setMoving(false)
      return false
    }
    // No corner-cutting: a diagonal step also requires both orthogonal
    // tiles adjacent to it to be open, so you can't clip through a wall's
    // corner point.
    if (dx !== 0 && dy !== 0) {
      if (this.isBlocked(nextCol, this.row) || this.isBlocked(this.col, nextRow)) {
        this.actor.setMoving(false)
        return false
      }
    }

    const from = this.tileCenter(this.col, this.row)
    const to = this.tileCenter(nextCol, nextRow)
    this.fromX = from.x
    this.fromY = from.y
    this.toX = to.x
    this.toY = to.y
    this.col = nextCol
    this.row = nextRow
    this.elapsed = 0
    this.moving = true
    this.actor.setMoving(true)
    return true
  }

  /** @param {string|null} inputDir one of the DIRECTIONS keys, or null */
  update(delta, inputDir) {
    if (this.moving) {
      this.elapsed += delta
      const t = Math.min(1, this.elapsed / this.stepDurationMs)
      this.actor.sprite.setPosition(
        this.fromX + (this.toX - this.fromX) * t,
        this.fromY + (this.toY - this.fromY) * t
      )
      if (t >= 1) {
        this.moving = false
        this.actor.setMoving(false)
        if (inputDir) this.tryStartStep(inputDir)
      }
    } else if (inputDir && !this.locked) {
      this.tryStartStep(inputDir)
    } else if (inputDir) {
      this.actor.setFacing(FACING_FOR_DIR[inputDir])
    }
    this.actor.update(delta)
  }

  teleport(col, row) {
    this.col = col
    this.row = row
    const { x, y } = this.tileCenter(col, row)
    this.fromX = x
    this.fromY = y
    this.toX = x
    this.toY = y
    this.moving = false
    this.actor.sprite.setPosition(x, y)
  }
}

/** Combines separate horizontal/vertical key states into one of the 8 DIRECTIONS keys, or null. */
export function combineDirection(horiz, vert) {
  if (vert && horiz) return `${vert}${horiz}`
  return vert || horiz || null
}
