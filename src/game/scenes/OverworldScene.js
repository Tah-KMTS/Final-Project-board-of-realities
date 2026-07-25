import Phaser from 'phaser'
import { useGameStore } from '../../store/useGameStore'
import { resolvePalette } from '../characterPalettes'
import { generateAmbientNpcs } from '../../utils/npcGenerator'
import { getAllCharacters } from '../../features/agents/characterLookup'
import { TITAN_ROUTINES, updateAgentPositions } from '../../features/agents/agentMovementEngine'
import { SpriteActor } from '../actor'
import { TileMover, combineDirection } from '../tileMover'
import {
  buildTerrainLayer,
  placeTree,
  placeFlower,
  placeRock,
  placeBuildingFacade,
  preloadTerrainAssets,
} from '../tileGen'
import { preloadPlayerSheet } from '../spriteGen'

// ---------------------------------------------------------------------------
// OverworldScene is the single walkable map for Capital Syndicate (the
// Finance world). Zones: the outdoor `overworld` map, the Stock Exchange's
// own bespoke `stockExchangeInterior` trading floor, the Casino's own
// bespoke `casinoInterior` gaming floor (blackjack/poker/slots/NPC
// challenges - too much going on for the generic template, same reasoning
// as the Stock Exchange), and a generic `buildingInterior` room (see
// INTERIOR_TEMPLATES) reused by every other building - which template a
// given building gets is looked up from BUILDING_INTERIOR_TEMPLATE.
// Walking up to any of the 19 buildings and
// pressing E swaps into its interior in place (same scene, same Phaser.Game
// instance, same technique DominoWorldScene uses for its own rooms); the
// desk inside emits the exact same `{type:'building', id, npcId}` interact
// payload the buildings used to emit instantly, so WorldScreen.jsx's modal
// wiring needed zero changes.
// ---------------------------------------------------------------------------

const TILE_SIZE = 40
// row must stay MAP_TOP_MARGIN - 1 (see below) - one clear row above the
// first district band. Row 1 used to satisfy that with MAP_TOP_MARGIN=2,
// but that put the player at world y=60, which the HTML HUD overlay (fixed
// atop the canvas) visually covers - the player was invisible at spawn
// until they moved down. Bumped alongside MAP_TOP_MARGIN so this stays
// clear of the HUD without touching the band/gap layout math at all.
const DEFAULT_SPAWN = { col: 7, row: 3 }

// ---------------- Capital Syndicate: 4-district Financial region ----------------
// Each district is a self-contained horizontal band, stacked top to bottom
// in DISTRICT_ORDER, with a grass gap (>= BAND_GAP tiles) between bands for
// a street. Buildings within a band are packed left-to-right and wrap to a
// second row once they'd cross BAND_COL_END - laid out by layoutFinanceMap()
// below rather than hand-placed, so there's no risk of two buildings (or a
// building and the map border) overlapping as the roster changes. Verified
// with a standalone overlap/bounds check before wiring this in, not just
// eyeballed.
const DISTRICT_ORDER = ['Tokyo District', 'Kyoto District', 'Osaka District', 'Sapporo District']

const FINANCE_BUILDING_DEFS = [
  // --- Tokyo District ---
  { id: 'stockExchange', label: 'Tokyo Stock Exchange', district: 'Tokyo District', color: 0x1f5f3a, width: 3, height: 3 },
  { id: 'buffettHQ', label: 'Biffle Tower', district: 'Tokyo District', color: 0x555555, width: 3, height: 3, npcId: 'buffett' },
  { id: 'vanderbiltHQ', label: 'Vanderbilt Rail Co.', district: 'Tokyo District', color: 0x6b4a2a, width: 3, height: 3, npcId: 'vanderbilt' },
  { id: 'muskHQ', label: 'Rusk Industries', district: 'Tokyo District', color: 0x2a2a2a, width: 3, height: 3, npcId: 'musk' },
  { id: 'howardMarksHQ', label: 'Oaktree Cycle Capital', district: 'Tokyo District', color: 0x2a4f4a, width: 4, height: 3, npcId: 'howardmarks' },
  { id: 'appleHQ', label: 'Apple Glass HQ', district: 'Tokyo District', color: 0xc0c0c0, width: 4, height: 3, npcId: 'jobs' },
  { id: 'cryptoExchange', label: 'Crypto HQ', district: 'Tokyo District', color: 0x8a5a1f, width: 4, height: 3 },
  { id: 'corporateOffice', label: 'Corporate Holdings', district: 'Tokyo District', color: 0x4a3a5f, width: 4, height: 3 },
  { id: 'vcHub', label: 'Venture Capital Hub', district: 'Tokyo District', color: 0x2a3a6b, width: 3, height: 3 },
  { id: 'bank', label: 'Bank & Realty Office', district: 'Tokyo District', color: 0x1f3a5f, width: 4, height: 3 },
  { id: 'realEstateAgency', label: 'Real Estate Agency', district: 'Tokyo District', color: 0x3a5f4a, width: 4, height: 3 },
  { id: 'parliament', label: 'Parliament Hall', district: 'Tokyo District', color: 0x3a3a6a, width: 4, height: 3 },

  // --- Kyoto District ---
  { id: 'irsHQ', label: 'IRS Internal Revenue', district: 'Kyoto District', color: 0x5a5a5a, width: 4, height: 3, npcId: 'caplin' },
  { id: 'teaHouse', label: 'Cherry Coke Tea House', district: 'Kyoto District', color: 0x8a4a2a, width: 3, height: 2 },
  { id: 'machiyaEstate', label: 'Machiya Executive Estate', district: 'Kyoto District', color: 0x6a5a3a, width: 4, height: 3 },
  { id: 'zenGarden', label: 'Zen Rock Garden', district: 'Kyoto District', color: 0x8a8a6a, width: 3, height: 2 },
  { id: 'silkMarket', label: 'Silk & Kimono Market', district: 'Kyoto District', color: 0x8a2a4a, width: 3, height: 2 },
  { id: 'sakeBrewery', label: 'Fushimi Sake Brewery', district: 'Kyoto District', color: 0x6a4a2a, width: 3, height: 2 },
  { id: 'artisanShop', label: 'Kiyomizu Artisan Shop', district: 'Kyoto District', color: 0x4a6a5a, width: 3, height: 2 },
  { id: 'hotel', label: 'Ryokan Mountain Inn', district: 'Kyoto District', color: 0x5a4a3a, width: 4, height: 3 },
  { id: 'park', label: 'Serenity Park', district: 'Kyoto District', color: 0x2a5f2a, width: 4, height: 2 },
  { id: 'temple', label: 'Whispering Temple', district: 'Kyoto District', color: 0x5a5a4a, width: 4, height: 2 },

  // --- Osaka District ---
  { id: 'casino', label: 'Neon Dragon Casino', district: 'Osaka District', color: 0x8a1f6a, width: 4, height: 3 },
  { id: 'arcade', label: 'Pixel Palace Arcade', district: 'Osaka District', color: 0x1f6a8a, width: 3, height: 3 },
  { id: 'speakeasyHotel', label: 'Chicago Speakeasy Hotel', district: 'Osaka District', color: 0x6a3a2a, width: 4, height: 3, npcId: 'capone' },
  { id: 'fbiHQ', label: 'FBI Headquarters', district: 'Osaka District', color: 0x2a3a5a, width: 4, height: 3, npcId: 'hoover' },
  { id: 'dotonboriArcade', label: 'Dotonbori Merchant Arcade', district: 'Osaka District', color: 0x8a6a2a, width: 4, height: 2 },
  { id: 'fishMarket', label: 'Kuromon Fish Market', district: 'Osaka District', color: 0x2a5a6a, width: 3, height: 2 },
  { id: 'takoyakiStand', label: 'Takoyaki Street Food', district: 'Osaka District', color: 0x8a4a1f, width: 2, height: 2 },
  { id: 'crimeAlley', label: 'Crime Alley', district: 'Osaka District', color: 0x6a1f1f, width: 4, height: 2, npcId: 'luciano' },
  { id: 'blackMarket', label: 'Black Market', district: 'Osaka District', color: 0x4a1f6a, width: 3, height: 2 },
  { id: 'callCenterOps', label: 'Call Center Ops', district: 'Osaka District', color: 0x6a5a1f, width: 3, height: 2 },
  { id: 'dockVaults', label: 'Dock Underground Vaults', district: 'Osaka District', color: 0x2a2a3a, width: 4, height: 2 },

  // --- Sapporo District ---
  { id: 'fordRougeComplex', label: 'Ford River Rouge Complex', district: 'Sapporo District', color: 0x3a4a5a, width: 4, height: 3, npcId: 'ford' },
  { id: 'carnegieSteelMill', label: 'Homestead Steel Mill', district: 'Sapporo District', color: 0x5a3a2a, width: 4, height: 3, npcId: 'carnegie' },
  { id: 'standardOilRefinery', label: 'Standard Oil Refinery', district: 'Sapporo District', color: 0x2a3a3a, width: 4, height: 3, npcId: 'rockefeller' },
  { id: 'pentagonDodHQ', label: 'Pentagon Procurement HQ', district: 'Sapporo District', color: 0x2a4a6a, width: 4, height: 3, npcId: 'mcnamara' },
  { id: 'epaHQ', label: 'EPA Regulation Agency', district: 'Sapporo District', color: 0x2a5a3a, width: 4, height: 3, npcId: 'ruckelshaus' },
  { id: 'sapporoBrewery', label: 'Alpine Snow Brewery', district: 'Sapporo District', color: 0x8a6a2a, width: 3, height: 2 },
  { id: 'alpineLodge', label: 'Mount Yotei Alpine Lodge', district: 'Sapporo District', color: 0x6a4a3a, width: 4, height: 3 },
  { id: 'trainStation', label: '🚆 Central Train Station', district: 'Sapporo District', color: 0x4a6fa5, width: 4, height: 2 },
]

const BAND_COL_START = 2
const BAND_COL_END_FROM_RIGHT = 3 // BAND_COL_END = MAP_COLS - this
const BAND_GAP = 4 // tiles between buildings, and between a band's bottom and the next band's top
// wall row + 3 clear buffer rows before the first band. Was 2 (wall + 1
// buffer) until the HUD-overlap fix above needed DEFAULT_SPAWN pushed down;
// raising this shifts every district band down by the same amount, so the
// already-verified column/gap layout below is untouched, just offset.
const MAP_TOP_MARGIN = 4

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

  return { buildings, mapRows, hStreets, districtBandRows }
}

const MAP_COLS = 40
const { buildings: FINANCE_BUILDINGS, mapRows: MAP_ROWS, hStreets: FINANCE_H_STREETS, districtBandRows: DISTRICT_BAND_ROWS } = layoutFinanceMap(MAP_COLS)
// Two vertical corridors: col 7 is the spawn column, col 33 is the far-side
// expressway running from the coastal water channel to the city south gate.
const FINANCE_V_STREETS = [7, 33]
// Rows 1-3 along the top edge render as water tiles for terrain variety.
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
// Stock Exchange and Casino are the two exceptions - they keep bespoke rooms
// (buildStockExchangeInteriorZone / buildCasinoInteriorZone) instead of one.
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
  appleHQ: 'tycoonOffice',
  bank: 'officeA',
  realEstateAgency: 'officeA',
  corporateOffice: 'officeB',
  vcHub: 'officeB',
  speakeasyHotel: 'officeB',
  irsHQ: 'officeA',
  fbiHQ: 'officeA',
  pentagonDodHQ: 'officeA',
  epaHQ: 'officeA',
  fordRougeComplex: 'officeB',
  carnegieSteelMill: 'officeB',
  standardOilRefinery: 'officeB',
  teaHouse: 'amenity',
  machiyaEstate: 'amenity',
  zenGarden: 'amenity',
  silkMarket: 'amenity',
  sakeBrewery: 'amenity',
  artisanShop: 'amenity',
  dotonboriArcade: 'amenity',
  fishMarket: 'amenity',
  takoyakiStand: 'amenity',
  dockVaults: 'amenity',
  sapporoBrewery: 'amenity',
  alpineLodge: 'amenity',
  trainStation: 'amenity',
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
  casinoInterior: { cols: INTERIOR_COLS, rows: INTERIOR_ROWS },
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

// 'path' and 'water' render the same everywhere; 'grass' cells get a
// per-district ground reskin (Tokyo slate marble, Kyoto cobblestone, everyone
// else plain grass); border 'wall' cells are the same everywhere too.
function terrainTileTypeAt(tile, row) {
  if (tile === 'water') return 'water'
  if (tile === 'path') return 'path'
  if (tile === 'wall') return 'wall'
  
  if (row >= DISTRICT_BAND_ROWS['Tokyo District'].top - 2 && row <= DISTRICT_BAND_ROWS['Tokyo District'].bottom + 2) return 'slate'
  if (row >= DISTRICT_BAND_ROWS['Kyoto District'].top - 2 && row <= DISTRICT_BAND_ROWS['Kyoto District'].bottom + 2) return 'cobblestone'
  
  return 'grass'
}

function scatterEnvironment(scene, layout, buildings, count, zoneObjects) {
  const forbidden = new Set()
  for (const b of buildings) {
    for (let r = b.tiles.r0 - 1; r <= b.tiles.r1 + 1; r++) {
      for (let c = b.tiles.c0 - 1; c <= b.tiles.c1 + 1; c++) forbidden.add(`${r},${c}`)
    }
  }
  for (let i = 0; i < count; i++) {
    const r = 4 + Math.floor(Math.random() * (MAP_ROWS - 6)) // skip water rows at top
    const c = 1 + Math.floor(Math.random() * (MAP_COLS - 2))
    if (layout[r][c] !== 'grass' || forbidden.has(`${r},${c}`)) continue
    const cx = c * TILE_SIZE + TILE_SIZE / 2
    const cy = r * TILE_SIZE + TILE_SIZE / 2
    let objs
    const isUrban = (r >= DISTRICT_BAND_ROWS['Tokyo District'].top - 2 && r <= DISTRICT_BAND_ROWS['Tokyo District'].bottom + 2) || (r >= DISTRICT_BAND_ROWS['Osaka District'].top - 2 && r <= DISTRICT_BAND_ROWS['Osaka District'].bottom + 2)
    const isJRPG = (r >= DISTRICT_BAND_ROWS['Kyoto District'].top - 2 && r <= DISTRICT_BAND_ROWS['Kyoto District'].bottom + 2)

    if (isUrban) {
      // Only sparse rocks for urban marble districts
      if (Math.random() > 0.25) continue
      objs = placeRock(scene, cx, cy)
    } else if (isJRPG) {
      // Kyoto: flowers (cherry blossom) dominant + rocks
      const roll = Math.random()
      objs = roll < 0.65 ? placeFlower(scene, cx, cy) : placeRock(scene, cx, cy)
    } else {
      const roll = Math.random()
      objs = roll < 0.45 ? placeTree(scene, cx, cy) : roll < 0.85 ? placeFlower(scene, cx, cy) : placeRock(scene, cx, cy)
    }
    if (objs) zoneObjects.push(...objs)
  }
}

// Keep the old name as an alias so nothing else breaks
function scatterTrees(scene, layout, buildings, count, zoneObjects) {
  scatterEnvironment(scene, layout, buildings, count, 'default', zoneObjects)
}

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

// ---------------- named-character agent spawning ----------------
// Every character in every roster (titans, crime syndicate, presidents, fed/
// ftc chairmen, agency heads) walks the merged mega-map as a live agent:
// position and current action come from agentMovementEngine each frame -
// bespoke TITAN_ROUTINES schedules where they exist, the id-seeded orbit
// tier otherwise - with the "thought" strings below derived from each
// character's real roster data (platform, policy bias, syndicate territory,
// perk, archetype) rather than a generic shared string.

const CITY_TO_DISTRICT = {
  tokyo: 'Tokyo District',
  kyoto: 'Kyoto District',
  osaka: 'Osaka District',
  sapporo: 'Sapporo District',
}

function homeDistrictFor(character) {
  const routine = TITAN_ROUTINES[character.id]
  if (routine) return CITY_TO_DISTRICT[routine.homeCity] || 'Tokyo District'
  const cat = character.category || ''
  if (cat.startsWith('Crime') || cat === 'FBI Leader') return 'Osaka District'
  if (cat === 'IRS Leader' || cat === 'FTC Chairman') return 'Kyoto District'
  if (cat === 'DOD Leader' || cat === 'EPA Leader') return 'Sapporo District'
  // Presidents (Parliament Hall), Fed chairmen (Bank), SEC leaders (Stock
  // Exchange), and remaining titans all live around Tokyo's civic core.
  return 'Tokyo District'
}

function agentAmbientActions(c) {
  const acts = []
  if (c.executivePriority) acts.push(`🏛️ Agenda: ${String(c.executivePriority).replace(/_/g, ' ')}`)
  if (c.platform) acts.push(`📜 Championing ${c.platform}`)
  if (c.heatPolicy) acts.push(`🚔 Enforcing ${c.heatPolicy}`)
  if (c.policyBias) acts.push(`🏦 Steering rates: ${c.policyBias}`)
  if (c.bias) acts.push(`⚖️ Pursuing ${c.bias}`)
  if (c.territory) acts.push(`🗺️ Patrolling ${c.territory}`)
  if (c.specialty) acts.push(`🕶️ Running ${c.specialty}`)
  if (c.perkTitle) acts.push(`💼 Working ${c.perkTitle}`)
  if (c.archetype) acts.push(`📊 Playing the ${String(c.archetype).replace(/_/g, ' ')} book`)
  if (!acts.length && c.title) acts.push(`🚶 ${c.title}`)
  return acts
}

function wanderActor(scene, actor, delta, speed = 20) {
  actor.wanderTimer -= delta
  if (actor.wanderTimer <= 0) {
    actor.wanderTimer = 1500 + Math.random() * 2500
    const dirs = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }]
    actor.wanderDir = dirs[Math.floor(Math.random() * dirs.length)]
  }
  const rawNx = actor.x + actor.wanderDir.x * speed * (delta / 1000)
  const rawNy = actor.y + actor.wanderDir.y * speed * (delta / 1000)
  const { x: nx, y: ny, blocked } = scene.resolveOpenPosition(rawNx, rawNy)
  actor.sprite.setPosition(nx, ny)
  // Hit a building wall - kill the current drift immediately instead of
  // pushing into it again next tick, so the wander timer re-rolls a new
  // (hopefully open) direction right away rather than looking stuck.
  if (blocked) actor.wanderTimer = 0
  actor.setMoving(actor.wanderDir.x !== 0 || actor.wanderDir.y !== 0)
  if (actor.wanderDir.x > 0) actor.setFacing('right')
  else if (actor.wanderDir.x < 0) actor.setFacing('left')
  else if (actor.wanderDir.y > 0) actor.setFacing('down')
  else if (actor.wanderDir.y < 0) actor.setFacing('up')
  actor.update(delta)
  actor.sprite.setDepth(actor.y)
  actor.shadow.setDepth(actor.y - 1)
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
    this.namedRoamers = []
    this.agentClock = 0
  }

  preload() {
    preloadTerrainAssets(this)
    preloadPlayerSheet(this)
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
      this.removeNamedRoamer(npcId)
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
    else if (zoneId === 'casinoInterior') this.buildCasinoInteriorZone()
    else this.buildGenericInteriorZone(this.currentInteriorBuildingId)

    const zone = ZONES[zoneId]
    this.cameras.main.setBounds(0, 0, zone.cols * TILE_SIZE, zone.rows * TILE_SIZE)
    // Arcade Physics world bounds default to the 800x500 canvas size, not
    // the zone size - without this the player's collideWorldBounds body
    // gets clamped back inside that small box while walking.
    this.physics.world.setBounds(0, 0, zone.cols * TILE_SIZE, zone.rows * TILE_SIZE)
    if (teleportPlayer) {
      const spawn = zoneId === 'overworld' ? this.overworldReturnSpawn : INTERIOR_SPAWN
      this.tileMover.teleport(spawn.col, spawn.row)
    }
    this.cameras.main.startFollow(this.playerActor.sprite, true)
  }

  teleportToCity(cityId) {
    const districtMap = {
      'tokyo': 'Tokyo District',
      'kyoto': 'Kyoto District',
      'osaka': 'Osaka District',
      'sapporo': 'Sapporo District'
    }
    const districtName = districtMap[cityId] || 'Tokyo District'
    
    // Find a building in that district to spawn near (preferably train station)
    let target = FINANCE_BUILDINGS.find(b => b.district === districtName && b.id === 'trainStation')
    if (!target) {
        target = FINANCE_BUILDINGS.find(b => b.district === districtName)
    }
    
    if (target) {
        this.overworldReturnSpawn = {
            col: Math.round((target.tiles.c0 + target.tiles.c1) / 2),
            row: target.tiles.r1 + 1,
        }
        if (this.currentZoneId === 'overworld') {
            this.tileMover.teleport(this.overworldReturnSpawn.col, this.overworldReturnSpawn.row)
        }
    }
  }

  clearZoneObjects() {
    for (const obj of this.zoneObjects) obj.destroy()
    this.zoneObjects = []
    for (const roamer of this.namedRoamers) {
      roamer.actor.destroy()
      roamer.label.destroy()
    }
    for (const actor of this.financeAmbientActors) actor.destroy()
    this.namedRoamers = []
    this.financeNamedNpcActors = {}
    this.financeAmbientActors = []
  }

  buildOverworldZone() {
    this.financeLayout = buildLayout(financeTileType, MAP_COLS, MAP_ROWS)

    const currentCityId = useGameStore.getState().currentCityId || 'tokyo'

    // Procedural terrain layer - one Graphics pass, per-city ground reskin.
    const terrainLayer = buildTerrainLayer(this, MAP_COLS, MAP_ROWS, TILE_SIZE, (row, col) =>
      terrainTileTypeAt(this.financeLayout[row][col], row)
    )
    this.zoneObjects.push(terrainLayer)

    // City-specific environment scatter
    scatterEnvironment(this, this.financeLayout, FINANCE_BUILDINGS, 80, this.zoneObjects)

    drawBuildings(this, FINANCE_BUILDINGS, this.zoneObjects)

    // City-specific landmark buildings overlay (now District-specific)
    this.drawCityLandmarkOverlay()

    this.spawnNamedRoamers()
    this.spawnFinanceAmbientNpcs()

    this.regionLabel.setText('Capital Syndicate Mega-Map')
    this.buildOverworldZones()
  }

  drawCityLandmarkOverlay() {
    const overlayGraphics = this.add.graphics().setDepth(2000)
    this.zoneObjects.push(overlayGraphics)

    // Tokyo District: amber-gold border accent
    const tokyoBuildings = FINANCE_BUILDINGS.filter(b => b.district === 'Tokyo District')
    for (let i = 0; i < Math.min(3, tokyoBuildings.length); i++) {
      const b = tokyoBuildings[i]
      const x = b.tiles.c0 * TILE_SIZE
      const y = b.tiles.r0 * TILE_SIZE
      const w = (b.tiles.c1 - b.tiles.c0 + 1) * TILE_SIZE
      const h = (b.tiles.r1 - b.tiles.r0 + 1) * TILE_SIZE
      overlayGraphics.lineStyle(3, 0xf59e0b, 0.9)
      overlayGraphics.strokeRect(x, y, w, h)
      overlayGraphics.fillStyle(0xf59e0b, 0.3)
      overlayGraphics.fillRect(x, y - 4, w, 4)
    }

    // Kyoto District: red torii-gate accent
    const kyotoBuildings = FINANCE_BUILDINGS.filter(b => b.district === 'Kyoto District')
    for (let i = 0; i < Math.min(3, kyotoBuildings.length); i++) {
      const b = kyotoBuildings[i]
      const x = b.tiles.c0 * TILE_SIZE
      const y = b.tiles.r0 * TILE_SIZE
      const w = (b.tiles.c1 - b.tiles.c0 + 1) * TILE_SIZE
      const h = (b.tiles.r1 - b.tiles.r0 + 1) * TILE_SIZE
      overlayGraphics.fillStyle(0xdc2626, 0.85)
      overlayGraphics.fillRect(x - 4, y - 10, w + 8, 6)
      overlayGraphics.fillStyle(0xfbbf24, 1)
      overlayGraphics.fillRect(x + w / 2 - 2, y - 14, 4, 4)
    }

    // Osaka District: cyan/neon magenta border accents
    const osakaBuildings = FINANCE_BUILDINGS.filter(b => b.district === 'Osaka District')
    for (let i = 0; i < Math.min(3, osakaBuildings.length); i++) {
      const b = osakaBuildings[i]
      const x = b.tiles.c0 * TILE_SIZE
      const y = b.tiles.r0 * TILE_SIZE
      const w = (b.tiles.c1 - b.tiles.c0 + 1) * TILE_SIZE
      const h = (b.tiles.r1 - b.tiles.r0 + 1) * TILE_SIZE
      overlayGraphics.lineStyle(3, 0x06b6d4, 0.9)
      overlayGraphics.strokeRect(x, y, w, h)
      overlayGraphics.fillStyle(0xec4899, 0.7)
      overlayGraphics.fillRect(x + 4, y - 6, w - 8, 4)
    }

    // Sapporo District: ice-blue border accents & snow caps
    const sapporoBuildings = FINANCE_BUILDINGS.filter(b => b.district === 'Sapporo District')
    for (let i = 0; i < Math.min(3, sapporoBuildings.length); i++) {
      const b = sapporoBuildings[i]
      const x = b.tiles.c0 * TILE_SIZE
      const y = b.tiles.r0 * TILE_SIZE
      const w = (b.tiles.c1 - b.tiles.c0 + 1) * TILE_SIZE
      const h = (b.tiles.r1 - b.tiles.r0 + 1) * TILE_SIZE
      overlayGraphics.lineStyle(3, 0x38bdf8, 0.9)
      overlayGraphics.strokeRect(x, y, w, h)
      overlayGraphics.fillStyle(0xe0f2fe, 0.9)
      overlayGraphics.fillRect(x - 2, y - 6, w + 4, 5)
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

  buildCasinoInteriorZone() {
    drawInteriorRoom(this, this.zoneObjects, {
      floorA: 0x2a1030,
      floorB: 0x230d28,
      deskColor: 0x8a1f6a,
      deskLabel: 'Casino Floor',
    })

    this.regionLabel.setText('Neon Dragon Casino')

    this.zones = [
      {
        type: 'interiorDesk',
        id: 'casino',
        label: 'Casino Floor',
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
    if (
      this.currentZoneId === 'stockExchangeInterior' ||
      this.currentZoneId === 'casinoInterior' ||
      this.currentZoneId === 'buildingInterior'
    ) {
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

  // The player is grid-locked through TileMover/isBlockedTile above, so it
  // can never step onto a building tile in the first place. Named roamers
  // and ambient NPCs move continuously (lerped routine positions, free
  // wander drift) with no equivalent check, so they could be computed
  // straight into - or spawn inside - a building's footprint and visibly
  // stand/walk through it. This snaps a candidate world position out to
  // just past whichever padded building edge it's closest to, so buildings
  // read as solid for them too without needing full pathfinding.
  resolveOpenPosition(x, y) {
    if (this.currentZoneId !== 'overworld') return { x, y, blocked: false }
    const col = Math.floor(x / TILE_SIZE)
    const row = Math.floor(y / TILE_SIZE)
    const building = FINANCE_BUILDINGS.find(
      (b) => col >= b.tiles.c0 && col <= b.tiles.c1 && row >= b.tiles.r0 && row <= b.tiles.r1
    )
    if (!building) return { x, y, blocked: false }
    const pad = TILE_SIZE * 0.7
    const left = building.tiles.c0 * TILE_SIZE - pad
    const right = (building.tiles.c1 + 1) * TILE_SIZE + pad
    const top = building.tiles.r0 * TILE_SIZE - pad
    const bottom = (building.tiles.r1 + 1) * TILE_SIZE + pad
    const edges = [
      { side: 'left', d: x - left },
      { side: 'right', d: right - x },
      { side: 'top', d: y - top },
      { side: 'bottom', d: bottom - y },
    ].sort((a, b) => a.d - b.d)
    const closest = edges[0].side
    if (closest === 'left') return { x: left, y, blocked: true }
    if (closest === 'right') return { x: right, y, blocked: true }
    if (closest === 'top') return { x, y: top, blocked: true }
    return { x, y: bottom, blocked: true }
  }

  // ---------------- NPCs ----------------

  spawnNamedRoamers() {
    const npcStatus = useGameStore.getState().world2.npcStatus
    this.namedRoamers = []
    this.financeNamedNpcActors = {}
    for (const character of getAllCharacters()) {
      if (npcStatus[character.id] === 'dead') continue
      const actor = new SpriteActor(this, -100, -100, `npc_${character.id}`, character.palette)
      const label = this.add
        .text(-100, -100, character.name, {
          fontFamily: 'monospace',
          fontSize: '9px',
          color: '#ffe066',
          align: 'center',
          stroke: '#000000',
          strokeThickness: 3,
        })
        .setOrigin(0.5, 1)
      const roamer = {
        agent: { id: character.id, name: character.name, ambientActions: agentAmbientActions(character) },
        character,
        actor,
        label,
        district: homeDistrictFor(character),
        currentAction: '',
        dead: false,
      }
      this.namedRoamers.push(roamer)
      this.financeNamedNpcActors[character.id] = actor
    }
    this.updateNamedRoamers(0)
  }

  // Maps the movement engine's 1600x1800 legacy per-city coordinate space
  // into the character's home-district band on the merged mega-map: x carries
  // over directly (both spaces are 1600px wide), y is normalized into the
  // band's row range (staying clear of the coastal water rows up top).
  roamerWorldPosition(raw, district) {
    const band = DISTRICT_BAND_ROWS[district] || DISTRICT_BAND_ROWS['Tokyo District']
    const topPx = Math.max(4, band.top - 1) * TILE_SIZE
    const bottomPx = (band.bottom + 3) * TILE_SIZE
    const y = topPx + (raw.currentY / 1800) * (bottomPx - topPx)
    const x = Math.min((MAP_COLS - 1.5) * TILE_SIZE, Math.max(TILE_SIZE * 1.5, raw.currentX))
    return { x, y }
  }

  updateNamedRoamers(delta) {
    if (!this.namedRoamers.length) return
    // agentClock is the engine's timeTick: schedule steps advance every 5
    // ticks, so delta/4000 here means one routine step every ~20 seconds.
    this.agentClock += delta / 4000
    const raws = updateAgentPositions(this.namedRoamers.map((r) => r.agent), this.agentClock)
    const px = this.playerActor?.x ?? -9999
    const py = this.playerActor?.y ?? -9999
    for (let i = 0; i < raws.length; i++) {
      const roamer = this.namedRoamers[i]
      if (roamer.dead) continue
      const raw = raws[i]
      roamer.currentAction = raw.currentAction || ''
      const rawPos = this.roamerWorldPosition(raw, roamer.district)
      const { x, y } = this.resolveOpenPosition(rawPos.x, rawPos.y)
      const dx = x - roamer.actor.x
      const dy = y - roamer.actor.y
      const moved = Math.abs(dx) + Math.abs(dy) > 0.05
      roamer.actor.sprite.setPosition(x, y)
      roamer.actor.setMoving(moved)
      if (Math.abs(dx) > Math.abs(dy)) roamer.actor.setFacing(dx > 0 ? 'right' : 'left')
      else if (moved) roamer.actor.setFacing(dy > 0 ? 'down' : 'up')
      roamer.actor.update(delta)
      // Name floats above the sprite; the agent's current "thought" appears
      // once the player is close enough to read it.
      const near = Phaser.Math.Distance.Between(px, py, x, y) < 180
      const wanted = near && roamer.currentAction ? `${roamer.character.name}\n${roamer.currentAction}` : roamer.character.name
      if (roamer.label.text !== wanted) roamer.label.setText(wanted)
      roamer.label.setPosition(x, y - 26)
      roamer.label.setDepth(y + 500)
    }
  }

  findNearbyNamedRoamer() {
    const px = this.playerActor.x
    const py = this.playerActor.y
    return this.namedRoamers.find((r) => !r.dead && Phaser.Math.Distance.Between(px, py, r.actor.x, r.actor.y) < 30)
  }

  removeNamedRoamer(npcId) {
    const roamer = this.namedRoamers.find((r) => r.agent.id === npcId)
    if (roamer) {
      roamer.dead = true
      roamer.actor.sprite.setVisible(false)
      roamer.actor.shadow.setVisible(false)
      roamer.label.setVisible(false)
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

    this.zones = FINANCE_BUILDINGS.map((b, i) => ({
      type: 'building',
      id: b.id,
      uid: i,
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
      if (!actor.dead) wanderActor(this, actor, delta)
    }
  }

  updateNearbyZone() {
    const px = this.playerActor.x
    const py = this.playerActor.y
    const staticZone = this.zones.find((z) => Phaser.Geom.Rectangle.Contains(z.rect, px, py))
    const namedRoamer = !staticZone && this.currentZoneId === 'overworld' ? this.findNearbyNamedRoamer() : null
    const financeAmbient = !staticZone && !namedRoamer ? this.findNearbyFinanceAmbientNpc() : null

    if (staticZone) {
      this.nearbyZone = staticZone
      const verb = staticZone.type === 'building' ? 'enter' : null
      this.promptText.setText(verb ? `Press E to ${verb} ${staticZone.label}` : `Press E: ${staticZone.label}`)
    } else if (namedRoamer) {
      this.nearbyZone = { type: 'namedRoamer', roamer: namedRoamer }
      this.promptText.setText(`Press E to talk to ${namedRoamer.character.name}`)
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
      if (zone.id === 'trainStation') {
        this.pauseForModal()
        this.bridge.emit('interact', { type: 'townTravel' })
        return
      }
      
      const building = FINANCE_BUILDINGS[zone.uid] || FINANCE_BUILDINGS.find((b) => b.id === zone.id)
      
      if (zone.id === 'stockExchange') {
        this.overworldReturnSpawn = STOCK_EXCHANGE_DOOR
        this.loadZone('stockExchangeInterior')
        return
      }
      if (zone.id === 'casino') {
        this.overworldReturnSpawn = {
          col: Math.round((building.tiles.c0 + building.tiles.c1) / 2),
          row: building.tiles.r1 + 1,
        }
        this.loadZone('casinoInterior')
        return
      }
      
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
    } else if (zone.type === 'namedRoamer') {
      // 'namedRoamer' matches no building-specific modal case, so
      // WorldScreen's generic building-with-npcId branch renders
      // NamedNpcModal - the same modal the interior desks open.
      this.bridge.emit('interact', { type: 'building', id: 'namedRoamer', npcId: zone.roamer.agent.id })
    } else if (zone.type === 'financeAmbientNpc') {
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
    this.updateAllAmbientNpcs(delta)
    if (this.currentZoneId === 'overworld') this.updateNamedRoamers(delta)

    if (this.interactionLocked) return

    this.updateNearbyZone()

    if (this.currentZoneId === 'overworld') {
      const row = Math.floor(this.playerActor.y / TILE_SIZE)
      let newCityId = null
      if (row >= DISTRICT_BAND_ROWS['Tokyo District'].top - 4 && row <= DISTRICT_BAND_ROWS['Tokyo District'].bottom + 4) newCityId = 'tokyo'
      else if (row >= DISTRICT_BAND_ROWS['Kyoto District'].top - 4 && row <= DISTRICT_BAND_ROWS['Kyoto District'].bottom + 4) newCityId = 'kyoto'
      else if (row >= DISTRICT_BAND_ROWS['Osaka District'].top - 4 && row <= DISTRICT_BAND_ROWS['Osaka District'].bottom + 4) newCityId = 'osaka'
      else if (row >= DISTRICT_BAND_ROWS['Sapporo District'].top - 4 && row <= DISTRICT_BAND_ROWS['Sapporo District'].bottom + 4) newCityId = 'sapporo'

      const state = useGameStore.getState()
      if (newCityId && state.currentCityId !== newCityId) {
        state.switchCity(newCityId)
      }
    }

    if (Phaser.Input.Keyboard.JustDown(this.wasd.E) && this.nearbyZone) {
      this.triggerInteraction(this.nearbyZone)
    }
  }
}
