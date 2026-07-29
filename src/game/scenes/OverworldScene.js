import Phaser from 'phaser'
import { useGameStore } from '../../store/useGameStore'
import { resolvePalette } from '../characterPalettes'
import { generateAmbientNpcs } from '../../utils/npcGenerator'
import { getAllCharacters, getAnyCharacter } from '../../features/agents/characterLookup'
import { getDisposition } from '../../features/agents/characterDispositions'
import { TITAN_ROUTINES } from '../../features/agents/agentMovementEngine'
import { TIME_BLOCKS, simulateWorldPresence } from '../../features/agents/worldPresenceEngine'
import { CHARACTER_HOME_BUILDING_DEFS } from '../../features/world/characterHomeBuildings'
import { SpriteActor } from '../actor'
import { VehicleActor } from '../VehicleActor'
import { TileMover, combineDirection } from '../tileMover'
import { preloadVehicleAssets, ensurePico8CarFrames, TIER_SPRITES, npcVehicleFor, PICO8_ATLAS_KEY, pico8CarFrameFor } from '../vehicleGen'
import { INTERACTIVE_LOCATIONS } from '../../features/world/interactiveLocations'
import {
  buildTerrainLayer,
  placeTree,
  placeFlower,
  placeRock,
  placeBuildingFacade,
  preloadTerrainAssets,
  placeFencePen,
  HABITAT_ASSET_KEYS,
  WEALTH_STONE_THRESHOLD,
  buildingDoorAnimSpec,
} from '../tileGen'
import {
  SERENE_VILLAGE_DOOR_KEY,
  SERENE_DOOR_ANIM_OPEN,
  SERENE_DOOR_ANIM_CLOSE,
  ensureSereneVillageDoorAnims,
} from '../packs/packRender'
import { preloadPlayerSheet } from '../spriteGen'
import { buildTmxWallInteriorZone, TEA_HOUSE_ROOM } from '../interiors/tmxWallInterior'
import { buildChapelMapZone, preloadChapelMap, CHAPEL_ROOM } from '../interiors/tmxMapInterior'
import { buildChapelExteriorZone, preloadChapelExterior, CHAPEL_EXTERIOR_ROOM } from '../interiors/tmxMapExterior'
import { preloadChapelPack } from '../packs/chapelPixelTiles'
import { preloadCuteTerrain } from '../packs/cuteFantasyTerrain'

// ---------------------------------------------------------------------------
// OverworldScene is the single walkable map for Capital Syndicate (the
// Finance world). Zones: the outdoor `overworld` map, the Stock Exchange's
// own bespoke `stockExchangeInterior` trading floor, the Casino's own
// bespoke `casinoInterior` gaming floor (blackjack/poker/slots/NPC
// challenges - too much going on for the generic template, same reasoning
// as the Stock Exchange), and a generic `buildingInterior` room (see
// INTERIOR_TEMPLATES) reused by every other building - which template a
// given building gets is looked up from BUILDING_INTERIOR_TEMPLATE, falling
// back to a `residence`/`hideout` template by the building's `kind` for the
// 88 character home/hideout buildings that aren't hand-listed there (see
// interiorTemplateFor).
// Walking up to any of the 129 buildings (41 hand-authored + 88 character
// homes/hideouts from characterHomeBuildings.js) and pressing E swaps into
// its interior in place (same scene, same Phaser.Game instance, same
// technique DominoWorldScene uses for its own rooms); the desk inside emits
// the exact same `{type:'building', id, npcId}` interact payload the
// buildings used to emit instantly, so WorldScreen.jsx's modal wiring
// needed zero changes.
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

// House rule: 2x2 character homes/hideouts packed at the same BAND_GAP=4 as
// the hand-authored buildings below measured out to a 154-row map (verified
// with a standalone layout script) - way too tall to be playable. Giving
// home/hideout defs their own tighter `gap` (per-def override, see
// layoutFinanceMap) instead keeps the map at 73 rows for the same 88 homes.
const HOME_GAP = 2

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
  // Distinct indigo/violet exterior (every other Kyoto building above is a
  // muted brown/grey/green earth-tone) so this reads as the grand chapel
  // it now has an interior for (see buildChapelInteriorZone in this file
  // and src/game/interiors/tmxWallInterior.js) rather than blending into
  // the district as just another plain amenity building - reported gap:
  // the interior existed but nothing on the map signaled it. Label now
  // says "Chapel" outright while keeping "Whispering Temple" as the
  // flavor name TempleModal.jsx already displays.
  { id: 'temple', label: 'Whispering Temple Chapel', district: 'Kyoto District', color: 0x3a2a6a, width: 4, height: 2 },

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

  // --- Character homes & hideouts (generated, see characterHomeBuildings.js) ---
  // Appended after the 41 defs above (not interleaved) so the already-
  // verified district layout stays first and unaffected; layoutFinanceMap
  // packs each into its def's district band same as any other building.
  ...CHARACTER_HOME_BUILDING_DEFS.map((d) => ({ ...d, gap: HOME_GAP })),
]

const BAND_COL_START = 2
const BAND_COL_END_FROM_RIGHT = 3 // BAND_COL_END = MAP_COLS - this
const BAND_GAP = 4 // default tiles between buildings (a def can override its own with `gap`,
// see layoutFinanceMap), and always the row-wrap gap plus the gap between a
// band's bottom and the next band's top - those two stay on this constant
// regardless of which def's gap triggered the wrap, so mixing gap sizes
// within one band can't shrink the clearance the row below still needs.
// wall row + 3 clear buffer rows before the first band. Was 2 (wall + 1
// buffer) until the HUD-overlap fix above needed DEFAULT_SPAWN pushed down;
// raising this shifts every district band down by the same amount, so the
// already-verified column/gap layout below is untouched, just offset.
const MAP_TOP_MARGIN = 4

// STEP 1 of the map coherence overhaul (production/next-session-plan.md).
//
// The problem this fixes: FINANCE_V_STREETS used to be a hardcoded list of
// single columns ([7, 20, 34, 47, 60, 73]) that layoutFinanceMap knew nothing
// about, so buildings were packed straight over them and their facades drew
// on top of the road - the "building is built on the road" the human
// reported. Streets were also 1 tile wide, too narrow to read as roads or to
// drive on.
//
// Now: street columns are DERIVED from the map width, streets are
// STREET_WIDTH tiles wide, and the packer treats them as reserved - it skips
// a building past any street block it would overlap.
const STREET_WIDTH = 3
const V_STREET_SPACING = 26 // gap between street blocks; must exceed the widest building
const V_STREET_FIRST_COL = 6

function verticalStreetColumns(mapCols) {
  const cols = []
  for (let start = V_STREET_FIRST_COL; start + STREET_WIDTH - 1 < mapCols - 1; start += V_STREET_SPACING) {
    for (let d = 0; d < STREET_WIDTH; d++) cols.push(start + d)
  }
  return cols
}

// Smallest column >= `col` where a `width`-wide building clears every street
// block, or null if it can't fit before `bandColEnd` (caller then wraps to a
// new row). V_STREET_SPACING guarantees the gaps between streets are wider
// than any building, so wrapping always eventually succeeds.
function firstColumnClearOfStreets(col, width, streetCols, bandColEnd) {
  let c = col
  while (c + width - 1 <= bandColEnd) {
    let hit = -1
    for (let x = c; x <= c + width - 1; x++) {
      if (streetCols.includes(x)) { hit = x; break }
    }
    if (hit === -1) return c
    c = hit + 1
  }
  return null
}

function layoutFinanceMap(mapCols) {
  const streetCols = verticalStreetColumns(mapCols)
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
      // Reserve the vertical streets: shift right past any street block this
      // building would straddle, wrapping to the next row if it no longer
      // fits on this one.
      let clear = firstColumnClearOfStreets(col, b.width, streetCols, bandColEnd)
      if (clear === null) {
        col = BAND_COL_START
        row += rowMaxHeight + BAND_GAP
        rowMaxHeight = 0
        clear = firstColumnClearOfStreets(col, b.width, streetCols, bandColEnd)
      }
      col = clear
      const c0 = col
      const r0 = row
      const c1 = col + b.width - 1
      const r1 = row + b.height - 1
      buildings.push({ ...b, tiles: { c0, r0, c1, r1 } })
      col += b.width + (b.gap ?? BAND_GAP)
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
  // Flat list of every street ROW (not just the centre line) so existing
  // consumers keep working with plain .includes(r) / random indexing, while
  // the street is now STREET_WIDTH tiles tall. Clamped into the grass gap so
  // a street never touches a band's buildings.
  const hStreets = []
  for (let i = 0; i < DISTRICT_ORDER.length - 1; i++) {
    const gapTop = districtBandRows[DISTRICT_ORDER[i]].bottom + 1
    const gapBottom = districtBandRows[DISTRICT_ORDER[i + 1]].top - 1
    const centre = Math.round((gapTop + gapBottom) / 2)
    const half = Math.floor(STREET_WIDTH / 2)
    for (let r = centre - half; r <= centre - half + STREET_WIDTH - 1; r++) {
      if (r >= gapTop && r <= gapBottom) hStreets.push(r)
    }
  }

  return { buildings, mapRows, hStreets, districtBandRows, vStreets: streetCols }
}

const MAP_COLS = 160
const {
  buildings: FINANCE_BUILDINGS,
  mapRows: MAP_ROWS,
  hStreets: FINANCE_H_STREETS,
  districtBandRows: DISTRICT_BAND_ROWS,
  vStreets: FINANCE_V_STREETS,
} = layoutFinanceMap(MAP_COLS)
// Exported purely so the layout can be asserted against from outside (no
// building overlaps, every door reachable) without a Phaser canvas - the
// packing is generated from a 129-entry def list now, far past the point
// where eyeballing it is meaningful. Nothing in the game reads these.
export {
  FINANCE_BUILDINGS,
  FINANCE_V_STREETS,
  FINANCE_H_STREETS,
  MAP_COLS,
  MAP_ROWS,
  DISTRICT_BAND_ROWS,
  TILE_SIZE,
  presenceStepProgress,
  presencePhaseOffset,
  idleDriftOffset,
  IDLE_DRIFT_RADIUS_BY_TIER,
}
// (Historical note: this used to describe six hand-picked corridors on an
// 80-wide map. Street columns are now derived from the map width by
// verticalStreetColumns() and reserved by the packer - see the comment above
// layoutFinanceMap. Kept only for the DEFAULT_SPAWN detail below.)
// Six vertical corridors spread evenly across the map: col 7 is the
// spawn column (kept - DEFAULT_SPAWN sits on it), the rest give the right
// half of the map (which the original two-corridor [7, 33] left with no
// north-south route once the map widened past 40 cols) the same coverage.
// FINANCE_V_STREETS is now derived by layoutFinanceMap (see above) rather
// than hardcoded here. The old comment at this spot said a building "can
// still occupy one of these columns... its facade just renders over the
// street" - that was the bug, not an acceptable trade-off, and the packer
// now reserves street columns instead.
// Rows 1-2 along the top edge render as water tiles for terrain variety.
// Water is now impassable (isSingleTileObstacle/isBlockedTile - see there
// for why), so this deliberately excludes row 3: DEFAULT_SPAWN.row is
// pinned to MAP_TOP_MARGIN-1 (=3) for HUD-clearance reasons unrelated to
// terrain (see the comment above DEFAULT_SPAWN), and that spawn tile must
// stay walkable. Shrinking the water band by one row is the fix, not moving
// the spawn - moving it would reopen the HUD-overlap bug that comment
// documents.
const WATER_ROWS = [1, 2]

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
// palette + desk label differ per INTERIOR_TEMPLATES entry. Crypto HQ gets
// a template all to itself; the 5 tycoon HQs share "tycoonOffice"; 6
// government/finance offices share "officeA"; 6 corporate/industrial HQs
// share "officeB"; the remaining 21 district-amenity buildings share
// "amenity" - all 39 hand-listed by id in BUILDING_INTERIOR_TEMPLATE below.
// The 88 character home/hideout buildings (characterHomeBuildings.js) would
// be silly to list by hand one at a time, so they're deliberately left out
// of that map entirely - interiorTemplateFor() falls back to "residence" or
// "hideout" by the building's `kind` for anything not found there. Stock
// Exchange and Casino are the two exceptions to all of this - they keep
// bespoke rooms (buildStockExchangeInteriorZone / buildCasinoInteriorZone)
// instead of a template.
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
  residence: { floorA: 0x2a3020, floorB: 0x1f2418, deskColor: 0x4a3a2a, deskLabel: 'Study' },
  hideout: { floorA: 0x1f1418, floorB: 0x160e12, deskColor: 0x6a1f3a, deskLabel: 'Back Room' },
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

// Explicit id lookup first (the 39 hand-authored entries above); falls back
// to the building's `kind` for the 88 generated home/hideout buildings,
// which were deliberately never added to BUILDING_INTERIOR_TEMPLATE one by
// one (see the comment on INTERIOR_TEMPLATES above). "amenity" is the last
// resort so this can never return undefined and crash buildGenericInteriorZone.
function interiorTemplateFor(building) {
  const explicitId = BUILDING_INTERIOR_TEMPLATE[building.id]
  if (explicitId) return INTERIOR_TEMPLATES[explicitId]
  if (building.kind === 'home') return INTERIOR_TEMPLATES.residence
  if (building.kind === 'hideout') return INTERIOR_TEMPLATES.hideout
  return INTERIOR_TEMPLATES.amenity
}

const ZONES = {
  overworld: { cols: MAP_COLS, rows: MAP_ROWS },
  stockExchangeInterior: { cols: INTERIOR_COLS, rows: INTERIOR_ROWS },
  casinoInterior: { cols: INTERIOR_COLS, rows: INTERIOR_ROWS },
  buildingInterior: { cols: INTERIOR_COLS, rows: INTERIOR_ROWS },
  // Bespoke real-tileset rooms (see src/game/interiors/tmxWallInterior.js) -
  // same "own room shape, own zone id" pattern as stockExchangeInterior/
  // casinoInterior above, just variable-sized instead of reusing
  // INTERIOR_COLS/ROWS.
  chapelInterior: { cols: CHAPEL_ROOM.cols, rows: CHAPEL_ROOM.rows },
  chapelExterior: { cols: CHAPEL_EXTERIOR_ROOM.cols, rows: CHAPEL_EXTERIOR_ROOM.rows },
  teaHouseInterior: { cols: TEA_HOUSE_ROOM.cols, rows: TEA_HOUSE_ROOM.rows },
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

// Trees and rocks are solid obstacles (their tile is added to
// `blockedTiles`, consulted by isBlockedTile below) - flowers stay walkable
// ground decoration, matching the usual top-down-RPG convention. Previously
// nothing scattered here was ever registered as blocked, so the player
// could walk straight through a tree trunk or a boulder.
function scatterEnvironment(scene, layout, buildings, count, zoneObjects, blockedTiles) {
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
    let solid = false
    const isUrban = (r >= DISTRICT_BAND_ROWS['Tokyo District'].top - 2 && r <= DISTRICT_BAND_ROWS['Tokyo District'].bottom + 2) || (r >= DISTRICT_BAND_ROWS['Osaka District'].top - 2 && r <= DISTRICT_BAND_ROWS['Osaka District'].bottom + 2)
    const isJRPG = (r >= DISTRICT_BAND_ROWS['Kyoto District'].top - 2 && r <= DISTRICT_BAND_ROWS['Kyoto District'].bottom + 2)

    if (isUrban) {
      // Only sparse rocks for urban marble districts
      if (Math.random() > 0.25) continue
      objs = placeRock(scene, cx, cy)
      solid = true
    } else if (isJRPG) {
      // Kyoto: flowers (cherry blossom) dominant + rocks
      const roll = Math.random()
      if (roll < 0.65) {
        objs = placeFlower(scene, cx, cy)
      } else {
        objs = placeRock(scene, cx, cy)
        solid = true
      }
    } else {
      const roll = Math.random()
      if (roll < 0.45) {
        objs = placeTree(scene, cx, cy)
        solid = true
      } else if (roll < 0.85) {
        objs = placeFlower(scene, cx, cy)
      } else {
        objs = placeRock(scene, cx, cy)
        solid = true
      }
    }
    if (objs) {
      zoneObjects.push(...objs)
      if (solid && blockedTiles) blockedTiles.add(`${r},${c}`)
    }
  }
}

// Keep the old name as an alias so nothing else breaks
function scatterTrees(scene, layout, buildings, count, zoneObjects) {
  scatterEnvironment(scene, layout, buildings, count, 'default', zoneObjects)
}

// Animated-door scope: ONLY buildings whose facade resolved to a Serene
// Village cottage prefab (buildingDoorAnimSpec returns non-null exclusively
// for that family - see tileGen.js) get an overlay sprite here. That's
// roughly a quarter of the "everyone else" wealth tier's homes (see
// brickOrPico8HomeKit), not all 129 buildings - deliberately scoped so the
// animation reads as "this recognizable house style has a working door"
// rather than a uniform tic applied to every building indiscriminately
// (district civic buildings, hideouts, and the other two home facade
// families all keep their door as a static painted-on frame, same as
// before this change).
function drawBuildings(scene, buildings, zoneObjects) {
  for (const b of buildings) {
    const x = b.tiles.c0 * TILE_SIZE
    const y = b.tiles.r0 * TILE_SIZE
    const w = (b.tiles.c1 - b.tiles.c0 + 1) * TILE_SIZE
    const h = (b.tiles.r1 - b.tiles.r0 + 1) * TILE_SIZE
    zoneObjects.push(...placeBuildingFacade(scene, x, y, w, h, b.color, b))
    const label = scene.add
      .text(x + w / 2, y - 12, b.label, { fontFamily: 'monospace', fontSize: '10px', color: '#ffffff' })
      .setOrigin(0.5, 1)
      .setDepth(y + h + 10)
    zoneObjects.push(label)

    const doorSpec = buildingDoorAnimSpec(b, x, y, w, h)
    if (doorSpec && scene.textures.exists(SERENE_VILLAGE_DOOR_KEY)) {
      const doorSprite = scene.add
        .sprite(doorSpec.x, doorSpec.y, SERENE_VILLAGE_DOOR_KEY, 0)
        .setOrigin(0, 0)
        .setScale(TILE_SIZE / 16)
      // +1 over the facade's own depth (set to y+h by placeBuildingFacade)
      // so the door sprite always draws on top of the static wall tile it's
      // overlaying, regardless of Phaser's tie-break order for equal depths.
      doorSprite.setDepth(y + h + 1)
      zoneObjects.push(doorSprite)
      scene.animatedDoors.push({ sprite: doorSprite, buildingId: doorSpec.buildingId, isOpen: false })
    }
  }
}

// ---------------- named-character agent spawning ----------------
// Every character in every roster (titans, crime syndicate, presidents, fed/
// ftc chairmen, agency heads) walks the merged mega-map as a live agent.
// Position and current action come from worldPresenceEngine.js - the same
// single source of truth the text modals read via dynamicScheduleEngine.js's
// adapter - so a character's on-map position and their modal's location text
// can never disagree (see updateNamedRoamers/refreshPresenceCache below).
// agentMovementEngine.js's TITAN_ROUTINES is no longer a position source
// (see that file's own header comment); homeDistrictFor below still reads it
// purely for home-city grouping. The "thought" strings ambient (non-named)
// wander NPCs use are still derived from each character's real roster data
// (platform, policy bias, syndicate territory, perk, archetype) rather than
// a generic shared string.

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

// House rule: worldPresenceEngine.js only advances what block a character is
// in when worldClock.timeBlockIndex itself advances (End Day presses) - see
// useGameStore.js's endDay(). Sprites still need to glide continuously in
// real time between End Day presses (freezing solid the instant a block
// resolves would be a visible regression from the old always-drifting
// TITAN_ROUTINES lerp), so updateNamedRoamers resolves BOTH the current
// block's building and this-next-block's building per character and
// interpolates between their door pixels using a real-time triangle wave
// (0->1->0, never snapping) rather than a one-shot lerp that would arrive
// and then sit still. This mirrors useGameStore.js's own End Day wraparound
// math exactly so "next block" here can never disagree with what actually
// happens when the player presses End Day.
function nextTimeBlock(day, timeBlockIndex) {
  let idx = timeBlockIndex + 1
  let nextDay = day
  if (idx >= TIME_BLOCKS.length) {
    idx = 0
    nextDay += 1
  }
  return { day: nextDay, timeBlockIndex: idx }
}

// How many agentClock units (see updateNamedRoamers - agentClock advances by
// delta/4000 each frame) one one-way glide between two doors takes. 5 units
// is the same pace the old TITAN_ROUTINES lerp used between schedule steps
// (~20 real seconds), kept for continuity of feel.
const PRESENCE_STEP_PERIOD = 5
// How often (ms) the presence cache is force-refreshed even without a block
// change, so a mid-block wantedLevel swing (police chase heat) is reflected
// within a few seconds instead of only at the next End Day.
const PRESENCE_RESOLVE_INTERVAL_MS = 2500

// Deterministic per-character phase so all 88 sprites don't glide back and
// forth in exact lockstep (same tiny hash pattern used elsewhere in this
// codebase for id-seeded, non-Math.random spread - see agentMovementEngine's
// hashSeed/characterDispositions's hashId).
function presencePhaseOffset(characterId) {
  let h = 0
  for (let i = 0; i < characterId.length; i++) h = (h * 31 + characterId.charCodeAt(i)) >>> 0
  return (h % 997) / 997
}

// Continuous 0->1->0 triangle wave (never jumps/snaps at the loop point) -
// the "stepProgress" a character's sprite lerps between its current-block
// and next-block door positions with.
function presenceStepProgress(agentClock, phaseOffset) {
  const x = agentClock / PRESENCE_STEP_PERIOD + phaseOffset
  const frac = x - Math.floor(x)
  return frac < 0.5 ? frac * 2 : (1 - frac) * 2
}

// House rule: the lerp above has nothing to interpolate between when a
// roamer's current-block and next-block buildingId are the SAME building
// (doorA === doorB in updateNamedRoamers) - measured as the common case by
// design (~49% of all character-instants frozen at any moment, up to ~79%
// for recluse tier, since staying put across consecutive blocks is normal
// behavior, not a glitch). Without something layered on top, that's a
// sprite pinned to one exact pixel with setMoving(false) killing its walk
// animation - forever, since worldPresenceEngine.js only advances a block on
// an End Day press (see the house rule above nextTimeBlock()). A character
// the simulation says is at building X must still read as unambiguously AT
// building X (see buildingDoorPixel's "ground truth" comment above) - so
// this is deliberately NOT "give them somewhere to walk", it's "make
// staying put look alive": a small idle mill/pace loop centered on the
// character's own door, added to rawPos in updateNamedRoamers BEFORE
// resolveOpenPosition so the existing building-footprint pushout still
// guards this position exactly like every other one. It's cosmetic,
// scene-layer motion only, applied after worldPresenceEngine.js has already
// resolved the real buildingId for this frame - worldPresenceEngine.js
// itself is untouched and stays pure, same as agentClock/presenceStepProgress
// never feeding anything back into it. Two sin/cos terms at different,
// golden-ratio-scaled (so never in sync) periods trace a wandering Lissajous
// loop instead of a straight back-and-forth line, so the two axes are
// (short of a measure-zero instant) never simultaneously motionless -
// updateNamedRoamers' moving/facing logic below leans on that to keep the
// walk-cycle animation playing and facing changes non-jittery. Per-character
// phase on both axes is the same hashId()-style deterministic hash as
// presencePhaseOffset() above / characterDispositions.js's hashId (no
// Math.random - see this file's and that file's other house rules on that),
// so the 88 sprites don't mill in lockstep. Radius is scaled by disposition
// tier (characterDispositions.js's getDisposition) - a recluse paces tight
// to their door, a socialite circulates wider - and the tuned radii below
// stay well under the ~160px minimum door-to-door spacing the generated map
// happens to have, so a drifting character's nearest door is always still
// their own.
function idleDriftHash(seed) {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0
  return h
}

const GOLDEN_RATIO = 1.6180339887498949
// agentClock units (see updateNamedRoamers - advances delta/4000 per frame,
// i.e. 1 unit = 4 real seconds, same units PRESENCE_STEP_PERIOD uses) for one
// full idle-drift loop on each axis - a handful of real seconds, so the mill
// reads as idle fidgeting rather than vibrating (too fast) or standing still
// (too slow). The Y period is the X period scaled by the golden ratio so the
// two never share a beat.
const IDLE_DRIFT_PERIOD_X = 1.8
const IDLE_DRIFT_PERIOD_Y = IDLE_DRIFT_PERIOD_X * GOLDEN_RATIO

const IDLE_DRIFT_RADIUS_BY_TIER = {
  recluse: 6,
  fugitive: 7,
  homebody: 9,
  regular: 12,
  socialite: 16,
}

function idleDriftOffset(characterId, agentClock, tier) {
  const radius = IDLE_DRIFT_RADIUS_BY_TIER[tier] ?? IDLE_DRIFT_RADIUS_BY_TIER.regular
  const phaseX = ((idleDriftHash(`${characterId}:driftX`) % 1000) / 1000) * Math.PI * 2
  const phaseY = ((idleDriftHash(`${characterId}:driftY`) % 1000) / 1000) * Math.PI * 2
  const x = Math.sin((agentClock / IDLE_DRIFT_PERIOD_X) * Math.PI * 2 + phaseX) * radius
  const y = Math.cos((agentClock / IDLE_DRIFT_PERIOD_Y) * Math.PI * 2 + phaseY) * radius
  return { x, y }
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

// ---------------------------------------------------------------------------
// Habitat animals (Cute_Fantasy_Free Chicken/Cow/Pig/Sheep) - see
// spawnHabitatAnimals/spawnWealthyPetPens below for where these get created.
// AnimalActor duck-types exactly the shape wanderActor (above) expects -
// .sprite/.shadow Phaser objects, .wanderTimer/.wanderDir state, and
// .setMoving/.setFacing/.update methods - so animals reuse wanderActor's
// existing collision-safe movement verbatim instead of a second movement
// system. Each animal sheet is a confirmed clean 2x2 grid of 32px walk-cycle
// frames (verified by cropping and viewing every cell); this renders a
// single static frame per animal rather than wiring a second per-species
// animation timer - "motionless but wandering" is an accepted simplification
// for a background decoration layer, not a bug.
// ---------------------------------------------------------------------------
const ANIMAL_FRAME_SIZE = 32

class AnimalActor {
  constructor(scene, x, y, textureKey) {
    this.scene = scene
    this.shadowOffsetY = 10
    this.shadow = scene.add.ellipse(x, y + this.shadowOffsetY, 16, 6, 0x000000, 0.3)
    this.sprite = scene.add.image(x, y, textureKey, 0)
    this.sprite.setScale(TILE_SIZE / ANIMAL_FRAME_SIZE)
    this.sprite.setDepth(y)
    this.shadow.setDepth(y - 1)
    this.wanderTimer = 0
    this.wanderDir = { x: 0, y: 0 }
    this.dead = false
  }

  get x() { return this.sprite.x }
  get y() { return this.sprite.y }

  setFacing(dir) {
    if (dir === 'left') this.sprite.setFlipX(true)
    else if (dir === 'right') this.sprite.setFlipX(false)
    // up/down: no distinct frames for these sheets, intentional no-op.
  }

  setMoving(_isMoving) {
    // Static single-frame pose - no walk-cycle to toggle, see class comment.
  }

  update(_delta) {
    this.shadow.setPosition(this.sprite.x, this.sprite.y + this.shadowOffsetY)
    this.sprite.setDepth(this.sprite.y)
    this.shadow.setDepth(this.sprite.y - 1)
  }

  destroy() {
    this.sprite.destroy()
    this.shadow.destroy()
  }
}

const HABITAT_ANIMAL_TEXTURE_KEYS = [
  HABITAT_ASSET_KEYS.chicken,
  HABITAT_ASSET_KEYS.cow,
  HABITAT_ASSET_KEYS.pig,
  HABITAT_ASSET_KEYS.sheep,
]

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
    // Parked/atmosphere cars in the current zone (only ever populated for
    // 'overworld' - see spawnWorldVehicles/clearZoneObjects). Each entry:
    // { tierId, name, spriteName, speedMultiplier, scale, col, row, owned, actor }.
    this.vehicleActors = []
    // Set while the player is driving one of the entries above; that entry's
    // VehicleActor is repositioned onto this.playerActor's (hidden) position
    // every frame instead of a second movement system - see update().
    this.drivingEntry = null
    // '{row},{col}' keys for scattered trees/rocks (see scatterEnvironment) -
    // rebuilt fresh each buildOverworldZone() call, consulted by
    // isBlockedTile so the player/NPCs/vehicles can't walk or drive through
    // them the way they could before this set existed.
    this.blockedEnvironmentTiles = new Set()
    // Ambient wandering habitat animals (small grass-cluster critters plus
    // the 1-2 exotic pets inside a wealthy home's fenced pen) - see
    // spawnHabitatAnimals/spawnWealthyPetPens. Rebuilt fresh each
    // buildOverworldZone() call and updated every frame the same way
    // financeAmbientActors are (see updateHabitatAnimals/update()).
    this.habitatAnimalActors = []
    // Animated door overlays (Serene Village cottage homes only - see
    // drawBuildings/updateAnimatedDoors). Each entry: { sprite, buildingId,
    // isOpen }. Rebuilt fresh each buildOverworldZone() call; the sprites
    // themselves live in zoneObjects too and get destroyed by
    // clearZoneObjects the normal way, this array just tracks anim state.
    this.animatedDoors = []
    this.agentClock = 0
    // Keyed by characterId -> { currentBuildingId, nextBuildingId, action },
    // refreshed by refreshPresenceCache() on block change / throttle interval
    // (see PRESENCE_RESOLVE_INTERVAL_MS) rather than every frame - see the
    // house-rule comment above nextTimeBlock().
    this.presenceCache = new Map()
    this.presenceBlockKey = null
    this.presenceResolveTimer = 0
  }

  preload() {
    preloadTerrainAssets(this)
    preloadPlayerSheet(this)
    preloadVehicleAssets(this)
    preloadChapelPack(this)
    preloadChapelMap(this)
    preloadChapelExterior(this)
    preloadCuteTerrain(this)
  }

  create() {
    useGameStore.getState().initFinanceMarket()
    // Carves the 3 true-top-down car frames out of the pico-8-city sheet
    // (vehicleGen.js) - must happen after preload's load.image() lands, so
    // create() rather than preload(). Idempotent, safe on scene restart.
    ensurePico8CarFrames(this)
    // Registers the 'open'/'close' anims on this scene's AnimationManager -
    // must happen after preload's load.spritesheet() lands, same reasoning
    // as ensurePico8CarFrames above.
    ensureSereneVillageDoorAnims(this)

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
    // Fired by WorldScreen.jsx for both a legit transit-hub purchase and a
    // successful theft (same event, same payload shape - see that file's
    // handleAcquireVehicle/handleVehicleStolen). If the car already exists
    // in the world (the common case: all 3 hub tiers and every atmosphere
    // car are always spawned, see spawnWorldVehicles), just flip it to
    // owned in place rather than spawning a duplicate.
    this.bridge?.on('acquireVehicle', (vehicle) => {
      this.onAcquireVehicle(vehicle)
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
    else if (zoneId === 'chapelInterior') this.buildChapelInteriorZone()
    else if (zoneId === 'chapelExterior') this.buildChapelExteriorZone()
    else if (zoneId === 'teaHouseInterior') this.buildTeaHouseInteriorZone()
    else this.buildGenericInteriorZone(this.currentInteriorBuildingId)

    const zone = ZONES[zoneId]
    this.cameras.main.setBounds(0, 0, zone.cols * TILE_SIZE, zone.rows * TILE_SIZE)
    // Arcade Physics world bounds default to the 800x500 canvas size, not
    // the zone size - without this the player's collideWorldBounds body
    // gets clamped back inside that small box while walking.
    this.physics.world.setBounds(0, 0, zone.cols * TILE_SIZE, zone.rows * TILE_SIZE)
    if (teleportPlayer) {
      // chapelInterior/teaHouseInterior carry their own room-specific spawn
      // tile (their rooms aren't INTERIOR_COLS/ROWS-shaped) - every other
      // interior still reuses the one shared INTERIOR_SPAWN.
      const spawn =
        zoneId === 'overworld'
          ? this.overworldReturnSpawn
          : zoneId === 'chapelInterior'
            ? CHAPEL_ROOM.spawn
            : zoneId === 'chapelExterior'
              ? CHAPEL_EXTERIOR_ROOM.spawn
            : zoneId === 'teaHouseInterior'
              ? TEA_HOUSE_ROOM.spawn
              : INTERIOR_SPAWN
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
      if (roamer.carActor) roamer.carActor.destroy()
    }
    for (const actor of this.financeAmbientActors) actor.destroy()
    for (const animal of this.habitatAnimalActors) animal.destroy()
    for (const vehicle of this.vehicleActors) vehicle.actor.destroy()
    this.namedRoamers = []
    this.financeNamedNpcActors = {}
    this.financeAmbientActors = []
    this.habitatAnimalActors = []
    this.vehicleActors = []
    // The sprites themselves are already destroyed above (they're in
    // zoneObjects) - this just drops the now-stale anim-state entries.
    this.animatedDoors = []
    // Zone-persistence house rule: vehicles only ever live in the
    // 'overworld' zone (interiors have their own collision and no cars), and
    // driving never carries across a zone load - buildings/exits already
    // call exitVehicle() first (see triggerInteraction), this is just the
    // safety net for any path that doesn't (e.g. the trainStation/
    // teleportToCity city-travel shortcuts). Owned vehicles aren't lost -
    // spawnWorldVehicles respawns every store-owned tier near the station
    // when 'overworld' loads back in.
    if (this.drivingEntry) {
      this.drivingEntry = null
      this.tileMover.stepDurationMs = 160
      this.playerActor.sprite.setVisible(true)
      this.playerActor.shadow.setVisible(true)
      useGameStore.getState().setDriving(false)
    }
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
    this.blockedEnvironmentTiles = new Set()
    scatterEnvironment(this, this.financeLayout, FINANCE_BUILDINGS, 80, this.zoneObjects, this.blockedEnvironmentTiles)

    drawBuildings(this, FINANCE_BUILDINGS, this.zoneObjects)

    // Small, bounded "wealth flex" pens (a handful of the richest homes get a
    // fenced-in exotic pet) and the general ambient-animal habitat clusters -
    // both after drawBuildings so FINANCE_BUILDINGS' final tile rects exist,
    // and after scatterEnvironment above so blockedEnvironmentTiles is
    // populated for the "near a tree" placement bias / pen-fence collision.
    this.spawnWealthyPetPens()
    this.spawnHabitatAnimals()

    // City-specific landmark buildings overlay (now District-specific)
    this.drawCityLandmarkOverlay()

    this.spawnNamedRoamers()
    this.spawnFinanceAmbientNpcs()
    // Building interaction zones (this.zones) have to exist BEFORE vehicles
    // spawn - adjacentOpenTiles below checks candidate tiles against them so
    // a parked car never lands inside a building's own (padded) interact
    // rect, which would make the car unreachable (its zone always loses to
    // the building's in updateNearbyZone's static-zone-first check).
    this.buildOverworldZones()
    this.spawnWorldVehicles()

    this.regionLabel.setText('Capital Syndicate Mega-Map')
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
    const template = interiorTemplateFor(building)

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

  // Real tile-based rooms built from the chapel pack's Walls_Interior
  // tileset via the generic buildTmxWallInteriorZone builder (see
  // src/game/interiors/tmxWallInterior.js) - the `temple` building
  // (Whispering Temple) gets the actual chapel interior; `teaHouse` reuses
  // the exact same wall/floor tileset in a much smaller room, proving it's
  // genuinely general-purpose rather than chapel-only. Both keep their
  // existing building id in the desk zone so TempleModal / DistrictBuildingModal
  // routing in WorldScreen.jsx (which key off that id, not npcId) is untouched.
  // The chapel now renders the pack's OWN authored room (Interior.tmx via
  // tmxMapInterior.js) rather than a hand-placed approximation of it - see
  // that file's header for why. teaHouse still uses the hand-placed builder,
  // which remains the right tool for rooms with no authored map to copy.
  buildChapelInteriorZone() {
    const { zones, blockedTiles } = buildChapelMapZone(this, this.zoneObjects, Phaser, TILE_SIZE)
    this.interiorBlockedTiles = blockedTiles
    this.zones = zones
  }

  // Short camera fade around a zone change, used for the chapel's nested
  // doors (courtyard <-> interior) so walking through reads as a door
  // opening rather than an instant cut. Deliberately NOT an animated door
  // sprite: the chapel pack ships no door-open art at all (no door/gate
  // asset, and Exterior.tmx's animation entries are all dragon wings), so
  // a real open/close would mean fabricating frames that don't exist.
  // `zoneTransitioning` guards against a second trigger landing mid-fade,
  // which would otherwise queue two loadZone calls.
  transitionToZone(zoneId, duration = 160) {
    if (this.zoneTransitioning) return
    this.zoneTransitioning = true
    const cam = this.cameras.main
    cam.fadeOut(duration, 0, 0, 0)
    cam.once('camerafadeoutcomplete', () => {
      this.loadZone(zoneId)
      cam.fadeIn(duration, 0, 0, 0)
      this.zoneTransitioning = false
    })
  }

  buildChapelExteriorZone() {
    const { zones, blockedTiles } = buildChapelExteriorZone(this, this.zoneObjects, Phaser, TILE_SIZE)
    this.interiorBlockedTiles = blockedTiles
    this.zones = zones
  }

  buildTeaHouseInteriorZone() {
    const { zones, blockedTiles } = buildTmxWallInteriorZone(this, TEA_HOUSE_ROOM, this.zoneObjects, Phaser, TILE_SIZE)
    this.interiorBlockedTiles = blockedTiles
    this.zones = zones
  }

  // ---------------- collision ----------------

  isBlockedTile(col, row) {
    if (
      this.currentZoneId === 'chapelInterior' ||
      this.currentZoneId === 'chapelExterior' ||
      this.currentZoneId === 'teaHouseInterior'
    ) {
      const zone = ZONES[this.currentZoneId]
      if (col < 0 || col >= zone.cols || row < 0 || row >= zone.rows) return true
      return this.interiorBlockedTiles?.has(`${col},${row}`) ?? false
    }
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
    // Water (isSingleTileObstacle) was rendered as a distinct tile type
    // (financeTileType/WATER_ROWS) but never actually stopped anyone - the
    // player, NPCs, and vehicles could all walk/drive straight across the
    // coastal rows. No swimming/boat mechanic exists, so treat it as fully
    // impassable, same as a wall. A parked/idle vehicle blocks its own tile
    // too (excluding whichever entry is currently being driven - that one's
    // position just mirrors the player's own already-validated TileMover
    // position, not a second body that could collide with it).
    if (this.isSingleTileObstacle(col, row)) return true
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
  // A single tile (not a whole building rect) is solid for a continuously-
  // moving actor: a scattered tree/rock, a water tile (see isBlockedTile -
  // no swimming/boat mechanic exists), or a parked vehicle that isn't the
  // one currently being driven. Shared by resolveOpenPosition below instead
  // of duplicating the same nearest-edge push-out three times.
  isSingleTileObstacle(col, row) {
    if (this.blockedEnvironmentTiles?.has(`${row},${col}`)) return true
    if (this.financeLayout?.[row]?.[col] === 'water') return true
    if (this.vehicleActors) {
      for (const v of this.vehicleActors) {
        if (v === this.drivingEntry) continue
        if (v.col === col && v.row === row) return true
      }
    }
    return false
  }

  resolveOpenPosition(x, y) {
    if (this.currentZoneId !== 'overworld') return { x, y, blocked: false }
    const col = Math.floor(x / TILE_SIZE)
    const row = Math.floor(y / TILE_SIZE)
    const building = FINANCE_BUILDINGS.find(
      (b) => col >= b.tiles.c0 && col <= b.tiles.c1 && row >= b.tiles.r0 && row <= b.tiles.r1
    )
    // Same nearest-edge push-out as the building case below, just against a
    // single tile's bounds instead of a building rect.
    if (!building && this.isSingleTileObstacle(col, row)) {
      const pad = TILE_SIZE * 0.5
      const left = col * TILE_SIZE - pad
      const right = (col + 1) * TILE_SIZE + pad
      const top = row * TILE_SIZE - pad
      const bottom = (row + 1) * TILE_SIZE + pad
      const tileEdges = [
        { side: 'left', d: x - left },
        { side: 'right', d: right - x },
        { side: 'top', d: y - top },
        { side: 'bottom', d: bottom - y },
      ].sort((a, b) => a.d - b.d)
      const closestTileEdge = tileEdges[0].side
      if (closestTileEdge === 'left') return { x: left, y, blocked: true }
      if (closestTileEdge === 'right') return { x: right, y, blocked: true }
      if (closestTileEdge === 'top') return { x, y: top, blocked: true }
      return { x, y: bottom, blocked: true }
    }
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
        phaseOffset: presencePhaseOffset(character.id),
        currentAction: '',
        dead: false,
      }
      this.namedRoamers.push(roamer)
      this.financeNamedNpcActors[character.id] = actor
    }
    // Spawning happens before the first updateNamedRoamers tick has anything
    // cached, so force a synchronous resolve now rather than leaving every
    // roamer at its (-100,-100) placeholder for one frame.
    this.refreshPresenceCache()
    this.updateNamedRoamers(0)
  }

  // Real live-map pixel position just outside a building's south edge (the
  // same "stand outside the door" convention triggerInteraction uses for
  // overworldReturnSpawn) - the ground truth for "this character is
  // physically at this building", not just narrating it.
  buildingDoorPixel(buildingId) {
    const b = FINANCE_BUILDINGS.find((bd) => bd.id === buildingId)
    if (!b) return null
    return {
      x: ((b.tiles.c0 + b.tiles.c1 + 1) / 2) * TILE_SIZE,
      y: (b.tiles.r1 + 1) * TILE_SIZE + TILE_SIZE / 2,
    }
  }

  // Resolves every named roamer's current-block and next-block buildingId
  // from worldPresenceEngine.js (the same single source of truth the text
  // modals read) and caches the pair, keyed by characterId. Called on block
  // change and on a throttle (see PRESENCE_RESOLVE_INTERVAL_MS in
  // updateNamedRoamers) rather than every frame - resolving all 88
  // characters twice (current + next block) is cheap at that cadence but
  // wasteful at 60fps.
  refreshPresenceCache() {
    if (!this.namedRoamers.length) return
    const store = useGameStore.getState()
    const worldClock = store.worldClock || { day: 1, timeBlockIndex: 0 }
    const upcoming = nextTimeBlock(worldClock.day, worldClock.timeBlockIndex)
    const ids = this.namedRoamers.map((r) => r.agent.id)
    const baseCtx = { runSeed: store.runSeed, wantedLevel: store.wantedLevel }
    const currentPresence = simulateWorldPresence(ids, { ...baseCtx, day: worldClock.day, timeBlockIndex: worldClock.timeBlockIndex })
    const nextPresence = simulateWorldPresence(ids, { ...baseCtx, day: upcoming.day, timeBlockIndex: upcoming.timeBlockIndex })
    const cache = new Map()
    for (let i = 0; i < ids.length; i++) {
      cache.set(ids[i], {
        currentBuildingId: currentPresence[i].buildingId,
        nextBuildingId: nextPresence[i].buildingId,
        action: currentPresence[i].action,
      })
    }
    this.presenceCache = cache
    this.presenceBlockKey = `${worldClock.day}|${worldClock.timeBlockIndex}`
  }

  updateNamedRoamers(delta) {
    if (!this.namedRoamers.length) return
    // agentClock now only drives the continuous door-to-door glide (see
    // presenceStepProgress) - it no longer indexes into a schedule array,
    // that whole position path (agentMovementEngine.updateAgentPositions) is
    // retired in favor of worldPresenceEngine.js (see the house-rule comment
    // above nextTimeBlock()).
    this.agentClock += delta / 4000
    this.presenceResolveTimer += delta
    const worldClock = useGameStore.getState().worldClock || { day: 1, timeBlockIndex: 0 }
    const blockKey = `${worldClock.day}|${worldClock.timeBlockIndex}`
    if (blockKey !== this.presenceBlockKey || this.presenceResolveTimer >= PRESENCE_RESOLVE_INTERVAL_MS) {
      this.presenceResolveTimer = 0
      this.refreshPresenceCache()
    }

    const px = this.playerActor?.x ?? -9999
    const py = this.playerActor?.y ?? -9999
    for (const roamer of this.namedRoamers) {
      if (roamer.dead) continue
      const presence = this.presenceCache.get(roamer.agent.id)
      roamer.currentAction = presence?.action || ''
      // worldPresenceEngine.js guarantees buildingId is always a real
      // building id (home_<id> or one of the 41 hand-authored ones), so
      // doorA/doorB should always resolve - the final else branch is
      // defensive only, for a roster id that somehow has no disposition.
      const doorA = presence ? this.buildingDoorPixel(presence.currentBuildingId) : null
      const doorB = presence ? this.buildingDoorPixel(presence.nextBuildingId) : null
      let rawPos
      if (doorA && doorB) {
        const t = presenceStepProgress(this.agentClock, roamer.phaseOffset)
        rawPos = { x: doorA.x + (doorB.x - doorA.x) * t, y: doorA.y + (doorB.y - doorA.y) * t }
      } else if (doorA) {
        rawPos = doorA
      } else {
        rawPos = { x: roamer.actor.x, y: roamer.actor.y }
      }
      if (doorA) {
        const tier = getDisposition(roamer.agent.id)?.tier
        const drift = idleDriftOffset(roamer.agent.id, this.agentClock, tier)
        rawPos = { x: rawPos.x + drift.x, y: rawPos.y + drift.y }
      }
      const { x, y } = this.resolveOpenPosition(rawPos.x, rawPos.y)
      const dx = x - roamer.actor.x
      const dy = y - roamer.actor.y
      const movedDist = Math.abs(dx) + Math.abs(dy)
      roamer.actor.sprite.setPosition(x, y)
      // "moving" tracks having a real door anchor (see the idleDriftOffset
      // house rule above) rather than a per-frame pixel delta, which can dip
      // below threshold right at a drift turning point and falsely freeze
      // the walk cycle; facing only updates on frames that moved enough to
      // have a dominant axis, so it no longer flips on sub-pixel deltas.
      roamer.actor.setMoving(Boolean(doorA))
      if (movedDist > 0.05) {
        if (Math.abs(dx) > Math.abs(dy)) roamer.actor.setFacing(dx > 0 ? 'right' : 'left')
        else roamer.actor.setFacing(dy > 0 ? 'down' : 'up')
      }
      roamer.actor.update(delta)

      // Titans/socialites (npcVehicleFor - same gating that decides who can
      // OWN a car, see vehicleGen.js) render as their car while actually
      // travelling door-to-door (currentBuildingId !== nextBuildingId) -
      // reusing (x,y), the exact post-resolveOpenPosition point the walking
      // sprite above already got pushed out of building footprints to, so a
      // driving NPC is never worse-guarded than a walking one (see this
      // file's own house-rule comment on that ~12.4% lerp-clips-corners rough
      // edge - not attempting to fix it here, just not bypassing its guard).
      // Milling in place (doorA===doorB) shows the walking sprite instead -
      // a character standing at their own door should read as a person, not
      // a parked car mid-pavement.
      const vehicleSpec = npcVehicleFor(roamer.character)
      const travelling = Boolean(doorA && doorB && presence?.currentBuildingId !== presence?.nextBuildingId)
      if (vehicleSpec && travelling) {
        if (!roamer.carActor) roamer.carActor = new VehicleActor(this, x, y, { spriteName: vehicleSpec.spriteName, scale: vehicleSpec.scale, atlasKey: vehicleSpec.atlasKey })
        roamer.carActor.setPosition(x, y)
        roamer.carActor.faceVector(dx, dy)
        roamer.carActor.setVisible(true)
        roamer.actor.sprite.setVisible(false)
        roamer.actor.shadow.setVisible(false)
      } else {
        if (roamer.carActor) roamer.carActor.setVisible(false)
        roamer.actor.sprite.setVisible(true)
        roamer.actor.shadow.setVisible(true)
      }

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
      if (roamer.carActor) roamer.carActor.setVisible(false)
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

  // ---------------- habitat animals ----------------
  // Small, bounded ambient decoration - a handful of grass-cluster critters
  // (this method) plus a few fenced "wealth flex" exotic pets
  // (spawnWealthyPetPens below). Both create AnimalActor instances and push
  // them into this.habitatAnimalActors, updated every frame by
  // updateHabitatAnimals via the shared wanderActor() function - not a
  // second movement system.

  // Roughly 2-3 small clusters of 2-4 animals each, biased toward landing
  // near an existing scattered tree/rock (blockedEnvironmentTiles, populated
  // by scatterEnvironment just before this runs - see buildOverworldZone) so
  // they read as loitering near a landmark rather than scattered uniformly
  // across the whole map; falls back to any open grass tile if no
  // tree/rock-adjacent spot is found within the try budget.
  spawnHabitatAnimals() {
    const treeTiles = []
    for (const key of this.blockedEnvironmentTiles) {
      const [r, c] = key.split(',').map(Number)
      treeTiles.push({ r, c })
    }

    const clusterCount = 2 + Math.floor(Math.random() * 2) // 2-3 clusters
    for (let cluster = 0; cluster < clusterCount; cluster++) {
      let anchor = null
      for (let tries = 0; tries < 40 && !anchor; tries++) {
        let r
        let c
        if (treeTiles.length && Math.random() < 0.7) {
          const t = treeTiles[Math.floor(Math.random() * treeTiles.length)]
          r = t.r + Math.floor(Math.random() * 5) - 2 // +/- 2 tiles of a tree/rock
          c = t.c + Math.floor(Math.random() * 5) - 2
        } else {
          r = 4 + Math.floor(Math.random() * (MAP_ROWS - 6)) // skip the coastal water channel
          c = 1 + Math.floor(Math.random() * (MAP_COLS - 2))
        }
        if (r < 1 || r >= MAP_ROWS - 1 || c < 1 || c >= MAP_COLS - 1) continue
        if (this.financeLayout[r]?.[c] !== 'grass') continue
        if (this.isBlockedTile(c, r)) continue
        anchor = { r, c }
      }
      if (!anchor) continue

      const size = 2 + Math.floor(Math.random() * 3) // 2-4 animals per cluster
      for (let i = 0; i < size; i++) {
        let spot = null
        for (let tries = 0; tries < 15 && !spot; tries++) {
          const rr = anchor.r + Math.floor(Math.random() * 3) - 1
          const cc = anchor.c + Math.floor(Math.random() * 3) - 1
          if (rr < 1 || rr >= MAP_ROWS - 1 || cc < 1 || cc >= MAP_COLS - 1) continue
          if (this.financeLayout[rr]?.[cc] !== 'grass') continue
          if (this.isBlockedTile(cc, rr)) continue
          spot = { r: rr, c: cc }
        }
        if (!spot) continue
        const textureKey = HABITAT_ANIMAL_TEXTURE_KEYS[Math.floor(Math.random() * HABITAT_ANIMAL_TEXTURE_KEYS.length)]
        const animal = new AnimalActor(this, spot.c * TILE_SIZE + TILE_SIZE / 2, spot.r * TILE_SIZE + TILE_SIZE / 2, textureKey)
        this.habitatAnimalActors.push(animal)
      }
    }
  }

  // First open (grass, not a building/tree/rock/other-reserved-cell) WxH
  // rectangle found among a handful of fixed offsets adjacent to `home`'s
  // footprint (below/above/right/left, each tried at two alignments) -
  // simpler than a full ring search since pen placement is low-stakes (skip
  // the character entirely if nothing fits, per the project brief). Mirrors
  // the forbidden-zone style scatterEnvironment/adjacentOpenTiles already use
  // in this file, just for a multi-tile rect instead of single tiles.
  findPenSpot(home, w, h, buildingTileSet, usedPenTiles) {
    const { c0: hc0, r0: hr0, c1: hc1, r1: hr1 } = home.tiles
    const candidates = [
      { c0: hc0, r0: hr1 + 1 }, // below, left-aligned
      { c0: hc1 - w + 1, r0: hr1 + 1 }, // below, right-aligned
      { c0: hc0, r0: hr0 - h }, // above, left-aligned
      { c0: hc1 - w + 1, r0: hr0 - h }, // above, right-aligned
      { c0: hc1 + 1, r0: hr0 }, // right, top-aligned
      { c0: hc1 + 1, r0: hr1 - h + 1 }, // right, bottom-aligned
      { c0: hc0 - w, r0: hr0 }, // left, top-aligned
      { c0: hc0 - w, r0: hr1 - h + 1 }, // left, bottom-aligned
    ]
    for (const { c0, r0 } of candidates) {
      if (c0 < 1 || r0 < 1 || c0 + w - 1 >= MAP_COLS - 1 || r0 + h - 1 >= MAP_ROWS - 1) continue
      let ok = true
      for (let r = r0; r < r0 + h && ok; r++) {
        for (let c = c0; c < c0 + w && ok; c++) {
          const key = `${r},${c}`
          if (this.financeLayout[r]?.[c] !== 'grass') ok = false
          else if (buildingTileSet.has(key)) ok = false
          else if (usedPenTiles.has(key)) ok = false
          else if (this.blockedEnvironmentTiles.has(key)) ok = false
        }
      }
      if (ok) return { c0, r0 }
    }
    return null
  }

  // The "exotic pets as a wealth flex" detail: a small, fixed number of the
  // wealthiest homes (by the SAME billionaire signal tileGen.js's
  // packFacadeFor uses for the stone-cottage tier - see WEALTH_STONE_THRESHOLD)
  // get a small fenced pen next to their home with 1-2 animals wandering only
  // inside it. Deliberately capped at PET_PEN_COUNT - this is flavor for a
  // handful of the richest characters, not a mechanic for all 88 homes.
  spawnWealthyPetPens() {
    const PET_PEN_COUNT = 5
    const PET_PEN_W = 4
    const PET_PEN_H = 4

    const wealthyHomes = FINANCE_BUILDINGS.filter((b) => b.kind === 'home')
      .map((b) => ({ building: b, netWorth: getAnyCharacter(b.npcId)?.netWorth ?? 0 }))
      .filter((h) => h.netWorth >= WEALTH_STONE_THRESHOLD)
      .sort((a, b) => b.netWorth - a.netWorth)
      .slice(0, PET_PEN_COUNT)

    const buildingTileSet = new Set()
    for (const b of FINANCE_BUILDINGS) {
      for (let r = b.tiles.r0; r <= b.tiles.r1; r++) {
        for (let c = b.tiles.c0; c <= b.tiles.c1; c++) buildingTileSet.add(`${r},${c}`)
      }
    }
    const usedPenTiles = new Set()

    for (const { building: home } of wealthyHomes) {
      const spot = this.findPenSpot(home, PET_PEN_W, PET_PEN_H, buildingTileSet, usedPenTiles)
      if (!spot) continue // low-stakes decoration - skip rather than force an overlap
      const { c0, r0 } = spot
      const px = c0 * TILE_SIZE
      const py = r0 * TILE_SIZE
      const fenceObjs = placeFencePen(this, px, py, PET_PEN_W * TILE_SIZE, PET_PEN_H * TILE_SIZE, TILE_SIZE)
      this.zoneObjects.push(...fenceObjs)

      // Perimeter fence cells read as solid exactly like a scattered
      // tree/rock (see scatterEnvironment/blockedEnvironmentTiles), reusing
      // isBlockedTile/resolveOpenPosition's existing collision path instead
      // of a new one - this is also what keeps the pen's animals contained
      // without a separate pen-bounds check.
      for (let c = c0; c < c0 + PET_PEN_W; c++) {
        this.blockedEnvironmentTiles.add(`${r0},${c}`)
        this.blockedEnvironmentTiles.add(`${r0 + PET_PEN_H - 1},${c}`)
        usedPenTiles.add(`${r0},${c}`)
        usedPenTiles.add(`${r0 + PET_PEN_H - 1},${c}`)
      }
      for (let r = r0; r < r0 + PET_PEN_H; r++) {
        this.blockedEnvironmentTiles.add(`${r},${c0}`)
        this.blockedEnvironmentTiles.add(`${r},${c0 + PET_PEN_W - 1}`)
        usedPenTiles.add(`${r},${c0}`)
        usedPenTiles.add(`${r},${c0 + PET_PEN_W - 1}`)
      }

      const interior = []
      for (let r = r0 + 1; r < r0 + PET_PEN_H - 1; r++) {
        for (let c = c0 + 1; c < c0 + PET_PEN_W - 1; c++) {
          interior.push({ r, c })
          usedPenTiles.add(`${r},${c}`) // reserve interior too, so other pens/clusters skip it
        }
      }
      const animalCount = Math.min(interior.length, 1 + Math.floor(Math.random() * 2)) // 1-2
      for (let i = 0; i < animalCount; i++) {
        const idx = Math.floor(Math.random() * interior.length)
        const { r, c } = interior.splice(idx, 1)[0]
        const textureKey = HABITAT_ANIMAL_TEXTURE_KEYS[Math.floor(Math.random() * HABITAT_ANIMAL_TEXTURE_KEYS.length)]
        const animal = new AnimalActor(this, c * TILE_SIZE + TILE_SIZE / 2, r * TILE_SIZE + TILE_SIZE / 2, textureKey)
        this.habitatAnimalActors.push(animal)
      }
    }
  }

  // Reuses wanderActor verbatim (see updateAllAmbientNpcs below for the
  // identical pattern with financeAmbientActors) for the free movement, then
  // adds the one check wanderActor/resolveOpenPosition don't do themselves:
  // resolveOpenPosition only stops actors at solid obstacles (buildings,
  // scattered trees/rocks, and now pen fences), not by terrain TYPE, so an
  // animal could otherwise wander from grass onto a path/water tile. If the
  // post-wander tile isn't grass, the move is reverted and the wander timer
  // is reset so a new (hopefully open) direction gets picked next tick -
  // exactly the same "blocked" recovery wanderActor already uses for walls.
  updateHabitatAnimals(delta) {
    for (const animal of this.habitatAnimalActors) {
      const prevX = animal.x
      const prevY = animal.y
      wanderActor(this, animal, delta, 16)
      const col = Math.floor(animal.x / TILE_SIZE)
      const row = Math.floor(animal.y / TILE_SIZE)
      if (this.financeLayout[row]?.[col] !== 'grass') {
        animal.sprite.setPosition(prevX, prevY)
        animal.wanderTimer = 0
      }
    }
  }

  // ---------------- vehicles ----------------
  // Real, walk-up-and-press-E world objects (drive-if-owned, steal-if-not) -
  // not a second collision/movement system, see enterVehicle/exitVehicle and
  // the driving branch in update(). Only ever built for the 'overworld' zone
  // (see clearZoneObjects/buildOverworldZone).

  // First `count` open tiles (per isBlockedTile - the same authority the
  // player's own TileMover uses) found by scanning outward ring-by-ring from
  // `building`'s footprint, skipping any tile another vehicle already
  // occupies AND any tile still inside some building's own (padded)
  // interaction rect (this.zones, built before this ever runs - see
  // buildOverworldZone). That second check matters even though ring 1 is
  // already outside `building`'s own footprint: this.zones rects are padded
  // by TILE_SIZE/2 past the footprint (see buildOverworldZones), so a tile
  // one step out can still have its pixel center inside that padded rect -
  // and a car parked there would be permanently unreachable, since
  // updateNearbyZone tests static (building) zones before vehicle zones.
  // Rings widen (rather than a fixed 1-tile ring) so this keeps searching
  // past the padding instead of returning fewer than `count` tiles. Never
  // hardcoded: the finance map's building layout is itself generated (see
  // layoutFinanceMap), so a fixed offset could land inside a footprint, a
  // wall, or another building's rect the moment the roster changes.
  // True if the tile's pixel center falls inside ANY building's interaction
  // rect (this.zones - padded TILE_SIZE/2 past the footprint, see
  // buildOverworldZones). A vehicle parked there would be permanently
  // unreachable: updateNearbyZone tests static (building) zones before
  // vehicle zones, so the building always wins the interaction. Requires
  // this.zones to already be built (buildOverworldZone calls
  // buildOverworldZones() before spawning any vehicle - see that method).
  isInsideAnyBuildingZone(col, row) {
    const px = col * TILE_SIZE + TILE_SIZE / 2
    const py = row * TILE_SIZE + TILE_SIZE / 2
    return this.zones.some((z) => z.type === 'building' && Phaser.Geom.Rectangle.Contains(z.rect, px, py))
  }

  // First `count` open tiles (per isBlockedTile - the same authority the
  // player's own TileMover uses) found by scanning outward ring-by-ring from
  // `building`'s footprint, skipping any tile another vehicle already
  // occupies AND any tile isInsideAnyBuildingZone (see that method - matters
  // even though ring 1 is already outside `building`'s own footprint,
  // because zone rects are padded past it and a neighboring building's rect
  // can also reach in). Rings widen (rather than stopping at a fixed 1-tile
  // ring) so this keeps searching past the padding instead of silently
  // returning fewer than `count` tiles. Never hardcoded: the finance map's
  // building layout is itself generated (see layoutFinanceMap), so a fixed
  // offset could land inside a footprint, a wall, or another building's rect
  // the moment the roster changes.
  adjacentOpenTiles(building, count) {
    const tiles = []
    const occupied = new Set(this.vehicleActors.map((v) => `${v.col},${v.row}`))
    const { c0, r0, c1, r1 } = building.tiles
    const MAX_RING = 6
    for (let ring = 1; ring <= MAX_RING && tiles.length < count; ring++) {
      for (let r = r0 - ring; r <= r1 + ring && tiles.length < count; r++) {
        for (let c = c0 - ring; c <= c1 + ring && tiles.length < count; c++) {
          const onRing = r === r0 - ring || r === r1 + ring || c === c0 - ring || c === c1 + ring
          if (!onRing) continue
          const key = `${c},${r}`
          if (occupied.has(key)) continue
          if (this.isBlockedTile(c, r)) continue
          if (this.isInsideAnyBuildingZone(c, r)) continue
          tiles.push({ col: c, row: r })
        }
      }
    }
    return tiles
  }

  spawnVehicleEntry({ tierId, name, spriteName, speedMultiplier, scale, col, row, owned, atlasKey }) {
    const { x, y } = this.tileMover.tileCenter(col, row)
    const actor = new VehicleActor(this, x, y, { spriteName, scale, atlasKey })
    const entry = { tierId, name, spriteName, speedMultiplier, scale, col, row, owned, atlasKey, actor }
    this.vehicleActors.push(entry)
    return entry
  }

  spawnWorldVehicles() {
    const owned = useGameStore.getState().world2.transitState?.ownedVehicles || []
    const isOwned = (tierId) => owned.some((v) => v.tierId === tierId)
    // Restores an OWNED vehicle to the exact tile it was last parked at
    // (see updateOwnedVehiclePosition, called from exitVehicle/
    // onAcquireVehicle below) instead of its default fixed/random slot -
    // reported by the user: "if i stole or buy it and i enter the house
    // when i came out, the car disappear, it should stay there". House
    // rule found while fixing this: EVERY vehicle tierId that can ever be
    // `owned` is unconditionally re-spawned by one of the three blocks
    // below on every 'overworld' load (that's how they show up as theft/
    // rent targets before being owned at all) - so "respawn near the
    // station" was never actually a fallback for an uncovered case, it was
    // silently overriding this exact spot on every single zone reload.
    // Falls back to `fallbackTile` only when there's no stored position
    // yet (never parked since being acquired) or the stored tile is no
    // longer valid (e.g. something else now occupies it).
    const restoredTile = (tierId, fallbackTile) => {
      const record = owned.find((v) => v.tierId === tierId)
      if (
        record &&
        Number.isFinite(record.col) &&
        Number.isFinite(record.row) &&
        !this.isBlockedTile(record.col, record.row) &&
        !this.isInsideAnyBuildingZone(record.col, record.row)
      ) {
        return { col: record.col, row: record.row }
      }
      return fallbackTile
    }

    // The 3 transit-hub tiers double as theft targets before purchase and as
    // the player's own car once bought (see interactiveLocations.js's
    // transit_hub options - reused directly rather than re-declaring the
    // same name/speedMultiplier/spriteName here).
    const trainStation = FINANCE_BUILDINGS.find((b) => b.id === 'trainStation')
    const hubTiers = INTERACTIVE_LOCATIONS.find((l) => l.id === 'transit_hub').options.filter((o) => o.type === 'vehicle')
    if (trainStation) {
      const hubTiles = this.adjacentOpenTiles(trainStation, hubTiers.length)
      hubTiers.forEach((opt, i) => {
        const fallbackTile = hubTiles[i]
        if (!fallbackTile) return
        const owns = isOwned(opt.id)
        const tile = owns ? restoredTile(opt.id, fallbackTile) : fallbackTile
        this.spawnVehicleEntry({
          tierId: opt.id,
          name: opt.name,
          spriteName: opt.spriteName,
          speedMultiplier: opt.speedMultiplier,
          scale: TIER_SPRITES[opt.id]?.scale ?? 1,
          atlasKey: TIER_SPRITES[opt.id]?.atlasKey,
          col: tile.col,
          row: tile.row,
          owned: owns,
        })
      })
    }

    // Atmosphere: a police cruiser outside the FBI HQ. Every atmosphere
    // vehicle is stealable/driveable (see `owned` below), so - same as the
    // rent/buy hub tiers and every NPC car - it needs a real top-down
    // sprite, not the old illustrated side-view atlas: that assumption
    // ("atmosphere cars don't rotate during normal play") was the actual
    // bug behind the reported "flying car" - anything the player can drive
    // rotates. tierId is still the flavor name (`atmo_police`) even though
    // the sprite is now one of the 3 shared pico8 colors - see
    // pico8CarFrameFor's header comment.
    const fbiHQ = FINANCE_BUILDINGS.find((b) => b.id === 'fbiHQ')
    const policeFallback = fbiHQ ? this.adjacentOpenTiles(fbiHQ, 1)[0] : null
    if (policeFallback) {
      const ownsPolice = isOwned('atmo_police')
      const tile = ownsPolice ? restoredTile('atmo_police', policeFallback) : policeFallback
      this.spawnVehicleEntry({
        tierId: 'atmo_police',
        name: 'Police Cruiser',
        spriteName: pico8CarFrameFor('atmo_police'),
        atlasKey: PICO8_ATLAS_KEY,
        speedMultiplier: 2.0,
        scale: 1, // absolute size now comes from VehicleActor's uniform-width scaling, see that file
        col: tile.col,
        row: tile.row,
        owned: ownsPolice,
      })
    }

    // Atmosphere: an ambulance plus a handful of street traffic, scattered
    // onto open street-column/random-row tiles - same bounded random-retry
    // shape spawnFinanceAmbientNpcs() uses for ambient people, checked
    // against isBlockedTile (buildings are a much bigger footprint to dodge
    // than the grass/path tile-type check that function uses). `flavor`
    // names/tierIds the old illustrated-atlas filenames (ambulance/taxi/
    // van/suv/sedan_blue) for display/identity only now - the actual
    // sprite is a pico8CarFrameFor pick, same top-down-sprite fix as the
    // police cruiser above. An OWNED entry skips the random hunt entirely
    // and goes straight to restoredTile (falling back to a random tile only
    // if it has no valid stored position yet) - see restoredTile's header.
    const streetPool = ['ambulance.png', 'taxi.png', 'van.png', 'suv.png', 'sedan_blue.png']
    let spawned = 0
    let attempts = 0
    while (spawned < streetPool.length && attempts < 200) {
      attempts++
      const flavor = streetPool[spawned]
      const tierId = `atmo_${flavor.replace('.png', '')}`
      const owns = isOwned(tierId)
      let tile = null
      if (owns) {
        const restored = restoredTile(tierId, null)
        if (restored && !this.vehicleActors.some((v) => v.col === restored.col && v.row === restored.row)) {
          tile = restored
        }
      }
      if (!tile) {
        const c = FINANCE_V_STREETS[Math.floor(Math.random() * FINANCE_V_STREETS.length)]
        const r = 4 + Math.floor(Math.random() * (MAP_ROWS - 6))
        if (this.isBlockedTile(c, r)) continue
        if (this.isInsideAnyBuildingZone(c, r)) continue
        if (this.vehicleActors.some((v) => v.col === c && v.row === r)) continue
        tile = { col: c, row: r }
      }
      this.spawnVehicleEntry({
        tierId,
        name: flavor === 'ambulance.png' ? 'Ambulance' : `Parked ${flavor.replace('.png', '')}`,
        spriteName: pico8CarFrameFor(tierId),
        atlasKey: PICO8_ATLAS_KEY,
        speedMultiplier: 2.0,
        scale: 1, // absolute size now comes from VehicleActor's uniform-width scaling, see that file
        col: tile.col,
        row: tile.row,
        owned: owns,
      })
      spawned++
    }

    // Defensive-only fallback below: every tierId that can ever be `owned`
    // is already unconditionally spawned by the three blocks above (that's
    // how they show up as theft/rent targets before being owned at all),
    // so in the current vehicle roster this loop's dedup check always
    // finds an existing entry and skips - it's a no-op safety net for a
    // hypothetical future owned-vehicle type that ISN'T also an always-on
    // theft/rent target, not the mechanism actually restoring position
    // (see restoredTile above for that).
    if (trainStation) {
      const stationFallback = this.adjacentOpenTiles(trainStation, owned.length)
      let idx = 0
      for (const v of owned) {
        if (this.vehicleActors.some((e) => e.tierId === v.tierId)) continue
        const tile = restoredTile(v.tierId, stationFallback[idx++])
        if (!tile) continue
        this.spawnVehicleEntry({
          tierId: v.tierId,
          name: v.name,
          spriteName: v.spriteName,
          speedMultiplier: v.speedMultiplier,
          scale: TIER_SPRITES[v.tierId]?.scale ?? 1,
          // Prefer TIER_SPRITES (the 2 purchasable hub tiers) so their
          // behavior is unchanged; atmosphere tierIds have no TIER_SPRITES
          // entry at all, so they fall back to whatever atlasKey got
          // captured on the record itself (see the vehicleTheft emit in
          // triggerInteraction and onAcquireVehicle below) - without this
          // fallback every restored atmosphere vehicle silently reverted to
          // the old illustrated atlas on the very next zone reload, even
          // after the initial-spawn fix above.
          atlasKey: TIER_SPRITES[v.tierId]?.atlasKey ?? v.atlasKey,
          col: tile.col,
          row: tile.row,
          owned: true,
        })
      }
    }
  }

  onAcquireVehicle(vehicle) {
    const existing = this.vehicleActors.find((v) => v.tierId === vehicle.tierId)
    if (existing) {
      existing.owned = true
      // Captures the theft/purchase-moment position immediately, in case
      // the player never actually drives it (walks away on foot) before
      // the zone reloads - exitVehicle() covers the "drove it, then
      // parked" case, this covers "never drove it at all".
      useGameStore.getState().updateOwnedVehiclePosition(existing.tierId, existing.col, existing.row)
      return
    }
    // Not currently in the world (e.g. bought/stolen, then the overworld got
    // unloaded before this event's listener ran) - store still has it, so
    // spawnWorldVehicles will place it at its last known spot (or near the
    // station if it's never been parked yet) next time 'overworld' loads
    // (see that method's zone-persistence fallback). Nothing to spawn right
    // now if we're not even in that zone.
    if (this.currentZoneId !== 'overworld') return
    const trainStation = FINANCE_BUILDINGS.find((b) => b.id === 'trainStation')
    const tile = trainStation ? this.adjacentOpenTiles(trainStation, 1)[0] : null
    if (!tile) return
    this.spawnVehicleEntry({
      tierId: vehicle.tierId,
      name: vehicle.name,
      spriteName: vehicle.spriteName,
      speedMultiplier: vehicle.speedMultiplier,
      scale: TIER_SPRITES[vehicle.tierId]?.scale ?? 1,
      // See spawnWorldVehicles' zone-persistence fallback for why this
      // needs the `?? vehicle.atlasKey` fallback: atmosphere tierIds have
      // no TIER_SPRITES entry.
      atlasKey: TIER_SPRITES[vehicle.tierId]?.atlasKey ?? vehicle.atlasKey,
      col: tile.col,
      row: tile.row,
      owned: true,
    })
    useGameStore.getState().updateOwnedVehiclePosition(vehicle.tierId, tile.col, tile.row)
  }

  // House rule: this threshold can't reuse the 30px the roamer/ambient-NPC
  // checks use - those actors drift continuously at sub-tile positions, so
  // 30px genuinely means "close by". Cars sit dead-center on a tile
  // (TileMover grid-locks the player the same way), so the player's own
  // tile and an orthogonally-adjacent tile's car are EXACTLY 40px apart
  // (TILE_SIZE) - 30 would never fire from a neighboring tile at all, only
  // when standing on the car's own tile. 46 clears the orthogonal case (40)
  // with a little slack while still rejecting a diagonal neighbor (~56.6,
  // one tile further out than intended) and a 2-tiles-away car (80).
  findNearbyVehicle() {
    const px = this.playerActor.x
    const py = this.playerActor.y
    return this.vehicleActors.find((v) => Phaser.Math.Distance.Between(px, py, v.actor.x, v.actor.y) < 46)
  }

  // First open (isBlockedTile-checked) tile among the 8 neighbors of
  // (col,row), nearest-first by the same fixed scan order every call - used
  // to place the player on foot next to the car they just parked. Falls
  // back to the car's own tile if every neighbor is blocked (e.g. parked in
  // a tight gap) rather than failing to exit at all.
  findOpenNeighborTile(col, row) {
    const offsets = [
      [0, 1], [0, -1], [1, 0], [-1, 0],
      [1, 1], [1, -1], [-1, 1], [-1, -1],
    ]
    for (const [dc, dr] of offsets) {
      const c = col + dc
      const r = row + dr
      if (!this.isBlockedTile(c, r)) return { col: c, row: r }
    }
    return { col, row }
  }

  enterVehicle(entry) {
    this.drivingEntry = entry
    this.playerActor.sprite.setVisible(false)
    this.playerActor.shadow.setVisible(false)
    this.tileMover.stepDurationMs = Math.round(160 / entry.speedMultiplier)
    // Avoids a one-frame snap-rotation from stale prev-position on the first
    // driving frame (see the faceVector call in update()).
    this._prevDriveX = this.playerActor.x
    this._prevDriveY = this.playerActor.y
    useGameStore.getState().setDriving(true)
  }

  exitVehicle() {
    const entry = this.drivingEntry
    if (!entry) return
    this.drivingEntry = null
    this.tileMover.stepDurationMs = 160
    useGameStore.getState().setDriving(false)
    const parkedCol = this.tileMover.col
    const parkedRow = this.tileMover.row
    entry.col = parkedCol
    entry.row = parkedRow
    // Persists the exact parked tile so spawnWorldVehicles can restore it
    // here (not "near the station") the next time this zone loads - see
    // that method's zone-persistence fallback.
    useGameStore.getState().updateOwnedVehiclePosition(entry.tierId, parkedCol, parkedRow)
    const { x, y } = this.tileMover.tileCenter(parkedCol, parkedRow)
    entry.actor.setPosition(x, y)
    const neighbor = this.findOpenNeighborTile(parkedCol, parkedRow)
    this.tileMover.teleport(neighbor.col, neighbor.row)
    this.playerActor.sprite.setVisible(true)
    this.playerActor.shadow.setVisible(true)
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

    // While driving, only a building entrance (auto-exits the car, see
    // triggerInteraction) or exiting the car itself are on offer - talking
    // to a roamer/ambient NPC from inside a moving car doesn't make sense,
    // and re-triggering the SAME parked car you're sitting in as a theft
    // target doesn't either (see findNearbyVehicle - skipped entirely below).
    if (this.drivingEntry) {
      const staticZone = this.zones.find((z) => Phaser.Geom.Rectangle.Contains(z.rect, px, py))
      if (staticZone) {
        this.nearbyZone = staticZone
        const verb = staticZone.type === 'building' ? 'enter' : null
        this.promptText.setText(verb ? `Press E to ${verb} ${staticZone.label}` : `Press E: ${staticZone.label}`)
      } else {
        this.nearbyZone = { type: 'vehicleExit' }
        this.promptText.setText(`Press E to exit ${this.drivingEntry.name}`)
      }
      return
    }

    // House rule: a vehicle the player is right on top of/next to wins over
    // an enclosing building zone. spawnWorldVehicles/adjacentOpenTiles
    // already keep every spawned car clear of every building's (padded)
    // rect, so this branch shouldn't fire in the normal case - it's a second
    // line of defense so a car can never become silently unreachable just
    // because it ended up inside a building's interaction footprint (a
    // building zone always wins a Phaser.Geom.Rectangle.Contains tie
    // otherwise, since it's tested first below). Building priority is
    // unchanged when no vehicle is nearby.
    const vehicle = this.currentZoneId === 'overworld' ? this.findNearbyVehicle() : null
    const staticZone = !vehicle ? this.zones.find((z) => Phaser.Geom.Rectangle.Contains(z.rect, px, py)) : null
    const namedRoamer = !staticZone && !vehicle && this.currentZoneId === 'overworld' ? this.findNearbyNamedRoamer() : null
    const financeAmbient = !staticZone && !vehicle && !namedRoamer ? this.findNearbyFinanceAmbientNpc() : null

    if (vehicle) {
      this.nearbyZone = { type: 'vehicle', vehicle }
      this.promptText.setText(vehicle.owned ? `Press E to drive ${vehicle.name}` : `Press E to steal ${vehicle.name}`)
    } else if (staticZone) {
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

  // Plays a Serene Village home's door 'open'/'close' animation on building-
  // entry proximity, reusing the SAME check that already drives the
  // "Press E to enter" prompt (this.nearbyZone, set by updateNearbyZone just
  // above) instead of a second independent distance check - the door opens
  // the instant the prompt appears and closes the instant it moves off this
  // building (whether the player walked away or onto a different zone
  // entirely), so the two always agree. Cheap no-op when animatedDoors is
  // empty (every zone except 'overworld', and most of 'overworld' too, since
  // only a fraction of homes get this facade - see drawBuildings).
  updateAnimatedDoors() {
    if (!this.animatedDoors.length) return
    const nearbyBuildingId = this.nearbyZone?.type === 'building' ? this.nearbyZone.id : null
    for (const door of this.animatedDoors) {
      const shouldBeOpen = door.buildingId === nearbyBuildingId
      if (shouldBeOpen && !door.isOpen) {
        door.isOpen = true
        door.sprite.anims.play(SERENE_DOOR_ANIM_OPEN, true)
      } else if (!shouldBeOpen && door.isOpen) {
        door.isOpen = false
        door.sprite.anims.play(SERENE_DOOR_ANIM_CLOSE, true)
      }
    }
  }

  triggerInteraction(zone) {
    if (!this.bridge || this.interactionLocked) return
    if (zone.type === 'vehicle') {
      if (zone.vehicle.owned) {
        this.enterVehicle(zone.vehicle)
      } else {
        this.pauseForModal()
        this.bridge.emit('interact', {
          type: 'vehicleTheft',
          vehicle: {
            tierId: zone.vehicle.tierId,
            name: zone.vehicle.name,
            spriteName: zone.vehicle.spriteName,
            speedMultiplier: zone.vehicle.speedMultiplier,
            // Without this, the store's ownedVehicles record for a stolen
            // atmosphere vehicle had no atlasKey at all, so
            // spawnWorldVehicles' zone-persistence fallback (TIER_SPRITES
            // has no atmo_* entry) would fall back to VehicleActor's
            // illustrated-atlas default the moment the live scene entry
            // was destroyed by a zone change - i.e. the "flying car" bug
            // would come right back on the very next building the player
            // entered while driving a stolen car.
            atlasKey: zone.vehicle.atlasKey,
          },
        })
      }
      return
    }
    if (zone.type === 'vehicleExit') {
      this.exitVehicle()
      return
    }
    // Entering a building/interior, or exiting one, while driving would
    // otherwise leave the player "in a car" inside a room that has no car
    // collision for it - park it right at the threshold first.
    if (this.drivingEntry && (zone.type === 'building' || zone.type === 'exit')) {
      this.exitVehicle()
    }
    if (zone.type === 'exit') {
      // `target` lets an exit lead somewhere other than the overworld - the
      // chapel is nested (interior -> courtyard -> overworld). Absent target
      // keeps every pre-existing exit behaving exactly as before.
      const target = zone.target || 'overworld'
      const CHAPEL_ZONES = ['chapelInterior', 'chapelExterior']
      if (CHAPEL_ZONES.includes(target) || CHAPEL_ZONES.includes(this.currentZoneId)) {
        this.transitionToZone(target)
      } else {
        this.loadZone(target)
      }
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
      if (zone.id === 'temple') {
        this.transitionToZone('chapelExterior')
        return
      }
      if (zone.id === 'teaHouse') {
        this.loadZone('teaHouseInterior')
        return
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

    // Driving: the SAME TileMover/isBlockedTile pipeline above just moved
    // this.playerActor (hidden - see enterVehicle); mirror that position onto
    // the vehicle's sprite instead of running a second movement system, and
    // face it along the actual per-frame travel vector so it reads correctly
    // on diagonals too (faceVector, not the 4-cardinal setFacing).
    if (this.drivingEntry) {
      const dx = this.playerActor.x - this._prevDriveX
      const dy = this.playerActor.y - this._prevDriveY
      this.drivingEntry.actor.setPosition(this.playerActor.x, this.playerActor.y)
      this.drivingEntry.actor.faceVector(dx, dy)
    }
    this._prevDriveX = this.playerActor.x
    this._prevDriveY = this.playerActor.y

    this.updateAllAmbientNpcs(delta)
    this.updateHabitatAnimals(delta)
    if (this.currentZoneId === 'overworld') this.updateNamedRoamers(delta)

    if (this.interactionLocked) return

    this.updateNearbyZone()
    this.updateAnimatedDoors()

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
