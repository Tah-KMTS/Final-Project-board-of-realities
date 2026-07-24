import Phaser from 'phaser'
import { useGameStore } from '../../store/useGameStore'
import { resolvePalette } from '../characterPalettes'
import { generateAmbientNpcs } from '../../utils/npcGenerator'
import { FINANCE_NPCS } from '../../features/finance/financeNpcs'
import { SpriteActor } from '../actor'
import { preloadPlayerSheet } from '../spriteGen'
import { TileMover, combineDirection } from '../tileMover'
import {
  drawSlateMarbleTile,
  preloadTerrainAssets,
  buildTerrainLayer,
  TERRAIN_TILE_INDEX,
  placeRock,
  placeBuildingFacade,
  addScreenVignette,
} from '../tileGen'

// ---------------------------------------------------------------------------
// TokyoScene — Metro Financial Capital
// A luxury, dense urban grid with marble floors, gold-trimmed skyscrapers,
// Tokyo Bay waterfront, and 4 stacked districts connected by streets.
//
// Map: 40 cols × 45 rows
//   Row 0:     Wall border (north)
//   Rows 1-3:  Tokyo Bay water (coastal waterfront)
//   Row 4:     Path (boardwalk along the water)
//   Rows 5-12: Financial District
//   Row 13:    Horizontal street
//   Rows 14-21: Commercial District
//   Row 22:    Horizontal street
//   Rows 23-30: Government District
//   Row 31:    Horizontal street
//   Rows 32-38: Cultural District
//   Rows 39-43: Southern gardens (sparse rocks, clear paths)
//   Row 44:    Wall border (south)
//   Vertical streets: columns 7 and 33
// ---------------------------------------------------------------------------

const TILE_SIZE = 40
const MAP_COLS = 40
const MAP_ROWS = 45
const DEFAULT_SPAWN = { col: 7, row: 5 }

const WATER_ROWS = [1, 2, 3]
const H_STREETS = [4, 13, 22, 31]   // Row 4 = boardwalk, 13/22/31 = district separators
const V_STREETS = [7, 33]

// ---- Buildings ----

const TOKYO_BUILDINGS = [
  // Financial District (rows 5-12)
  { id: 'stockExchange',  label: 'Tokyo Stock Exchange',     district: 'Financial',  color: 0x1f5f3a, width: 3, height: 3 },
  { id: 'buffettHQ',      label: 'Biffle Tower',             district: 'Financial',  color: 0x555555, width: 3, height: 3, npcId: 'buffett' },
  { id: 'vanderbiltHQ',   label: 'Vanderbilt Rail Co.',      district: 'Financial',  color: 0x6b4a2a, width: 3, height: 3, npcId: 'vanderbilt' },
  { id: 'muskHQ',         label: 'Rusk Industries',          district: 'Financial',  color: 0x2a2a2a, width: 3, height: 3, npcId: 'musk' },
  { id: 'howardMarksHQ',  label: 'Oaktree Cycle Capital',    district: 'Financial',  color: 0x2a4f4a, width: 4, height: 3, npcId: 'howardmarks' },
  // Commercial District (rows 14-21)
  { id: 'bank',           label: 'Bank & Realty Office',     district: 'Commercial', color: 0x1f3a5f, width: 4, height: 3 },
  { id: 'realEstateAgency', label: 'Real Estate Agency',     district: 'Commercial', color: 0x3a5f4a, width: 4, height: 3 },
  { id: 'hotel',          label: 'Capital Suites Hotel',     district: 'Commercial', color: 0x8a6a2a, width: 4, height: 3 },
  { id: 'casino',         label: 'Neon Dragon Casino',       district: 'Commercial', color: 0x8a1f6a, width: 3, height: 3 },
  { id: 'arcade',         label: 'Pixel Palace Arcade',      district: 'Commercial', color: 0x1f6a8a, width: 3, height: 3 },
  // Government District (rows 23-30)
  { id: 'parliament',     label: 'Parliament Hall',          district: 'Government', color: 0x3a3a6a, width: 4, height: 3 },
  { id: 'ftcHQ',          label: 'FTC Commission',           district: 'Government', color: 0x5a3a2a, width: 4, height: 3 },
  { id: 'fedHQ',          label: 'Federal Reserve HQ',       district: 'Government', color: 0x2a5a3a, width: 4, height: 3 },
  { id: 'corporateOffice', label: 'Corporate Holdings',      district: 'Government', color: 0x4a3a5f, width: 4, height: 3 },
  { id: 'vcHub',          label: 'Venture Capital Hub',      district: 'Government', color: 0x2a3a6b, width: 3, height: 3 },
  { id: 'cryptoExchange', label: 'Crypto HQ',                district: 'Government', color: 0x8a5a1f, width: 4, height: 3 },
  // Cultural District (rows 32-38)
  { id: 'park',           label: 'Serenity Park',            district: 'Cultural',   color: 0x2a5f2a, width: 4, height: 2 },
  { id: 'temple',         label: 'Whispering Temple',        district: 'Cultural',   color: 0x5a5a4a, width: 4, height: 2 },
  { id: 'appleHQ',        label: 'Apple Glass HQ',           district: 'Cultural',   color: 0xc0c0c0, width: 4, height: 3, npcId: 'jobs' },
  { id: 'gigaFactory',    label: 'Giga Factory',             district: 'Cultural',   color: 0x1a1a2e, width: 4, height: 3, npcId: 'musk' },
  { id: 'trainStation',   label: '🚆 Train Station',        district: 'Transport',  color: 0x4a6fa5, width: 3, height: 3 },
]

// ---- District band configs for auto-layout ----

const DISTRICT_BANDS = [
  { name: 'Financial',  startRow: 5,  endRow: 12 },
  { name: 'Commercial', startRow: 14, endRow: 21 },
  { name: 'Government', startRow: 23, endRow: 30 },
  { name: 'Cultural',   startRow: 32, endRow: 38 },
  { name: 'Transport',  startRow: 39, endRow: 42 },
]

// Auto-layout: pack buildings left-to-right within their district band,
// skipping vertical street columns, wrapping to a new row when needed.
function layoutBuildings() {
  const placed = []
  for (const band of DISTRICT_BANDS) {
    const defs = TOKYO_BUILDINGS.filter((b) => b.district === band.name)
    let col = 1
    let row = band.startRow
    let rowMaxH = 0

    for (const b of defs) {
      // Skip over vertical street columns
      if (V_STREETS.includes(col)) col++
      if (col + b.width > V_STREETS[0] && col < V_STREETS[0] + 1 && !V_STREETS.includes(col)) {
        // Would overlap vStreet[0] — jump past it
      }

      // Wrap to next row if we'd exceed usable columns
      if (col + b.width > MAP_COLS - 1) {
        col = 1
        row += rowMaxH + 1
        rowMaxH = 0
      }

      // Skip vertical streets in the middle of the building
      let adjustedCol = col
      for (const vs of V_STREETS) {
        if (adjustedCol <= vs && adjustedCol + b.width > vs) {
          adjustedCol = vs + 1
        }
      }
      // Re-check bounds after adjustment
      if (adjustedCol + b.width > MAP_COLS - 1) {
        adjustedCol = 1
        row += rowMaxH + 1
        rowMaxH = 0
      }

      // Clamp to band endRow
      if (row + b.height - 1 > band.endRow) break

      const c0 = adjustedCol
      const r0 = row
      const c1 = c0 + b.width - 1
      const r1 = r0 + b.height - 1
      placed.push({ ...b, tiles: { c0, r0, c1, r1 } })
      col = c1 + 2 // gap of 1 tile between buildings
      rowMaxH = Math.max(rowMaxH, b.height)
    }
  }
  return placed
}

const PLACED_BUILDINGS = layoutBuildings()

// ---- Tile type function ----

function tokyoTileType(r, c) {
  if (r === 0 || c === 0 || r === MAP_ROWS - 1 || c === MAP_COLS - 1) return 'wall'
  if (WATER_ROWS.includes(r)) return 'water'
  if (H_STREETS.includes(r) || V_STREETS.includes(c)) return 'path'
  return 'grass'
}

function buildLayout() {
  const layout = []
  for (let r = 0; r < MAP_ROWS; r++) {
    const row = []
    for (let c = 0; c < MAP_COLS; c++) row.push(tokyoTileType(r, c))
    layout.push(row)
  }
  return layout
}

// ---- Terrain tile index for the Cute Fantasy tilemap layer ----
// Tokyo uses slate marble for 'grass' cells (procedural), so we return null
// for those → the fallback Graphics pass draws them instead.
function terrainTileIndexAt(tile) {
  if (tile === 'water') return TERRAIN_TILE_INDEX.water
  if (tile === 'path') return TERRAIN_TILE_INDEX.path
  return null // grass → marble fallback, wall → fallback
}

// ---- Building interiors (same 12×9 template as OverworldScene) ----

const INTERIOR_COLS = 12
const INTERIOR_ROWS = 9
const INTERIOR_SPAWN = { col: 6, row: 5 }
const INTERIOR_DESK = { c0: 5, r0: 2, c1: 6, r1: 3 }
const INTERIOR_EXIT = { c0: 5, r0: 7, c1: 7, r1: 8 }

const INTERIOR_TEMPLATES = {
  cryptoHQ:     { floorA: 0x1a1030, floorB: 0x241640, deskColor: 0x8a5a1f, deskLabel: 'Trading Terminal' },
  tycoonOffice: { floorA: 0x2a2420, floorB: 0x241f1c, deskColor: 0x555555, deskLabel: 'Executive Desk' },
  officeA:      { floorA: 0x1e2430, floorB: 0x1a1f29, deskColor: 0x1f3a5f, deskLabel: 'Front Desk' },
  officeB:      { floorA: 0x241e30, floorB: 0x1f1a29, deskColor: 0x4a3a5f, deskLabel: 'Reception Desk' },
  amenity:      { floorA: 0x201c28, floorB: 0x1b1822, deskColor: 0x5a4a2a, deskLabel: 'Counter' },
  exchange:     { floorA: 0x2a2b45, floorB: 0x252638, deskColor: 0x1f5f3a, deskLabel: 'Trading Floor' },
  casinoFloor:  { floorA: 0x2a1030, floorB: 0x230d28, deskColor: 0x8a1f6a, deskLabel: 'Casino Floor' },
}

const BUILDING_INTERIOR_MAP = {
  stockExchange: 'exchange',
  casino: 'casinoFloor',
  cryptoExchange: 'cryptoHQ',
  buffettHQ: 'tycoonOffice',
  vanderbiltHQ: 'tycoonOffice',
  muskHQ: 'tycoonOffice',
  howardMarksHQ: 'tycoonOffice',
  appleHQ: 'tycoonOffice',
  gigaFactory: 'tycoonOffice',
  bank: 'officeA',
  realEstateAgency: 'officeA',
  fedHQ: 'officeA',
  ftcHQ: 'officeA',
  corporateOffice: 'officeB',
  vcHub: 'officeB',
  hotel: 'amenity',
  arcade: 'amenity',
  parliament: 'amenity',
  park: 'amenity',
  temple: 'amenity',
  trainStation: 'amenity',
}

const ZONES = {
  overworld: { cols: MAP_COLS, rows: MAP_ROWS },
  buildingInterior: { cols: INTERIOR_COLS, rows: INTERIOR_ROWS },
}

// ---- Helpers ----

function drawInteriorRoom(scene, zoneObjects, { floorA, floorB, deskColor, deskLabel }) {
  const g = scene.add.graphics()
  zoneObjects.push(g)
  for (let row = 0; row < INTERIOR_ROWS; row++) {
    for (let col = 0; col < INTERIOR_COLS; col++) {
      const isBorder = row === 0 || col === 0 || row === INTERIOR_ROWS - 1 || col === INTERIOR_COLS - 1
      const x = col * TILE_SIZE
      const y = row * TILE_SIZE
      g.fillStyle(isBorder ? 0x1a1a2e : (row + col) % 2 === 0 ? floorA : floorB, 1)
      g.fillRect(x, y, TILE_SIZE, TILE_SIZE)
    }
  }

  const d = INTERIOR_DESK
  const dx = d.c0 * TILE_SIZE
  const dy = d.r0 * TILE_SIZE
  const dw = (d.c1 - d.c0 + 1) * TILE_SIZE
  const dh = (d.r1 - d.r0 + 1) * TILE_SIZE
  zoneObjects.push(...placeBuildingFacade(scene, dx, dy, dw, dh, deskColor))
  const label = scene.add
    .text(dx + dw / 2, dy - 12, deskLabel, { fontFamily: 'monospace', fontSize: '10px', color: '#ffffff' })
    .setOrigin(0.5, 1)
    .setDepth(dy + dh + 10)
  zoneObjects.push(label)
  return { dx, dy, dw, dh }
}

function interiorExitZone() {
  return {
    type: 'exit',
    id: 'toOverworld',
    label: 'Exit to Tokyo',
    rect: new Phaser.Geom.Rectangle(
      INTERIOR_EXIT.c0 * TILE_SIZE,
      INTERIOR_EXIT.r0 * TILE_SIZE,
      (INTERIOR_EXIT.c1 - INTERIOR_EXIT.c0 + 1) * TILE_SIZE,
      (INTERIOR_EXIT.r1 - INTERIOR_EXIT.r0 + 1) * TILE_SIZE
    ),
  }
}

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

// ---------------------------------------------------------------------------
// TokyoScene
// ---------------------------------------------------------------------------

export default class TokyoScene extends Phaser.Scene {
  constructor() {
    super('TokyoScene')
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
    useGameStore.getState().initFinanceMarket()

    this.promptText = this.add
      .text(320, 460, '', { fontFamily: 'monospace', fontSize: '14px', color: '#ffe066' })
      .setScrollFactor(0)
      .setOrigin(0.5)
      .setDepth(2000)
    this.regionLabel = this.add
      .text(10, 10, '', { fontFamily: 'monospace', fontSize: '13px', color: '#c9a8ff' })
      .setScrollFactor(0)
      .setDepth(2000)

    this.cursors = this.input.keyboard.createCursorKeys()
    this.wasd = this.input.keyboard.addKeys('W,A,S,D,E,R')

    this.createPlayer()
    addScreenVignette(this)
    this.loadZone('overworld', false)

    this.bridge?.emit('regionChanged', { region: 'finance' })

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

  // ---- Zone loading ----

  loadZone(zoneId, teleportPlayer = true) {
    this.clearZoneObjects()
    this.currentZoneId = zoneId

    if (zoneId === 'overworld') this.buildOverworldZone()
    else this.buildGenericInteriorZone(this.currentInteriorBuildingId)

    const zone = ZONES[zoneId] || ZONES.buildingInterior
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

  // ---- Overworld construction ----

  buildOverworldZone() {
    this.layout = buildLayout()

    // Terrain tilemap layer (water + path tiles from the art pack)
    const terrainLayer = buildTerrainLayer(this, MAP_COLS, MAP_ROWS, TILE_SIZE, (row, col) =>
      terrainTileIndexAt(this.layout[row][col])
    )
    this.zoneObjects.push(terrainLayer)

    // Fallback Graphics for marble grass + wall cells (no pack asset)
    const fallbackG = this.add.graphics()
    this.zoneObjects.push(fallbackG)
    for (let row = 0; row < MAP_ROWS; row++) {
      for (let col = 0; col < MAP_COLS; col++) {
        const tile = this.layout[row][col]
        if (tile === 'grass') {
          drawSlateMarbleTile(fallbackG, col * TILE_SIZE, row * TILE_SIZE, TILE_SIZE)
        } else if (tile === 'wall') {
          fallbackG.fillStyle(0x5b4636, 1)
          fallbackG.fillRect(col * TILE_SIZE, row * TILE_SIZE, TILE_SIZE, TILE_SIZE)
        }
      }
    }

    // Urban scatter — sparse rocks only (no trees for dense city)
    this.scatterEnvironment(40)

    // Draw buildings
    this.drawBuildings()

    // Gold accent overlay on first 3 Financial District buildings
    this.drawGoldAccentOverlay()

    // NPCs
    this.drawNamedNpcs()
    this.spawnAmbientNpcs()

    this.regionLabel.setText('🏛️ Tokyo — Luxury Financial District')
    this.buildOverworldZones()
  }

  scatterEnvironment(count) {
    const forbidden = new Set()
    for (const b of PLACED_BUILDINGS) {
      for (let r = b.tiles.r0 - 1; r <= b.tiles.r1 + 1; r++) {
        for (let c = b.tiles.c0 - 1; c <= b.tiles.c1 + 1; c++) forbidden.add(`${r},${c}`)
      }
    }
    for (let i = 0; i < count; i++) {
      const r = 5 + Math.floor(Math.random() * (MAP_ROWS - 7))
      const c = 1 + Math.floor(Math.random() * (MAP_COLS - 2))
      if (this.layout[r][c] !== 'grass' || forbidden.has(`${r},${c}`)) continue
      // Urban: only sparse rocks (25% chance per candidate)
      if (Math.random() > 0.25) continue
      const cx = c * TILE_SIZE + TILE_SIZE / 2
      const cy = r * TILE_SIZE + TILE_SIZE / 2
      const objs = placeRock(this, cx, cy)
      if (objs) this.zoneObjects.push(...objs)
    }
  }

  drawBuildings() {
    for (const b of PLACED_BUILDINGS) {
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

  drawGoldAccentOverlay() {
    const g = this.add.graphics().setDepth(2000)
    this.zoneObjects.push(g)
    const financialBuildings = PLACED_BUILDINGS.filter((b) => b.district === 'Financial')
    for (let i = 0; i < Math.min(3, financialBuildings.length); i++) {
      const b = financialBuildings[i]
      const x = b.tiles.c0 * TILE_SIZE
      const y = b.tiles.r0 * TILE_SIZE
      const w = (b.tiles.c1 - b.tiles.c0 + 1) * TILE_SIZE
      const h = (b.tiles.r1 - b.tiles.r0 + 1) * TILE_SIZE
      // Amber/gold border accent
      g.lineStyle(3, 0xf59e0b, 0.9)
      g.strokeRect(x, y, w, h)
      // Gold roof cap
      g.fillStyle(0xf59e0b, 0.3)
      g.fillRect(x, y - 4, w, 4)
    }
  }

  // ---- Building interiors ----

  buildGenericInteriorZone(buildingId) {
    const building = PLACED_BUILDINGS.find((b) => b.id === buildingId)
    const templateKey = BUILDING_INTERIOR_MAP[buildingId] || 'amenity'
    const template = INTERIOR_TEMPLATES[templateKey]

    drawInteriorRoom(this, this.zoneObjects, template)

    this.regionLabel.setText(building ? building.label : 'Interior')

    this.zones = [
      {
        type: 'interiorDesk',
        id: building ? building.id : buildingId,
        npcId: building ? building.npcId : undefined,
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

  // ---- Collision ----

  isBlockedTile(col, row) {
    if (this.currentZoneId === 'buildingInterior') {
      if (col < 0 || col >= INTERIOR_COLS || row < 0 || row >= INTERIOR_ROWS) return true
      const isBorder = row === 0 || col === 0 || row === INTERIOR_ROWS - 1 || col === INTERIOR_COLS - 1
      if (isBorder) return true
      const d = INTERIOR_DESK
      if (col >= d.c0 && col <= d.c1 && row >= d.r0 && row <= d.r1) return true
      return false
    }
    // Overworld
    if (col < 0 || col >= MAP_COLS || row < 0 || row >= MAP_ROWS) return true
    if (this.layout[row][col] === 'wall') return true
    if (this.layout[row][col] === 'water') return true
    for (const b of PLACED_BUILDINGS) {
      if (col >= b.tiles.c0 && col <= b.tiles.c1 && row >= b.tiles.r0 && row <= b.tiles.r1) return true
    }
    return false
  }

  // ---- NPCs ----

  drawNamedNpcs() {
    const npcStatus = useGameStore.getState().world2?.npcStatus || {}
    this.namedNpcActors = {}
    for (const b of PLACED_BUILDINGS) {
      if (!b.npcId) continue
      if (npcStatus[b.npcId] === 'dead') continue
      const npc = FINANCE_NPCS.find((n) => n.id === b.npcId)
      if (!npc) continue
      const cx = b.tiles.c0 * TILE_SIZE + (b.tiles.c1 - b.tiles.c0 + 1) * TILE_SIZE / 2
      const cy = (b.tiles.r1 + 1) * TILE_SIZE + TILE_SIZE / 2
      const actor = new SpriteActor(this, cx, cy, `npc_tokyo_${npc.id}`, npc.palette)
      this.namedNpcActors[npc.id] = actor
    }
  }

  spawnAmbientNpcs() {
    const npcs = generateAmbientNpcs('tokyo_ambient', 8)
    this.ambientActors = npcs.map((npc, i) => {
      let r, c, tries = 0
      do {
        r = 5 + Math.floor(Math.random() * (MAP_ROWS - 7))
        c = 1 + Math.floor(Math.random() * (MAP_COLS - 2))
        tries++
      } while (tries < 50 && this.layout[r][c] !== 'grass' && this.layout[r][c] !== 'path')

      const actor = new SpriteActor(
        this,
        c * TILE_SIZE + TILE_SIZE / 2,
        r * TILE_SIZE + TILE_SIZE / 2,
        `npc_tokyo_ambient_${i}`,
        npc.palette
      )
      actor.npcId = npc.id
      actor.npcName = npc.name
      actor.wanderTimer = 0
      actor.wanderDir = { x: 0, y: 0 }
      actor.dead = false
      return actor
    })
  }

  // ---- Player / zones ----

  createPlayer() {
    const player = useGameStore.getState().player
    const palette = resolvePalette(player)
    this.playerActor = new SpriteActor(
      this,
      DEFAULT_SPAWN.col * TILE_SIZE + TILE_SIZE / 2,
      DEFAULT_SPAWN.row * TILE_SIZE + TILE_SIZE / 2,
      'player_texture_tokyo',
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
    this.zones = PLACED_BUILDINGS.map((b) => ({
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

  // ---- Encounters ----

  maybeSpawnPolice() {
    if (!this.bridge) return
    if (this.currentZoneId !== 'overworld') return
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

  findNearbyAmbientNpc() {
    const px = this.playerActor.x
    const py = this.playerActor.y
    return this.ambientActors.find((a) => !a.dead && Phaser.Math.Distance.Between(px, py, a.x, a.y) < 26)
  }

  updateAllAmbientNpcs(delta) {
    for (const actor of this.ambientActors) {
      if (!actor.dead) wanderActor(actor, delta)
    }
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
      this.nearbyZone = { type: 'financeAmbientNpc', npcRef: ambient }
      this.promptText.setText(`Press E to approach ${ambient.npcName}`)
    } else {
      this.nearbyZone = null
      this.promptText.setText(
        this.currentZoneId === 'overworld'
          ? 'Walk up to a building or person, then press E'
          : 'Walk up to the desk, then press E'
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
      const building = PLACED_BUILDINGS.find((b) => b.id === zone.id)
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
    } else if (zone.type === 'financeAmbientNpc') {
      this.bridge.emit('interact', { type: 'ambientNpc', npcId: zone.npcRef.npcId, npcName: zone.npcRef.npcName })
    }
  }

  // ---- Game loop ----

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
    this.updateAllAmbientNpcs(delta)

    if (this.interactionLocked) return

    this.updateNearbyZone()

    if (Phaser.Input.Keyboard.JustDown(this.wasd.E) && this.nearbyZone) {
      this.triggerInteraction(this.nearbyZone)
    }
  }
}
