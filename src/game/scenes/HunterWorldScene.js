import Phaser from 'phaser'
import { useGameStore } from '../../store/useGameStore'
import { resolvePalette } from '../characterPalettes'
import { generateAmbientNpcs } from '../../utils/npcGenerator'
import { SpriteActor } from '../actor'
import { TileMover, combineDirection } from '../tileMover'
import { drawGrassTile, drawRoadTile, drawWaterTile, drawTree, drawFlower, drawRock, drawBuildingFacade, addScreenVignette } from '../tileGen'

const TILE_SIZE = 32
const MAP_COLS = 26
const MAP_ROWS = 20

const BUILDINGS = [
  { id: 'hq', label: 'Hunter Association HQ', color: 0x2a4f9e, tiles: { c0: 1, r0: 1, c1: 4, r1: 3 } },
  { id: 'supermarket', label: 'Supermarket', color: 0xb59b1f, tiles: { c0: 20, r0: 1, c1: 23, r1: 3 } },
  { id: 'burgerJoint', label: 'Burger Joint', color: 0xb5601f, tiles: { c0: 20, r0: 15, c1: 23, r1: 17 } },
  { id: 'dorms', label: 'Hunter Guild Dorms', color: 0x5f5f8f, tiles: { c0: 1, r0: 15, c1: 4, r1: 17 }, decorative: true },
]

const RIFTS = [
  { id: 'riftA', difficulty: 3, tileX: 7, tileY: 12 },
  { id: 'riftB', difficulty: 7, tileX: 18, tileY: 7 },
]

const MARRIAGE_SPOT = { tileX: 13, tileY: 5 }
const RIVER_COL = 12
const BRIDGE_ROWS = [9, 10]

const NPC_SPAWN_POOL = [
  { tileX: 3, tileY: 5, note: 'gardening outside HQ' },
  { tileX: 21, tileY: 10, note: 'loitering behind the burger joint' },
  { tileX: 9, tileY: 16, note: 'sitting on a bench' },
  { tileX: 15, tileY: 3, note: 'standing in the middle of the road' },
  { tileX: 6, tileY: 3, note: 'crouched by the HQ steps' },
  { tileX: 22, tileY: 6, note: 'hiding near the supermarket' },
]

function tileType(r, c) {
  const isBorder = r === 0 || c === 0 || r === MAP_ROWS - 1 || c === MAP_COLS - 1
  if (isBorder) return 'wall'
  if (c === RIVER_COL) return BRIDGE_ROWS.includes(r) ? 'path' : 'water'
  if (r === 7) return 'path'
  if (c === 13) return 'path'
  return 'grass'
}

function pickTwoDistinctSpawns() {
  const pool = [...NPC_SPAWN_POOL]
  const first = pool.splice(Math.floor(Math.random() * pool.length), 1)[0]
  const second = pool.splice(Math.floor(Math.random() * pool.length), 1)[0]
  return [first, second]
}

export default class HunterWorldScene extends Phaser.Scene {
  constructor() {
    super('HunterWorldScene')
    this.bridge = null
    this.nearbyZone = null
    this.interactionLocked = false
    this.ambientActors = []
  }

  create() {
    this.layout = this.buildLayout()
    this.drawTerrain()
    this.scatterTrees()
    this.drawBuildings()
    this.drawRiftPortals()
    this.drawMarriageNpc()
    this.drawHiddenNpcs()
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

    this.criminalEncounterTimer = this.time.addEvent({
      delay: 20000,
      loop: true,
      callback: () => this.maybeSpawnCriminal(),
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
    const tile = this.layout[row][col]
    if (tile === 'wall' || tile === 'water') return true
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
        else if (tile === 'path') drawRoadTile(graphics, x, y, TILE_SIZE, r === 7, c)
        else if (tile === 'water') drawWaterTile(graphics, x, y, TILE_SIZE, 0)
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
    for (let i = 0; i < 40; i++) {
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

  drawRiftPortals() {
    for (const rift of RIFTS) {
      const cx = rift.tileX * TILE_SIZE + TILE_SIZE / 2
      const cy = rift.tileY * TILE_SIZE + TILE_SIZE / 2
      const glow = this.add.circle(cx, cy, 18, 0x7a2fd6, 0.25)
      const portal = this.add.circle(cx, cy, 12, 0x9a5cff, 0.9)
      this.tweens.add({ targets: [portal, glow], scale: 1.2, duration: 700, yoyo: true, repeat: -1 })
    }
  }

  drawMarriageNpc() {
    const cx = MARRIAGE_SPOT.tileX * TILE_SIZE + TILE_SIZE / 2
    const cy = MARRIAGE_SPOT.tileY * TILE_SIZE + TILE_SIZE / 2
    new SpriteActor(this, cx, cy, 'npc_marriage', {
      skin: '#f1c27d', hair: '#8b0000', outfit: '#7a2fd6', hairStyle: 'Long',
    })
  }

  drawHiddenNpcs() {
    const [poomSpot, tanSpot] = pickTwoDistinctSpawns()
    this.poomSpawn = poomSpot
    this.tanSpawn = tanSpot

    new SpriteActor(
      this,
      poomSpot.tileX * TILE_SIZE + TILE_SIZE / 2,
      poomSpot.tileY * TILE_SIZE + TILE_SIZE / 2,
      'npc_poom',
      { skin: '#c68642', hair: '#1a1a1a', outfit: '#333333', hairStyle: 'Buzzcut' }
    )
    new SpriteActor(
      this,
      tanSpot.tileX * TILE_SIZE + TILE_SIZE / 2,
      tanSpot.tileY * TILE_SIZE + TILE_SIZE / 2,
      'npc_tan',
      { skin: '#e0ac69', hair: '#003f7f', outfit: '#2f9e44', hairStyle: 'Spiky' }
    )
  }

  spawnAmbientNpcs() {
    const npcs = generateAmbientNpcs('hunter_ambient', 5)
    this.ambientActors = npcs.map((npc, i) => {
      let r, c
      do {
        r = 1 + Math.floor(Math.random() * (MAP_ROWS - 2))
        c = 1 + Math.floor(Math.random() * (MAP_COLS - 2))
      } while (this.layout[r][c] !== 'grass' && this.layout[r][c] !== 'path')

      const actor = new SpriteActor(this, c * TILE_SIZE + TILE_SIZE / 2, r * TILE_SIZE + TILE_SIZE / 2, `npc_ambient_${i}`, npc.palette)
      actor.wanderTimer = 0
      actor.wanderDir = { x: 0, y: 0 }
      return actor
    })
  }

  createPlayer() {
    const startCol = 13
    const startRow = 7
    const player = useGameStore.getState().player
    const palette = resolvePalette(player)
    this.playerActor = new SpriteActor(
      this,
      startCol * TILE_SIZE + TILE_SIZE / 2,
      startRow * TILE_SIZE + TILE_SIZE / 2,
      'player_texture',
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
      ...BUILDINGS.filter((b) => !b.decorative).map((b) => ({
        type: 'building',
        id: b.id,
        label: b.label,
        rect: new Phaser.Geom.Rectangle(
          b.tiles.c0 * TILE_SIZE,
          b.tiles.r0 * TILE_SIZE,
          (b.tiles.c1 - b.tiles.c0 + 1) * TILE_SIZE,
          (b.tiles.r1 - b.tiles.r0 + 1) * TILE_SIZE
        ),
      })),
      ...RIFTS.map((rift) => ({
        type: 'rift',
        id: rift.id,
        label: `Dimensional Rift (Difficulty ${rift.difficulty})`,
        difficulty: rift.difficulty,
        rect: new Phaser.Geom.Rectangle(
          rift.tileX * TILE_SIZE - 8,
          rift.tileY * TILE_SIZE - 8,
          TILE_SIZE + 16,
          TILE_SIZE + 16
        ),
      })),
      {
        type: 'marriage',
        id: 'marriageCandidate',
        label: 'Talk',
        rect: new Phaser.Geom.Rectangle(
          MARRIAGE_SPOT.tileX * TILE_SIZE - 8,
          MARRIAGE_SPOT.tileY * TILE_SIZE - 8,
          TILE_SIZE + 16,
          TILE_SIZE + 16
        ),
      },
      {
        type: 'poom',
        id: 'poom',
        label: 'Talk to Poom',
        rect: new Phaser.Geom.Rectangle(
          this.poomSpawn.tileX * TILE_SIZE - 8,
          this.poomSpawn.tileY * TILE_SIZE - 8,
          TILE_SIZE + 16,
          TILE_SIZE + 16
        ),
      },
      {
        type: 'tan',
        id: 'tan',
        label: 'Talk to Tan',
        rect: new Phaser.Geom.Rectangle(
          this.tanSpawn.tileX * TILE_SIZE - 8,
          this.tanSpawn.tileY * TILE_SIZE - 8,
          TILE_SIZE + 16,
          TILE_SIZE + 16
        ),
      },
    ]
  }

  maybeSpawnCriminal() {
    if (!this.bridge) return
    const state = useGameStore.getState()
    if (!state.player.alive) return
    if (Math.random() > 0.35) return
    this.pauseForModal()
    this.bridge.emit('criminalEncounter', {})
  }

  maybeSpawnPolice() {
    if (!this.bridge) return
    const state = useGameStore.getState()
    if (!state.player.alive) return
    if (state.wantedLevel <= 0) return
    if (Math.random() > 0.4) return
    this.pauseForModal()
    this.bridge.emit('policeEncounter', { wantedLevel: state.wantedLevel })
  }

  pauseForModal() {
    this.tileMover.locked = true
    this.playerActor.setMoving(false)
    this.interactionLocked = true
  }

  resumeFromModal() {
    this.interactionLocked = false
  }

  updateAmbientNpcs(delta) {
    for (const actor of this.ambientActors) {
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
    if (Phaser.Input.Keyboard.JustDown(this.wasd.R)) {
      this.commitCrime()
    }
  }

  updateNearbyZone() {
    const px = this.playerActor.x
    const py = this.playerActor.y
    const zone = this.zones.find((z) => Phaser.Geom.Rectangle.Contains(z.rect, px, py))
    this.nearbyZone = zone || null

    if (zone) {
      const hint = zone.type === 'building' ? `Press E to enter ${zone.label}` : `Press E: ${zone.label}`
      this.promptText.setText(hint)
    } else {
      this.promptText.setText('R: Rob a bystander (raises Wanted Level)')
    }
  }

  triggerInteraction(zone) {
    if (!this.bridge || this.interactionLocked) return
    this.pauseForModal()
    this.bridge.emit('interact', { type: zone.type, id: zone.id, difficulty: zone.difficulty })
  }

  commitCrime() {
    if (!this.bridge || this.interactionLocked) return
    const store = useGameStore.getState()
    store.addCash(50)
    store.addWantedLevel(1)
    this.promptText.setText('You robbed a bystander. +$50, Wanted Level up!')
  }
}
