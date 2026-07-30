import Phaser from 'phaser'
import { useGameStore } from '../../store/useGameStore'
import { resolvePalette } from '../characterPalettes'
import { generateAmbientNpcs } from '../../utils/npcGenerator'
import { getAllCharacters, getAnyCharacter } from '../../features/agents/characterLookup'
import { getDisposition } from '../../features/agents/characterDispositions'
import { TIME_BLOCKS, simulateWorldPresence } from '../../features/agents/worldPresenceEngine'
import { CHARACTER_HOME_BUILDING_DEFS, getHomeBuildingDef } from '../../features/world/characterHomeBuildings'
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
  residentialStyleKey,
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
import { buildChapelExteriorZone, preloadChapelExterior, updateChapelGate, chapelFacadeSolidOffsets, CHAPEL_EXTERIOR_ROOM } from '../interiors/tmxMapExterior'
import { preloadChapelPack } from '../packs/chapelPixelTiles'
import { preloadCuteTerrain, preloadCuteTrees, GRASS_TYPES } from '../packs/cuteFantasyTerrain'
import { preloadTopDownVehicles, NPC_VEHICLE_TIERS, vehiclePerformance, VEHICLE_LAUNCH_FRACTION } from '../packs/topDownVehicles'

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

// ---------------- Capital Syndicate: unified Financial region ----------------
// Map overhaul Phase 1 (flattening): this used to be 4 stacked district
// bands (Tokyo/Kyoto/Osaka/Sapporo), each its own self-contained row-band
// with its own street gap. That grouping is gone - FINANCE_BUILDING_DEFS
// below is now ONE flat pool, packed left-to-right/top-to-bottom by
// layoutFinanceMap() with no district concept at all, so the whole roster
// reads as one continuous city. The "--- Tokyo District ---"-style comments
// still splitting the list below are leftover roster organisation only
// (keeps related HQs/amenities grouped in the source for readability) - they
// no longer correspond to any physical region of the map; a building's
// position is purely wherever the packer's cursor happens to land.
//
// Buildings are packed left-to-right and wrap to a new row once they'd cross
// bandColEnd - laid out by layoutFinanceMap() below rather than hand-placed,
// so there's no risk of two buildings (or a building and the map border)
// overlapping as the roster changes. Verified with a standalone overlap/
// bounds check before wiring this in, not just eyeballed.

// House rule: 2x2 character homes/hideouts packed at the same BAND_GAP=4 as
// the hand-authored buildings below measured out to a 154-row map (verified
// with a standalone layout script) - way too tall to be playable. Giving
// home/hideout defs their own tighter `gap` (per-def override, see
// layoutFinanceMap) instead keeps the map at 73 rows for the same 88 homes.
// Tightened further to 1 (from 2) - the plan is to make homes background
// scenery rather than player-enterable buildings, at which point they don't
// need the same walk-up clearance a real building does; packing them denser
// now gets the map size win regardless of when that lands.
const HOME_GAP = 1

const FINANCE_BUILDING_DEFS = [
  // --- Financial/civic HQs (formerly "Tokyo") ---
  { id: 'stockExchange', label: 'Tokyo Stock Exchange', facadeStyle: 'modernGlass', color: 0x1f5f3a, width: 3, height: 3 },
  // Consolidation (Phase 2): Buffett/Vanderbilt/Musk/Howard Marks/Jobs each
  // used to be their own single-tenant HQ. Folded into one denser
  // multi-tenant hub (see BusinessCenterModal.jsx's 5 tabs) - footprint is
  // bigger than any one of the old towers to read as "several tenants share
  // this building", not just a relabeled single HQ.
  { id: 'businessCenter', label: 'Capital Business Center', facadeStyle: 'modernGlass', color: 0x3a3a4a, width: 7, height: 4 },
  { id: 'corporateOffice', label: 'Corporate Holdings', facadeStyle: 'modernGlass', color: 0x4a3a5f, width: 4, height: 3 },
  { id: 'vcHub', label: 'Venture Capital Hub', facadeStyle: 'modernGlass', color: 0x2a3a6b, width: 3, height: 3 },
  { id: 'bank', label: 'Bank & Realty Office', facadeStyle: 'modernGlass', color: 0x1f3a5f, width: 4, height: 3 },
  { id: 'realEstateAgency', label: 'Real Estate Agency', facadeStyle: 'modernGlass', color: 0x3a5f4a, width: 4, height: 3 },
  { id: 'parliament', label: 'Parliament Hall', facadeStyle: 'modernGlass', color: 0x3a3a6a, width: 4, height: 3 },
  // Consolidation (Phase 2): FBI HQ (Hoover) + IRS HQ (Caplin) folded into one
  // federal hub (see GovernmentBuildingModal.jsx's 3 tabs, the 3rd of which
  // also gives the existing status-bar-only GovernmentModal a physical
  // building). modernGlass (not traditionalCottage/modernBrick like its two
  // predecessors) to read as the civic building it now is, matching
  // Parliament Hall's look.
  { id: 'governmentBuilding', label: 'Federal Government Building', facadeStyle: 'modernGlass', color: 0x2a3a5a, width: 6, height: 4 },

  // --- Cultural/amenity buildings (formerly "Kyoto") ---
  { id: 'teaHouse', label: 'Cherry Coke Tea House', facadeStyle: 'traditionalCottage', color: 0x8a4a2a, width: 3, height: 2 },
  { id: 'machiyaEstate', label: 'Machiya Executive Estate', facadeStyle: 'traditionalCottage', color: 0x6a5a3a, width: 4, height: 3 },
  { id: 'zenGarden', label: 'Zen Rock Garden', facadeStyle: 'traditionalCottage', color: 0x8a8a6a, width: 3, height: 2 },
  { id: 'silkMarket', label: 'Silk & Kimono Market', facadeStyle: 'traditionalCottage', color: 0x8a2a4a, width: 3, height: 2 },
  { id: 'sakeBrewery', label: 'Fushimi Sake Brewery', facadeStyle: 'traditionalCottage', color: 0x6a4a2a, width: 3, height: 2 },
  { id: 'artisanShop', label: 'Kiyomizu Artisan Shop', facadeStyle: 'traditionalCottage', color: 0x4a6a5a, width: 3, height: 2 },
  { id: 'hotel', label: 'Ryokan Mountain Inn', facadeStyle: 'traditionalCottage', color: 0x5a4a3a, width: 4, height: 3 },
  { id: 'park', label: 'Serenity Park', facadeStyle: 'traditionalCottage', color: 0x2a5f2a, width: 4, height: 2 },
  // Distinct indigo/violet exterior (every other Kyoto building above is a
  // muted brown/grey/green earth-tone) so this reads as the grand chapel
  // it now has an interior for (see buildChapelInteriorZone in this file
  // and src/game/interiors/tmxWallInterior.js) rather than blending into
  // the district as just another plain amenity building - reported gap:
  // the interior existed but nothing on the map signaled it. Label now
  // says "Chapel" outright while keeping "Whispering Temple" as the
  // flavor name TempleModal.jsx already displays.
  // 16x14 matches the authored chapel art exactly (House/Wings/Dragon layers,
  // cols 6-21 x rows 2-15 of Exterior.tmx) so the facade fills its footprint
  // with no overflow onto neighbours - see drawChapelExteriorFacade.
  { id: 'temple', label: 'Whispering Temple Chapel', facadeStyle: 'traditionalCottage', color: 0x3a2a6a, width: 30, height: 22 },

  // --- Entertainment/crime buildings (formerly "Osaka") ---
  { id: 'casino', label: 'Neon Dragon Casino', facadeStyle: 'modernBrick', color: 0x8a1f6a, width: 4, height: 3 },
  { id: 'dotonboriArcade', label: 'Dotonbori Merchant Arcade', facadeStyle: 'modernBrick', color: 0x8a6a2a, width: 4, height: 2 },
  { id: 'fishMarket', label: 'Kuromon Fish Market', facadeStyle: 'modernBrick', color: 0x2a5a6a, width: 3, height: 2 },
  { id: 'takoyakiStand', label: 'Takoyaki Street Food', facadeStyle: 'modernBrick', color: 0x8a4a1f, width: 2, height: 2 },
  // Consolidation (Phase 2): Black Market + Call Center Ops + Crime Alley
  // (Luciano) + Speakeasy Hotel (Capone) folded into one underworld hub (see
  // UnderworldModal.jsx's 4 tabs). Widest/tallest of the 3 new hubs footprint-
  // wise since it absorbs 4 former buildings, not 2-5 tenants sharing offices
  // - reads as a sprawling underworld block rather than a single storefront.
  { id: 'underworld', label: 'The Underworld', facadeStyle: 'modernBrick', color: 0x3a1f3a, width: 6, height: 4 },
  { id: 'dockVaults', label: 'Dock Underground Vaults', facadeStyle: 'modernBrick', color: 0x2a2a3a, width: 4, height: 2 },

  // --- Industrial/civic buildings (formerly "Sapporo") ---
  { id: 'fordRougeComplex', label: 'Ford River Rouge Complex', facadeStyle: 'modernGlass', color: 0x3a4a5a, width: 4, height: 3, npcId: 'ford' },
  { id: 'carnegieSteelMill', label: 'Homestead Steel Mill', facadeStyle: 'modernGlass', color: 0x5a3a2a, width: 4, height: 3, npcId: 'carnegie' },
  { id: 'standardOilRefinery', label: 'Standard Oil Refinery', facadeStyle: 'modernGlass', color: 0x2a3a3a, width: 4, height: 3, npcId: 'rockefeller' },
  { id: 'pentagonDodHQ', label: 'Pentagon Procurement HQ', facadeStyle: 'modernGlass', color: 0x2a4a6a, width: 4, height: 3, npcId: 'mcnamara' },
  { id: 'epaHQ', label: 'EPA Regulation Agency', facadeStyle: 'modernGlass', color: 0x2a5a3a, width: 4, height: 3, npcId: 'ruckelshaus' },
  { id: 'sapporoBrewery', label: 'Alpine Snow Brewery', facadeStyle: 'modernGlass', color: 0x8a6a2a, width: 3, height: 2 },
  { id: 'alpineLodge', label: 'Mount Yotei Alpine Lodge', facadeStyle: 'modernGlass', color: 0x6a4a3a, width: 4, height: 3 },
  { id: 'trainStation', label: '🚆 Central Train Station', facadeStyle: 'modernGlass', color: 0x4a6fa5, width: 4, height: 2 },

  // --- Character homes & hideouts (generated, see characterHomeBuildings.js) ---
  // Appended after the 41 defs above (not interleaved) so the already-
  // verified office/amenity layout stays first and unaffected; layoutFinanceMap
  // packs the whole list (offices then homes) as one flat pool.
  // Sorted by residentialStyleKey (stone manor / wood house / pico8 /
  // serene cottage / brick cottage / hideout) before packing - array order
  // is preserved straight through packing, so this sort survives into "same
  // style lands in a contiguous run", i.e. actual visual clusters rather
  // than the roster's arbitrary order scattering every style across every
  // row (reported: a log-cabin home next to a stone manor next to a pico8
  // warehouse, no grouping at all).
  ...CHARACTER_HOME_BUILDING_DEFS
    .map((d) => ({ ...d, gap: HOME_GAP }))
    .sort((a, b) => residentialStyleKey(a.npcId, a.kind).localeCompare(residentialStyleKey(b.npcId, b.kind))),
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
// Distance between street-block starts. The clear gap is
// V_STREET_SPACING - STREET_WIDTH, and that gap MUST exceed the widest
// building plus its 1-tile art margin on each side, or that building can
// never be placed. Raised from 26 when the chapel grew to 30 tiles wide:
// 26 left a 23-column gap, the packer could not fit it anywhere, and it
// came out with null coordinates. checkMapLayout.mjs catches this.
const V_STREET_SPACING = 38
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

// Horizontal streets, map-flattening version: there's no longer a fixed set
// of district-gap rows to drop a street into (that concept is gone - see the
// header comment above FINANCE_BUILDING_DEFS). Unlike vertical streets,
// horizontal rows also can't be reserved DURING packing the way columns are
// (verticalStreetColumns precomputes columns from mapCols, a known input;
// mapRows is only known once packing finishes). So this runs packing first
// with no street concept at all, then does a second pass over the finished
// building list: find every row-band that ended up fully building-free
// (there are several - BAND_GAP/HOME_GAP row-wraps, and especially the
// office->home category-change boundary, all leave multi-row gaps nothing
// was ever packed into), and greedily place a STREET_WIDTH-tall street in
// every free band spaced at least H_STREET_INTERVAL rows from the last one
// chosen. This reliably finds every usable gap in the actual finished
// layout, rather than only the gaps that happen to exist exactly at a wrap
// boundary hit while walking the packing cursor (tried first; it missed
// several perfectly good gaps because the packer doesn't wrap on every row).
// Interval picked to land in the middle of the "every ~14-16 rows" target:
// dense enough to keep the road-tile count in the same ballpark as the old
// 4-band scheme (checked with production/checkMapLayout.mjs), sparse enough
// that most building rows aren't immediately adjacent to a street.
const H_STREET_INTERVAL = 15

function layoutFinanceMap(mapCols) {
  const streetCols = verticalStreetColumns(mapCols)
  // Facade ART is allowed to overflow its footprint (prefab facades draw
  // taller/wider than the tiles they own - see packRender), so a building
  // whose footprint merely touches a street still LOOKS like it's built on
  // the road. Reserving one extra column either side of every street block
  // keeps that overhang off the tarmac. Packing-only: these margin columns
  // are ordinary grass, not road.
  const reservedCols = []
  for (const c of streetCols) {
    reservedCols.push(c - 1, c, c + 1)
  }
  const bandColEnd = mapCols - BAND_COL_END_FROM_RIGHT
  const buildings = []
  let col = BAND_COL_START
  let row = MAP_TOP_MARGIN
  let rowMaxHeight = 0
  let prevIsHome = null

  for (const b of FINANCE_BUILDING_DEFS) {
    // Force a fresh row whenever the building "category" changes (hand-
    // authored office/HQ facades vs. character homes/hideouts), even if
    // the current row has space left. Without this, homes are appended
    // after the hand-authored defs in the same array, and the packer just
    // kept filling the row it was on - so the LAST office building and the
    // FIRST home routinely ended up side by side, with no gap and two
    // completely different art styles touching directly (reported: a flat
    // grey office facade wedged into a row of log-cabin homes). Homes still
    // pack tightly against EACH OTHER (see HOME_GAP) - this only draws a
    // line between the two categories, using the wider BAND_GAP rather than
    // either category's own tighter gap, so the boundary reads as
    // deliberate, not just another row wrap.
    const isHome = Boolean(b.kind)
    const categoryChanged = prevIsHome !== null && isHome !== prevIsHome && col !== BAND_COL_START
    // Row-wrap gap honours the same per-def override horizontal packing
    // already uses (b.gap ?? BAND_GAP) instead of always BAND_GAP. Homes
    // set gap: HOME_GAP=1 to pack tightly side-by-side, but every WRAPPED
    // row still cost a full BAND_GAP=4 vertically regardless - with ~88
    // 2-wide homes needing several wrapped rows, that asymmetry was most of
    // the map's excess height.
    if (categoryChanged) {
      col = BAND_COL_START
      row += rowMaxHeight + BAND_GAP
      rowMaxHeight = 0
    } else if (col + b.width - 1 > bandColEnd) {
      col = BAND_COL_START
      row += rowMaxHeight + (b.gap ?? BAND_GAP)
      rowMaxHeight = 0
    }
    prevIsHome = isHome
    // Reserve the vertical streets: shift right past any street block this
    // building would straddle, wrapping to the next row if it no longer
    // fits on this one.
    let clear = firstColumnClearOfStreets(col, b.width, reservedCols, bandColEnd)
    if (clear === null) {
      col = BAND_COL_START
      row += rowMaxHeight + (b.gap ?? BAND_GAP)
      rowMaxHeight = 0
      clear = firstColumnClearOfStreets(col, b.width, reservedCols, bandColEnd)
    }
    if (clear === null) {
      // Unreachable while V_STREET_SPACING is wide enough for the widest
      // building (see its comment). Failing loudly beats silently writing
      // null tile coords, which is what produced a building at column
      // `null` when the chapel outgrew the street spacing.
      throw new Error(
        `layoutFinanceMap: "${b.label ?? b.id}" is ${b.width} tiles wide and cannot fit between vertical streets ` +
          `(clear gap is ${V_STREET_SPACING - STREET_WIDTH} columns). Raise V_STREET_SPACING.`
      )
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
  const mapRows = row + rowMaxHeight + 2 // clear buffer row + bottom wall row

  // Second pass: scan the finished layout for building-free row bands (rows
  // no building's r0..r1 touches) and greedily place a street in every band
  // spaced >= H_STREET_INTERVAL from the last one chosen. Starts scanning at
  // MAP_TOP_MARGIN, not row 0 - everything above that is the water/wall
  // margin financeTileType already handles on its own, not packable content.
  const rowHasBuilding = new Array(mapRows).fill(false)
  for (const b of buildings) {
    for (let r = b.tiles.r0; r <= b.tiles.r1; r++) rowHasBuilding[r] = true
  }
  const freeBands = []
  let bandStart = null
  for (let r = MAP_TOP_MARGIN; r < mapRows; r++) {
    if (!rowHasBuilding[r]) {
      if (bandStart === null) bandStart = r
    } else if (bandStart !== null) {
      freeBands.push([bandStart, r - 1])
      bandStart = null
    }
  }
  if (bandStart !== null) freeBands.push([bandStart, mapRows - 1])

  const hStreets = []
  let lastStreetCenter = -Infinity
  for (const [bandTop, bandBottom] of freeBands) {
    const bandLen = bandBottom - bandTop + 1
    if (bandLen < STREET_WIDTH) continue
    const center = Math.round((bandTop + bandBottom) / 2)
    if (center - lastStreetCenter < H_STREET_INTERVAL) continue
    const half = Math.floor(STREET_WIDTH / 2)
    const streetTop = Math.max(bandTop, center - half)
    for (let r = streetTop; r <= streetTop + STREET_WIDTH - 1 && r <= bandBottom; r++) hStreets.push(r)
    lastStreetCenter = center
  }

  return { buildings, mapRows, hStreets, vStreets: streetCols }
}

const MAP_COLS = 118
const {
  buildings: FINANCE_BUILDINGS,
  mapRows: MAP_ROWS,
  hStreets: FINANCE_H_STREETS,
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
  TILE_SIZE,
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

// businessCenter/underworld/governmentBuilding (the 3 Phase-2 hub buildings)
// deliberately have no entry here - like stockExchange/casino/trainStation,
// triggerInteraction() special-cases their `zone.id` and opens a React modal
// directly instead of ever routing through buildGenericInteriorZone, so they
// never need an interior template.
const BUILDING_INTERIOR_TEMPLATE = {
  bank: 'officeA',
  realEstateAgency: 'officeA',
  corporateOffice: 'officeB',
  vcHub: 'officeB',
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
  hotel: 'amenity',
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

// 'path' and 'water' render the same everywhere; 'grass' cells are now a
// single uniform ground type map-wide (the old Tokyo-slate/Kyoto-cobblestone
// row-band reskin is gone along with the district system - and it was
// already a no-op visually, since GRASS_TYPES in cuteFantasyTerrain.js
// treats slate/cobblestone/grass as rendering identically); border 'wall'
// cells are the same everywhere too.
// Footprint-relative solid tiles for the chapel courtyard drawn on the map.
// Computed once - it's pure data derived from the authored .tmx.
const TEMPLE_SOLID_OFFSETS = chapelFacadeSolidOffsets()

// Footprint-relative rect of the chapel's own doors (House layer spans cols
// 11-18 and ends at row 15, so the doors are the centre pair) plus the tile
// below them, which is where the player stands to use them.
const CHAPEL_DOOR_OFFSET = { col: 14, row: 15, width: 2, height: 2 }

function terrainTileTypeAt(tile, _row) {
  if (tile === 'water') return 'water'
  if (tile === 'path') return 'path'
  if (tile === 'wall') return 'wall'
  // `_row` is unused now that ground type no longer varies by district band
  // position - kept as a parameter so callers (buildTerrainLayer's
  // (row, col) => ... callback) don't need to change.
  return 'grass'
}

// Trees are solid again (their tile - and the canopy tile above it, for the
// ~2-tile-tall Cute Fantasy oak - go into `blockedTiles`, consulted by
// isBlockedTile/isSingleTileObstacle below): reported as "the big tree" not
// blocking the player or NPCs. Rocks/flowers stay walkable ground
// decoration. Named roamers (the 88 scheduled characters) don't run
// collision at all any more regardless (see updateNamedRoamers's own house
// rule on why - a straight-line-walk-vs-buildings problem, not a trees
// problem) so this only affects the player and ambient/wandering NPCs
// (wanderActor), both of which already re-roll a new direction on hitting
// an obstacle rather than fighting it.
// Scatter ATTEMPTS (not placements - most rolls are rejected for landing on
// a road, a building's 1-tile margin, or a non-grass type). Scaled off the
// map area so widening the map doesn't silently thin the vegetation out:
// the previous flat 80 was tuned for an 80-wide map and left the 160-wide
// one looking bare.
const ENVIRONMENT_SCATTER_ATTEMPTS = Math.round((MAP_COLS * MAP_ROWS) / 9)

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
    // Map overhaul step 3: props go on anything that RENDERS as grass, not
    // just the literal 'grass' type (GRASS_TYPES also covers the now-unused
    // 'slate'/'cobblestone' values in case any old save/layout data still
    // has them - see cuteFantasyTerrain's GRASS_TYPES).
    if (!GRASS_TYPES.has(layout[r][c]) || forbidden.has(`${r},${c}`)) continue
    const cx = c * TILE_SIZE + TILE_SIZE / 2
    const cy = r * TILE_SIZE + TILE_SIZE / 2
    let objs
    let isTree = false
    // Map flattening: one blended vegetation mix for the whole map instead
    // of 3 district-position-dependent profiles (formerly "urban" ~55%
    // tree/17% rock/28% flower over Tokyo+Osaka, "JRPG" ~50% tree/15% rock/
    // 35% flower over Kyoto, and a third default elsewhere). Picked roughly
    // between those three rather than a straight average, per the map-
    // flattening brief.
    const roll = Math.random()
    if (roll < 0.48) { objs = placeTree(scene, cx, cy); isTree = true }
    else if (roll < 0.75) objs = placeFlower(scene, cx, cy)
    else objs = placeRock(scene, cx, cy)
    if (objs) {
      zoneObjects.push(...objs)
      if (isTree && blockedTiles) {
        blockedTiles.add(`${r},${c}`)
        // The Cute Fantasy oak's trunk sits on (r,c) and the canopy rises
        // into the tile ABOVE it - blocking only the trunk let people stand
        // inside the leaves, which read as walking through the tree. Only
        // block the canopy tile if it's ordinary ground: it can be a ROAD
        // (vehicles are road-locked, blocking it would sever the network
        // with no visible cause) or the player's own spawn tile.
        const canopyType = r > 0 ? layout[r - 1][c] : null
        const canopyIsSpawn = r - 1 === DEFAULT_SPAWN.row && c === DEFAULT_SPAWN.col
        if (r > 0 && GRASS_TYPES.has(canopyType) && !canopyIsSpawn) {
          blockedTiles.add(`${r - 1},${c}`)
        }
      }
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
// (see that file's own header comment). The "thought" strings ambient
// (non-named) wander NPCs use are still derived from each character's real
// roster data (platform, policy bias, syndicate territory, perk, archetype)
// rather than a generic shared string.
// (Map flattening: homeDistrictFor()/CITY_TO_DISTRICT, which used to tag
// each named roamer with a home-district string purely for grouping, are
// gone - nothing ever read roamer.district back out.)

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

// Named-roamer movement speed in px/s - the SAME constant speed for every
// roamer, walking or driving (see the seekTo()/travelPhase state machine in
// updateNamedRoamers). An earlier design tried to fit each journey into a
// precomputed time period (so two stops in the same block would always be
// reached "on schedule") using a continuous back-and-forth triangle wave;
// that kept producing distinct bugs - a unit-conversion error that silently
// doubled real speed, an asymmetric clamp that froze the return leg then
// snapped to catch up, and (structurally) any two roamers with
// differently-far-apart stops reading as different speeds even when the
// math was correct. Simpler and more robust: nobody arrives "on schedule",
// everybody just walks/drives there at one constant, believable pace and
// waits once they arrive. 70px/s (1.75 tiles/s) was the original target and
// is mathematically exact (verified: seekTo bounds every step to
// speed*delta with no possible overshoot) - but repeated human feedback
// said it still reads as too fast on screen. Cut to 30px/s (0.75 tiles/s),
// close to wanderActor's existing 20px/s ambient-NPC pace elsewhere in this
// file - a purposeful walk should be a little brisker than aimless
// wandering, not much more.
const NAMED_ROAMER_WALK_SPEED_PX_PER_SEC = 30
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

// House rule: the "not traveling" branch has nowhere to walk when a
// roamer's current-block and next-block buildingId are the SAME building
// (updateNamedRoamers) - measured as the common case by
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
// itself is untouched and stays pure, same as agentClock never feeding
// anything back into it. Two sin/cos terms at different,
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
// i.e. 1 unit = 4 real seconds) for one full idle-drift loop on each axis -
// a handful of real seconds, so the mill
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

// Fixed per-character "door slot" - the Phase 2 building consolidation lets
// up to 5 characters (Business Center) share one physical door, and
// buildingDoorPixel used to resolve every character at that building to the
// exact same pixel with only idleDriftOffset's few-px mill on top, so 5
// roamers converging there visually stacked on nearly one spot. Same
// deterministic, id-seeded hash style as idleDriftOffset/presencePhaseOffset
// above (no Math.random) - each character gets one fixed slot in a small
// ring around the door, added to the door pixel BEFORE idleDriftOffset's
// mill/seek target math runs, so it composes with (rather than fights)
// that existing drift. 6 slots spaced 12-24px from center and from each
// other is plenty for "reads as distinct people", not full pedestrian
// collision - this game doesn't have that for anyone.
const DOOR_SLOT_OFFSETS = [
  { x: 0, y: 0 },
  { x: -18, y: 8 },
  { x: 18, y: 8 },
  { x: -24, y: -8 },
  { x: 24, y: -8 },
  { x: 0, y: 18 },
]

function doorSlotOffset(characterId) {
  const idx = idleDriftHash(`${characterId}:doorSlot`) % DOOR_SLOT_OFFSETS.length
  return DOOR_SLOT_OFFSETS[idx]
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
    preloadCuteTrees(this)
    preloadTopDownVehicles(this)
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

  // Map flattening: there's only one city now, so `cityId` is accepted but
  // ignored - this just teleports the player to the (single) train station.
  // Kept rather than deleted because GameCanvas.jsx still wires a 'cityTravel'
  // bridge event to this method; TownTravelUI.jsx's city-picker (its only
  // caller) is removed in this same pass, so in practice nothing invokes
  // this any more, but leaving a working no-op-ish stub is safer than a
  // dangling method other code still references.
  teleportToCity(_cityId) {
    const target = FINANCE_BUILDINGS.find(b => b.id === 'trainStation')
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

    // Procedural terrain layer - one Graphics pass, uniform ground everywhere
    // (see terrainTileTypeAt - the old per-district ground reskin is gone).
    const terrainLayer = buildTerrainLayer(this, MAP_COLS, MAP_ROWS, TILE_SIZE, (row, col) =>
      terrainTileTypeAt(this.financeLayout[row][col], row)
    )
    this.zoneObjects.push(terrainLayer)

    this.blockedEnvironmentTiles = new Set()
    scatterEnvironment(this, this.financeLayout, FINANCE_BUILDINGS, ENVIRONMENT_SCATTER_ATTEMPTS, this.zoneObjects, this.blockedEnvironmentTiles)

    drawBuildings(this, FINANCE_BUILDINGS, this.zoneObjects)

    // Small, bounded "wealth flex" pens (a handful of the richest homes get a
    // fenced-in exotic pet) and the general ambient-animal habitat clusters -
    // both after drawBuildings so FINANCE_BUILDINGS' final tile rects exist,
    // and after scatterEnvironment above so blockedEnvironmentTiles is
    // populated for the "near a tree" placement bias / pen-fence collision.
    this.spawnWealthyPetPens()
    this.spawnHabitatAnimals()

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
    this.chapelGate = null

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
      if (col >= b.tiles.c0 && col <= b.tiles.c1 && row >= b.tiles.r0 && row <= b.tiles.r1) {
        // The chapel draws a whole authored courtyard, most of which is
        // walkable ground. Blocking its footprint rect like a normal
        // building walled the courtyard off entirely, so it uses the
        // authored per-tile collision instead - same rules as the
        // standalone zone, gate opening included.
        if (b.id === 'temple') {
          if (TEMPLE_SOLID_OFFSETS.has(`${col - b.tiles.c0},${row - b.tiles.r0}`)) return true
          continue
        }
        return true
      }
    }
    // Driving-only rules. Kept separate from the checks above so walking is
    // completely unaffected: on foot the player may still cross grass and
    // brush past people, which is what you'd expect.
    if (this.drivingEntry) {
      // Cars belong on the road. Without this they drove over lawns, gardens
      // and the chapel courtyard's grass.
      if (!this.isRoadTile(col, row)) return true
      // ...and can't drive through people or livestock. Vehicles and
      // buildings were already solid via isSingleTileObstacle/FINANCE_
      // BUILDINGS above; these two were not.
      if (this.isOccupiedByCreature(col, row)) return true
    }
    return false
  }

  // True if a named roamer or a habitat animal is standing on this tile.
  // Both move continuously in world pixels, so their tile is derived rather
  // than stored.
  isOccupiedByCreature(col, row) {
    const onTile = (x, y) => Math.floor(x / TILE_SIZE) === col && Math.floor(y / TILE_SIZE) === row
    if (this.namedRoamers) {
      for (const roamer of this.namedRoamers) {
        if (roamer.actor && onTile(roamer.actor.x, roamer.actor.y)) return true
      }
    }
    if (this.habitatAnimalActors) {
      for (const animal of this.habitatAnimalActors) {
        if (onTile(animal.x, animal.y)) return true
      }
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
  // physically at this building", not just narrating it. `characterId` is
  // optional (omitting it returns the bare center-door pixel, used by
  // teleportToCity/spawn code that has no per-character concept); when
  // given, doorSlotOffset spreads that character to their own fixed slot
  // around the door so multiple roamers at the same building don't stack.
  buildingDoorPixel(buildingId, characterId) {
    const b = FINANCE_BUILDINGS.find((bd) => bd.id === buildingId)
    if (!b) return null
    const base = {
      x: ((b.tiles.c0 + b.tiles.c1 + 1) / 2) * TILE_SIZE,
      y: (b.tiles.r1 + 1) * TILE_SIZE + TILE_SIZE / 2,
    }
    if (!characterId) return base
    const slot = doorSlotOffset(characterId)
    return { x: base.x + slot.x, y: base.y + slot.y }
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

  updateNamedRoamers(rawDelta) {
    if (!this.namedRoamers.length) return
    // Clamp delta before it drives any movement math. An uncapped delta
    // turns any real stall (tab backgrounded for a moment, a GC pause, a
    // slow frame) into a catch-up jump - stepPx = speed*delta scales up
    // right along with however long the stall was, so a single bad frame
    // can move a roamer dozens of pixels in one step even though the
    // per-frame math is "correct". Reported as "some NPCs moving at super
    // speed" - a few characters happening to catch the one spiked frame,
    // not a sustained issue. 50ms floor (~20fps) still tracks legitimate
    // slow frames without amplifying real stalls into visible teleports.
    const delta = Math.min(rawDelta, 50)
    // agentClock feeds idleDriftOffset's mill-in-place animation for roamers
    // who aren't currently traveling - actual travel is constant-speed
    // seek-and-stop, not agentClock-driven (see the travelPhase state
    // machine below). agentClock no longer indexes into a schedule array;
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
      const doorA = presence ? this.buildingDoorPixel(presence.currentBuildingId, roamer.agent.id) : null
      const doorB = presence ? this.buildingDoorPixel(presence.nextBuildingId, roamer.agent.id) : null
      const traveling = doorA && doorB && presence?.currentBuildingId !== presence?.nextBuildingId

      // spawnNamedRoamers() creates every actor at the (-100,-100) off-screen
      // placeholder, potentially thousands of pixels from their real
      // building. seekTo below is a small, per-frame bounded step - correct
      // for ongoing movement, but if a roamer's very first resolved position
      // is used as its seek origin, that first frame kicks off a real-time
      // walk all the way in from (-100,-100), straight-line through
      // whatever buildings happen to be on the way (each one shoving the
      // position via resolveOpenPosition) - measured as roamers appearing to
      // move at 400-700+px/s right after a fresh "New Game". Snap once,
      // directly, the first time a real door resolves, same way the old
      // time-based system's absolute t-lerp always did implicitly.
      if (!roamer.placed) {
        const startAt = doorA || doorB
        if (startAt) {
          roamer.actor.sprite.setPosition(startAt.x, startAt.y)
          roamer.placed = true
        }
      }

      // Constant-speed "seek and stop" movement - every roamer moves toward
      // its current target at exactly NAMED_ROAMER_WALK_SPEED_PX_PER_SEC and
      // holds position once it arrives. Replaces an earlier design that
      // tried to fit each journey into a precomputed time period with a
      // continuous back-and-forth triangle wave; that approach kept
      // producing distinct bugs (a unit-conversion error that doubled real
      // speed, an asymmetric clamp that froze the return leg then snapped,
      // and cars appearing to move at wildly different speeds depending on
      // how far apart their two stops happened to be) because "arrive
      // exactly on schedule" and "move at a believable constant speed" are
      // fighting requirements once distances vary. This drops the
      // schedule-timing requirement - a roamer just walks there and waits.
      const stepPx = NAMED_ROAMER_WALK_SPEED_PX_PER_SEC * (delta / 1000)
      const seekTo = (target) => {
        const dx = target.x - roamer.actor.x
        const dy = target.y - roamer.actor.y
        const dist = Math.hypot(dx, dy)
        if (dist <= stepPx || dist === 0) return { pos: { x: target.x, y: target.y }, arrived: true }
        return {
          pos: { x: roamer.actor.x + (dx / dist) * stepPx, y: roamer.actor.y + (dy / dist) * stepPx },
          arrived: false,
        }
      }

      let rawPos = { x: roamer.actor.x, y: roamer.actor.y }
      let onFoot = true

      if (!traveling) {
        roamer.travelPhase = null
        const dest = doorA || doorB
        if (dest) {
          // idleDriftOffset must be folded into the SEEK TARGET (door +
          // offset), not added to the result afterward. seekTo's "from"
          // point is wherever the actor currently is - which already
          // includes last frame's drift - so adding a fresh drift value on
          // top of that every frame doesn't orbit the door, it ACCUMULATES:
          // roughly the same offset gets re-added frame after frame with no
          // bound, running away in whatever direction that frame's phase
          // happened to point. Measured as a nearly-constant drift value
          // (e.g. {x:-16,y:-9}) compounding into a runaway walk at
          // 20x the intended speed for whichever roamer's phase gave it a
          // large offset - explains the reported mix of "some fast, some
          // stuck at a building, some normal": purely a function of each
          // character's drift phase at that moment, not their actual
          // situation. Seeking toward a slowly-moving point (the door,
          // orbited by the bounded sin/cos offset) keeps the roamer
          // genuinely centered on their door instead.
          const tier = doorA ? getDisposition(roamer.agent.id)?.tier : null
          const drift = doorA ? idleDriftOffset(roamer.agent.id, this.agentClock, tier) : { x: 0, y: 0 }
          rawPos = seekTo({ x: dest.x + drift.x, y: dest.y + drift.y }).pos
        }
      } else {
        // Car-owning roamers used to route VIA their car (walk to it, drive
        // a road-following route, walk in from the drop-off) instead of a
        // straight door-to-door line. That choreography was the source of
        // three separate movement bugs in a row (an asymmetric catch-up
        // clamp, an instant-snap on unblocking, and a stuck-target issue
        // that made roamers read as sprinting at 400-700+px/s) and isn't
        // core to the game - simplified to the same plain walk everyone
        // else gets. The car stays visually parked at its last spot instead
        // of following them; see the `roamer.inCar`/`carPark` rendering
        // below, unchanged.
        roamer.travelPhase = null
        rawPos = seekTo(doorB).pos
      }
      roamer.inCar = !onFoot
      // Named roamers don't push against building collision at all - they
      // have no pathfinding, so any straight-line walk (traveling) or small
      // idle wander (drifting near their own door) can graze a building
      // edge, and resolveOpenPosition fighting that every frame is what
      // read as shaking in place or a permanent stall against an obstacle
      // (reported against both buildings and a parked car). Buildings stay
      // solid for the PLAYER; for roamers this trades a rare, brief visual
      // overlap with a building corner for never visibly fighting or
      // getting stuck - the better trade for background NPCs. Trees/rocks
      // are no longer solid for anyone (see scatterEnvironment) so they're
      // not a factor here either way.
      const x = rawPos.x
      const y = rawPos.y
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
      // Car-owning NPCs DO drive - but only on the road, same rule the player
      // gets. Previously the car was teleported onto the roamer for the whole
      // journey, and roamers walk straight lines between buildings, so it was
      // driven over lawns. These live on the roamer rather than in
      // vehicleActors, which is why the road invariant never caught them.
      //
      // Now: the car is created parked in front of the owner's house and
      // returns there whenever they aren't driving it. It only follows them
      // while they are travelling AND standing on a road tile, so it is never
      // seen off-road under its own power.
      const vehicleSpec = npcVehicleFor(roamer.character)
      if (vehicleSpec && !roamer.carActor && !roamer.carParkFailed) {
        const homeDef = getHomeBuildingDef(roamer.character.id)
        const home = homeDef ? FINANCE_BUILDINGS.find((b) => b.id === homeDef.id) : null
        if (home) {
          const col = Math.round((home.tiles.c0 + home.tiles.c1) / 2)
          const frontRow = home.tiles.r1 + 1
          // Park at the KERB nearest the house rather than on the lawn in
          // front of it - nearestRoadTile already prefers kerb tiles over the
          // driving lane, so this reuses the same rule the player's vehicles
          // get instead of inventing a second one.
          const spot = this.nearestRoadTile(col, frontRow) ?? { col, row: frontRow }
          roamer.carPark = { x: spot.col * TILE_SIZE + TILE_SIZE / 2, y: spot.row * TILE_SIZE + TILE_SIZE / 2 }
          // Deterministic per-character pick so a given NPC always has the
          // same car. `>>> 0` not `>>` - a signed shift yields a negative
          // index for about half of all ids.
          let hash = 0
          for (const ch of roamer.character.id) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0
          roamer.carActor = new VehicleActor(this, roamer.carPark.x, roamer.carPark.y, {
            spriteName: vehicleSpec.spriteName,
            scale: vehicleSpec.scale,
            atlasKey: vehicleSpec.atlasKey,
            tierId: NPC_VEHICLE_TIERS[hash % NPC_VEHICLE_TIERS.length],
          })
          this.orientParked(roamer.carActor, spot.col, spot.row) // lie along the road
          // Register it as a real vehicle so it can be walked up to, stolen
          // and driven like any other parked car. Without this it was just
          // scenery - findNearbyVehicle only ever searched vehicleActors.
          roamer.carEntry = {
            tierId: `npc_${roamer.character.id}`,
            name: `${roamer.character.name}'s car`,
            spriteName: vehicleSpec.spriteName,
            atlasKey: vehicleSpec.atlasKey,
            speedMultiplier: 1.8,
            scale: vehicleSpec.scale ?? 1,
            col: spot.col,
            row: spot.row,
            owned: false,
            actor: roamer.carActor,
          }
          this.vehicleActors.push(roamer.carEntry)
        } else {
          roamer.carParkFailed = true // no home building; don't retry every frame
        }
      }

      // Once the player steals or is driving it, the NPC no longer controls
      // the car - otherwise the roamer would keep teleporting it back and
      // fight the player for its position.
      const takenByPlayer = Boolean(
        roamer.carEntry && (roamer.carEntry.owned || this.drivingEntry === roamer.carEntry)
      )
      const travelling = Boolean(doorA && doorB && presence?.currentBuildingId !== presence?.nextBuildingId)

      if (roamer.carActor && !takenByPlayer) {
        // An NPC does not TURN INTO a car. They walk to where it is parked,
        // get in, drive, and park it again at whatever building they arrive
        // at - so the car is always somewhere plausible and the person is
        // always visible unless they are actually behind the wheel.
        if (!travelling) {
          // Arrived: park at the kerb nearest this building - but resolve the
          // spot ONCE per arrival, not every frame.
          //
          // Recomputing per frame was the "cars blinking" bug: nearestRoadTile
          // skips tiles other vehicles occupy, so as cars moved it kept
          // returning a DIFFERENT tile and the car teleported between them
          // every frame. It also caused the overlaps - two cars resolved in
          // the same frame could both be handed the same tile before either
          // had registered on it. Caching by building id fixes both: the
          // chosen tile is written to carEntry immediately, so every other
          // car's search treats it as taken from then on.
          const hereId = presence?.currentBuildingId ?? null
          if (hereId !== roamer.carParkedFor) {
            const here = hereId ? FINANCE_BUILDINGS.find((b) => b.id === hereId) : null
            if (here) {
              const spot = this.nearestRoadTile(
                Math.round((here.tiles.c0 + here.tiles.c1) / 2),
                here.tiles.r1 + 1,
                [],
                roamer.carEntry
              )
              if (spot) {
                roamer.carPark = {
                  x: spot.col * TILE_SIZE + TILE_SIZE / 2,
                  y: spot.row * TILE_SIZE + TILE_SIZE / 2,
                  col: spot.col,
                  row: spot.row,
                }
                if (roamer.carEntry) {
                  roamer.carEntry.col = spot.col
                  roamer.carEntry.row = spot.row
                }
                roamer.carParkedFor = hereId
              }
            } else {
              roamer.carParkedFor = hereId
            }
          }
          roamer.inCar = false
          roamer.offRoadFrames = 0
          roamer.carRest = null
        }

        // inCar is decided by the route phase computed earlier in this loop,
        // not re-derived here. The old on-road / proximity test fought with
        // it and is gone; this block only places the car now.
        if (roamer.inCar) {
          roamer.carActor.setPosition(x, y)
          roamer.carActor.faceVector(dx, dy)
        } else if (roamer.carPark) {
          // Parked. carRest tracks the current leg (pickup before the drive,
          // drop-off after); carPark is the fallback once the journey is over
          // and the !travelling branch has re-parked it.
          const target = roamer.carRest ?? roamer.carPark
          if (roamer.carActor.x !== target.x || roamer.carActor.y !== target.y) {
            roamer.carActor.setPosition(target.x, target.y)
            this.orientParked(
              roamer.carActor,
              Math.floor(target.x / TILE_SIZE),
              Math.floor(target.y / TILE_SIZE)
            )
          }
        }
        roamer.carActor.setVisible(true)
      }

      // Hidden only while actually behind the wheel.
      const driving = Boolean(roamer.inCar && !takenByPlayer)
      roamer.actor.sprite.setVisible(!driving)
      roamer.actor.shadow.setVisible(!driving)

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
    const actor = new VehicleActor(this, x, y, { spriteName, scale, atlasKey, tierId })
    this.orientParked(actor, col, row)
    const entry = { tierId, name, spriteName, speedMultiplier, scale, col, row, owned, atlasKey, actor }
    this.vehicleActors.push(entry)
    return entry
  }

  // Vehicles belong on the road. The atmosphere "street pool" already picked
  // street columns, but the transit-hub and police vehicles were placed with
  // adjacentOpenTiles() next to their building, which is grass - that's why
  // cars were sitting on lawns beside the shops.
  isRoadTile(col, row) {
    return FINANCE_V_STREETS.includes(col) || FINANCE_H_STREETS.includes(row)
  }

  // Nearest free road tile to (col,row), searched as expanding square rings so
  // a vehicle still parks near the building it belongs to - just on the road
  // rather than on the grass. `taken` covers tiles claimed earlier in the same
  // spawn pass, which aren't in vehicleActors yet.
  // A 3-wide street's middle column is the driving lane; the two outer
  // columns are the kerb. Parking in the middle blocked the road entirely
  // (vehicles are solid), so a parked car goes to the kerb.
  isKerbTile(col, row) {
    if (!this.isRoadTile(col, row)) return false
    const onV = FINANCE_V_STREETS.includes(col)
    const onH = FINANCE_H_STREETS.includes(row)
    // Never park in a crossroads - it blocks both directions at once.
    if (onV && onH) return false
    if (onV) {
      // Kerb = the outer columns of the 3-wide block; the middle column has
      // road on both sides and is the driving lane.
      return !(FINANCE_V_STREETS.includes(col - 1) && FINANCE_V_STREETS.includes(col + 1))
    }
    // Horizontal street: the same rule, but on ROWS. The previous version
    // returned true for any column here, which is why cars still parked
    // across the middle of east-west roads.
    return !(FINANCE_H_STREETS.includes(row - 1) && FINANCE_H_STREETS.includes(row + 1))
  }

  // A parked car should lie ALONG the road, not across it. A car is roughly
  // one tile wide but two long, so parking it nose-to-kerb on an east-west
  // street pushes its whole length into the driving lanes. Vertical streets
  // want a north/south car; horizontal streets want an east/west one.
  parkedFacing(col, row) {
    if (FINANCE_V_STREETS.includes(col)) return [0, 1] // along a north-south street
    if (FINANCE_H_STREETS.includes(row)) return [1, 0] // along an east-west street
    return [0, 1]
  }

  // Points an idle vehicle along whichever road it is parked on.
  orientParked(actor, col, row) {
    const [dx, dy] = this.parkedFacing(col, row)
    actor.faceVector(dx, dy)
  }

  // A parked car is about 87px long against 40px tiles, so two cars on
  // ADJACENT tiles still overlap even though their tiles differ - which is
  // why "no vehicle on this exact tile" was not enough to stop them sitting
  // on top of each other. Centres need roughly a car's length between them.
  CAR_TILE_GAP = 2

  // True if any vehicle (or already-claimed spot) is close enough that a car
  // parked here would visually overlap it.
  // `ignore` is the vehicle being placed. Without it a car re-parking would
  // reject every spot near its own current position, since it is itself in
  // vehicleActors.
  vehicleTooClose(c, r, taken, ignore = null) {
    const near = (o) => Math.abs(o.col - c) <= this.CAR_TILE_GAP && Math.abs(o.row - r) <= this.CAR_TILE_GAP
    if (taken.some(near)) return true
    return Boolean(this.vehicleActors?.some((v) => v !== ignore && near(v)))
  }

  // Nearest vertical-street column to `col`. Drive routes run along the road
  // grid, and the grid's north-south legs are these columns.
  nearestVStreetCol(col) {
    let best = null
    for (const c of FINANCE_V_STREETS) {
      if (best === null || Math.abs(c - col) < Math.abs(best - col)) best = c
    }
    return best ?? col
  }

  nearestHStreetRow(row) {
    let best = null
    for (const r of FINANCE_H_STREETS) {
      if (best === null || Math.abs(r - row) < Math.abs(best - row)) best = r
    }
    return best ?? row
  }

  // Middle column of the 3-wide street block nearest `col` - the DRIVING
  // lane. Cars park on the outer (kerb) columns, so routing along a kerb put
  // moving traffic straight into the parked cars: with the yield rule added,
  // every car stopped permanently behind a parked one and nothing drove at
  // all. Driving down the middle keeps the two apart.
  drivingLaneCol(col) {
    const near = this.nearestVStreetCol(col)
    for (const cand of [near, near - 1, near + 1]) {
      if (FINANCE_V_STREETS.includes(cand - 1) && FINANCE_V_STREETS.includes(cand + 1)) return cand
    }
    return near
  }

  drivingLaneRow(row) {
    const near = this.nearestHStreetRow(row)
    for (const cand of [near, near - 1, near + 1]) {
      if (FINANCE_H_STREETS.includes(cand - 1) && FINANCE_H_STREETS.includes(cand + 1)) return cand
    }
    return near
  }

  // Waypoints for driving from tile P to tile D along roads only. A straight
  // line between two kerbs cuts across grass, because the road network is a
  // grid - this walks it properly: north-south along the pickup's street, east
  // -west along a connecting cross-street, then north-south to the drop-off.
  // Returns world-pixel centres.
  roadRouteWaypoints(pCol, pRow, dCol, dRow) {
    const centre = (c, r) => ({ x: c * TILE_SIZE + TILE_SIZE / 2, y: r * TILE_SIZE + TILE_SIZE / 2 })
    const pv = this.drivingLaneCol(pCol)
    const dv = this.drivingLaneCol(dCol)
    const cross = this.drivingLaneRow(Math.round((pRow + dRow) / 2))
    const pts = [centre(pCol, pRow)]
    if (pv !== pCol) pts.push(centre(pv, pRow)) // sidle onto the north-south street
    pts.push(centre(pv, cross)) // drive it to the cross-street
    if (dv !== pv) pts.push(centre(dv, cross)) // along the cross-street
    pts.push(centre(dv, dRow)) // down the destination's street
    if (dv !== dCol) pts.push(centre(dCol, dRow)) // pull into the kerb
    return pts
  }

  // True if another vehicle sits close AHEAD of a car at `pos` travelling in
  // direction `dir`. Only vehicles in front count - checking all directions
  // would deadlock two cars that merely pass near each other, and a car
  // should not brake for something already behind it.
  vehicleAhead(pos, dir, self) {
    const len = Math.hypot(dir.x, dir.y)
    if (len < 0.0001) return false
    const ux = dir.x / len
    const uy = dir.y / len
    for (const v of this.vehicleActors) {
      if (v === self || !v.actor) continue
      const ox = v.actor.x - pos.x
      const oy = v.actor.y - pos.y
      const dist = Math.hypot(ox, oy)
      if (dist > TILE_SIZE * 1.6 || dist < 0.0001) continue
      const along = ox * ux + oy * uy
      if (along <= 0) continue // behind us
      // Must also be roughly IN the lane, not merely nearby - a car parked at
      // the kerb is beside the driving lane, and braking for it would stall
      // traffic permanently.
      const lateral = Math.abs(ox * -uy + oy * ux)
      if (lateral < TILE_SIZE * 0.7) return true
    }
    return false
  }

  // Position along a polyline at 0..1 of its total length.
  pointAlongRoute(points, u) {
    if (points.length < 2) return points[0] ?? { x: 0, y: 0 }
    const segs = []
    let total = 0
    for (let i = 1; i < points.length; i++) {
      const d = Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y)
      segs.push(d)
      total += d
    }
    if (total <= 0) return points[0]
    let want = Math.max(0, Math.min(1, u)) * total
    for (let i = 0; i < segs.length; i++) {
      if (want <= segs[i] || i === segs.length - 1) {
        const f = segs[i] > 0 ? want / segs[i] : 0
        const a = points[i]
        const b = points[i + 1]
        return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f }
      }
      want -= segs[i]
    }
    return points[points.length - 1]
  }

  routeLength(points) {
    if (!points || points.length < 2) return 0
    let total = 0
    for (let i = 1; i < points.length; i++) {
      total += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y)
    }
    return total
  }

  nearestRoadTile(col, row, taken = [], ignore = null) {
    // Two passes: kerb tiles first, then any road tile as a fallback so a
    // vehicle still spawns if every kerb nearby is taken.
    for (const kerbOnly of [true, false]) {
    for (let radius = 0; radius <= 24; radius++) {
      for (let dc = -radius; dc <= radius; dc++) {
        for (let dr = -radius; dr <= radius; dr++) {
          if (Math.max(Math.abs(dc), Math.abs(dr)) !== radius) continue
          const c = col + dc
          const r = row + dr
          if (c < 1 || r < 1 || c >= MAP_COLS - 1 || r >= MAP_ROWS - 1) continue
          if (!this.isRoadTile(c, r)) continue
          if (kerbOnly && !this.isKerbTile(c, r)) continue
          if (this.isBlockedTile(c, r)) continue
          if (this.vehicleTooClose(c, r, taken, ignore)) continue
          return { col: c, row: r }
        }
      }
    }
    }
    return null
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
        // Stored positions outlive the map. Anything saved before the map
        // was widened (or parked on what is now grass) has to be rejected,
        // or a car reappears sitting on a lawn forever.
        record.col > 0 &&
        record.row > 0 &&
        record.col < MAP_COLS - 1 &&
        record.row < MAP_ROWS - 1 &&
        this.isRoadTile(record.col, record.row) &&
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
      const claimed = []
      hubTiers.forEach((opt, i) => {
        const near = hubTiles[i]
        if (!near) return
        // Park it on the nearest road tile instead of whatever open ground
        // happened to be adjacent to the station.
        const fallbackTile = this.nearestRoadTile(near.col, near.row, claimed) ?? near
        claimed.push(fallbackTile)
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
    // fbiHQ was folded into governmentBuilding in the Phase 2 building
    // consolidation (see FINANCE_BUILDING_DEFS) - this atmosphere
    // police-cruiser spawn just needed a still-real building id near it.
    const fbiHQ = FINANCE_BUILDINGS.find((b) => b.id === 'governmentBuilding')
    const policeNear = fbiHQ ? this.adjacentOpenTiles(fbiHQ, 1)[0] : null
    const policeFallback = policeNear
      ? (this.nearestRoadTile(policeNear.col, policeNear.row) ?? policeNear)
      : null
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
    // Was: pick a random street column and a random row, up to 200 tries.
    // With the wider street spacing there are far fewer road tiles, so those
    // tries kept landing on blocked ground and the loop gave up early - which
    // is why several atmosphere cars stopped appearing at all. Enumerate the
    // actual free kerb tiles instead, so every vehicle in the pool gets one
    // as long as one exists.
    const kerbCandidates = []
    for (let r = 4; r < MAP_ROWS - 2; r++) {
      for (const c of FINANCE_V_STREETS) {
        if (!this.isKerbTile(c, r)) continue
        if (this.isBlockedTile(c, r)) continue
        if (this.vehicleTooClose(c, r, [])) continue
        kerbCandidates.push({ col: c, row: r })
      }
    }
    // Deterministic spread rather than clustering at the top of the map.
    const stride = Math.max(1, Math.floor(kerbCandidates.length / (streetPool.length + 1)))
    streetPool.forEach((flavor, i) => {
      const tierId = `atmo_${flavor.replace('.png', '')}`
      const owns = isOwned(tierId)
      let tile = null
      if (owns) {
        const restored = restoredTile(tierId, null)
        if (restored && !this.vehicleActors.some((v) => v.col === restored.col && v.row === restored.row)) {
          tile = restored
        }
      }
      if (!tile) tile = kerbCandidates[(i + 1) * stride] ?? kerbCandidates[i]
      if (!tile) return
      this.spawnVehicleEntry({
        tierId,
        name: `Parked ${flavor.replace('.png', '').replace('_', ' ')}`,
        spriteName: pico8CarFrameFor(tierId),
        atlasKey: PICO8_ATLAS_KEY,
        speedMultiplier: 1.8,
        scale: 1,
        col: tile.col,
        row: tile.row,
        owned: owns,
      })
    })

    // Final invariant: no vehicle ends up off the road, whichever of the
    // blocks above placed it. Each of them has its own tile-picking rule
    // (hub = nearest kerb, police = nearest kerb, street pool = a random
    // street column, owned = a restored position) and a car was still
    // turning up on grass, so rather than keep auditing four code paths
    // this enforces the rule once, at the end, where it can't be missed.
    for (const v of this.vehicleActors) {
      if (this.isRoadTile(v.col, v.row)) continue
      const snapped = this.nearestRoadTile(v.col, v.row, [], v)
      if (!snapped) continue
      v.col = snapped.col
      v.row = snapped.row
      const { x, y } = this.tileMover.tileCenter(snapped.col, snapped.row)
      v.actor.setPosition(x, y)
      if (v.owned) useGameStore.getState().updateOwnedVehiclePosition(v.tierId, snapped.col, snapped.row)
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
    // Pull away from a standstill rather than snapping to top speed. The
    // throttle ramps in update(); see vehiclePerformance for per-vehicle
    // top speed and how fast each one gets there.
    this.driveThrottle = 0
    this.applyDriveSpeed()
    // Avoids a one-frame snap-rotation from stale prev-position on the first
    // driving frame (see the faceVector call in update()).
    this._prevDriveX = this.playerActor.x
    this._prevDriveY = this.playerActor.y
    useGameStore.getState().setDriving(true)
  }

  // Converts the current throttle into a TileMover step duration. Shorter
  // step = faster. Called every frame while driving.
  applyDriveSpeed() {
    const entry = this.drivingEntry
    if (!entry) return
    const { speed } = vehiclePerformance(entry.tierId, entry.speedMultiplier ?? 1.8)
    const t = this.driveThrottle ?? 0
    const current = speed * (VEHICLE_LAUNCH_FRACTION + (1 - VEHICLE_LAUNCH_FRACTION) * t)
    this.tileMover.stepDurationMs = Math.round(160 / Math.max(0.2, current))
  }

  exitVehicle() {
    const entry = this.drivingEntry
    if (!entry) return
    this.driveThrottle = 0
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
      // The chapel's footprint is the whole 30x22 courtyard, so the usual
      // whole-footprint rect would offer "press E to enter" while the player
      // is out among the graves. It gets a rect around its actual doors
      // instead (CHAPEL_DOOR_OFFSET, the centre pair of the House layer's
      // bottom row) so entering happens where the doors are.
      rect:
        b.id === 'temple'
          ? new Phaser.Geom.Rectangle(
              (b.tiles.c0 + CHAPEL_DOOR_OFFSET.col) * TILE_SIZE - pad,
              (b.tiles.r0 + CHAPEL_DOOR_OFFSET.row) * TILE_SIZE - pad,
              CHAPEL_DOOR_OFFSET.width * TILE_SIZE + TILE_SIZE,
              CHAPEL_DOOR_OFFSET.height * TILE_SIZE + TILE_SIZE
            )
          : new Phaser.Geom.Rectangle(
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
      // The 3 Phase-2 consolidated hubs (Underworld/Business Center/
      // Government Building) are multi-tenant tabbed React modals, not a
      // walk-in interior - same pattern as trainStation above: open the
      // modal straight from the overworld footprint, no interior zone load.
      if (zone.id === 'underworld' || zone.id === 'businessCenter' || zone.id === 'governmentBuilding') {
        this.pauseForModal()
        this.bridge.emit('interact', { type: 'building', id: zone.id })
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
        this.transitionToZone('chapelInterior')
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

    // Courtyard gate swings open as the player walks up to it.
    if (this.currentZoneId === 'chapelExterior' || this.currentZoneId === 'overworld') {
      updateChapelGate(this, this.playerActor.x, this.playerActor.y, TILE_SIZE)
    }

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

      // Throttle: builds while a direction is held, falls away when it isn't,
      // at the vehicle's own accel rate. A supercar is near top speed almost
      // immediately; a van takes a couple of seconds. Braking is quicker than
      // accelerating, which is both true of cars and stops a released key
      // leaving you coasting.
      const { accel } = vehiclePerformance(this.drivingEntry.tierId, this.drivingEntry.speedMultiplier ?? 1.8)
      const dt = delta / 1000
      const throttling = Boolean(horiz || vert)
      const rate = throttling ? accel : -accel * 2
      this.driveThrottle = Math.max(0, Math.min(1, (this.driveThrottle ?? 0) + rate * dt))
      this.applyDriveSpeed()
    }
    this._prevDriveX = this.playerActor.x
    this._prevDriveY = this.playerActor.y

    this.updateAllAmbientNpcs(delta)
    this.updateHabitatAnimals(delta)
    if (this.currentZoneId === 'overworld') this.updateNamedRoamers(delta)

    if (this.interactionLocked) return

    this.updateNearbyZone()
    this.updateAnimatedDoors()

    // Map flattening: currentCityId no longer changes as the player walks
    // around - there's nothing to detect any more (the district bands this
    // derived from are gone). Every reader elsewhere already defaults via
    // `s.currentCityId || 'tokyo'`, so leaving it frozen at whatever it was
    // is safe.

    if (Phaser.Input.Keyboard.JustDown(this.wasd.E) && this.nearbyZone) {
      this.triggerInteraction(this.nearbyZone)
    }
  }
}
