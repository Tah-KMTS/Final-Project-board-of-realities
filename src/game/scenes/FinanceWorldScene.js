import Phaser from 'phaser'
import { useGameStore } from '../../store/useGameStore'
import { resolvePalette } from '../characterPalettes'
import { generateAmbientNpcs } from '../../utils/npcGenerator'
import { FINANCE_NPCS } from '../../features/finance/financeNpcs'
import { SpriteActor } from '../actor'
import { TileMover, combineDirection } from '../tileMover'
import { drawGrassTile, drawRoadTile, drawTree, drawFlower, drawRock, drawBuildingFacade, addScreenVignette } from '../tileGen'

const TILE_SIZE = 32
const MAP_COLS = 26
const MAP_ROWS = 20

const BUILDINGS = [
  { id: 'stockExchange', label: 'Stock Exchange', color: 0x1f5f3a, tiles: { c0: 1, r0: 1, c1: 4, r1: 3 } },
  { id: 'buffettHQ', label: 'Buffett Tower', color: 0x555555, tiles: { c0: 8, r0: 1, c1: 10, r1: 3 }, npcId: 'buffett' },
  { id: 'vanderbiltHQ', label: 'Vanderbilt Rail Co.', color: 0x6b4a2a, tiles: { c0: 14, r0: 1, c1: 16, r1: 3 }, npcId: 'vanderbilt' },
  { id: 'muskHQ', label: 'Musk Industries', color: 0x2a2a2a, tiles: { c0: 20, r0: 1, c1: 22, r1: 3 }, npcId: 'musk' },
  { id: 'bank', label: 'Bank & Realty Office', color: 0x1f3a5f, tiles: { c0: 1, r0: 15, c1: 4, r1: 17 } },
  { id: 'corporateOffice', label: 'Corporate Holdings', color: 0x4a3a5f, tiles: { c0: 11, r0: 15, c1: 14, r1: 17 } },
  { id: 'cryptoExchange', label: 'Crypto Exchange', color: 0x8a5a1f, tiles: { c0: 20, r0: 15, c1: 23, r1: 17 } },
]

// Wall Street reads as a grid of city blocks, not a single crossroad -
// distinguishes it structurally from Hunter's Rift and Domino City rather
// than just being the same layout with different building colors.
const H_STREETS = [7, 12]
const V_STREETS = [6, 19]

function tileType(r, c) {
  const isBorder = r === 0 || c === 0 || r === MAP_ROWS - 1 || c === MAP_COLS - 1
  if (isBorder) return 'wall'
  if (H_STREETS.includes(r) || V_STREETS.includes(c)) return 'path'
  return 'grass'
}

export default class FinanceWorldScene extends Phaser.Scene {
  constructor() {
    super('FinanceWorldScene')
    this.bridge = null
    this.nearbyZone = null
    this.interactionLocked = false
    this.ambientActors = []
  }

  create() {
    useGameStore.getState().initFinanceMarket()

    this.layout = this.buildLayout()
    this.drawTerrain()
    this.scatterTrees()
    this.drawBuildings()
    this.drawNamedNpcs()
    this.spawnAmbientNpcs()
    this.createPlayer()

    this.promptText = this.add
      .text(320, 460, '', { fontFamily: 'monospace', fontSize: '14px', color: '#ffe066' })
      .setScrollFactor(0)
      .setOrigin(0.5)
      .setDepth(2000)

    this.cursors = this.input.keyboard.createCursorKeys()
    this.wasd = this.input.keyboard.addKeys('W,A,S,D,E,R')

    this.cameras.main.setBounds(0, 0, MAP_COLS * TILE_SIZE, MAP_ROWS * TILE_SIZE)
    this.cameras.main.startFollow(this.playerActor.sprite, true)
    addScreenVignette(this)

    this.buildZones()

    this.bridge?.on('npcKilled', ({ npcId }) => {
      this.namedNpcActors[npcId]?.destroy()
    })
    this.bridge?.on('ambientNpcKilled', ({ npcId }) => {
      this.removeAmbientNpc(npcId)
    })

    this.marketTimer = this.time.addEvent({
      delay: 4000,
      loop: true,
      callback: () => useGameStore.getState().tickFinanceMarket(),
    })

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
        else if (tile === 'path') drawRoadTile(graphics, x, y, TILE_SIZE, H_STREETS.includes(r), c)
        else {
          graphics.fillStyle(0x5b4636, 1)
          graphics.fillRect(x, y, TILE_SIZE, TILE_SIZE)
        }
      }
    }
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

  drawNamedNpcs() {
    this.namedNpcActors = {}
    for (const b of BUILDINGS) {
      if (!b.npcId) continue
      const npc = FINANCE_NPCS.find((n) => n.id === b.npcId)
      const cx = b.tiles.c0 * TILE_SIZE + ((b.tiles.c1 - b.tiles.c0 + 1) * TILE_SIZE) / 2
      const cy = (b.tiles.r1 + 1) * TILE_SIZE + TILE_SIZE / 2
      const actor = new SpriteActor(this, cx, cy, `npc_${npc.id}`, npc.palette)
      this.namedNpcActors[npc.id] = actor
    }
  }

  spawnAmbientNpcs() {
    const npcs = generateAmbientNpcs('finance_ambient', 8)
    this.ambientActors = npcs.map((npc, i) => {
      let r, c
      do {
        r = 1 + Math.floor(Math.random() * (MAP_ROWS - 2))
        c = 1 + Math.floor(Math.random() * (MAP_COLS - 2))
      } while (this.layout[r][c] !== 'grass' && this.layout[r][c] !== 'path')

      const actor = new SpriteActor(this, c * TILE_SIZE + TILE_SIZE / 2, r * TILE_SIZE + TILE_SIZE / 2, `npc_fin_ambient_${i}`, npc.palette)
      actor.npcId = npc.id
      actor.npcName = npc.name
      actor.wanderTimer = 0
      actor.wanderDir = { x: 0, y: 0 }
      actor.dead = false
      return actor
    })
  }

  createPlayer() {
    const startCol = 13
    const startRow = 9
    const player = useGameStore.getState().player
    const palette = resolvePalette(player)
    this.playerActor = new SpriteActor(
      this,
      startCol * TILE_SIZE + TILE_SIZE / 2,
      startRow * TILE_SIZE + TILE_SIZE / 2,
      'player_texture_finance',
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
    this.zones = BUILDINGS.map((b) => ({
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
    }))
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

  removeAmbientNpc(npcId) {
    const actor = this.ambientActors.find((a) => a.npcId === npcId)
    if (actor) {
      actor.dead = true
      actor.sprite.setVisible(false)
    }
  }

  updateAmbientNpcs(delta) {
    for (const actor of this.ambientActors) {
      if (actor.dead) continue
      actor.wanderTimer -= delta
      if (actor.wanderTimer <= 0) {
        actor.wanderTimer = 1500 + Math.random() * 2500
        const dirs = [
          { x: 0, y: 0 }, { x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 },
        ]
        actor.wanderDir = dirs[Math.floor(Math.random() * dirs.length)]
      }
      const speed = 20
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
  }

  findNearbyAmbientNpc() {
    const px = this.playerActor.x
    const py = this.playerActor.y
    return this.ambientActors.find((a) => !a.dead && Phaser.Math.Distance.Between(px, py, a.x, a.y) < 26)
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
    const buildingZone = this.zones.find((z) => Phaser.Geom.Rectangle.Contains(z.rect, px, py))
    const ambientNpc = !buildingZone ? this.findNearbyAmbientNpc() : null

    if (buildingZone) {
      this.nearbyZone = buildingZone
      this.promptText.setText(`Press E to enter ${buildingZone.label}`)
    } else if (ambientNpc) {
      this.nearbyZone = { type: 'ambientNpc', npcRef: ambientNpc }
      this.promptText.setText(`Press E to approach ${ambientNpc.npcName}`)
    } else {
      this.nearbyZone = null
      this.promptText.setText('Walk up to a building or person, then press E')
    }
  }

  triggerInteraction(zone) {
    if (!this.bridge || this.interactionLocked) return
    this.pauseForModal()
    if (zone.type === 'ambientNpc') {
      this.bridge.emit('interact', { type: 'ambientNpc', npcId: zone.npcRef.npcId, npcName: zone.npcRef.npcName })
    } else {
      this.bridge.emit('interact', { type: zone.type, id: zone.id, npcId: zone.npcId })
    }
  }
}
