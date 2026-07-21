import Phaser from 'phaser'
import { useGameStore } from '../../store/useGameStore'
import { resolvePalette } from '../characterPalettes'
import { generateAmbientNpcs } from '../../utils/npcGenerator'
import { YUGIOH_NPCS } from '../../features/yugioh/yugiohNpcs'
import { SpriteActor } from '../actor'
import { TileMover, combineDirection } from '../tileMover'
import { drawGrassTile, drawRoadTile, drawTree, drawFlower, drawRock, drawBuildingFacade } from '../tileGen'

const TILE_SIZE = 32
const MAP_COLS = 26
const MAP_ROWS = 20

const BUILDINGS = [
  { id: 'kameGameShop', label: 'Kame Game Shop', color: 0x6b3a1f, tiles: { c0: 1, r0: 1, c1: 4, r1: 3 }, npcId: 'yugi' },
  { id: 'kaibaCorpTower', label: 'KaibaCorp Tower', color: 0x2a3a5f, tiles: { c0: 20, r0: 1, c1: 23, r1: 3 }, npcId: 'kaiba' },
  { id: 'cardShop', label: 'Duke Devlin\'s Card Shop', color: 0x4a3a5f, tiles: { c0: 1, r0: 15, c1: 4, r1: 17 }, npcId: 'duke' },
]

const FIXED_NPCS = [
  { npcId: 'joey', tileX: 8, tileY: 5, kidnappable: true },
  { npcId: 'tristan', tileX: 17, tileY: 5, kidnappable: true },
  { npcId: 'solomon', tileX: 3, tileY: 6, kidnappable: true },
  { npcId: 'tea', tileX: 13, tileY: 4 },
  { npcId: 'tah', tileX: 13, tileY: 14 },
]

// A real town plaza at the center (not just a thin crossroad like Hunter's
// Rift) so Domino City reads as structurally distinct, not a recolor.
const PLAZA = { c0: 10, r0: 6, c1: 16, r1: 12 }

function tileType(r, c) {
  const isBorder = r === 0 || c === 0 || r === MAP_ROWS - 1 || c === MAP_COLS - 1
  if (isBorder) return 'wall'
  if (c >= PLAZA.c0 && c <= PLAZA.c1 && r >= PLAZA.r0 && r <= PLAZA.r1) return 'path'
  if (r === 9) return 'path'
  if (c === 13) return 'path'
  return 'grass'
}

export default class YugiohWorldScene extends Phaser.Scene {
  constructor() {
    super('YugiohWorldScene')
    this.bridge = null
    this.nearbyZone = null
    this.interactionLocked = false
    this.ambientActors = []
  }

  create() {
    this.layout = this.buildLayout()
    this.drawTerrain()
    this.drawPlazaFountain()
    this.scatterTrees()
    this.drawBuildings()
    this.drawFixedNpcs()
    this.drawCynn()
    this.spawnAmbientNpcs()
    this.createPlayer()

    this.promptText = this.add
      .text(320, 460, '', { fontFamily: 'monospace', fontSize: '14px', color: '#ffe066' })
      .setScrollFactor(0)
      .setOrigin(0.5)

    this.cursors = this.input.keyboard.createCursorKeys()
    this.wasd = this.input.keyboard.addKeys('W,A,S,D,E,R')

    this.cameras.main.setBounds(0, 0, MAP_COLS * TILE_SIZE, MAP_ROWS * TILE_SIZE)
    this.cameras.main.startFollow(this.playerActor.sprite, true)

    this.buildZones()

    this.policeTimer = this.time.addEvent({
      delay: 9000,
      loop: true,
      callback: () => this.maybeSpawnPolice(),
    })
  }

  buildLayout() {
    const layout = []
    for (let r = 0; r < MAP_ROWS; r++) {
      const row = []
      for (let c = 0; c < MAP_COLS; c++) row.push(tileType(r, c))
      layout.push(row)
    }
    return layout
  }

  isBlockedTile(col, row) {
    if (col < 0 || col >= MAP_COLS || row < 0 || row >= MAP_ROWS) return true
    if (this.layout[row][col] === 'wall') return true
    if (col === 13 && row === 9) return true // fountain
    for (const b of BUILDINGS) {
      if (col >= b.tiles.c0 && col <= b.tiles.c1 && row >= b.tiles.r0 && row <= b.tiles.r1) return true
    }
    return false
  }

  drawTerrain() {
    const graphics = this.add.graphics()
    for (let r = 0; r < MAP_ROWS; r++) {
      for (let c = 0; c < MAP_COLS; c++) {
        const tile = this.layout[r][c]
        const x = c * TILE_SIZE
        const y = r * TILE_SIZE
        if (tile === 'grass') drawGrassTile(graphics, x, y, TILE_SIZE)
        else if (tile === 'path') drawRoadTile(graphics, x, y, TILE_SIZE, r === 9, c)
        else {
          graphics.fillStyle(0x5b4636, 1)
          graphics.fillRect(x, y, TILE_SIZE, TILE_SIZE)
        }
      }
    }
  }

  drawPlazaFountain() {
    const cx = 13 * TILE_SIZE + TILE_SIZE / 2
    const cy = 9 * TILE_SIZE + TILE_SIZE / 2
    this.add.circle(cx, cy, 30, 0x5b4636)
    this.add.circle(cx, cy, 25, 0x2f6fb5)
    const ripple = this.add.circle(cx, cy, 14, 0x5b9de0, 0.7)
    this.tweens.add({ targets: ripple, scale: 1.3, alpha: 0.2, duration: 1400, yoyo: true, repeat: -1 })
    this.add
      .text(cx, cy - 46, 'Domino Plaza', { fontFamily: 'monospace', fontSize: '10px', color: '#ffffff' })
      .setOrigin(0.5, 1)
  }

  scatterTrees() {
    const forbidden = new Set()
    for (const b of BUILDINGS) {
      for (let r = b.tiles.r0 - 1; r <= b.tiles.r1 + 1; r++) {
        for (let c = b.tiles.c0 - 1; c <= b.tiles.c1 + 1; c++) forbidden.add(`${r},${c}`)
      }
    }
    for (let i = 0; i < 32; i++) {
      const r = 1 + Math.floor(Math.random() * (MAP_ROWS - 2))
      const c = 1 + Math.floor(Math.random() * (MAP_COLS - 2))
      if (this.layout[r][c] !== 'grass' || forbidden.has(`${r},${c}`)) continue
      const cx = c * TILE_SIZE + TILE_SIZE / 2
      const cy = r * TILE_SIZE + TILE_SIZE / 2
      const roll = Math.random()
      if (roll < 0.45) drawTree(this, cx, cy)
      else if (roll < 0.85) drawFlower(this, cx, cy)
      else drawRock(this, cx, cy)
    }
  }

  drawBuildings() {
    const graphics = this.add.graphics()
    for (const b of BUILDINGS) {
      const x = b.tiles.c0 * TILE_SIZE
      const y = b.tiles.r0 * TILE_SIZE
      const w = (b.tiles.c1 - b.tiles.c0 + 1) * TILE_SIZE
      const h = (b.tiles.r1 - b.tiles.r0 + 1) * TILE_SIZE
      drawBuildingFacade(graphics, x, y, w, h, b.color)
      this.add
        .text(x + w / 2, y - 12, b.label, { fontFamily: 'monospace', fontSize: '10px', color: '#ffffff' })
        .setOrigin(0.5, 1)
    }
  }

  drawFixedNpcs() {
    this.fixedNpcActors = {}
    for (const spot of FIXED_NPCS) {
      const npc = YUGIOH_NPCS[spot.npcId]
      const cx = spot.tileX * TILE_SIZE + TILE_SIZE / 2
      const cy = spot.tileY * TILE_SIZE + TILE_SIZE / 2
      const actor = new SpriteActor(this, cx, cy, `npc_${spot.npcId}`, npc.palette)
      this.fixedNpcActors[spot.npcId] = actor
    }
  }

  drawCynn() {
    const npc = YUGIOH_NPCS.cynn
    const startR = 10
    const startC = 20
    this.cynnActor = new SpriteActor(
      this,
      startC * TILE_SIZE + TILE_SIZE / 2,
      startR * TILE_SIZE + TILE_SIZE / 2,
      'npc_cynn',
      npc.palette
    )
    this.cynnActor.wanderTimer = 0
    this.cynnActor.wanderDir = { x: 0, y: 0 }
  }

  spawnAmbientNpcs() {
    const npcs = generateAmbientNpcs('yugioh_ambient', 6)
    this.ambientActors = npcs.map((npc, i) => {
      let r, c
      do {
        r = 1 + Math.floor(Math.random() * (MAP_ROWS - 2))
        c = 1 + Math.floor(Math.random() * (MAP_COLS - 2))
      } while (this.layout[r][c] !== 'grass' && this.layout[r][c] !== 'path')

      const actor = new SpriteActor(this, c * TILE_SIZE + TILE_SIZE / 2, r * TILE_SIZE + TILE_SIZE / 2, `npc_ygo_ambient_${i}`, npc.palette)
      actor.npcId = npc.id
      actor.npcName = npc.name
      actor.wanderTimer = 0
      actor.wanderDir = { x: 0, y: 0 }
      return actor
    })
  }

  createPlayer() {
    const startCol = 13
    const startRow = 11
    const player = useGameStore.getState().player
    const palette = resolvePalette(player)
    this.playerActor = new SpriteActor(
      this,
      startCol * TILE_SIZE + TILE_SIZE / 2,
      startRow * TILE_SIZE + TILE_SIZE / 2,
      'player_texture_yugioh',
      palette
    )
    this.tileMover = new TileMover({
      actor: this.playerActor,
      tileSize: TILE_SIZE,
      isBlocked: (c, r) => this.isBlockedTile(c, r),
      startCol,
      startRow,
    })
  }

  buildZones() {
    this.zones = [
      ...BUILDINGS.map((b) => ({
        type: 'building',
        id: b.id,
        label: b.label,
        npcId: b.npcId,
        rect: new Phaser.Geom.Rectangle(
          b.tiles.c0 * TILE_SIZE,
          b.tiles.r0 * TILE_SIZE,
          (b.tiles.c1 - b.tiles.c0 + 1) * TILE_SIZE,
          (b.tiles.r1 - b.tiles.r0 + 1) * TILE_SIZE
        ),
      })),
      ...FIXED_NPCS.map((spot) => ({
        type: 'namedNpc',
        npcId: spot.npcId,
        kidnappable: spot.kidnappable,
        label: `Talk to ${YUGIOH_NPCS[spot.npcId].name}`,
        rect: new Phaser.Geom.Rectangle(
          spot.tileX * TILE_SIZE - 10,
          spot.tileY * TILE_SIZE - 10,
          TILE_SIZE + 20,
          TILE_SIZE + 20
        ),
      })),
    ]
  }

  maybeSpawnPolice() {
    if (!this.bridge) return
    const state = useGameStore.getState()
    if (!state.player.alive) return
    if (state.wantedLevel <= 0) return
    if (Math.random() > 0.4) return
    this.pauseForModal()
    this.bridge.emit('financePoliceEncounter', { wantedLevel: state.wantedLevel })
  }

  pauseForModal() {
    this.tileMover.locked = true
    this.playerActor.setMoving(false)
    this.interactionLocked = true
  }

  resumeFromModal() {
    this.interactionLocked = false
  }

  wanderActor(actor, delta, speed = 20) {
    actor.wanderTimer -= delta
    if (actor.wanderTimer <= 0) {
      actor.wanderTimer = 1500 + Math.random() * 2500
      const dirs = [
        { x: 0, y: 0 }, { x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 },
      ]
      actor.wanderDir = dirs[Math.floor(Math.random() * dirs.length)]
    }
    const nx = actor.x + actor.wanderDir.x * speed * (delta / 1000)
    const ny = actor.y + actor.wanderDir.y * speed * (delta / 1000)
    actor.sprite.setPosition(nx, ny)
    actor.setMoving(actor.wanderDir.x !== 0 || actor.wanderDir.y !== 0)
    if (actor.wanderDir.x > 0) actor.setFacing('right')
    else if (actor.wanderDir.x < 0) actor.setFacing('left')
    else if (actor.wanderDir.y > 0) actor.setFacing('down')
    else if (actor.wanderDir.y < 0) actor.setFacing('up')
    actor.update(delta)
  }

  updateAmbientNpcs(delta) {
    for (const actor of this.ambientActors) this.wanderActor(actor, delta)
    this.wanderActor(this.cynnActor, delta, 26)
  }

  findNearbyAmbientNpc() {
    const px = this.playerActor.x
    const py = this.playerActor.y
    return this.ambientActors.find((a) => Phaser.Math.Distance.Between(px, py, a.x, a.y) < 26)
  }

  isNearCynn() {
    return Phaser.Math.Distance.Between(this.playerActor.x, this.playerActor.y, this.cynnActor.x, this.cynnActor.y) < 28
  }

  update(time, delta) {
    if (!this.playerActor || !this.tileMover) return

    this.tileMover.locked = this.interactionLocked

    let horiz = null
    if (this.cursors.left.isDown || this.wasd.A.isDown) horiz = 'left'
    else if (this.cursors.right.isDown || this.wasd.D.isDown) horiz = 'right'
    let vert = null
    if (this.cursors.up.isDown || this.wasd.W.isDown) vert = 'up'
    else if (this.cursors.down.isDown || this.wasd.S.isDown) vert = 'down'
    const inputDir = combineDirection(horiz, vert)

    this.tileMover.update(delta, this.interactionLocked ? null : inputDir)
    this.updateAmbientNpcs(delta)

    if (this.interactionLocked) return

    this.updateNearbyZone()

    if (Phaser.Input.Keyboard.JustDown(this.wasd.E) && this.nearbyZone) {
      this.triggerInteraction(this.nearbyZone)
    }
  }

  updateNearbyZone() {
    const px = this.playerActor.x
    const py = this.playerActor.y
    const staticZone = this.zones.find((z) => Phaser.Geom.Rectangle.Contains(z.rect, px, py))
    const ambientNpc = !staticZone ? this.findNearbyAmbientNpc() : null
    const nearCynn = !staticZone && !ambientNpc && this.isNearCynn()

    if (staticZone) {
      this.nearbyZone = staticZone
      this.promptText.setText(`Press E: ${staticZone.label}`)
    } else if (nearCynn) {
      this.nearbyZone = { type: 'cynn' }
      this.promptText.setText('Press E to approach Cynn')
    } else if (ambientNpc) {
      this.nearbyZone = { type: 'ambientChallenge', npcRef: ambientNpc }
      this.promptText.setText(`Press E to challenge ${ambientNpc.npcName}`)
    } else {
      this.nearbyZone = null
      this.promptText.setText('Domino City: walk up to a building or person, then press E')
    }
  }

  triggerInteraction(zone) {
    if (!this.bridge || this.interactionLocked) return
    this.pauseForModal()
    if (zone.type === 'ambientChallenge') {
      this.bridge.emit('interact', { type: 'ambientChallenge', npcName: zone.npcRef.npcName })
    } else if (zone.type === 'cynn') {
      this.bridge.emit('interact', { type: 'cynn' })
    } else if (zone.type === 'namedNpc') {
      this.bridge.emit('interact', { type: 'namedNpc', npcId: zone.npcId, kidnappable: zone.kidnappable })
    } else {
      this.bridge.emit('interact', { type: zone.type, id: zone.id, npcId: zone.npcId })
    }
  }
}
