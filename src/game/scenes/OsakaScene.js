import BaseTownScene, { TILE_SIZE } from './BaseTownScene'
import {
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

// ---------------------------------------------------------------------------
// OsakaScene — Merchant & Underground Nightlife Hub (Extends BaseTownScene)
// Canals, dense alleyways, neon-lit entertainment, and the crime syndicate's turf.
// ---------------------------------------------------------------------------

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

function layoutOsakaBuildings() {
  const placed = []
  const GAP = 2

  // Entertainment District: rows 5-14
  const entertainment = OSAKA_BUILDINGS.filter((b) => b.district === 'Entertainment')
  let col = 2, row = 6
  for (const b of entertainment) {
    if (col + b.width > MAP_COLS - 2) { col = 2; row += 4 }
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

  // Government & Transport District: rows 36-42
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

const PLACED_BUILDINGS = layoutOsakaBuildings()

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

function osakaTileType(r, c) {
  if (r === 0 || r === MAP_ROWS - 2 || r === MAP_ROWS - 1 || c === 0 || c === MAP_COLS - 1) return 'wall'
  if (r >= 1 && r <= 3) return 'water'
  if (r === 4) return 'path'
  if (r >= 25 && r <= 26) return 'water'
  if (r === 15 || r === 35) return 'path'
  if (V_STREETS.includes(c)) return 'path'
  return 'grass'
}

function buildLayout() {
  const layout = []
  for (let r = 0; r < MAP_ROWS; r++) {
    const row = []
    for (let c = 0; c < MAP_COLS; c++) row.push(osakaTileType(r, c))
    layout.push(row)
  }
  return layout
}

export default class OsakaScene extends BaseTownScene {
  constructor() {
    super('OsakaScene', {
      cityId: 'osaka',
      cityLabel: '🐙 Osaka — Merchant & Underground Nightlife Hub',
      mapCols: MAP_COLS,
      mapRows: MAP_ROWS,
      defaultSpawn: DEFAULT_SPAWN,
      buildings: PLACED_BUILDINGS,
      interiorTemplateMap: BUILDING_INTERIOR_MAP,
    })
  }

  buildOverworldZone() {
    this.layout = buildLayout()

    const terrainLayer = buildTerrainLayer(this, MAP_COLS, MAP_ROWS, TILE_SIZE, (row, col) => {
      const tile = this.layout[row][col]
      if (tile === 'water') return TERRAIN_TILE_INDEX.water
      if (tile === 'path') return TERRAIN_TILE_INDEX.path
      if (tile === 'wall') return TERRAIN_TILE_INDEX.wall
      return TERRAIN_TILE_INDEX.grass
    })
    this.zoneObjects.push(terrainLayer)

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

    this.scatterOsakaEnvironment(60)
    this.drawBuildings()
    this.drawNeonGlowOverlay()
    this.drawDistrictLabels()
    this.drawNamedNpcs()
    this.spawnAmbientNpcs()
    this.regionLabel.setText('🐙 Osaka — Merchant & Underground Nightlife Hub')
    this.buildOverworldZones()
  }

  drawDistrictLabels() {
    const labels = [
      { text: '🎰 Entertainment District', x: (MAP_COLS * TILE_SIZE) / 2, y: 5 * TILE_SIZE - 8, color: '#ff66cc' },
      { text: '🛒 Merchant District', x: (MAP_COLS * TILE_SIZE) / 2, y: 16 * TILE_SIZE - 8, color: '#ffaa44' },
      { text: '🔪 Underground District', x: (MAP_COLS * TILE_SIZE) / 2, y: 27 * TILE_SIZE - 8, color: '#ff4444' },
      { text: '🏛️ Government & Transport', x: (MAP_COLS * TILE_SIZE) / 2, y: 36 * TILE_SIZE - 8, color: '#6699ff' },
    ]
    for (const lbl of labels) {
      const t = this.add
        .text(lbl.x, lbl.y, lbl.text, { fontFamily: 'monospace', fontSize: '11px', color: lbl.color })
        .setOrigin(0.5, 1)
        .setDepth(1500)
      this.zoneObjects.push(t)
    }
  }

  drawNeonGlowOverlay() {
    const gfx = this.add.graphics().setDepth(500)
    this.zoneObjects.push(gfx)
    for (const b of PLACED_BUILDINGS) {
      if (b.district !== 'Entertainment' && b.district !== 'Underground') continue
      const x = b.tiles.c0 * TILE_SIZE
      const y = b.tiles.r0 * TILE_SIZE
      const w = (b.tiles.c1 - b.tiles.c0 + 1) * TILE_SIZE
      const h = (b.tiles.r1 - b.tiles.r0 + 1) * TILE_SIZE
      const neonColors = [0xff00ff, 0x00ffff, 0xff4400, 0xffff00]
      const neon = neonColors[Math.floor(Math.random() * neonColors.length)]
      gfx.lineStyle(2, neon, 0.6)
      gfx.strokeRect(x - 1, y - 1, w + 2, h + 2)
      gfx.fillStyle(neon, 0.15)
      gfx.fillRect(x, y + h, w, 4)
    }
  }

  scatterOsakaEnvironment(count) {
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
      const cx = c * TILE_SIZE + TILE_SIZE / 2
      const cy = r * TILE_SIZE + TILE_SIZE / 2
      if (Math.random() > 0.35) continue
      let objs
      const roll = Math.random()
      if (roll < 0.5) objs = placeRock(this, cx, cy)
      else if (roll < 0.8) objs = placeFlower(this, cx, cy)
      else objs = placeTree(this, cx, cy)
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

  drawNamedNpcs() {
    const npcStatus = useGameStore.getState().world2?.npcStatus || {}
    for (const b of PLACED_BUILDINGS) {
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
    const npcs = generateAmbientNpcs('osaka_ambient', 6)
    this.ambientActors = npcs.map((npc, i) => {
      let r, c, tries = 0
      do {
        r = 5 + Math.floor(Math.random() * (MAP_ROWS - 8))
        c = 1 + Math.floor(Math.random() * (MAP_COLS - 2))
        tries++
      } while (tries < 50 && this.layout[r][c] !== 'grass' && this.layout[r][c] !== 'path')

      const actor = new SpriteActor(
        this,
        c * TILE_SIZE + TILE_SIZE / 2,
        r * TILE_SIZE + TILE_SIZE / 2,
        `npc_osaka_amb_${i}`,
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
    if (this.layout[row][col] === 'wall' || this.layout[row][col] === 'water') return true
    for (const b of PLACED_BUILDINGS) {
      if (col >= b.tiles.c0 && col <= b.tiles.c1 && row >= b.tiles.r0 && row <= b.tiles.r1) return true
    }
    return false
  }
}
