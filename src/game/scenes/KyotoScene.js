import BaseTownScene, { TILE_SIZE } from './BaseTownScene'
import {
  drawCobblestoneTile,
  buildTerrainLayer,
  TERRAIN_TILE_INDEX,
  placeTree,
  placeFlower,
  placeRock,
  placeBuildingFacade,
} from '../tileGen'
import { FINANCE_NPCS } from '../../features/finance/financeNpcs'
import { useGameStore } from '../../store/useGameStore'
import { SpriteActor } from '../actor'
import { generateAmbientNpcs } from '../../utils/npcGenerator'

const MAP_COLS = 40
const MAP_ROWS = 50
const DEFAULT_SPAWN = { col: 10, row: 16 }

const MOUNTAIN_ROWS = [0, 1, 2, 3]
const KAMO_RIVER_ROWS = [13, 14, 15]
const LAKE_BIWA_ROWS = [46, 47, 48]
const WATER_ROWS = [...KAMO_RIVER_ROWS, ...LAKE_BIWA_ROWS]
const H_STREETS = [25, 35]
const V_STREETS = [10, 30]
const BORDER_ROW = MAP_ROWS - 1

const BRIDGE_TILES = new Set()
for (const row of KAMO_RIVER_ROWS) {
  for (let col = 18; col <= 21; col++) BRIDGE_TILES.add(`${row},${col}`)
}

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
      while (V_STREETS.includes(col) || V_STREETS.includes(col + 1)) col++

      if (col + b.width - 1 > BAND_COL_END) {
        col = BAND_COL_START
        row += rowMaxH + BAND_GAP
        rowMaxH = 0
      }
      if (row + b.height - 1 > band.endRow) break

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

function kyotoTileType(row, col) {
  if (row === 0 || row === BORDER_ROW || col === 0 || col === MAP_COLS - 1) return 'wall'
  if (MOUNTAIN_ROWS.includes(row)) return 'wall'
  if (BRIDGE_TILES.has(`${row},${col}`)) return 'path'
  if (WATER_ROWS.includes(row)) return 'water'
  if (H_STREETS.includes(row) || V_STREETS.includes(col)) return 'path'
  return 'grass'
}

function buildLayout() {
  const layout = []
  for (let r = 0; r < MAP_ROWS; r++) {
    const row = []
    for (let c = 0; c < MAP_COLS; c++) row.push(kyotoTileType(r, c))
    layout.push(row)
  }
  return layout
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

export default class KyotoScene extends BaseTownScene {
  constructor() {
    super('KyotoScene', {
      cityId: 'kyoto',
      cityLabel: '⛩️ Kyoto — Shinto Pagoda District',
      mapCols: MAP_COLS,
      mapRows: MAP_ROWS,
      defaultSpawn: DEFAULT_SPAWN,
      buildings: KYOTO_PLACED_BUILDINGS,
      interiorTemplateMap: BUILDING_INTERIOR_TEMPLATE
    })
  }

  buildOverworldZone() {
    this.layout = buildLayout()

    const terrainLayer = buildTerrainLayer(this, MAP_COLS, MAP_ROWS, TILE_SIZE, (row, col) => {
      const tile = this.layout[row][col]
      if (tile === 'water') return TERRAIN_TILE_INDEX.water
      if (tile === 'path') return BRIDGE_TILES.has(`${row},${col}`) ? TERRAIN_TILE_INDEX.bridge : TERRAIN_TILE_INDEX.path
      if (tile === 'wall') return TERRAIN_TILE_INDEX.wall
      return TERRAIN_TILE_INDEX.cobblestone
    })
    this.zoneObjects.push(terrainLayer)

    this.scatterKyotoEnvironment()
    this.drawBuildings()
    this.drawToriiOverlays()
    this.drawNamedNpcs()
    this.spawnAmbientNpcs()
    this.regionLabel.setText('⛩️ Kyoto — Shinto Pagoda District')
    this.buildOverworldZones()
  }

  scatterKyotoEnvironment() {
    const forbidden = new Set()
    for (const b of KYOTO_PLACED_BUILDINGS) {
      for (let r = b.tiles.r0 - 1; r <= b.tiles.r1 + 1; r++) {
        for (let c = b.tiles.c0 - 1; c <= b.tiles.c1 + 1; c++) forbidden.add(`${r},${c}`)
      }
    }

    for (let i = 0; i < 120; i++) {
      const r = 4 + Math.floor(Math.random() * (MAP_ROWS - 6))
      const c = 1 + Math.floor(Math.random() * (MAP_COLS - 2))
      if (this.layout[r]?.[c] !== 'grass' || forbidden.has(`${r},${c}`)) continue
      const cx = c * TILE_SIZE + TILE_SIZE / 2
      const cy = r * TILE_SIZE + TILE_SIZE / 2

      let objs
      const isRiverbank = r === 12 || r === 16 || r === 45 || r === 4 || r === 5
      if (isRiverbank) {
        objs = Math.random() < 0.7 ? placeTree(this, cx, cy) : placeFlower(this, cx, cy)
      } else if (r >= 43 && r <= 45) {
        objs = placeFlower(this, cx, cy)
      } else {
        const roll = Math.random()
        if (roll < 0.65) objs = placeFlower(this, cx, cy)
        else if (roll < 0.85) objs = placeTree(this, cx, cy)
        else objs = placeRock(this, cx, cy)
      }
      if (objs) this.zoneObjects.push(...objs)
    }
  }

  drawBuildings() {
    for (const b of KYOTO_PLACED_BUILDINGS) {
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

  drawToriiOverlays() {
    const overlayGraphics = this.add.graphics().setDepth(2000)
    this.zoneObjects.push(overlayGraphics)

    const toriiBuildings = KYOTO_PLACED_BUILDINGS.filter(
      (b) => b.district === 'Temple' || b.id === 'berkshireHQ'
    )

    for (const b of toriiBuildings) {
      const x = b.tiles.c0 * TILE_SIZE
      const y = b.tiles.r0 * TILE_SIZE
      const w = (b.tiles.c1 - b.tiles.c0 + 1) * TILE_SIZE
      
      overlayGraphics.fillStyle(0xdc2626, 0.85)
      overlayGraphics.fillRect(x - 4, y - 10, w + 8, 6)
      overlayGraphics.fillStyle(0xfbbf24, 1)
      overlayGraphics.fillRect(x + w / 2 - 2, y - 14, 4, 4)
    }

    for (const row of KAMO_RIVER_ROWS) {
      const py = row * TILE_SIZE
      overlayGraphics.fillStyle(0x6a4a2a, 0.9)
      overlayGraphics.fillRect(18 * TILE_SIZE - 2, py, 2, TILE_SIZE)
      overlayGraphics.fillRect(22 * TILE_SIZE, py, 2, TILE_SIZE)
    }
    const bridgeLabel = this.add
      .text(20 * TILE_SIZE, 12 * TILE_SIZE + TILE_SIZE / 2, '🌉 Wooden Bridge', {
        fontFamily: 'monospace', fontSize: '9px', color: '#d4a017',
      })
      .setOrigin(0.5, 1)
      .setDepth(2001)
    this.zoneObjects.push(bridgeLabel)
  }

  drawNamedNpcs() {
    const npcStatus = useGameStore.getState().world2?.npcStatus || {}
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
      } while (tries < 50 && this.layout[r][c] !== 'grass' && this.layout[r][c] !== 'path')

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

  isBlockedOverworldTile(col, row) {
    if (col < 0 || col >= MAP_COLS || row < 0 || row >= MAP_ROWS) return true
    const tile = this.layout?.[row]?.[col]
    if (tile === 'wall' || tile === 'water') return true
    for (const b of KYOTO_PLACED_BUILDINGS) {
      if (col >= b.tiles.c0 && col <= b.tiles.c1 && row >= b.tiles.r0 && row <= b.tiles.r1) return true
    }
    return false
  }
}
