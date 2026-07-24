import Phaser from 'phaser'
import { useGameStore } from '../../store/useGameStore'
import { resolvePalette } from '../characterPalettes'
import { generateAmbientNpcs } from '../../utils/npcGenerator'
import { FINANCE_NPCS } from '../../features/finance/financeNpcs'
import { SpriteActor } from '../actor'
import { preloadPlayerSheet } from '../spriteGen'
import { TileMover, combineDirection } from '../tileMover'
import {
  preloadTerrainAssets,
  buildTerrainLayer,
  TERRAIN_TILE_INDEX,
  placeTree,
  placeFlower,
  placeRock,
  placeBuildingFacade,
  addScreenVignette,
} from '../tileGen'

// ---------------------------------------------------------------------------
// OsakaScene — Merchant & Underground Nightlife Hub
// Canals, dense alleyways, neon-lit entertainment, and the crime syndicate's
// home turf. Dotonbori canal runs along the top and through the mid-town,
// separating the Entertainment/Merchant districts from the Underground.
// ---------------------------------------------------------------------------

const TILE_SIZE = 40
const MAP_COLS = 40
const MAP_ROWS = 45
const DEFAULT_SPAWN = { col: 10, row: 4 }

// Vertical streets
const V_STREETS = [8, 32]

const OSAKA_BUILDINGS = [
  { id: 'casino', label: 'Neon Dragon Casino', district: 'Entertainment', color: 0x8a1f6a, width: 4, height: 3 },
  { id: 'arcade', label: 'Pixel Palace Arcade', district: 'Entertainment', color: 0x1f6a8a, width: 3, height: 3 },
  { id: 'speakeasyHotel', label: 'Chicago Speakeasy Hotel', district: 'Entertainment', color: 0x6a3a2a, width: 4, height: 3, npcId: 'capone' },
  { id: 'dotonboriArcade', label: 'Dotonbori Merchant Arcade', district: 'Merchant', color: 0x8a6a2a, width: 4, height: 2 },
  { id: 'fishMarket', label: 'Kuromon Fish Market', district: 'Merchant', color: 0x2a5a6a, width: 3, height: 2 },
  { id: 'takoyakiStand', label: 'Takoyaki Street Food', district: 'Merchant', color: 0x8a4a1f, width: 2, height: 2 },
  { id: 'crimeAlley', label: 'Crime Alley', district: 'Underground', color: 0x6a1f1f, width: 4, height: 2, npcId: 'luciano' },
  { id: 'blackMarket', label: 'Black Market', district: 'Underground', color: 0x4a1f6a, width: 3, height: 2 },
  { id: 'callCenterOps', label: 'Call Center Ops', district: 'Underground', color: 0x6a5a1f, width: 3, height: 2 },
  { id: 'dockVaults', label: 'Dock Underground Vaults', district: 'Underground', color: 0x2a2a3a, width: 4, height: 2 },
  { id: 'fbiHQ', label: 'FBI Headquarters', district: 'Government', color: 0x2a3a5a, width: 4, height: 3 },
  { id: 'trainStation', label: '🚆 Train Station', district: 'Transport', color: 0x4a6fa5, width: 3, height: 3 },
]

// --- Layout buildings into their map regions ---
function layoutOsakaBuildings() {
  const placed = []
  const GAP = 2

  // Entertainment District: rows 5-14
  const entertainment = OSAKA_BUILDINGS.filter((b) => b.district === 'Entertainment')
  let col = 2, row = 6
  for (const b of entertainment) {
    if (col + b.width > MAP_COLS - 2) { col = 2; row += 4 }
    // skip vertical streets
    if (V_STREETS.some((vs) => col <= vs && col + b.width > vs)) col = V_STREETS.find((vs) => col <= vs) + 1
    placed.push({ ...b, tiles: { c0: col, r0: row, c1: col + b.width - 1, r1: row + b.height - 1 } })
    col += b.width + GAP
  }

  // Merchant District: rows 16-24
  const merchants = OSAKA_BUILDINGS.filter((b) => b.district === 'Merchant')
  col = 2; row = 17
  for (const b of merchants) {
    if (col + b.width > MAP_COLS - 2) { col = 2; row += 3 }
    if (V_STREETS.some((vs) => col <= vs && col + b.width > vs)) col = V_STREETS.find((vs) => col <= vs) + 1
    placed.push({ ...b, tiles: { c0: col, r0: row, c1: col + b.width - 1, r1: row + b.height - 1 } })
    col += b.width + GAP
  }

  // Underground District: rows 27-34
  const underground = OSAKA_BUILDINGS.filter((b) => b.district === 'Underground')
  col = 2; row = 28
  for (const b of underground) {
    if (col + b.width > MAP_COLS - 2) { col = 2; row += 3 }
    if (V_STREETS.some((vs) => col <= vs && col + b.width > vs)) col = V_STREETS.find((vs) => col <= vs) + 1
    placed.push({ ...b, tiles: { c0: col, r0: row, c1: col + b.width - 1, r1: row + b.height - 1 } })
    col += b.width + GAP
  }

  // Government District: rows 36-42
  const government = OSAKA_BUILDINGS.filter((b) => b.district === 'Government' || b.district === 'Transport')
  col = 2; row = 37
  for (const b of government) {
    if (col + b.width > MAP_COLS - 2) { col = 2; row += 4 }
    if (V_STREETS.some((vs) => col <= vs && col + b.width > vs)) col = V_STREETS.find((vs) => col <= vs) + 1
    placed.push({ ...b, tiles: { c0: col, r0: row, c1: col + b.width - 1, r1: row + b.height - 1 } })
    col += b.width + GAP
  }

  return placed
}

const BUILDINGS = layoutOsakaBuildings()

// --- Tile type function ---
function osakaTileType(r, c) {
  // Borders
  if (r === 0 || r === MAP_ROWS - 2 || r === MAP_ROWS - 1 || c === 0 || c === MAP_COLS - 1) return 'wall'
  // Dotonbori Canal (top)
  if (r >= 1 && r <= 3) return 'water'
  // Canal boardwalk
  if (r === 4) return 'path'
  // Mid-town canal
  if (r >= 25 && r <= 26) return 'water'
  // Horizontal streets
  if (r === 15 || r === 35) return 'path'
  // Vertical streets
  if (V_STREETS.includes(c)) return 'path'
  return 'grass'
}

function buildLayout(tileTypeFn, cols, rows) {
  const layout = []
  for (let r = 0; r < rows; r++) {
    const row = []
    for (let c = 0; c < cols; c++) row.push(tileTypeFn(r, c))
    layout.push(row)
  }
  return layout
}

// --- Interior constants (matches OverworldScene convention) ---
const INTERIOR_COLS = 12
const INTERIOR_ROWS = 9
const INTERIOR_SPAWN = { col: 6, row: 5 }
const INTERIOR_DESK = { c0: 5, r0: 2, c1: 6, r1: 3 }
const INTERIOR_EXIT = { c0: 5, r0: 7, c1: 7, r1: 8 }

const INTERIOR_TEMPLATES = {
  entertainment: { floorA: 0x1a0828, floorB: 0x240d30, deskColor: 0x8a1f6a, deskLabel: 'Stage / Counter' },
  merchant: { floorA: 0x2a2010, floorB: 0x241c0e, deskColor: 0x8a6a2a, deskLabel: 'Market Stall' },
  underground: { floorA: 0x121018, floorB: 0x0e0c14, deskColor: 0x6a1f1f, deskLabel: 'Ops Desk' },
  government: { floorA: 0x1a1e2a, floorB: 0x161a24, deskColor: 0x2a3a5a, deskLabel: 'Official Desk' },
  transport: { floorA: 0x1e2028, floorB: 0x181a22, deskColor: 0x4a6fa5, deskLabel: 'Ticket Counter' },
}

const BUILDING_INTERIOR_MAP = {
  casino: 'entertainment',
  arcade: 'entertainment',
  speakeasyHotel: 'entertainment',
  dotonboriArcade: 'merchant',
  fishMarket: 'merchant',
  takoyakiStand: 'merchant',
  crimeAlley: 'underground',
  blackMarket: 'underground',
  callCenterOps: 'underground',
  dockVaults: 'underground',
  fbiHQ: 'government',
  trainStation: 'transport',
}

const ZONES = {
  overworld: { cols: MAP_COLS, rows: MAP_ROWS },
  buildingInterior: { cols: INTERIOR_COLS, rows: INTERIOR_ROWS },
}

// --- Helpers ---
function wanderActor(actor, delta, speed = 20) {
  actor.wanderTimer -= delta
  if (actor.wanderTimer <= 0) {
    actor.wanderTimer = 1500 + Math.random() * 2500
    const dirs = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }]
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
  actor.sprite.setDepth(actor.y)
  actor.shadow.setDepth(actor.y - 1)
}

function drawInteriorRoom(scene, zoneObjects, { floorA, floorB, deskColor, deskLabel }) {
  const floorGraphics = scene.add.graphics()
  zoneObjects.push(floorGraphics)
  for (let row = 0; row < INTERIOR_ROWS; row++) {
    for (let col = 0; col < INTERIOR_COLS; col++) {
      const isBorder = row === 0 || col === 0 || row === INTERIOR_ROWS - 1 || col === INTERIOR_COLS - 1
      const x = col * TILE_SIZE
      const y = row * TILE_SIZE
      floorGraphics.fillStyle(isBorder ? 0x1a1a2e : (row + col) % 2 === 0 ? floorA : floorB, 1)
      floorGraphics.fillRect(x, y, TILE_SIZE, TILE_SIZE)
    }
  }
  const d = INTERIOR_DESK
  const dx = d.c0 * TILE_SIZE
  const dy = d.r0 * TILE_SIZE
  const dw = (d.c1 - d.c0 + 1) * TILE_SIZE
  const dh = (d.r1 - d.r0 + 1) * TILE_SIZE
  zoneObjects.push(...placeBuildingFacade(scene, dx, dy, dw, dh, deskColor))
  const deskLabelText = scene.add
    .text(dx + dw / 2, dy - 12, deskLabel, { fontFamily: 'monospace', fontSize: '10px', color: '#ffffff' })
    .setOrigin(0.5, 1)
    .setDepth(dy + dh + 10)
  zoneObjects.push(deskLabelText)
  return { dx, dy, dw, dh }
}

function interiorExitZone() {
  return {
    type: 'exit',
    id: 'toOverworld',
    label: 'Exit to Osaka',
    rect: new Phaser.Geom.Rectangle(
      INTERIOR_EXIT.c0 * TILE_SIZE,
      INTERIOR_EXIT.r0 * TILE_SIZE,
      (INTERIOR_EXIT.c1 - INTERIOR_EXIT.c0 + 1) * TILE_SIZE,
      (INTERIOR_EXIT.r1 - INTERIOR_EXIT.r0 + 1) * TILE_SIZE
    ),
  }
}

// --- Neon glow effect for the dark district atmosphere ---
function drawNeonGlowOverlay(scene, zoneObjects) {
  const gfx = scene.add.graphics().setDepth(500)
  zoneObjects.push(gfx)
  // Neon glow strips along entertainment buildings
  for (const b of BUILDINGS) {
    if (b.district !== 'Entertainment' && b.district !== 'Underground') continue
    const x = b.tiles.c0 * TILE_SIZE
    const y = b.tiles.r0 * TILE_SIZE
    const w = (b.tiles.c1 - b.tiles.c0 + 1) * TILE_SIZE
    const h = (b.tiles.r1 - b.tiles.r0 + 1) * TILE_SIZE
    // Neon base glow
    const neonColors = [0xff00ff, 0x00ffff, 0xff4400, 0xffff00]
    const neon = neonColors[Math.floor(Math.random() * neonColors.length)]
    gfx.lineStyle(2, neon, 0.6)
    gfx.strokeRect(x - 1, y - 1, w + 2, h + 2)
    // Bottom neon strip
    gfx.fillStyle(neon, 0.15)
    gfx.fillRect(x, y + h, w, 4)
  }
}

// ---------------------------------------------------------------------------
export default class OsakaScene extends Phaser.Scene {
  constructor() {
    super('OsakaScene')
    this.bridge = null
    this.nearbyZone = null
    this.interactionLocked = false
    this.zoneObjects = []
    this.currentZoneId = 'overworld'
    this.currentInteriorBuildingId = null
    this.overworldReturnSpawn = DEFAULT_SPAWN
    this.namedNpcActors = {}
    this.ambientActors = []
  }

  preload() {
    preloadPlayerSheet(this)
    preloadTerrainAssets(this)
  }

  create() {
    this.promptText = this.add
      .text(320, 460, '', { fontFamily: 'monospace', fontSize: '14px', color: '#ffe066' })
      .setScrollFactor(0)
      .setOrigin(0.5)
      .setDepth(2000)
    this.regionLabel = this.add
      .text(10, 10, '', { fontFamily: 'monospace', fontSize: '13px', color: '#ff99cc' })
      .setScrollFactor(0)
      .setDepth(2000)

    this.cursors = this.input.keyboard.createCursorKeys()
    this.wasd = this.input.keyboard.addKeys('W,A,S,D,E,R')

    this.createPlayer()
    this.loadZone('overworld', false)

    this.bridge?.emit('regionChanged', { region: 'osaka' })

    this.bridge?.on('npcKilled', ({ npcId }) => {
      this.namedNpcActors[npcId]?.destroy()
    })
    this.bridge?.on('ambientNpcKilled', ({ npcId }) => {
      this.removeAmbientNpc(npcId)
    })
  }

  // --- Zone loading ---
  loadZone(zoneId, teleportPlayer = true) {
    this.clearZoneObjects()
    this.currentZoneId = zoneId
    if (zoneId === 'overworld') this.buildOverworldZone()
    else this.buildGenericInteriorZone(this.currentInteriorBuildingId)

    const zone = ZONES[zoneId]
    this.cameras.main.setBounds(0, 0, zone.cols * TILE_SIZE, zone.rows * TILE_SIZE)
    if (teleportPlayer) {
      const spawn = zoneId === 'overworld' ? this.overworldReturnSpawn : INTERIOR_SPAWN
      this.tileMover.teleport(spawn.col, spawn.row)
    }
    this.cameras.main.startFollow(this.playerActor.sprite, true)
  }

  clearZoneObjects() {
    for (const obj of this.zoneObjects) obj.destroy()
    this.zoneObjects = []
    for (const id in this.namedNpcActors) this.namedNpcActors[id]?.destroy()
    for (const actor of this.ambientActors) actor.destroy()
    this.namedNpcActors = {}
    this.ambientActors = []
  }

  buildOverworldZone() {
    this.layout = buildLayout(osakaTileType, MAP_COLS, MAP_ROWS)

    // Real terrain layer
    const terrainLayer = buildTerrainLayer(this, MAP_COLS, MAP_ROWS, TILE_SIZE, (row, col) => {
      const tile = this.layout[row][col]
      if (tile === 'water') return TERRAIN_TILE_INDEX.water
      if (tile === 'path') return TERRAIN_TILE_INDEX.path
      if (tile === 'grass') return TERRAIN_TILE_INDEX.grass
      return null
    })
    this.zoneObjects.push(terrainLayer)

    // Fallback graphics for walls
    const fallbackGfx = this.add.graphics()
    this.zoneObjects.push(fallbackGfx)
    for (let r = 0; r < MAP_ROWS; r++) {
      for (let c = 0; c < MAP_COLS; c++) {
        if (this.layout[r][c] === 'wall') {
          fallbackGfx.fillStyle(0x2a1a2a, 1)
          fallbackGfx.fillRect(c * TILE_SIZE, r * TILE_SIZE, TILE_SIZE, TILE_SIZE)
        }
      }
    }

    // Dark overlay tint for neon-dark atmosphere on grass tiles
    const darkOverlay = this.add.graphics().setDepth(1)
    this.zoneObjects.push(darkOverlay)
    for (let r = 0; r < MAP_ROWS; r++) {
      for (let c = 0; c < MAP_COLS; c++) {
        if (this.layout[r][c] === 'grass') {
          darkOverlay.fillStyle(0x0a0012, 0.25)
          darkOverlay.fillRect(c * TILE_SIZE, r * TILE_SIZE, TILE_SIZE, TILE_SIZE)
        }
      }
    }

    // Scatter urban rocks (Osaka = dense urban, mostly rocks)
    this.scatterOsakaEnvironment(60)

    // Draw buildings
    this.drawBuildings()

    // Neon glow overlay
    drawNeonGlowOverlay(this, this.zoneObjects)

    // District labels
    this.drawDistrictLabels()

    // Screen vignette for cinematic atmosphere
    this.zoneObjects.push(addScreenVignette(this, MAP_COLS * TILE_SIZE, MAP_ROWS * TILE_SIZE))

    // NPCs
    this.drawNamedNpcs()
    this.spawnAmbientNpcs()

    this.regionLabel.setText('🐙 Osaka — Merchant & Underground Nightlife Hub')
    this.buildOverworldZones()
  }

  drawDistrictLabels() {
    const labels = [
      { text: '🎰 Entertainment District', x: MAP_COLS * TILE_SIZE / 2, y: 5 * TILE_SIZE - 8, color: '#ff66cc' },
      { text: '🛒 Merchant District', x: MAP_COLS * TILE_SIZE / 2, y: 16 * TILE_SIZE - 8, color: '#ffaa44' },
      { text: '🔪 Underground District', x: MAP_COLS * TILE_SIZE / 2, y: 27 * TILE_SIZE - 8, color: '#ff4444' },
      { text: '🏛️ Government & Transport', x: MAP_COLS * TILE_SIZE / 2, y: 36 * TILE_SIZE - 8, color: '#6699ff' },
    ]
    for (const lbl of labels) {
      const t = this.add
        .text(lbl.x, lbl.y, lbl.text, { fontFamily: 'monospace', fontSize: '11px', color: lbl.color })
        .setOrigin(0.5, 1)
        .setDepth(1500)
      this.zoneObjects.push(t)
    }
  }

  scatterOsakaEnvironment(count) {
    const forbidden = new Set()
    for (const b of BUILDINGS) {
      for (let r = b.tiles.r0 - 1; r <= b.tiles.r1 + 1; r++) {
        for (let c = b.tiles.c0 - 1; c <= b.tiles.c1 + 1; c++) forbidden.add(`${r},${c}`)
      }
    }
    for (let i = 0; i < count; i++) {
      const r = 5 + Math.floor(Math.random() * (MAP_ROWS - 7))
      const c = 1 + Math.floor(Math.random() * (MAP_COLS - 2))
      if (this.layout[r][c] !== 'grass' || forbidden.has(`${r},${c}`)) continue
      const cx = c * TILE_SIZE + TILE_SIZE / 2
      const cy = r * TILE_SIZE + TILE_SIZE / 2
      // Urban: mostly rocks, some sparse small trees
      if (Math.random() > 0.3) continue
      let objs
      const roll = Math.random()
      if (roll < 0.7) objs = placeRock(this, cx, cy)
      else objs = placeTree(this, cx, cy)
      if (objs) this.zoneObjects.push(...objs)
    }
  }

  drawBuildings() {
    for (const b of BUILDINGS) {
      const x = b.tiles.c0 * TILE_SIZE
      const y = b.tiles.r0 * TILE_SIZE
      const w = (b.tiles.c1 - b.tiles.c0 + 1) * TILE_SIZE
      const h = (b.tiles.r1 - b.tiles.r0 + 1) * TILE_SIZE
      this.zoneObjects.push(...placeBuildingFacade(this, x, y, w, h, b.color))
      const label = this.add
        .text(x + w / 2, y - 12, b.label, { fontFamily: 'monospace', fontSize: '10px', color: '#ffffff' })
        .setOrigin(0.5, 1)
        .setDepth(y + h + 10)
      this.zoneObjects.push(label)
    }
  }

  buildGenericInteriorZone(buildingId) {
    const building = BUILDINGS.find((b) => b.id === buildingId)
    const templateKey = BUILDING_INTERIOR_MAP[buildingId] || 'merchant'
    const template = INTERIOR_TEMPLATES[templateKey]

    drawInteriorRoom(this, this.zoneObjects, template)

    this.regionLabel.setText(building ? building.label : 'Interior')

    this.zones = [
      {
        type: 'interiorDesk',
        id: building?.id,
        npcId: building?.npcId,
        label: template.deskLabel,
        rect: new Phaser.Geom.Rectangle(
          INTERIOR_DESK.c0 * TILE_SIZE - TILE_SIZE / 2,
          INTERIOR_DESK.r0 * TILE_SIZE - TILE_SIZE / 2,
          (INTERIOR_DESK.c1 - INTERIOR_DESK.c0 + 1) * TILE_SIZE + TILE_SIZE,
          (INTERIOR_DESK.r1 - INTERIOR_DESK.r0 + 1) * TILE_SIZE + TILE_SIZE
        ),
      },
      interiorExitZone(),
    ]
  }

  // --- Collision ---
  isBlockedTile(col, row) {
    if (this.currentZoneId === 'buildingInterior') {
      if (col < 0 || col >= INTERIOR_COLS || row < 0 || row >= INTERIOR_ROWS) return true
      const isBorder = row === 0 || col === 0 || row === INTERIOR_ROWS - 1 || col === INTERIOR_COLS - 1
      if (isBorder) return true
      const d = INTERIOR_DESK
      if (col >= d.c0 && col <= d.c1 && row >= d.r0 && row <= d.r1) return true
      return false
    }
    if (col < 0 || col >= MAP_COLS || row < 0 || row >= MAP_ROWS) return true
    if (this.layout[row][col] === 'wall' || this.layout[row][col] === 'water') return true
    for (const b of BUILDINGS) {
      if (col >= b.tiles.c0 && col <= b.tiles.c1 && row >= b.tiles.r0 && row <= b.tiles.r1) return true
    }
    return false
  }

  // --- NPCs ---
  drawNamedNpcs() {
    const npcStatus = useGameStore.getState().world2?.npcStatus || {}
    this.namedNpcActors = {}
    for (const b of BUILDINGS) {
      if (!b.npcId) continue
      if (npcStatus[b.npcId] === 'dead') continue
      const npc = FINANCE_NPCS.find((n) => n.id === b.npcId)
      if (!npc) continue
      const cx = b.tiles.c0 * TILE_SIZE + ((b.tiles.c1 - b.tiles.c0 + 1) * TILE_SIZE) / 2
      const cy = (b.tiles.r1 + 1) * TILE_SIZE + TILE_SIZE / 2
      const actor = new SpriteActor(this, cx, cy, `npc_osaka_${npc.id}`, npc.palette)
      this.namedNpcActors[npc.id] = actor
    }
  }

  spawnAmbientNpcs() {
    const npcs = generateAmbientNpcs('osaka_ambient', 6)
    this.ambientActors = npcs.map((npc, i) => {
      let r, c, tries = 0
      do {
        r = 5 + Math.floor(Math.random() * (MAP_ROWS - 8))
        c = 1 + Math.floor(Math.random() * (MAP_COLS - 2))
        tries++
      } while (tries < 50 && this.layout[r][c] !== 'grass' && this.layout[r][c] !== 'path')
      const actor = new SpriteActor(this, c * TILE_SIZE + TILE_SIZE / 2, r * TILE_SIZE + TILE_SIZE / 2, `npc_osaka_amb_${i}`, npc.palette)
      actor.npcId = npc.id
      actor.npcName = npc.name
      actor.wanderTimer = 0
      actor.wanderDir = { x: 0, y: 0 }
      actor.dead = false
      return actor
    })
  }

  removeAmbientNpc(npcId) {
    const actor = this.ambientActors.find((a) => a.npcId === npcId)
    if (actor) {
      actor.dead = true
      actor.sprite.setVisible(false)
    }
  }

  findNearbyAmbientNpc() {
    const px = this.playerActor.x
    const py = this.playerActor.y
    return this.ambientActors.find((a) => !a.dead && Phaser.Math.Distance.Between(px, py, a.x, a.y) < 26)
  }

  // --- Player ---
  createPlayer() {
    const player = useGameStore.getState().player
    const palette = resolvePalette(player)
    this.playerActor = new SpriteActor(
      this,
      DEFAULT_SPAWN.col * TILE_SIZE + TILE_SIZE / 2,
      DEFAULT_SPAWN.row * TILE_SIZE + TILE_SIZE / 2,
      'player_texture_osaka',
      palette
    )
    this.tileMover = new TileMover({
      actor: this.playerActor,
      tileSize: TILE_SIZE,
      isBlocked: (c, r) => this.isBlockedTile(c, r),
      startCol: DEFAULT_SPAWN.col,
      startRow: DEFAULT_SPAWN.row,
    })
  }

  buildOverworldZones() {
    const pad = TILE_SIZE / 2
    this.zones = BUILDINGS.map((b) => ({
      type: 'building',
      id: b.id,
      label: b.label,
      npcId: b.npcId,
      rect: new Phaser.Geom.Rectangle(
        b.tiles.c0 * TILE_SIZE - pad,
        b.tiles.r0 * TILE_SIZE - pad,
        (b.tiles.c1 - b.tiles.c0 + 1) * TILE_SIZE + TILE_SIZE,
        (b.tiles.r1 - b.tiles.r0 + 1) * TILE_SIZE + TILE_SIZE
      ),
    }))
  }

  // --- Interaction ---
  pauseForModal() {
    this.tileMover.locked = true
    this.playerActor.setMoving(false)
    this.interactionLocked = true
  }

  resumeFromModal() {
    this.interactionLocked = false
  }

  updateNearbyZone() {
    const px = this.playerActor.x
    const py = this.playerActor.y
    const staticZone = this.zones.find((z) => Phaser.Geom.Rectangle.Contains(z.rect, px, py))
    const ambient = !staticZone ? this.findNearbyAmbientNpc() : null

    if (staticZone) {
      this.nearbyZone = staticZone
      const verb = staticZone.type === 'building' ? 'enter' : null
      this.promptText.setText(verb ? `Press E to ${verb} ${staticZone.label}` : `Press E: ${staticZone.label}`)
    } else if (ambient) {
      this.nearbyZone = { type: 'ambientNpc', npcRef: ambient }
      this.promptText.setText(`Press E to approach ${ambient.npcName}`)
    } else {
      this.nearbyZone = null
      this.promptText.setText(
        this.currentZoneId === 'overworld' ? 'Walk up to a building or person, then press E' : 'Walk up to the desk, then press E'
      )
    }
  }

  triggerInteraction(zone) {
    if (!this.bridge || this.interactionLocked) return
    if (zone.type === 'exit') {
      this.loadZone('overworld')
      return
    }
    if (zone.type === 'building') {
      const building = BUILDINGS.find((b) => b.id === zone.id)
      this.overworldReturnSpawn = {
        col: Math.round((building.tiles.c0 + building.tiles.c1) / 2),
        row: building.tiles.r1 + 1,
      }
      this.currentInteriorBuildingId = zone.id
      this.loadZone('buildingInterior')
      return
    }
    this.pauseForModal()
    if (zone.type === 'interiorDesk') {
      this.bridge.emit('interact', { type: 'building', id: zone.id, npcId: zone.npcId })
    } else if (zone.type === 'ambientNpc') {
      this.bridge.emit('interact', { type: 'ambientNpc', npcId: zone.npcRef.npcId, npcName: zone.npcRef.npcName })
    }
  }

  update(time, delta) {
    if (!this.playerActor || !this.tileMover) return

    this.tileMover.locked = this.interactionLocked
    this.playerActor.sprite.setDepth(this.playerActor.y)
    this.playerActor.shadow.setDepth(this.playerActor.y - 1)

    let horiz = null
    if (this.cursors.left.isDown || this.wasd.A.isDown) horiz = 'left'
    else if (this.cursors.right.isDown || this.wasd.D.isDown) horiz = 'right'
    let vert = null
    if (this.cursors.up.isDown || this.wasd.W.isDown) vert = 'up'
    else if (this.cursors.down.isDown || this.wasd.S.isDown) vert = 'down'
    const inputDir = combineDirection(horiz, vert)

    this.tileMover.update(delta, this.interactionLocked ? null : inputDir)

    // Wander ambient NPCs
    if (this.currentZoneId === 'overworld') {
      for (const actor of this.ambientActors) {
        if (!actor.dead) wanderActor(actor, delta)
      }
    }

    if (this.interactionLocked) return

    this.updateNearbyZone()

    if (Phaser.Input.Keyboard.JustDown(this.wasd.E) && this.nearbyZone) {
      this.triggerInteraction(this.nearbyZone)
    }
  }
}
