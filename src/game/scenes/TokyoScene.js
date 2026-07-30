import BaseTownScene, { TILE_SIZE } from './BaseTownScene'
import {
  buildTerrainLayer,
  placeRock,
  placeBuildingFacade,
} from '../tileGen'
import { FINANCE_NPCS } from '../../features/finance/financeNpcs'
import { useGameStore } from '../../store/useGameStore'
import { SpriteActor } from '../actor'
import { generateAmbientNpcs } from '../../utils/npcGenerator'

const MAP_COLS = 40
const MAP_ROWS = 45
const DEFAULT_SPAWN = { col: 7, row: 5 }

const WATER_ROWS = [1, 2, 3]
const H_STREETS = [4, 13, 22, 31]
const V_STREETS = [7, 33]

const TOKYO_BUILDINGS = [
  // Financial District - trading venues, tycoon HQs, and every other
  // corporate HQ (private companies aren't government buildings just
  // because they used to share a row with Parliament/FTC/Fed).
  { id: 'stockExchange',  label: 'Tokyo Stock Exchange',     district: 'Financial',  color: 0x1f5f3a, width: 3, height: 3 },
  { id: 'buffettHQ',      label: 'Buffett Tower',             district: 'Financial',  color: 0x555555, width: 3, height: 3, npcId: 'buffett' },
  { id: 'vanderbiltHQ',   label: 'Vanderbilt Rail Co.',      district: 'Financial',  color: 0x6b4a2a, width: 3, height: 3, npcId: 'vanderbilt' },
  { id: 'muskHQ',         label: 'Musk Industries',          district: 'Financial',  color: 0x2a2a2a, width: 3, height: 3, npcId: 'musk' },
  { id: 'howardMarksHQ',  label: 'Oaktree Cycle Capital',    district: 'Financial',  color: 0x2a4f4a, width: 4, height: 3, npcId: 'howardmarks' },
  { id: 'cryptoExchange', label: 'Crypto HQ',                district: 'Financial',  color: 0x8a5a1f, width: 4, height: 3 },
  { id: 'corporateOffice', label: 'Corporate Holdings',      district: 'Financial',  color: 0x4a3a5f, width: 4, height: 3 },
  { id: 'vcHub',          label: 'Venture Capital Hub',      district: 'Financial',  color: 0x2a3a6b, width: 3, height: 3 },
  { id: 'appleHQ',        label: 'Apple Glass HQ',           district: 'Financial',  color: 0xc0c0c0, width: 4, height: 3, npcId: 'jobs' },
  // Commercial District
  { id: 'bank',           label: 'Bank & Realty Office',     district: 'Commercial', color: 0x1f3a5f, width: 4, height: 3 },
  { id: 'realEstateAgency', label: 'Real Estate Agency',     district: 'Commercial', color: 0x3a5f4a, width: 4, height: 3 },
  { id: 'hotel',          label: 'Capital Suites Hotel',     district: 'Commercial', color: 0x8a6a2a, width: 4, height: 3 },
  { id: 'casino',         label: 'Neon Dragon Casino',       district: 'Commercial', color: 0x8a1f6a, width: 3, height: 3 },
  { id: 'arcade',         label: 'Pixel Palace Arcade',      district: 'Commercial', color: 0x1f6a8a, width: 3, height: 3 },
  // Government District - regulatory/political only. FTC/Federal Reserve
  // were removed from the map (they had no interior wired to any modal -
  // both functions are already fully reachable through the "Gov & Agencies"
  // toolbar button/GovernmentModal, so the physical buildings were dead
  // weight rather than a second entry point).
  { id: 'parliament',     label: 'Parliament Hall',          district: 'Government', color: 0x3a3a6a, width: 4, height: 3 },
  // Cultural District
  { id: 'park',           label: 'Serenity Park',            district: 'Cultural',   color: 0x2a5f2a, width: 4, height: 2 },
  { id: 'temple',         label: 'Whispering Temple',        district: 'Cultural',   color: 0x5a5a4a, width: 4, height: 2 },
  { id: 'trainStation',   label: '🚆 Train Station',        district: 'Transport',  color: 0x4a6fa5, width: 3, height: 3 },
]

const DISTRICT_BANDS = [
  { name: 'Financial',  startRow: 5,  endRow: 12 },
  { name: 'Commercial', startRow: 14, endRow: 21 },
  { name: 'Government', startRow: 23, endRow: 30 },
  { name: 'Cultural',   startRow: 32, endRow: 38 },
  { name: 'Transport',  startRow: 39, endRow: 42 },
]

function layoutBuildings() {
  const placed = []
  for (const band of DISTRICT_BANDS) {
    const defs = TOKYO_BUILDINGS.filter((b) => b.district === band.name)
    let col = 1
    let row = band.startRow
    let rowMaxH = 0

    for (const b of defs) {
      if (V_STREETS.includes(col)) col++
      if (col + b.width > V_STREETS[0] && col < V_STREETS[0] + 1 && !V_STREETS.includes(col)) {}

      if (col + b.width > MAP_COLS - 1) {
        col = 1
        row += rowMaxH + 1
        rowMaxH = 0
      }

      let adjustedCol = col
      for (const vs of V_STREETS) {
        if (adjustedCol <= vs && adjustedCol + b.width > vs) adjustedCol = vs + 1
      }
      if (adjustedCol + b.width > MAP_COLS - 1) {
        adjustedCol = 1
        row += rowMaxH + 1
        rowMaxH = 0
      }

      if (row + b.height - 1 > band.endRow) break

      const c0 = adjustedCol
      const r0 = row
      const c1 = c0 + b.width - 1
      const r1 = r0 + b.height - 1
      placed.push({ ...b, tiles: { c0, r0, c1, r1 } })
      col = c1 + 2
      rowMaxH = Math.max(rowMaxH, b.height)
    }
  }
  return placed
}

const PLACED_BUILDINGS = layoutBuildings()

const BUILDING_INTERIOR_MAP = {
  stockExchange: 'exchange',
  casino: 'casinoFloor',
  cryptoExchange: 'cryptoHQ',
  buffettHQ: 'tycoonOffice',
  vanderbiltHQ: 'tycoonOffice',
  muskHQ: 'tycoonOffice',
  howardMarksHQ: 'tycoonOffice',
  appleHQ: 'tycoonOffice',
  bank: 'officeA',
  realEstateAgency: 'officeA',
  corporateOffice: 'officeB',
  vcHub: 'officeB',
  hotel: 'amenity',
  arcade: 'amenity',
  parliament: 'amenity',
  park: 'amenity',
  temple: 'amenity',
  trainStation: 'amenity',
}

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

export default class TokyoScene extends BaseTownScene {
  constructor() {
    super('TokyoScene', {
      cityId: 'tokyo',
      cityLabel: '🏛️ Tokyo — Luxury Financial District',
      mapCols: MAP_COLS,
      mapRows: MAP_ROWS,
      defaultSpawn: DEFAULT_SPAWN,
      buildings: PLACED_BUILDINGS,
      interiorTemplateMap: BUILDING_INTERIOR_MAP
    })
  }
  
  buildOverworldZone() {
    this.layout = buildLayout()
    const terrainLayer = buildTerrainLayer(this, MAP_COLS, MAP_ROWS, TILE_SIZE, (row, col) => {
      const tile = this.layout[row][col]
      if (tile === 'water') return 'water'
      if (tile === 'path') return 'path'
      if (tile === 'wall') return 'wall'
      return 'slate'
    })
    this.zoneObjects.push(terrainLayer)

    this.scatterEnvironment(40)
    this.drawBuildings()
    this.drawGoldAccentOverlay()
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
      g.lineStyle(3, 0xf59e0b, 0.9)
      g.strokeRect(x, y, w, h)
      g.fillStyle(0xf59e0b, 0.3)
      g.fillRect(x, y - 4, w, 4)
    }
  }

  drawNamedNpcs() {
    const npcStatus = useGameStore.getState().world2?.npcStatus || {}
    for (const b of PLACED_BUILDINGS) {
      if (!b.npcId) continue
      if (npcStatus[b.npcId] === 'dead') continue
      const npc = FINANCE_NPCS.find((n) => n.id === b.npcId)
      if (!npc) continue
      const cx = b.tiles.c0 * TILE_SIZE + (b.tiles.c1 - b.tiles.c0 + 1) * TILE_SIZE / 2
      const cy = (b.tiles.r1 + 1) * TILE_SIZE + TILE_SIZE / 2
      const actor = new SpriteActor(this, cx, cy, `npc_${npc.id}`, npc.palette)
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

  isBlockedOverworldTile(col, row) {
    if (col < 0 || col >= MAP_COLS || row < 0 || row >= MAP_ROWS) return true
    if (this.layout[row][col] === 'wall' || this.layout[row][col] === 'water') return true
    for (const b of PLACED_BUILDINGS) {
      if (col >= b.tiles.c0 && col <= b.tiles.c1 && row >= b.tiles.r0 && row <= b.tiles.r1) return true
    }
    return false
  }
}
