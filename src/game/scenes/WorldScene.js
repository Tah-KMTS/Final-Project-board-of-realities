import Phaser from 'phaser'

const TILE_SIZE = 32
const MAP_COLS = 20
const MAP_ROWS = 15

// 0 = grass (walkable), 1 = wall (blocked), 2 = path (walkable)
const TILE_COLORS = {
  0: 0x3a7d34,
  1: 0x5b4636,
  2: 0xc2a25c,
}

function buildMapLayout() {
  const layout = []
  for (let r = 0; r < MAP_ROWS; r++) {
    const row = []
    for (let c = 0; c < MAP_COLS; c++) {
      const isBorder = r === 0 || c === 0 || r === MAP_ROWS - 1 || c === MAP_COLS - 1
      row.push(isBorder ? 1 : 0)
    }
    layout.push(row)
  }
  // simple horizontal + vertical path
  for (let c = 1; c < MAP_COLS - 1; c++) layout[7][c] = 2
  for (let r = 1; r < MAP_ROWS - 1; r++) layout[r][10] = 2
  return layout
}

export default class WorldScene extends Phaser.Scene {
  constructor() {
    super('WorldScene')
    this.layout = buildMapLayout()
  }

  preload() {}

  create() {
    this.drawTilemap()
    this.createPlayer()
    this.cursors = this.input.keyboard.createCursorKeys()
    this.wasd = this.input.keyboard.addKeys('W,A,S,D')

    this.cameras.main.setBounds(0, 0, MAP_COLS * TILE_SIZE, MAP_ROWS * TILE_SIZE)
    this.cameras.main.startFollow(this.player, true)
    this.physics.world.setBounds(0, 0, MAP_COLS * TILE_SIZE, MAP_ROWS * TILE_SIZE)
  }

  drawTilemap() {
    const graphics = this.add.graphics()
    this.wallRects = []
    for (let r = 0; r < MAP_ROWS; r++) {
      for (let c = 0; c < MAP_COLS; c++) {
        const tile = this.layout[r][c]
        graphics.fillStyle(TILE_COLORS[tile], 1)
        graphics.fillRect(c * TILE_SIZE, r * TILE_SIZE, TILE_SIZE, TILE_SIZE)
        graphics.lineStyle(1, 0x000000, 0.08)
        graphics.strokeRect(c * TILE_SIZE, r * TILE_SIZE, TILE_SIZE, TILE_SIZE)
        if (tile === 1) {
          const rect = this.add.rectangle(
            c * TILE_SIZE + TILE_SIZE / 2,
            r * TILE_SIZE + TILE_SIZE / 2,
            TILE_SIZE,
            TILE_SIZE
          )
          this.physics.add.existing(rect, true)
          this.wallRects.push(rect)
        }
      }
    }
  }

  createPlayer() {
    const startX = 10 * TILE_SIZE + TILE_SIZE / 2
    const startY = 7 * TILE_SIZE + TILE_SIZE / 2
    const container = this.add.container(startX, startY)

    const body = this.add.rectangle(0, 0, 20, 24, 0x3f6fd6)
    const face = this.add.rectangle(0, -14, 12, 8, 0xffdbac)
    this.directionIndicator = this.add.triangle(0, -20, 0, 6, 6, -4, -6, -4, 0xffffff)
    container.add([body, face, this.directionIndicator])

    this.physics.add.existing(container)
    container.body.setSize(20, 24)
    container.body.setCollideWorldBounds(true)

    this.player = container
    this.playerSpeed = 140
    this.facing = 'down'

    if (this.wallRects) {
      this.wallRects.forEach((wall) => this.physics.add.collider(this.player, wall))
    }
  }

  update() {
    if (!this.player) return
    const speed = this.playerSpeed
    let vx = 0
    let vy = 0

    if (this.cursors.left.isDown || this.wasd.A.isDown) {
      vx = -speed
      this.facing = 'left'
    } else if (this.cursors.right.isDown || this.wasd.D.isDown) {
      vx = speed
      this.facing = 'right'
    }

    if (this.cursors.up.isDown || this.wasd.W.isDown) {
      vy = -speed
      this.facing = 'up'
    } else if (this.cursors.down.isDown || this.wasd.S.isDown) {
      vy = speed
      this.facing = 'down'
    }

    if (vx !== 0 && vy !== 0) {
      const norm = Math.SQRT1_2
      vx *= norm
      vy *= norm
    }

    this.player.body.setVelocity(vx, vy)

    const rotations = { down: 0, up: 180, left: -90, right: 90 }
    this.directionIndicator.setAngle(rotations[this.facing])
  }
}
