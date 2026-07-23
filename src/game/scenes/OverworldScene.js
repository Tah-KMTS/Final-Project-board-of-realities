import Phaser from 'phaser'
import { useGameStore } from '../../store/useGameStore'
import { resolvePalette } from '../characterPalettes'
import { generateAmbientNpcs } from '../../utils/npcGenerator'
import { FINANCE_NPCS } from '../../features/finance/financeNpcs'
import { SpriteActor } from '../actor'
import { TileMover, combineDirection } from '../tileMover'
import {
  drawGrassTile,
  drawSlateMarbleTile,
  drawCobblestoneTile,
  drawRoadTile,
  drawWaterTile,
  drawTree,
  drawFlower,
  drawRock,
  drawBuildingFacade,
  addScreenVignette,
} from '../tileGen'

// ---------------------------------------------------------------------------
// OverworldScene is the single walkable map for Capital Syndicate (the
// Finance world). Zones: the outdoor `overworld` map, the Stock Exchange's
// own bespoke `stockExchangeInterior` trading floor, and a generic
// `buildingInterior` room (see INTERIOR_TEMPLATES) reused by every other
// building - which template a given building gets is looked up from
// BUILDING_INTERIOR_TEMPLATE. Walking up to any of the 19 buildings and
// pressing E swaps into its interior in place (same scene, same Phaser.Game
// instance, same technique DominoWorldScene uses for its own rooms); the
// desk inside emits the exact same `{type:'building', id, npcId}` interact
// payload the buildings used to emit instantly, so WorldScreen.jsx's modal
// wiring needed zero changes.
// ---------------------------------------------------------------------------

const TILE_SIZE = 40
const DEFAULT_SPAWN = { col: 7, row: 1 }

// ---------------- Capital Syndicate: 4-district Financial region ----------------
// Each district is a self-contained horizontal band, stacked top to bottom
// in DISTRICT_ORDER, with a grass gap (>= BAND_GAP tiles) between bands for
// a street. Buildings within a band are packed left-to-right and wrap to a
// second row once they'd cross BAND_COL_END - laid out by layoutFinanceMap()
// below rather than hand-placed, so there's no risk of two buildings (or a
// building and the map border) overlapping as the roster changes. Verified
// with a standalone overlap/bounds check before wiring this in, not just
// eyeballed.
const DISTRICT_ORDER = ['Financial District', 'Commercial District', 'Underground District', 'Government & Cultural District']

const FINANCE_BUILDING_DEFS = [
  // --- Financial District (Stock Exchange, tycoon HQs, Crypto HQ, VC Hub) ---
  { id: 'stockExchange', label: 'Stock Exchange', district: 'Financial District', color: 0x1f5f3a, width: 3, height: 3 },
  { id: 'buffettHQ', label: 'Buffett Tower', district: 'Financial District', color: 0x555555, width: 3, height: 3, npcId: 'buffett' },
  { id: 'vanderbiltHQ', label: 'Vanderbilt Rail Co.', district: 'Financial District', color: 0x6b4a2a, width: 3, height: 3, npcId: 'vanderbilt' },
  { id: 'muskHQ', label: 'Musk Industries', district: 'Financial District', color: 0x2a2a2a, width: 3, height: 3, npcId: 'musk' },
  { id: 'howardMarksHQ', label: 'Oaktree Cycle Capital', district: 'Financial District', color: 0x2a4f4a, width: 4, height: 3, npcId: 'howardmarks' },
  { id: 'vcHub', label: 'Venture Capital Hub', district: 'Financial District', color: 0x2a3a6b, width: 3, height: 3 },
  { id: 'corporateOffice', label: 'Corporate Holdings', district: 'Financial District', color: 0x4a3a5f, width: 4, height: 3 },
  { id: 'cryptoExchange', label: 'Crypto HQ', district: 'Financial District', color: 0x8a5a1f, width: 4, height: 3 },

  // --- Commercial District (Banks, Real Estate, Casino, Arcade, Hotel) ---
  { id: 'bank', label: 'Bank & Realty Office', district: 'Commercial District', color: 0x1f3a5f, width: 4, height: 3 },
  { id: 'realEstateAgency', label: 'Real Estate Agency', district: 'Commercial District', color: 0x3a5f4a, width: 4, height: 3 },
  { id: 'hotel', label: 'Capital Suites Hotel', district: 'Commercial District', color: 0x8a6a2a, width: 4, height: 3 },
  { id: 'casino', label: 'Neon Dragon Casino', district: 'Commercial District', color: 0x8a1f6a, width: 3, height: 3 },
  { id: 'arcade', label: 'Pixel Palace Arcade', district: 'Commercial District', color: 0x1f6a8a, width: 3, height: 3 },

  // --- Underground District (Crime Alley, Black Market, Call Center Ops) ---
  { id: 'crimeAlley', label: 'Crime Alley', district: 'Underground District', color: 0x6a1f1f, width: 4, height: 2 },
  { id: 'blackMarket', label: 'Black Market', district: 'Underground District', color: 0x4a1f6a, width: 3, height: 2 },
  { id: 'callCenterOps', label: 'Call Center Ops', district: 'Underground District', color: 0x6a5a1f, width: 3, height: 2 },

  // --- Government & Cultural District (Parliament, Park, Temple) ---
  { id: 'parliament', label: 'Parliament Hall', district: 'Government & Cultural District', color: 0x3a3a6a, width: 4, height: 2 },
  { id: 'park', label: 'Serenity Park', district: 'Government & Cultural District', color: 0x2a5f2a, width: 4, height: 2 },
  { id: 'temple', label: 'Whispering Temple', district: 'Government & Cultural District', color: 0x5a5a4a, width: 4, height: 2 },
]

const BAND_COL_START = 2
const BAND_COL_END_FROM_RIGHT = 3 // BAND_COL_END = MAP_COLS - this
const BAND_GAP = 4 // tiles between buildings, and between a band's bottom and the next band's top
const MAP_TOP_MARGIN = 2 // wall row + a clear spawn/buffer row before the first band

function layoutFinanceMap(mapCols) {
  const bandColEnd = mapCols - BAND_COL_END_FROM_RIGHT
  const buildings = []
  const districtBandRows = {}
  let cursorRow = MAP_TOP_MARGIN
  for (const district of DISTRICT_ORDER) {
    const defs = FINANCE_BUILDING_DEFS.filter((b) => b.district === district)
    let col = BAND_COL_START
    let row = cursorRow
    let rowMaxHeight = 0
    const bandTop = cursorRow
    for (const b of defs) {
      if (col + b.width - 1 > bandColEnd) {
        col = BAND_COL_START
        row += rowMaxHeight + BAND_GAP
        rowMaxHeight = 0
      }
      const c0 = col
      const r0 = row
      const c1 = col + b.width - 1
      const r1 = row + b.height - 1
      buildings.push({ ...b, tiles: { c0, r0, c1, r1 } })
      col += b.width + BAND_GAP
      rowMaxHeight = Math.max(rowMaxHeight, b.height)
    }
    const bandBottom = row + rowMaxHeight - 1
    districtBandRows[district] = { top: bandTop, bottom: bandBottom }
    cursorRow = bandBottom + BAND_GAP + 1
  }
  const lastBottom = districtBandRows[DISTRICT_ORDER[DISTRICT_ORDER.length - 1]].bottom
  const mapRows = lastBottom + 3 // clear buffer row + bottom wall row

  // One horizontal street laid across the middle of the grass gap between
  // each pair of adjacent bands.
  const hStreets = []
  for (let i = 0; i < DISTRICT_ORDER.length - 1; i++) {
    const gapTop = districtBandRows[DISTRICT_ORDER[i]].bottom + 1
    const gapBottom = districtBandRows[DISTRICT_ORDER[i + 1]].top - 1
    hStreets.push(Math.round((gapTop + gapBottom) / 2))
  }

  return { buildings, mapRows, hStreets }
}

const MAP_COLS = 40
const { buildings: FINANCE_BUILDINGS, mapRows: MAP_ROWS, hStreets: FINANCE_H_STREETS } = layoutFinanceMap(MAP_COLS)
// Two vertical corridors: col 7 is the spawn column, col 33 is the far-side
// expressway running from the coastal water channel to the city south gate.
const FINANCE_V_STREETS = [7, 33]
// Rows 1-3 along the top edge represent the coastal sea channel that the
// player must swim across to reach the inter-city highway.
const WATER_ROWS = [1, 2, 3]

function financeTileType(r, c) {
  const isBorder = r === 0 || c === 0 || r === MAP_ROWS - 1 || c === MAP_COLS - 1
  if (isBorder) return 'wall'
  if (WATER_ROWS.includes(r)) return 'water'
  if (FINANCE_H_STREETS.includes(r) || FINANCE_V_STREETS.includes(c)) return 'path'
  return 'grass'
}

// ---------------- Building interiors ----------------
// A single 12x9 room shape (INTERIOR_COLS/ROWS, matching DominoWorldScene's
// own room convention) is reused for every building's interior; only the
// palette + desk label differ per INTERIOR_TEMPLATES entry.  Crypto HQ gets
// a template all to itself; the 4 tycoon HQs share "tycoonOffice"; Bank +
// Real Estate Agency share "officeA"; Corporate Holdings + VC Hub share
// "officeB"; the remaining 9 district-amenity buildings share "amenity".
// Stock Exchange is the one exception - it keeps its bespoke trading-floor
// room (buildStockExchangeInteriorZone) from before this system existed.
const INTERIOR_COLS = 12
const INTERIOR_ROWS = 9
const INTERIOR_SPAWN = { col: 6, row: 5 }
const INTERIOR_DESK = { c0: 5, r0: 2, c1: 6, r1: 3 }
const INTERIOR_EXIT = { c0: 5, r0: 7, c1: 7, r1: 8 }
// Just outside (south of) the Stock Exchange building - where the player
// reappears on the overworld after leaving its interior.
const STOCK_EXCHANGE_DOOR = { col: 3, row: 4 }

const INTERIOR_TEMPLATES = {
  cryptoHQ: { floorA: 0x1a1030, floorB: 0x241640, deskColor: 0x8a5a1f, deskLabel: 'Trading Terminal' },
  tycoonOffice: { floorA: 0x2a2420, floorB: 0x241f1c, deskColor: 0x555555, deskLabel: 'Executive Desk' },
  officeA: { floorA: 0x1e2430, floorB: 0x1a1f29, deskColor: 0x1f3a5f, deskLabel: 'Front Desk' },
  officeB: { floorA: 0x241e30, floorB: 0x1f1a29, deskColor: 0x4a3a5f, deskLabel: 'Reception Desk' },
  amenity: { floorA: 0x201c28, floorB: 0x1b1822, deskColor: 0x5a4a2a, deskLabel: 'Counter' },
}

const BUILDING_INTERIOR_TEMPLATE = {
  cryptoExchange: 'cryptoHQ',
  buffettHQ: 'tycoonOffice',
  vanderbiltHQ: 'tycoonOffice',
  muskHQ: 'tycoonOffice',
  howardMarksHQ: 'tycoonOffice',
  bank: 'officeA',
  realEstateAgency: 'officeA',
  corporateOffice: 'officeB',
  vcHub: 'officeB',
  casino: 'amenity',
  arcade: 'amenity',
  hotel: 'amenity',
  crimeAlley: 'amenity',
  blackMarket: 'amenity',
  callCenterOps: 'amenity',
  parliament: 'amenity',
  park: 'amenity',
  temple: 'amenity',
}

const ZONES = {
  overworld: { cols: MAP_COLS, rows: MAP_ROWS },
  stockExchangeInterior: { cols: INTERIOR_COLS, rows: INTERIOR_ROWS },
  buildingInterior: { cols: INTERIOR_COLS, rows: INTERIOR_ROWS },
}

// ---------------- shared small helpers ----------------
function buildLayout(tileTypeFn, cols, rows) {
  const layout = []
  for (let r = 0; r < rows; r++) {
    const row = []
    for (let c = 0; c < cols; c++) row.push(tileTypeFn(r, c))
    layout.push(row)
  }
  return layout
}

function drawTileAt(graphics, tile, x, y, size, horizontal, dashIndex, cityId = 'tokyo') {
  if (tile === 'grass') {
    if (cityId === 'tokyo') drawSlateMarbleTile(graphics, x, y, size)
    else if (cityId === 'kyoto') drawCobblestoneTile(graphics, x, y, size)
    else drawGrassTile(graphics, x, y, size)
  }
  else if (tile === 'path') drawRoadTile(graphics, x, y, size, horizontal, dashIndex)
  else if (tile === 'water') drawWaterTile(graphics, x, y, size, 0)
  else {
    graphics.fillStyle(0x5b4636, 1)
    graphics.fillRect(x, y, size, size)
  }
}

function scatterEnvironment(scene, layout, buildings, count, cityId, zoneObjects) {
  const forbidden = new Set()
  for (const b of buildings) {
    for (let r = b.tiles.r0 - 1; r <= b.tiles.r1 + 1; r++) {
      for (let c = b.tiles.c0 - 1; c <= b.tiles.c1 + 1; c++) forbidden.add(`${r},${c}`)
    }
  }
  // Urban cities (Tokyo slate, Osaka) get rocks/props only, no nature.
  // Kyoto (cobblestone JRPG) gets cherry blossom flowers + rocks.
  // Default (grass biome) gets full mix: trees, flowers, rocks.
  const isUrban = cityId === 'tokyo' || cityId === 'osaka'
  const isJRPG = cityId === 'kyoto'
  for (let i = 0; i < count; i++) {
    const r = 4 + Math.floor(Math.random() * (MAP_ROWS - 6)) // skip water rows at top
    const c = 1 + Math.floor(Math.random() * (MAP_COLS - 2))
    if (layout[r][c] !== 'grass' || forbidden.has(`${r},${c}`)) continue
    const cx = c * TILE_SIZE + TILE_SIZE / 2
    const cy = r * TILE_SIZE + TILE_SIZE / 2
    let objs
    if (isUrban) {
      // Only sparse rocks for urban marble districts
      if (Math.random() > 0.25) continue
      objs = drawRock(scene, cx, cy)
    } else if (isJRPG) {
      // Kyoto: flowers (cherry blossom) dominant + rocks
      const roll = Math.random()
      objs = roll < 0.65 ? drawFlower(scene, cx, cy) : drawRock(scene, cx, cy)
    } else {
      const roll = Math.random()
      objs = roll < 0.45 ? drawTree(scene, cx, cy) : roll < 0.85 ? drawFlower(scene, cx, cy) : drawRock(scene, cx, cy)
    }
    if (objs) zoneObjects.push(...objs)
  }
}

// Keep the old name as an alias so nothing else breaks
function scatterTrees(scene, layout, buildings, count, zoneObjects) {
  scatterEnvironment(scene, layout, buildings, count, 'default', zoneObjects)
}

function drawBuildings(scene, graphics, buildings, zoneObjects) {
  for (const b of buildings) {
    const x = b.tiles.c0 * TILE_SIZE
    const y = b.tiles.r0 * TILE_SIZE
    const w = (b.tiles.c1 - b.tiles.c0 + 1) * TILE_SIZE
    const h = (b.tiles.r1 - b.tiles.r0 + 1) * TILE_SIZE
    drawBuildingFacade(graphics, x, y, w, h, b.color)
    const label = scene.add
      .text(x + w / 2, y - 12, b.label, { fontFamily: 'monospace', fontSize: '10px', color: '#ffffff' })
      .setOrigin(0.5, 1)
    zoneObjects.push(label)
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
}

// Draws a generic interior room (floor + desk + label) into `scene` using
// the given palette, and returns the desk's pixel rect. Shared by the Stock
// Exchange's bespoke room and every templated buildingInterior room so the
// two don't duplicate the same tile-fill loop.
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

  const deskGraphics = scene.add.graphics()
  zoneObjects.push(deskGraphics)
  const d = INTERIOR_DESK
  const dx = d.c0 * TILE_SIZE
  const dy = d.r0 * TILE_SIZE
  const dw = (d.c1 - d.c0 + 1) * TILE_SIZE
  const dh = (d.r1 - d.r0 + 1) * TILE_SIZE
  drawBuildingFacade(deskGraphics, dx, dy, dw, dh, deskColor)
  const deskLabelText = scene.add
    .text(dx + dw / 2, dy - 12, deskLabel, { fontFamily: 'monospace', fontSize: '10px', color: '#ffffff' })
    .setOrigin(0.5, 1)
  zoneObjects.push(deskLabelText)

  return { dx, dy, dw, dh }
}

function interiorExitZone() {
  return {
    type: 'exit',
    id: 'toOverworld',
    label: 'Exit to Capital Syndicate',
    rect: new Phaser.Geom.Rectangle(
      INTERIOR_EXIT.c0 * TILE_SIZE,
      INTERIOR_EXIT.r0 * TILE_SIZE,
      (INTERIOR_EXIT.c1 - INTERIOR_EXIT.c0 + 1) * TILE_SIZE,
      (INTERIOR_EXIT.r1 - INTERIOR_EXIT.r0 + 1) * TILE_SIZE
    ),
  }
}

export default class OverworldScene extends Phaser.Scene {
  constructor() {
    super('OverworldScene')
    this.bridge = null
    this.nearbyZone = null
    this.interactionLocked = false
    this.zoneObjects = []
    this.currentZoneId = 'overworld'
    this.currentInteriorBuildingId = null
    this.overworldReturnSpawn = DEFAULT_SPAWN
    this.financeNamedNpcActors = {}
    this.financeAmbientActors = []
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
      this.financeNamedNpcActors[npcId]?.destroy()
    })
    this.bridge?.on('ambientNpcKilled', ({ npcId }) => {
      this.removeFinanceAmbientNpc(npcId)
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

  // ---------------- zone loading ----------------

  loadZone(zoneId, teleportPlayer = true) {
    this.clearZoneObjects()
    this.currentZoneId = zoneId

    if (zoneId === 'overworld') this.buildOverworldZone()
    else if (zoneId === 'stockExchangeInterior') this.buildStockExchangeInteriorZone()
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
    for (const id in this.financeNamedNpcActors) this.financeNamedNpcActors[id]?.destroy()
    for (const actor of this.financeAmbientActors) actor.destroy()
    this.financeNamedNpcActors = {}
    this.financeAmbientActors = []
  }

  buildOverworldZone() {
    this.financeLayout = buildLayout(financeTileType, MAP_COLS, MAP_ROWS)

    const currentCityId = useGameStore.getState().currentCityId || 'tokyo'
    const terrainGraphics = this.add.graphics()
    this.zoneObjects.push(terrainGraphics)
    for (let row = 0; row < MAP_ROWS; row++) {
      for (let col = 0; col < MAP_COLS; col++) {
        const x = col * TILE_SIZE
        const y = row * TILE_SIZE
        drawTileAt(terrainGraphics, this.financeLayout[row][col], x, y, TILE_SIZE, FINANCE_H_STREETS.includes(row), col, currentCityId)
      }
    }

    // Coastal water channel label — visible above the swim zone
    const waterLabel = this.add
      .text(MAP_COLS * TILE_SIZE / 2, 2 * TILE_SIZE, '〰 COASTAL SEA CHANNEL — SWIM TO CROSS 〰', {
        fontFamily: 'monospace', fontSize: '9px', color: '#67e8f9', align: 'center',
      })
      .setOrigin(0.5, 0.5)
    this.zoneObjects.push(waterLabel)

    // City-specific environment scatter
    scatterEnvironment(this, this.financeLayout, FINANCE_BUILDINGS, 80, currentCityId, this.zoneObjects)

    const buildingGraphics = this.add.graphics()
    this.zoneObjects.push(buildingGraphics)
    drawBuildings(this, buildingGraphics, FINANCE_BUILDINGS, this.zoneObjects)

    // City-specific landmark buildings overlay
    this.drawCityLandmarkOverlay(currentCityId, buildingGraphics)

    this.drawFinanceNamedNpcs()
    this.spawnFinanceAmbientNpcs()

    const cityLabel = currentCityId === 'kyoto' ? '⛩️ Kyoto — Shinto Pagoda District'
      : currentCityId === 'tokyo' ? '🏛️ Tokyo — Luxury Financial District'
      : currentCityId === 'osaka' ? '🐙 Osaka — Commerce Quarter'
      : '❄️ Sapporo — Alpine Frontier'
    this.regionLabel.setText(cityLabel)
    this.buildOverworldZones()
  }

  drawCityLandmarkOverlay(cityId, graphics) {
    // Tokyo Option 3: amber-gold border accent on the first 3 buildings
    if (cityId === 'tokyo') {
      for (let i = 0; i < Math.min(3, FINANCE_BUILDINGS.length); i++) {
        const b = FINANCE_BUILDINGS[i]
        const x = b.tiles.c0 * TILE_SIZE
        const y = b.tiles.r0 * TILE_SIZE
        const w = (b.tiles.c1 - b.tiles.c0 + 1) * TILE_SIZE
        const h = (b.tiles.r1 - b.tiles.r0 + 1) * TILE_SIZE
        graphics.lineStyle(3, 0xf59e0b, 0.9)
        graphics.strokeRect(x, y, w, h)
        // Gold roof cap
        graphics.fillStyle(0xf59e0b, 0.3)
        graphics.fillRect(x, y - 4, w, 4)
      }
    }
    // Kyoto Option 2: red torii-gate accent on the first 3 buildings
    if (cityId === 'kyoto') {
      for (let i = 0; i < Math.min(3, FINANCE_BUILDINGS.length); i++) {
        const b = FINANCE_BUILDINGS[i]
        const x = b.tiles.c0 * TILE_SIZE
        const y = b.tiles.r0 * TILE_SIZE
        const w = (b.tiles.c1 - b.tiles.c0 + 1) * TILE_SIZE
        const h = (b.tiles.r1 - b.tiles.r0 + 1) * TILE_SIZE
        // Pagoda curved red roof accent
        graphics.fillStyle(0xdc2626, 0.85)
        graphics.fillRect(x - 4, y - 10, w + 8, 6)
        graphics.fillStyle(0xfbbf24, 1)
        graphics.fillRect(x + w / 2 - 2, y - 14, 4, 4)
      }
    }
  }

  buildStockExchangeInteriorZone() {
    drawInteriorRoom(this, this.zoneObjects, {
      floorA: 0x2a2b45,
      floorB: 0x252638,
      deskColor: 0x1f5f3a,
      deskLabel: 'Trading Floor',
    })

    this.regionLabel.setText('Stock Exchange')

    this.zones = [
      {
        type: 'interiorDesk',
        id: 'stockExchange',
        label: 'Trading Floor',
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

  buildGenericInteriorZone(buildingId) {
    const building = FINANCE_BUILDINGS.find((b) => b.id === buildingId)
    const template = INTERIOR_TEMPLATES[BUILDING_INTERIOR_TEMPLATE[buildingId]]

    drawInteriorRoom(this, this.zoneObjects, template)

    this.regionLabel.setText(building.label)

    this.zones = [
      {
        type: 'interiorDesk',
        id: building.id,
        npcId: building.npcId,
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

  // ---------------- collision ----------------

  isBlockedTile(col, row) {
    if (this.currentZoneId === 'stockExchangeInterior' || this.currentZoneId === 'buildingInterior') {
      if (col < 0 || col >= INTERIOR_COLS || row < 0 || row >= INTERIOR_ROWS) return true
      const isBorder = row === 0 || col === 0 || row === INTERIOR_ROWS - 1 || col === INTERIOR_COLS - 1
      if (isBorder) return true
      const d = INTERIOR_DESK
      if (col >= d.c0 && col <= d.c1 && row >= d.r0 && row <= d.r1) return true
      return false
    }
    if (col < 0 || col >= MAP_COLS || row < 0 || row >= MAP_ROWS) return true
    if (this.financeLayout[row][col] === 'wall') return true
    for (const b of FINANCE_BUILDINGS) {
      if (col >= b.tiles.c0 && col <= b.tiles.c1 && row >= b.tiles.r0 && row <= b.tiles.r1) return true
    }
    return false
  }

  // ---------------- NPCs ----------------

  drawFinanceNamedNpcs() {
    const npcStatus = useGameStore.getState().world2.npcStatus
    this.financeNamedNpcActors = {}
    for (const b of FINANCE_BUILDINGS) {
      if (!b.npcId) continue
      if (npcStatus[b.npcId] === 'dead') continue
      const npc = FINANCE_NPCS.find((n) => n.id === b.npcId)
      if (!npc) continue
      // Place NPC one tile south of the building's bottom edge, horizontally
      // centered on the building footprint.
      const cx = (b.tiles.c0 * TILE_SIZE + (b.tiles.c1 - b.tiles.c0 + 1) * TILE_SIZE / 2)
      const cy = (b.tiles.r1 + 1) * TILE_SIZE + TILE_SIZE / 2
      const actor = new SpriteActor(this, cx, cy, `npc_${npc.id}`, npc.palette)
      actor.sprite.setDepth(8)
      actor.shadow.setDepth(7)
      this.financeNamedNpcActors[npc.id] = actor
    }
  }

  spawnFinanceAmbientNpcs() {
    const npcs = generateAmbientNpcs('finance_ambient', 8)
    this.financeAmbientActors = npcs.map((npc, i) => {
      let r, c
      let tries = 0
      do {
        // Start from row 4 to skip the coastal water channel (rows 1-3)
        r = 4 + Math.floor(Math.random() * (MAP_ROWS - 6))
        c = 1 + Math.floor(Math.random() * (MAP_COLS - 2))
        tries++
      } while (tries < 50 && this.financeLayout[r][c] !== 'grass' && this.financeLayout[r][c] !== 'path')

      const actor = new SpriteActor(this, c * TILE_SIZE + TILE_SIZE / 2, r * TILE_SIZE + TILE_SIZE / 2, `npc_fin_ambient_${i}`, npc.palette)
      actor.npcId = npc.id
      actor.npcName = npc.name
      actor.wanderTimer = 0
      actor.wanderDir = { x: 0, y: 0 }
      actor.dead = false
      actor.sprite.setDepth(8)
      actor.shadow.setDepth(7)
      return actor
    })
  }

  // ---------------- player / zones ----------------

  createPlayer() {
    const player = useGameStore.getState().player
    const palette = resolvePalette(player)
    this.playerActor = new SpriteActor(
      this,
      DEFAULT_SPAWN.col * TILE_SIZE + TILE_SIZE / 2,
      DEFAULT_SPAWN.row * TILE_SIZE + TILE_SIZE / 2,
      'player_texture_overworld',
      palette
    )
    this.playerActor.sprite.setDepth(10)
    this.playerActor.shadow.setDepth(9)
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

    this.zones = FINANCE_BUILDINGS.map((b) => ({
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

  // ---------------- encounters ----------------

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

  removeFinanceAmbientNpc(npcId) {
    const actor = this.financeAmbientActors.find((a) => a.npcId === npcId)
    if (actor) {
      actor.dead = true
      actor.sprite.setVisible(false)
    }
  }

  findNearbyFinanceAmbientNpc() {
    const px = this.playerActor.x
    const py = this.playerActor.y
    return this.financeAmbientActors.find((a) => !a.dead && Phaser.Math.Distance.Between(px, py, a.x, a.y) < 26)
  }

  updateAllAmbientNpcs(delta) {
    for (const actor of this.financeAmbientActors) {
      if (!actor.dead) wanderActor(actor, delta)
    }
  }

  updateNearbyZone() {
    const px = this.playerActor.x
    const py = this.playerActor.y
    const staticZone = this.zones.find((z) => Phaser.Geom.Rectangle.Contains(z.rect, px, py))
    const financeAmbient = !staticZone ? this.findNearbyFinanceAmbientNpc() : null

    if (staticZone) {
      this.nearbyZone = staticZone
      const verb = staticZone.type === 'building' ? 'enter' : null
      this.promptText.setText(verb ? `Press E to ${verb} ${staticZone.label}` : `Press E: ${staticZone.label}`)
    } else if (financeAmbient) {
      this.nearbyZone = { type: 'financeAmbientNpc', npcRef: financeAmbient }
      this.promptText.setText(`Press E to approach ${financeAmbient.npcName}`)
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
      if (zone.id === 'stockExchange') {
        this.overworldReturnSpawn = STOCK_EXCHANGE_DOOR
        this.loadZone('stockExchangeInterior')
        return
      }
      const building = FINANCE_BUILDINGS.find((b) => b.id === zone.id)
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
    this.updateAllAmbientNpcs(delta)

    if (this.interactionLocked) return

    this.updateNearbyZone()

    if (Phaser.Input.Keyboard.JustDown(this.wasd.E) && this.nearbyZone) {
      this.triggerInteraction(this.nearbyZone)
    }
  }
}
