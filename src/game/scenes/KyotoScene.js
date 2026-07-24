import Phaser from 'phaser'
import { useGameStore } from '../../store/useGameStore'
import { resolvePalette } from '../characterPalettes'
import { generateAmbientNpcs } from '../../utils/npcGenerator'
import { FINANCE_NPCS } from '../../features/finance/financeNpcs'
import { SpriteActor } from '../actor'
import { preloadPlayerSheet } from '../spriteGen'
import { TileMover, combineDirection } from '../tileMover'
import {
  drawCobblestoneTile,
  addScreenVignette,
  preloadTerrainAssets,
  buildTerrainLayer,
  TERRAIN_TILE_INDEX,
  placeTree,
  placeFlower,
  placeRock,
  placeBuildingFacade,
} from '../tileGen'

// ---------------------------------------------------------------------------
// KyotoScene — Historical & Cultural Capital
//
// A cozy valley village surrounded by Higashiyama mountains, with the Kamo
// River running horizontally through the center, wooden bridges, bamboo
// forests, cherry blossom scatter everywhere, and traditional architecture.
//
// Standalone Phaser.Scene — will be refactored to extend BaseTownScene once
// that base class is extracted.
// ---------------------------------------------------------------------------

const TILE_SIZE = 40
const MAP_COLS = 40
const MAP_ROWS = 50
const DEFAULT_SPAWN = { col: 10, row: 16 }

// ---------------------------------------------------------------------------
// Map geography constants
// ---------------------------------------------------------------------------
const MOUNTAIN_ROWS = [0, 1, 2, 3]         // Higashiyama mountain ridge (wall)
const KAMO_RIVER_ROWS = [13, 14, 15]        // Kamo River (water)
const LAKE_BIWA_ROWS = [46, 47, 48]         // Lake Biwa Channel (water)
const WATER_ROWS = [...KAMO_RIVER_ROWS, ...LAKE_BIWA_ROWS]
const H_STREETS = [25, 35]                  // Horizontal streets
const V_STREETS = [10, 30]                  // Vertical corridors
const BORDER_ROW = MAP_ROWS - 1             // Row 49 bottom wall

// Wooden bridge over Kamo River
const BRIDGE_TILES = new Set()
for (const row of KAMO_RIVER_ROWS) {
  for (let col = 18; col <= 21; col++) {
    BRIDGE_TILES.add(`${row},${col}`)
  }
}

// ---------------------------------------------------------------------------
// Kyoto building definitions
// ---------------------------------------------------------------------------
const KYOTO_BUILDINGS = [
  // Bamboo Forest District (rows 5-12)
  { id: 'berkshireHQ', label: 'Berkshire Financial Tower', district: 'Bamboo Forest', color: 0x4a3a2a, width: 4, height: 3, npcId: 'buffett' },
  { id: 'teaHouse', label: 'Cherry Coke Tea House', district: 'Bamboo Forest', color: 0x8a4a2a, width: 3, height: 2 },
  { id: 'machiyaEstate', label: 'Machiya Executive Estate', district: 'Bamboo Forest', color: 0x6a5a3a, width: 4, height: 3 },
  // Temple & Garden District (rows 16-24)
  { id: 'irsHQ', label: 'IRS Revenue Building', district: 'Temple', color: 0x5a5a5a, width: 4, height: 3 },
  { id: 'temple', label: 'Golden Pavilion Temple', district: 'Temple', color: 0xd4a017, width: 4, height: 3 },
  { id: 'zenGarden', label: 'Zen Rock Garden', district: 'Temple', color: 0x8a8a6a, width: 3, height: 2 },
  // Merchant Quarter (rows 26-34)
  { id: 'silkMarket', label: 'Silk & Kimono Market', district: 'Merchant', color: 0x8a2a4a, width: 3, height: 2 },
  { id: 'sakeBrewery', label: 'Fushimi Sake Brewery', district: 'Merchant', color: 0x6a4a2a, width: 3, height: 2 },
  { id: 'artisanShop', label: 'Kiyomizu Artisan Shop', district: 'Merchant', color: 0x4a6a5a, width: 3, height: 2 },
  { id: 'inn', label: 'Ryokan Mountain Inn', district: 'Merchant', color: 0x5a4a3a, width: 4, height: 3 },
  // Transport
  { id: 'trainStation', label: '🚆 Train Station', district: 'Transport', color: 0x4a6fa5, width: 3, height: 3 },
]

// ---------------------------------------------------------------------------
// Layout: place buildings within their district row bands
// ---------------------------------------------------------------------------
const DISTRICT_BANDS = {
  'Bamboo Forest': { startRow: 5, endRow: 12 },
  'Temple':        { startRow: 16, endRow: 24 },
  'Merchant':      { startRow: 26, endRow: 34 },
  'Transport':     { startRow: 36, endRow: 42 },
}

const BAND_COL_START = 2
const BAND_COL_END = MAP_COLS - 3
const BAND_GAP = 2

function layoutKyotoBuildings() {
  const placed = []
  const districtGroups = {}
  for (const b of KYOTO_BUILDINGS) {
    if (!districtGroups[b.district]) districtGroups[b.district] = []
    districtGroups[b.district].push(b)
  }

  for (const [district, defs] of Object.entries(districtGroups)) {
    const band = DISTRICT_BANDS[district]
    if (!band) continue
    let col = BAND_COL_START
    let row = band.startRow
    let rowMaxH = 0

    for (const b of defs) {
      // Avoid vertical streets
      while (V_STREETS.includes(col) || V_STREETS.includes(col + 1)) col++

      if (col + b.width - 1 > BAND_COL_END) {
        col = BAND_COL_START
        row += rowMaxH + BAND_GAP
        rowMaxH = 0
      }
      if (row + b.height - 1 > band.endRow) break // district overflow guard

      const c0 = col
      const r0 = row
      const c1 = col + b.width - 1
      const r1 = row + b.height - 1
      placed.push({ ...b, tiles: { c0, r0, c1, r1 } })
      col += b.width + BAND_GAP
      rowMaxH = Math.max(rowMaxH, b.height)
    }
  }
  return placed
}

const KYOTO_PLACED_BUILDINGS = layoutKyotoBuildings()

// ---------------------------------------------------------------------------
// Tile type resolver
// ---------------------------------------------------------------------------
function kyotoTileType(row, col) {
  // Border walls
  if (row === 0 || row === BORDER_ROW || col === 0 || col === MAP_COLS - 1) return 'wall'
  // Mountain ridge
  if (MOUNTAIN_ROWS.includes(row)) return 'wall'
  // Bridge over river
  if (BRIDGE_TILES.has(`${row},${col}`)) return 'path'
  // Water (Kamo River + Lake Biwa)
  if (WATER_ROWS.includes(row)) return 'water'
  // Streets
  if (H_STREETS.includes(row) || V_STREETS.includes(col)) return 'path'
  // Everything else: grass (rendered as cobblestone for Kyoto)
  return 'grass'
}

// ---------------------------------------------------------------------------
// Terrain atlas tile index mapping for Kyoto
// Kyoto's "grass" cells use cobblestone (procedural), so return null for those
// ---------------------------------------------------------------------------
function kyotoTerrainIndex(tile) {
  if (tile === 'water') return TERRAIN_TILE_INDEX.water
  if (tile === 'path') return TERRAIN_TILE_INDEX.path
  // Kyoto grass → cobblestone (procedural fallback), not the pack's grass tile
  return null
}

// ---------------------------------------------------------------------------
// Interior constants (same 12x9 room as OverworldScene)
// ---------------------------------------------------------------------------
const INTERIOR_COLS = 12
const INTERIOR_ROWS = 9
const INTERIOR_SPAWN = { col: 6, row: 5 }
const INTERIOR_DESK = { c0: 5, r0: 2, c1: 6, r1: 3 }
const INTERIOR_EXIT = { c0: 5, r0: 7, c1: 7, r1: 8 }

const INTERIOR_TEMPLATES = {
  tycoonOffice: { floorA: 0x2a2420, floorB: 0x241f1c, deskColor: 0x555555, deskLabel: 'Executive Desk' },
  government:   { floorA: 0x1e2430, floorB: 0x1a1f29, deskColor: 0x5a5a5a, deskLabel: 'Revenue Counter' },
  temple:       { floorA: 0x2a2218, floorB: 0x252010, deskColor: 0xd4a017, deskLabel: 'Altar' },
  merchant:     { floorA: 0x201c28, floorB: 0x1b1822, deskColor: 0x5a4a2a, deskLabel: 'Counter' },
  amenity:      { floorA: 0x221e1a, floorB: 0x1d1915, deskColor: 0x4a3a2a, deskLabel: 'Reception' },
}

const BUILDING_INTERIOR_TEMPLATE = {
  berkshireHQ:   'tycoonOffice',
  teaHouse:      'amenity',
  machiyaEstate: 'tycoonOffice',
  irsHQ:         'government',
  temple:        'temple',
  zenGarden:     'amenity',
  silkMarket:    'merchant',
  sakeBrewery:   'merchant',
  artisanShop:   'merchant',
  inn:           'amenity',
  trainStation:  'amenity',
}

const ZONES = {
  overworld:        { cols: MAP_COLS, rows: MAP_ROWS },
  buildingInterior: { cols: INTERIOR_COLS, rows: INTERIOR_ROWS },
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------
function buildLayout(tileTypeFn, cols, rows) {
  const layout = []
  for (let r = 0; r < rows; r++) {
    const row = []
    for (let c = 0; c < cols; c++) row.push(tileTypeFn(r, c))
    layout.push(row)
  }
  return layout
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
    label: 'Exit to Kyoto',
    rect: new Phaser.Geom.Rectangle(
      INTERIOR_EXIT.c0 * TILE_SIZE,
      INTERIOR_EXIT.r0 * TILE_SIZE,
      (INTERIOR_EXIT.c1 - INTERIOR_EXIT.c0 + 1) * TILE_SIZE,
      (INTERIOR_EXIT.r1 - INTERIOR_EXIT.r0 + 1) * TILE_SIZE
    ),
  }
}

// ---------------------------------------------------------------------------
// Kyoto environment scatter — cherry blossoms heavy, with trees along
// mountain edges and riverbanks
// ---------------------------------------------------------------------------
function scatterKyotoEnvironment(scene, layout, buildings, count, zoneObjects) {
  const forbidden = new Set()
  for (const b of buildings) {
    for (let r = b.tiles.r0 - 1; r <= b.tiles.r1 + 1; r++) {
      for (let c = b.tiles.c0 - 1; c <= b.tiles.c1 + 1; c++) forbidden.add(`${r},${c}`)
    }
  }

  for (let i = 0; i < count; i++) {
    const r = 4 + Math.floor(Math.random() * (MAP_ROWS - 6))
    const c = 1 + Math.floor(Math.random() * (MAP_COLS - 2))
    if (layout[r]?.[c] !== 'grass' || forbidden.has(`${r},${c}`)) continue
    const cx = c * TILE_SIZE + TILE_SIZE / 2
    const cy = r * TILE_SIZE + TILE_SIZE / 2

    let objs
    // Dense trees along mountain edges (rows 4-5) and riverbanks (rows 12, 16)
    const isRiverbank = r === 12 || r === 16 || r === 45 || r === 4 || r === 5
    if (isRiverbank) {
      objs = Math.random() < 0.7 ? placeTree(scene, cx, cy) : placeFlower(scene, cx, cy)
    } else if (r >= 43 && r <= 45) {
      // Southern meadow — dense cherry blossom
      objs = placeFlower(scene, cx, cy)
    } else {
      // General Kyoto scatter: 65% flowers (cherry blossoms), 20% trees, 15% rocks
      const roll = Math.random()
      if (roll < 0.65) objs = placeFlower(scene, cx, cy)
      else if (roll < 0.85) objs = placeTree(scene, cx, cy)
      else objs = placeRock(scene, cx, cy)
    }
    if (objs) zoneObjects.push(...objs)
  }
}

// ---------------------------------------------------------------------------
// Draw building facades + labels
// ---------------------------------------------------------------------------
function drawBuildings(scene, buildings, zoneObjects) {
  for (const b of buildings) {
    const x = b.tiles.c0 * TILE_SIZE
    const y = b.tiles.r0 * TILE_SIZE
    const w = (b.tiles.c1 - b.tiles.c0 + 1) * TILE_SIZE
    const h = (b.tiles.r1 - b.tiles.r0 + 1) * TILE_SIZE
    zoneObjects.push(...placeBuildingFacade(scene, x, y, w, h, b.color))
    const label = scene.add
      .text(x + w / 2, y - 12, b.label, { fontFamily: 'monospace', fontSize: '10px', color: '#ffffff' })
      .setOrigin(0.5, 1)
      .setDepth(y + h + 10)
    zoneObjects.push(label)
  }
}

// ---------------------------------------------------------------------------
// KyotoScene
// ---------------------------------------------------------------------------
export default class KyotoScene extends Phaser.Scene {
  constructor() {
    super('KyotoScene')
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
  }

  // ---- zone loading ----

  loadZone(zoneId, teleportPlayer = true) {
    this.clearZoneObjects()
    this.currentZoneId = zoneId

    if (zoneId === 'overworld') this.buildOverworldZone()
    else this.buildGenericInteriorZone(this.currentInteriorBuildingId)

    const zone = ZONES[zoneId] || ZONES.overworld
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

  // ---- overworld rendering ----

  buildOverworldZone() {
    this.kyotoLayout = buildLayout(kyotoTileType, MAP_COLS, MAP_ROWS)

    // Real terrain art (path/water) via Tilemap layer
    const terrainLayer = buildTerrainLayer(this, MAP_COLS, MAP_ROWS, TILE_SIZE, (row, col) =>
      kyotoTerrainIndex(this.kyotoLayout[row][col])
    )
    this.zoneObjects.push(terrainLayer)

    // Fallback Graphics pass: cobblestone grass + wall tiles
    const fallbackGraphics = this.add.graphics()
    this.zoneObjects.push(fallbackGraphics)
    for (let row = 0; row < MAP_ROWS; row++) {
      for (let col = 0; col < MAP_COLS; col++) {
        const tile = this.kyotoLayout[row][col]
        if (tile === 'grass') {
          drawCobblestoneTile(fallbackGraphics, col * TILE_SIZE, row * TILE_SIZE, TILE_SIZE)
        } else if (tile === 'wall') {
          // Mountain / border walls — dark earthy brown
          fallbackGraphics.fillStyle(0x3a2e1f, 1)
          fallbackGraphics.fillRect(col * TILE_SIZE, row * TILE_SIZE, TILE_SIZE, TILE_SIZE)
          // Mountain texture detail for rows 1-3
          if (MOUNTAIN_ROWS.includes(row) && row > 0) {
            fallbackGraphics.fillStyle(0x5a4a32, 0.4)
            const px = col * TILE_SIZE
            const py = row * TILE_SIZE
            // Subtle ridge lines
            fallbackGraphics.fillRect(px + 2, py + TILE_SIZE / 2, TILE_SIZE - 4, 2)
          }
        }
      }
    }

    // Cherry blossom scatter — dense (120 attempts as per spec)
    scatterKyotoEnvironment(this, this.kyotoLayout, KYOTO_PLACED_BUILDINGS, 120, this.zoneObjects)

    // Buildings
    drawBuildings(this, KYOTO_PLACED_BUILDINGS, this.zoneObjects)

    // Kyoto landmark overlays — red torii accents on temple buildings
    this.drawToriiOverlays()

    // NPCs
    this.drawNamedNpcs()
    this.spawnAmbientNpcs()

    // Vignette
    addScreenVignette(this)

    this.regionLabel.setText('⛩️ Kyoto — Shinto Pagoda District')
    this.buildOverworldZones()
  }

  // Red torii-gate accent overlay on temple district buildings + golden finial
  drawToriiOverlays() {
    const overlayGraphics = this.add.graphics().setDepth(2000)
    this.zoneObjects.push(overlayGraphics)

    // Apply torii accent to temple district buildings and the Golden Pavilion
    const toriiBuildings = KYOTO_PLACED_BUILDINGS.filter(
      (b) => b.district === 'Temple' || b.id === 'berkshireHQ'
    )

    for (const b of toriiBuildings) {
      const x = b.tiles.c0 * TILE_SIZE
      const y = b.tiles.r0 * TILE_SIZE
      const w = (b.tiles.c1 - b.tiles.c0 + 1) * TILE_SIZE
      // Pagoda curved red roof accent
      overlayGraphics.fillStyle(0xdc2626, 0.85)
      overlayGraphics.fillRect(x - 4, y - 10, w + 8, 6)
      // Gold finial cap
      overlayGraphics.fillStyle(0xfbbf24, 1)
      overlayGraphics.fillRect(x + w / 2 - 2, y - 14, 4, 4)
    }

    // Extra accent: draw wooden bridge rails on the Kamo River bridge
    for (const row of KAMO_RIVER_ROWS) {
      const py = row * TILE_SIZE
      // Left rail
      overlayGraphics.fillStyle(0x6a4a2a, 0.9)
      overlayGraphics.fillRect(18 * TILE_SIZE - 2, py, 2, TILE_SIZE)
      // Right rail
      overlayGraphics.fillRect(22 * TILE_SIZE, py, 2, TILE_SIZE)
    }
    // Bridge label
    const bridgeLabel = this.add
      .text(20 * TILE_SIZE, 12 * TILE_SIZE + TILE_SIZE / 2, '🌉 Wooden Bridge', {
        fontFamily: 'monospace', fontSize: '9px', color: '#d4a017',
      })
      .setOrigin(0.5, 1)
      .setDepth(2001)
    this.zoneObjects.push(bridgeLabel)
  }

  // ---- building interiors ----

  buildGenericInteriorZone(buildingId) {
    const building = KYOTO_PLACED_BUILDINGS.find((b) => b.id === buildingId)
    const templateKey = BUILDING_INTERIOR_TEMPLATE[buildingId] || 'amenity'
    const template = INTERIOR_TEMPLATES[templateKey]

    drawInteriorRoom(this, this.zoneObjects, template)

    this.regionLabel.setText(building ? building.label : 'Interior')

    this.zones = [
      {
        type: 'interiorDesk',
        id: building ? building.id : buildingId,
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

  // ---- collision ----

  isBlockedTile(col, row) {
    if (this.currentZoneId === 'buildingInterior') {
      if (col < 0 || col >= INTERIOR_COLS || row < 0 || row >= INTERIOR_ROWS) return true
      const isBorder = row === 0 || col === 0 || row === INTERIOR_ROWS - 1 || col === INTERIOR_COLS - 1
      if (isBorder) return true
      const d = INTERIOR_DESK
      if (col >= d.c0 && col <= d.c1 && row >= d.r0 && row <= d.r1) return true
      return false
    }
    // Overworld collision
    if (col < 0 || col >= MAP_COLS || row < 0 || row >= MAP_ROWS) return true
    const tile = this.kyotoLayout?.[row]?.[col]
    if (tile === 'wall') return true
    if (tile === 'water') return true
    // Buildings are solid
    for (const b of KYOTO_PLACED_BUILDINGS) {
      if (col >= b.tiles.c0 && col <= b.tiles.c1 && row >= b.tiles.r0 && row <= b.tiles.r1) return true
    }
    return false
  }

  // ---- NPCs ----

  drawNamedNpcs() {
    const npcStatus = useGameStore.getState().world2?.npcStatus || {}
    this.namedNpcActors = {}
    for (const b of KYOTO_PLACED_BUILDINGS) {
      if (!b.npcId) continue
      if (npcStatus[b.npcId] === 'dead') continue
      const npc = FINANCE_NPCS.find((n) => n.id === b.npcId)
      if (!npc) continue
      const cx = b.tiles.c0 * TILE_SIZE + ((b.tiles.c1 - b.tiles.c0 + 1) * TILE_SIZE) / 2
      const cy = (b.tiles.r1 + 1) * TILE_SIZE + TILE_SIZE / 2
      const actor = new SpriteActor(this, cx, cy, `npc_${npc.id}`, npc.palette)
      this.namedNpcActors[npc.id] = actor
    }
  }

  spawnAmbientNpcs() {
    const npcs = generateAmbientNpcs('kyoto_ambient', 10)
    this.ambientActors = npcs.map((npc, i) => {
      let r, c
      let tries = 0
      do {
        r = 5 + Math.floor(Math.random() * (MAP_ROWS - 8))
        c = 1 + Math.floor(Math.random() * (MAP_COLS - 2))
        tries++
      } while (tries < 50 && this.kyotoLayout[r][c] !== 'grass' && this.kyotoLayout[r][c] !== 'path')

      const actor = new SpriteActor(
        this,
        c * TILE_SIZE + TILE_SIZE / 2,
        r * TILE_SIZE + TILE_SIZE / 2,
        `npc_kyoto_ambient_${i}`,
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

  // ---- player / zones ----

  createPlayer() {
    const player = useGameStore.getState().player
    const palette = resolvePalette(player)
    this.playerActor = new SpriteActor(
      this,
      DEFAULT_SPAWN.col * TILE_SIZE + TILE_SIZE / 2,
      DEFAULT_SPAWN.row * TILE_SIZE + TILE_SIZE / 2,
      'player_texture_kyoto',
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
    this.zones = KYOTO_PLACED_BUILDINGS.map((b) => ({
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

  // ---- encounters / interaction ----

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
      const building = KYOTO_PLACED_BUILDINGS.find((b) => b.id === zone.id)
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

  // ---- update loop ----

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
