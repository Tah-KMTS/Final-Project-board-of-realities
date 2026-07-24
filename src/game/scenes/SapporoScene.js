import Phaser from 'phaser'
import BaseTownScene, {
  TILE_SIZE,
  INTERIOR_DESK,
  drawInteriorRoom,
  interiorExitZone,
} from './BaseTownScene'
import {
  buildTerrainLayer,
  TERRAIN_TILE_INDEX,
  placeTree,
  placeFlower,
  placeRock,
  placeBuildingFacade,
  addScreenVignette,
} from '../tileGen'
import { FINANCE_NPCS } from '../../features/finance/financeNpcs'
import { getCityById } from '../../features/world/japanCities'
import { useGameStore } from '../../store/useGameStore'
import { SpriteActor } from '../actor'
import { generateAmbientNpcs } from '../../utils/npcGenerator'

const MAP_COLS = 40
const MAP_ROWS = 45
const DEFAULT_SPAWN = { col: 10, row: 8 }

// Vertical & Horizontal streets & natural water features
const V_STREETS = [10, 30]
const H_STREETS = [15, 26, 36]
const ISHIKARI_RIVER_ROWS = [24, 25]
const LAKE_SHIKOTSU_ROWS = [37, 38, 39, 40, 41]
const LAKE_SHIKOTSU_COLS = [28, 29, 30, 31, 32, 33, 34, 35, 36]

const BRIDGE_TILES = new Set()
for (const row of ISHIKARI_RIVER_ROWS) {
  for (let col = 9; col <= 11; col++) BRIDGE_TILES.add(`${row},${col}`)
  for (let col = 29; col <= 31; col++) BRIDGE_TILES.add(`${row},${col}`)
}

// Landmark and Building definitions from japanCities.js Sapporo profile
const SAPPORO_CITY_DATA = getCityById('sapporo')

const SAPPORO_BUILDINGS = [
  // Heavy Industry District (Henry Ford, Andrew Carnegie, John D. Rockefeller)
  {
    id: 'fordRougeComplex',
    label: 'Ford River Rouge Assembly Complex',
    district: 'Heavy Industry',
    color: 0x3a4a5a,
    width: 4,
    height: 3,
    npcId: 'ford',
  },
  {
    id: 'carnegieSteelMill',
    label: 'Homestead Steel Mill',
    district: 'Heavy Industry',
    color: 0x5a3a2a,
    width: 4,
    height: 3,
    npcId: 'carnegie',
  },
  {
    id: 'standardOilRefinery',
    label: 'Standard Oil Central Refinery',
    district: 'Heavy Industry',
    color: 0x2a3a3a,
    width: 4,
    height: 3,
    npcId: 'rockefeller',
  },

  // Federal Procurement District (Robert McNamara, William Ruckelshaus)
  {
    id: 'pentagonDodHQ',
    label: 'Pentagon Military Procurement HQ',
    district: 'Federal Procurement',
    color: 0x2a4a6a,
    width: 4,
    height: 3,
    npcId: 'mcnamara',
  },
  {
    id: 'epaHQ',
    label: 'EPA Environmental Regulation Agency',
    district: 'Federal Procurement',
    color: 0x2a5a3a,
    width: 4,
    height: 3,
    npcId: 'ruckelshaus',
  },

  // Alpine Town & Culture District
  {
    id: 'sapporoBrewery',
    label: 'Sapporo Alpine Snow Brewery',
    district: 'Alpine Town',
    color: 0x8a6a2a,
    width: 3,
    height: 2,
  },
  {
    id: 'alpineLodge',
    label: 'Mount Yotei Alpine Lodge',
    district: 'Alpine Town',
    color: 0x6a4a3a,
    width: 4,
    height: 3,
  },

  // Transport District
  {
    id: 'trainStation',
    label: '🚆 Sapporo Central Station',
    district: 'Transport',
    color: 0x4a6fa5,
    width: 3,
    height: 3,
  },
]

const DISTRICT_BANDS = {
  'Heavy Industry': { startRow: 5, endRow: 14 },
  'Federal Procurement': { startRow: 16, endRow: 23 },
  'Alpine Town': { startRow: 27, endRow: 35 },
  Transport: { startRow: 37, endRow: 42 },
}

function layoutSapporoBuildings() {
  const placed = []
  const GAP = 2

  for (const [district, band] of Object.entries(DISTRICT_BANDS)) {
    const defs = SAPPORO_BUILDINGS.filter((b) => b.district === district)
    let col = 2
    let row = band.startRow
    let rowMaxH = 0

    for (const b of defs) {
      if (V_STREETS.some((vs) => col <= vs && col + b.width > vs)) {
        col = V_STREETS.find((vs) => col <= vs) + 1
      }

      if (col + b.width > MAP_COLS - 2) {
        col = 2
        row += rowMaxH + GAP
        rowMaxH = 0
      }

      if (row + b.height - 1 > band.endRow) break

      const c0 = col
      const r0 = row
      const c1 = col + b.width - 1
      const r1 = row + b.height - 1
      placed.push({ ...b, tiles: { c0, r0, c1, r1 } })
      col += b.width + GAP
      rowMaxH = Math.max(rowMaxH, b.height)
    }
  }
  return placed
}

const SAPPORO_PLACED_BUILDINGS = layoutSapporoBuildings()

const SAPPORO_INTERIOR_MAP = {
  fordRougeComplex: 'industrial',
  carnegieSteelMill: 'industrial',
  standardOilRefinery: 'industrial',
  pentagonDodHQ: 'government',
  epaHQ: 'government',
  sapporoBrewery: 'cozyLodge',
  alpineLodge: 'cozyLodge',
  trainStation: 'amenity',
}

const SAPPORO_NPCS_DEF = {
  ford: FINANCE_NPCS.find((n) => n.id === 'ford'),
  carnegie: FINANCE_NPCS.find((n) => n.id === 'carnegie'),
  rockefeller: FINANCE_NPCS.find((n) => n.id === 'rockefeller'),
  mcnamara: {
    id: 'mcnamara',
    name: 'Robert McNamara',
    title: 'Secretary of Defense & DOD Procurement',
    palette: { skin: '#f1c27d', hair: '#7f8c8d', outfit: '#1b365d', hairStyle: 'Short' },
  },
  ruckelshaus: {
    id: 'ruckelshaus',
    name: 'William Ruckelshaus',
    title: '1st EPA Administrator',
    palette: { skin: '#e0ac69', hair: '#555555', outfit: '#1e4d2b', hairStyle: 'Short' },
  },
}

function sapporoTileType(row, col) {
  // Borders & Snow Mountain Peaks
  if (row <= 3 || row === MAP_ROWS - 1 || col === 0 || col === MAP_COLS - 1) return 'wall'
  // Ishikari River Basin
  if (BRIDGE_TILES.has(`${row},${col}`)) return 'path'
  if (ISHIKARI_RIVER_ROWS.includes(row)) return 'water'
  // Lake Shikotsu Crater
  if (LAKE_SHIKOTSU_ROWS.includes(row) && LAKE_SHIKOTSU_COLS.includes(col)) return 'water'
  // Streets
  if (H_STREETS.includes(row) || V_STREETS.includes(col)) return 'path'
  return 'grass'
}

function buildLayout() {
  const layout = []
  for (let r = 0; r < MAP_ROWS; r++) {
    const row = []
    for (let c = 0; c < MAP_COLS; c++) row.push(sapporoTileType(r, c))
    layout.push(row)
  }
  return layout
}

export default class SapporoScene extends BaseTownScene {
  constructor() {
    super('SapporoScene', {
      cityId: 'sapporo',
      cityLabel: '🏔️ Sapporo — Northern Industrial & Alpine Region',
      mapCols: MAP_COLS,
      mapRows: MAP_ROWS,
      defaultSpawn: DEFAULT_SPAWN,
      buildings: SAPPORO_PLACED_BUILDINGS,
      interiorTemplateMap: SAPPORO_INTERIOR_MAP,
    })
  }

  preload() {
    super.preload()
    this.preloadSapporoAssets()
  }

  preloadSapporoAssets() {
    const L = this.load
    const sereneBase = '/assets/packs/Serene_Village_revamped_v1.9/SERENE_VILLAGE_REVAMPED'
    const modernBase = '/assets/packs/Modern_Interiors_Free_v2.2/Modern%20tiles_Free/Interiors_free'

    // Serene Village environment pack assets for cozy Stardew Valley aesthetic
    if (!this.textures.exists('serene_village_32')) {
      L.image('serene_village_32', `${sereneBase}/Serene_Village_32x32.png`)
    }
    if (!this.textures.exists('serene_outside_stuff')) {
      L.image('serene_outside_stuff', `${sereneBase}/RPG_MAKER_MV/Outside_Stuff_TILESET_B-C-D-E.png`)
    }
    if (!this.textures.exists('serene_houses_mv')) {
      L.image('serene_houses_mv', `${sereneBase}/RPG_MAKER_MV/Houses_TILESET_B-C-D-E.png`)
    }
    if (!this.textures.exists('serene_campfire_32')) {
      L.spritesheet('serene_campfire_32', `${sereneBase}/Animated%20stuff/campfire_32x32.png`, {
        frameWidth: 32,
        frameHeight: 32,
      })
    }

    // Modern Interiors free pack assets for building interior rooms
    if (!this.textures.exists('modern_interiors_32')) {
      L.image('modern_interiors_32', `${modernBase}/32x32/Interiors_free_32x32.png`)
    }
    if (!this.textures.exists('modern_room_builder_32')) {
      L.image('modern_room_builder_32', `${modernBase}/32x32/Room_Builder_free_32x32.png`)
    }
  }

  buildOverworldZone() {
    this.layout = buildLayout()

    // Base terrain layer (Grass, path, water, snow peaks, walls)
    const terrainLayer = buildTerrainLayer(this, MAP_COLS, MAP_ROWS, TILE_SIZE, (row, col) => {
      const tile = this.layout[row][col]
      if (tile === 'water') return TERRAIN_TILE_INDEX.water
      if (tile === 'path') return TERRAIN_TILE_INDEX.path
      if (tile === 'wall') return row <= 3 ? TERRAIN_TILE_INDEX.snow : TERRAIN_TILE_INDEX.wall
      return TERRAIN_TILE_INDEX.grass
    })
    this.zoneObjects.push(terrainLayer)

    // Cozy Stardew Valley environment scattering (Serene Village assets)
    this.scatterCozyEnvironment()

    // Draw Buildings
    this.drawBuildings()

    // Draw District Labels & Bridges
    this.drawDistrictLabelsAndBridges()

    // Add Screen Vignette for atmosphere
    this.zoneObjects.push(addScreenVignette(this, MAP_COLS * TILE_SIZE, MAP_ROWS * TILE_SIZE))

    // Named & Ambient NPCs
    this.drawNamedNpcs()
    this.spawnAmbientNpcs()

    this.regionLabel.setText('🏔️ Sapporo — Northern Industrial & Alpine Region')
    this.buildOverworldZones()
  }

  scatterCozyEnvironment() {
    const forbidden = new Set()
    for (const b of SAPPORO_PLACED_BUILDINGS) {
      for (let r = b.tiles.r0 - 1; r <= b.tiles.r1 + 1; r++) {
        for (let c = b.tiles.c0 - 1; c <= b.tiles.c1 + 1; c++) forbidden.add(`${r},${c}`)
      }
    }

    // Place cozy campfires near Alpine Lodge and Sapporo Brewery
    const campfirePositions = [
      { col: 18, row: 30 },
      { col: 24, row: 32 },
      { col: 8, row: 10 },
    ]

    for (const pos of campfirePositions) {
      const cx = pos.col * TILE_SIZE + TILE_SIZE / 2
      const cy = pos.row * TILE_SIZE + TILE_SIZE / 2

      // Warm fire light glow circle
      const glow = this.add.graphics()
      glow.fillStyle(0xff8800, 0.25)
      glow.fillCircle(cx, cy, 32)
      glow.setDepth(cy - 2)
      this.zoneObjects.push(glow)

      if (this.textures.exists('serene_campfire_32')) {
        const fire = this.add.sprite(cx, cy, 'serene_campfire_32', 0).setScale(1.2)
        fire.setDepth(cy)
        this.zoneObjects.push(fire)
      } else {
        const rock = placeRock(this, cx, cy)
        if (rock) this.zoneObjects.push(...rock)
      }
    }

    // Scatter pine trees, flowers, and rustic rocks across alpine fields
    for (let i = 0; i < 90; i++) {
      const r = 4 + Math.floor(Math.random() * (MAP_ROWS - 6))
      const c = 1 + Math.floor(Math.random() * (MAP_COLS - 2))
      if (this.layout[r]?.[c] !== 'grass' || forbidden.has(`${r},${c}`)) continue
      const cx = c * TILE_SIZE + TILE_SIZE / 2
      const cy = r * TILE_SIZE + TILE_SIZE / 2

      let objs
      const roll = Math.random()
      if (roll < 0.5) objs = placeTree(this, cx, cy)
      else if (roll < 0.8) objs = placeFlower(this, cx, cy)
      else objs = placeRock(this, cx, cy)

      if (objs) this.zoneObjects.push(...objs)
    }
  }

  drawBuildings() {
    for (const b of SAPPORO_PLACED_BUILDINGS) {
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

  drawDistrictLabelsAndBridges() {
    const labels = [
      { text: '🏭 Heavy Industry District', x: (MAP_COLS * TILE_SIZE) / 2, y: 5 * TILE_SIZE - 8, color: '#90caf9' },
      { text: '🏛️ Federal Procurement District', x: (MAP_COLS * TILE_SIZE) / 2, y: 16 * TILE_SIZE - 8, color: '#a5d6a7' },
      { text: '🏞️ Ishikari River Basin', x: 20 * TILE_SIZE, y: 24 * TILE_SIZE - 6, color: '#80deea' },
      { text: '🏔️ Mount Yotei Alpine District', x: (MAP_COLS * TILE_SIZE) / 2, y: 27 * TILE_SIZE - 8, color: '#ffe082' },
      { text: '🌊 Lake Shikotsu Crater', x: 32 * TILE_SIZE, y: 37 * TILE_SIZE - 6, color: '#81d4fa' },
    ]
    for (const lbl of labels) {
      const t = this.add
        .text(lbl.x, lbl.y, lbl.text, { fontFamily: 'monospace', fontSize: '11px', color: lbl.color })
        .setOrigin(0.5, 1)
        .setDepth(1500)
      this.zoneObjects.push(t)
    }

    // Bridge visual overlay
    const overlay = this.add.graphics().setDepth(1200)
    this.zoneObjects.push(overlay)
    for (const row of ISHIKARI_RIVER_ROWS) {
      for (const col of [10, 30]) {
        const px = col * TILE_SIZE
        const py = row * TILE_SIZE
        overlay.fillStyle(0x795548, 0.9)
        overlay.fillRect(px - 16, py, 48, TILE_SIZE)
        overlay.fillStyle(0xd7ccc8, 1)
        overlay.fillRect(px - 16, py, 4, TILE_SIZE)
        overlay.fillRect(px + 28, py, 4, TILE_SIZE)
      }
    }
  }

  buildGenericInteriorZone(buildingId) {
    const building = SAPPORO_PLACED_BUILDINGS.find((b) => b.id === buildingId)
    const templateKey = SAPPORO_INTERIOR_MAP[buildingId] || 'amenity'

    const templateConfigs = {
      industrial: { floorA: 0x1c2526, floorB: 0x141b1c, deskColor: 0x3a4a5a, deskLabel: 'Industrial Assembly Console' },
      government: { floorA: 0x182430, floorB: 0x121c26, deskColor: 0x2a4a6a, deskLabel: 'Procurement Command Desk' },
      cozyLodge: { floorA: 0x2e1f18, floorB: 0x241812, deskColor: 0x6a4a3a, deskLabel: 'Alpine Reception Desk' },
      amenity: { floorA: 0x201c28, floorB: 0x1b1822, deskColor: 0x4a6fa5, deskLabel: 'Ticket Desk' },
    }

    const template = templateConfigs[templateKey] || templateConfigs.amenity

    // Render floor and desk base
    drawInteriorRoom(this, this.zoneObjects, template)

    // Add Modern Interiors detail graphics overlay (servers, monitors, desks)
    const interiorDecorGfx = this.add.graphics().setDepth(50)
    this.zoneObjects.push(interiorDecorGfx)

    if (templateKey === 'industrial') {
      // Control panel / screen monitors overlay
      interiorDecorGfx.fillStyle(0x00e676, 0.8)
      interiorDecorGfx.fillRect(5 * TILE_SIZE + 4, 2 * TILE_SIZE + 4, 16, 10)
      interiorDecorGfx.fillRect(6 * TILE_SIZE + 4, 2 * TILE_SIZE + 4, 16, 10)
    } else if (templateKey === 'government') {
      // DOD / EPA seal carpet accent
      interiorDecorGfx.lineStyle(2, 0x64b5f6, 0.6)
      interiorDecorGfx.strokeCircle(6 * TILE_SIZE, 5 * TILE_SIZE, 36)
    } else if (templateKey === 'cozyLodge') {
      // Warm hearth rug accent
      interiorDecorGfx.fillStyle(0xd32f2f, 0.4)
      interiorDecorGfx.fillRect(4 * TILE_SIZE, 5 * TILE_SIZE, 4 * TILE_SIZE, 2 * TILE_SIZE)
    }

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
      interiorExitZone(this.townConfig.cityLabel || 'Sapporo'),
    ]
  }

  drawNamedNpcs() {
    const npcStatus = useGameStore.getState().world2?.npcStatus || {}
    this.namedNpcActors = {}

    for (const b of SAPPORO_PLACED_BUILDINGS) {
      if (!b.npcId) continue
      if (npcStatus[b.npcId] === 'dead') continue

      const npcDef = SAPPORO_NPCS_DEF[b.npcId] || FINANCE_NPCS.find((n) => n.id === b.npcId)
      if (!npcDef) continue

      const cx = b.tiles.c0 * TILE_SIZE + ((b.tiles.c1 - b.tiles.c0 + 1) * TILE_SIZE) / 2
      const cy = (b.tiles.r1 + 1) * TILE_SIZE + TILE_SIZE / 2
      const actor = new SpriteActor(this, cx, cy, `npc_sapporo_${npcDef.id}`, npcDef.palette)
      this.namedNpcActors[npcDef.id] = actor
    }
  }

  spawnAmbientNpcs() {
    const npcs = generateAmbientNpcs('sapporo_ambient', 8)
    this.ambientActors = npcs.map((npc, i) => {
      let r, c, tries = 0
      do {
        r = 5 + Math.floor(Math.random() * (MAP_ROWS - 8))
        c = 1 + Math.floor(Math.random() * (MAP_COLS - 2))
        tries++
      } while (tries < 50 && this.layout[r]?.[c] !== 'grass' && this.layout[r]?.[c] !== 'path')

      const actor = new SpriteActor(
        this,
        c * TILE_SIZE + TILE_SIZE / 2,
        r * TILE_SIZE + TILE_SIZE / 2,
        `npc_sapporo_amb_${i}`,
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
    for (const b of SAPPORO_PLACED_BUILDINGS) {
      if (col >= b.tiles.c0 && col <= b.tiles.c1 && row >= b.tiles.r0 && row <= b.tiles.r1) return true
    }
    return false
  }
}
