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
  BUILDING_IMAGE_FILES,
  buildingImageTextureKey,
} from '../tileGen'
import {
  SERENE_VILLAGE_DOOR_KEY,
  SERENE_DOOR_ANIM_OPEN,
  SERENE_DOOR_ANIM_CLOSE,
  ensureSereneVillageDoorAnims,
  PREFAB_IMAGE_MAX_OVERFLOW_TILES,
  computePrefabImageOverflowPx,
} from '../packs/packRender'
import { preloadPlayerSheet } from '../spriteGen'
import { buildTmxWallInteriorZone, TEA_HOUSE_ROOM } from '../interiors/tmxWallInterior'
import { buildChapelMapZone, preloadChapelMap, CHAPEL_ROOM } from '../interiors/tmxMapInterior'
import { buildChapelExteriorZone, preloadChapelExterior, updateChapelGate, chapelFacadeSolidOffsets, CHAPEL_EXTERIOR_ROOM } from '../interiors/tmxMapExterior'
import { preloadChapelPack } from '../packs/chapelPixelTiles'
import { preloadCuteTerrain, preloadCuteTrees, GRASS_TYPES } from '../packs/cuteFantasyTerrain'
import { preloadTopDownVehicles, NPC_VEHICLE_TIERS, vehiclePerformance, VEHICLE_LAUNCH_FRACTION } from '../packs/topDownVehicles'
import { preloadNpcRealSprites } from '../packs/npcRealSprites'
import { preloadPlayerRealSprite } from '../packs/playerRealSprite'

// ---------------------------------------------------------------------------
// OverworldScene is the single walkable map for Capital Syndicate (the
// Finance world). Zones: the outdoor `overworld` map, the Stock Exchange's
// own bespoke `stockExchangeInterior` trading floor, and a generic
// `buildingInterior` room (see
// INTERIOR_TEMPLATES) reused by every other building - which template a
// given building gets is looked up from BUILDING_INTERIOR_TEMPLATE, falling
// back to a `residence`/`hideout` template by the building's `kind` for the
// 88 character home/hideout buildings that aren't hand-listed there (see
// interiorTemplateFor).
// Walking up to any of the 98 buildings (10 hand-authored + 88 character
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

// Map overhaul Phase 4 (tight residential clusters): homes used to be
// row-wrap packed with a uniform 1-tile gap between every single home
// (HOME_GAP), which reads as a loose flowing grid rather than the reference
// mockup's solid blocks of touching houses with visible separation only
// BETWEEN clusters/rows. Replaced by packHomeBand() below - see its header
// comment - which packs each style sub-group into its own square-ish grid of
// ROWS (each row a strip of houses touching edge to edge, zero horizontal
// gap), with ROW_GAP of walkable clearance between one row and the next so
// the cluster reads as parallel walkable rows rather than one solid
// impassable block, then packs those (up to 3) cluster rectangles across the
// band with CLUSTER_GAP between them (bigger than ROW_GAP, so a cluster
// boundary still reads as more of a break than a between-row gap). The old
// HOME_GAP constant and the `.map((d) => ({ ...d, gap: HOME_GAP }))` that
// applied it are gone - packHomeBand never reads a def's `gap` field.
const CLUSTER_GAP = 3
const ROW_GAP = 2

// Map overhaul Phase 4 (trim to the 14-main-building-category spec): the
// roster below used to carry 31 hand-authored hub defs (Phase 3). 9 of the
// 14 spec'd main-building categories already map 1:1 to a real building here
// (stockExchange/casino/bank/realEstateAgency/temple/underworld/
// trainStation/governmentBuilding/businessCenter); a 10th, Industrial Zones,
// is now `industrialZone` below - one multi-tenant hub absorbing the 5
// former single-tenant industrialist HQs (fordRougeComplex/carnegieSteelMill/
// standardOilRefinery/pentagonDodHQ/epaHQ), same TABS-modal pattern Phase 2
// already used 3 times for underworld/businessCenter/governmentBuilding -
// see IndustrialZoneModal.jsx. The remaining 4 spec categories (Court &
// Prison, Food Center, Dock/Pier, Entertainment Complex) are still unbuilt -
// out of scope for this pass. Every other Phase-3 hub def that didn't map to
// one of the 14 categories (parliament/hotel/park/dockVaults/teaHouse/
// machiyaEstate/zenGarden/silkMarket/sakeBrewery/artisanShop/
// dotonboriArcade/fishMarket/takoyakiStand/sapporoBrewery/alpineLodge/
// corporateOffice/vcHub - 17 buildings) is deleted outright, not folded into
// a hub - there's no natural absorbing building for any of them the way the
// Phase 2 consolidations had one.
//
// Every remaining non-home def below still carries a `zone` tag - one of
// 'law' (left column), 'finance' (center-left column), 'chapel' (center,
// fixed 30-wide reservation - temple is the sole occupant), or 'industry'
// (right column) - see layoutFinanceMap() for how each zone is packed into
// its own column region of the middle hub band.
const FINANCE_BUILDING_DEFS = [
  // --- Financial HQs ---
  { id: 'stockExchange', label: 'Tokyo Stock Exchange', facadeStyle: 'modernGlass', color: 0x1f5f3a, width: 3, height: 3, zone: 'finance' },
  // Consolidation (Phase 2): Buffett/Vanderbilt/Musk/Howard Marks/Jobs each
  // used to be their own single-tenant HQ. Folded into one denser
  // multi-tenant hub (see BusinessCenterModal.jsx's 5 tabs) - footprint is
  // bigger than any one of the old towers to read as "several tenants share
  // this building", not just a relabeled single HQ.
  { id: 'businessCenter', label: 'Capital Business Center', facadeStyle: 'modernGlass', color: 0x3a3a4a, width: 7, height: 4, zone: 'finance' },
  { id: 'bank', label: 'Bank & Realty Office', facadeStyle: 'modernGlass', color: 0x1f3a5f, width: 4, height: 3, zone: 'finance' },
  { id: 'realEstateAgency', label: 'Real Estate Agency', facadeStyle: 'modernGlass', color: 0x3a5f4a, width: 4, height: 3, zone: 'finance' },
  // Consolidation (Phase 2): FBI HQ (Hoover) + IRS HQ (Caplin) folded into one
  // federal hub (see GovernmentBuildingModal.jsx's 3 tabs, the 3rd of which
  // also gives the existing status-bar-only GovernmentModal a physical
  // building).
  { id: 'governmentBuilding', label: 'Federal Government Building', facadeStyle: 'modernGlass', color: 0x2a3a5a, width: 6, height: 4, zone: 'law' },

  // Distinct indigo/violet exterior so this reads as the grand chapel it has
  // an interior for (see buildChapelInteriorZone in this file and
  // src/game/interiors/tmxWallInterior.js) rather than blending into the
  // district as just another plain amenity building. Label now says
  // "Chapel" outright while keeping "Whispering Temple" as the flavor name
  // TempleModal.jsx already displays.
  // 16x14 matches the authored chapel art exactly (House/Wings/Dragon layers,
  // cols 6-21 x rows 2-15 of Exterior.tmx) so the facade fills its footprint
  // with no overflow onto neighbours - see drawChapelExteriorFacade.
  // zone: 'chapel' - the sole occupant of the fixed 30-wide center-column
  // reservation (its own width) in the middle hub band; see layoutFinanceMap.
  { id: 'temple', label: 'Whispering Temple Chapel', facadeStyle: 'traditionalCottage', color: 0x3a2a6a, width: 30, height: 22, zone: 'chapel' },

  { id: 'casino', label: 'Neon Dragon Casino', facadeStyle: 'modernBrick', color: 0x8a1f6a, width: 4, height: 3, zone: 'finance' },
  // New 11th hub building (header cleanup pass): FinanceStatusBar's "Places &
  // Transit" button is gone (header stripped to Phone + End Day only), so
  // its mcdonalds_diner content (previously only reachable via that button -
  // see WorldScreen.jsx's BUILDING_TO_INTERACTIVE_LOCATION comment) needed a
  // real building. Sized/styled like the other small finance-zone amenities
  // (bank/casino) rather than one of the multi-tenant tabbed hubs, since it's
  // a single InteractiveLocationModal entry, not several tenants.
  { id: 'foodCourt', label: 'Food Court', facadeStyle: 'modernBrick', color: 0xa05a1f, width: 4, height: 3, zone: 'finance' },
  // Consolidation (Phase 2): Black Market + Call Center Ops + Crime Alley
  // (Luciano) + Speakeasy Hotel (Capone) folded into one underworld hub (see
  // UnderworldModal.jsx's 4 tabs). Widest/tallest of the 4 multi-tenant hubs
  // footprint-wise since it absorbs 4 former buildings, not 2-5 tenants
  // sharing offices - reads as a sprawling underworld block rather than a
  // single storefront.
  { id: 'underworld', label: 'The Underworld', facadeStyle: 'modernBrick', color: 0x3a1f3a, width: 6, height: 4, zone: 'law' },

  // Consolidation (Phase 4): Ford River Rouge Complex + Homestead Steel Mill
  // + Standard Oil Refinery + Pentagon Procurement HQ + EPA Regulation
  // Agency - 5 former single-tenant industrialist/regulator HQs - folded
  // into one Industrial Zone hub, the 10th of the spec's 14 main-building
  // categories (see IndustrialZoneModal.jsx's 5 tabs). Sized like
  // businessCenter (7x4 for 5 tenants) for the same "reads as several
  // tenants share this building" reason.
  { id: 'industrialZone', label: 'Industrial Zone', facadeStyle: 'modernGlass', color: 0x3a4a4a, width: 7, height: 4, zone: 'industry' },
  { id: 'trainStation', label: '🚆 Central Train Station', facadeStyle: 'modernGlass', color: 0x4a6fa5, width: 4, height: 2, zone: 'industry' },

  // Dock/Pier - one of the last unbuilt spec categories (see the note
  // above). Marine cargo insurance/customs-manifest fraud, deliberately NOT
  // a smuggling loop (that's already owned by NarcoticsTradeModal.jsx/
  // SyndicateOperationsModal.jsx, reachable via the phone). Cast & Reel
  // fishing + a post-catch Declare Honest/Pad the Manifest choice, entirely
  // in WharfModal.jsx - see the triggerInteraction case below, same
  // straight-to-modal pattern as foodCourt (no Phaser interior needed).
  { id: 'wharf', label: 'Bonded Cargo Pier', facadeStyle: 'modernBrick', color: 0x2a5a6a, width: 4, height: 3, zone: 'industry' },

  // Entertainment Complex - the last unbuilt spec category. One building,
  // 2 tabs (Concert Hall/Sports Stadium - see EntertainmentComplexModal.jsx),
  // reusing two named characters who were written but previously un-slotted
  // into any building: Dixon Trujillo (Griselda Empire, "Nightclub
  // Extortion & Entertainment Fronts") for Concert Hall's arrow-key rhythm
  // minigame (RhythmGame.jsx), Arnold Rothstein ("fixed the 1919 World
  // Series") for Sports Stadium's alternating-key sprint QTE (SprintRace.jsx).
  // Same straight-to-modal shape as the other 4 tabbed hubs (underworld/
  // businessCenter/governmentBuilding/industrialZone) - see the
  // triggerInteraction case below, no Phaser interior needed.
  { id: 'entertainmentComplex', label: 'Entertainment Complex', facadeStyle: 'modernGlass', color: 0x5a3a8a, width: 6, height: 4, zone: 'industry' },

  // Court & Prison - one of the last 3 unbuilt spec categories (see the note
  // above). Gives the jail mini-map mechanic (bribeDice/maze, in
  // useGameStore.js's attemptJailBribe/attemptMazeSegment) a real door on
  // the map: arrest teleports the player straight into the jailCell zone
  // (see triggerInteraction's courtAndPrison special-case and loadZone's
  // jailCell/jailMaze/jailUnderworld branches below); walking up to it while
  // NOT in custody is a flavor no-op, not a real entrance - matches the
  // lore spec's "you don't check into a jail voluntarily" framing. zone:
  // 'law' puts it in the same column as `underworld`, which the maze's
  // back-door tunnel dead-ends into.
  { id: 'courtAndPrison', label: 'Court & Jail', facadeStyle: 'modernBrick', color: 0x4a4a4a, width: 4, height: 3, zone: 'law' },

  // Ince's house - she's a procedurally-generated finance-district ambient
  // NPC (npcGenerator.js's finance_ambient_2), not a roster member, so she
  // gets no characterHomeBuildings.js entry of her own. One bespoke hub-shaped
  // def instead (rather than adding her to a roster, which would pull in
  // unwanted side effects - dispositions, romance eligibility, a generic
  // NamedNpcModal fallback - she's deliberately excluded from, see
  // IncModal.jsx's header), but a real walk-in interior like every character
  // home (not in the no-interior hub list below) - npcId is what
  // buildGenericInteriorZone's interiorDesk forwards to WorldScreen.jsx so
  // reaching the desk opens IncModal. facadeStyle is dead here (see
  // BUILDING_IMAGE_FILES in tileGen.js - inceHome overrides it with the real
  // bespoke art), kept only as a harmless fallback if that image ever failed
  // to load.
  { id: 'inceHome', label: "Ince's House", facadeStyle: 'modernBrick', color: 0x2a5a6a, width: 4, height: 3, zone: 'finance', npcId: 'finance_ambient_2' },

  // --- Character homes & hideouts (generated, see characterHomeBuildings.js) ---
  // Appended after the 10 hub defs above (not interleaved) - layoutFinanceMap
  // below never packs this combined array as one flat pool any more (that
  // was the pre-Phase-3 scheme); it re-filters FINANCE_BUILDING_DEFS back
  // into hub defs (by `zone`) and home defs (by `kind`) itself. Kept as one
  // array anyway (rather than three separate exported lists) so this stays
  // the single roster source-of-truth other files could grep for.
  // Sorted by residentialStyleKey (stone manor / wood house / hideout /
  // brick cottage / stoneCottage / sereneRed / sereneGreen / sereneBlue)
  // before packing - array order is preserved straight through packing, so
  // this sort survives into "same style lands in a contiguous run" once
  // layoutFinanceMap splits it into the top-band styles (stone/woodHouse/
  // hideout) and bottom-band styles (brick/stoneCottage/sereneRed/
  // sereneGreen/sereneBlue) and packs each half, i.e. actual visual clusters
  // rather than the roster's arbitrary order scattering every style across
  // every row (reported: a log-cabin home next to a stone manor next to a
  // flat-roof warehouse, no grouping at all).
  ...CHARACTER_HOME_BUILDING_DEFS
    .slice()
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

// Streets are STREET_WIDTH tiles wide (wide enough to read as a road and to
// drive on) and the packer treats every street block as reserved - it skips
// a building past any street block it would overlap, so a facade can never
// draw on top of a road.
const STREET_WIDTH = 3
// 1-tile clear margin reserved on either side of every street block. Facade
// ART is allowed to overflow its footprint (prefab facades draw taller/wider
// than the tiles they own - see packRender), so a building whose footprint
// merely touches a street still LOOKS like it's built on the road without
// this margin. Packing-only: these margin columns/rows are ordinary grass,
// not road.
const STREET_MARGIN = 1

// Smallest column >= `col` where a `width`-wide building clears every street
// block in `streetCols` (already padded with STREET_MARGIN on each side by
// the caller - see reservedCols below), or null if it can't fit before
// `colEnd` (caller then wraps to a new row).
function firstColumnClearOfStreets(col, width, streetCols, colEnd) {
  let c = col
  while (c + width - 1 <= colEnd) {
    let hit = -1
    for (let x = c; x <= c + width - 1; x++) {
      if (streetCols.includes(x)) { hit = x; break }
    }
    if (hit === -1) return c
    c = hit + 1
  }
  return null
}

// ---------------------------------------------------------------------------
// Map overhaul Phase 3: rebuilds the map's spatial layout to a fixed 3-band
// mockup (a cross of 2 main horizontal roads dividing the map into 3
// horizontal bands) instead of the old single left-to-right/row-wrap pass:
//
//   1. Top home band    - residential clusters (stone/woodHouse/hideout style
//                          homes only), packed same as before.
//   2. Middle hub band   - all 10 hand-authored "hub" buildings (Phase 4
//                          trimmed this from 31 - see the header comment
//                          above FINANCE_BUILDING_DEFS), arranged in
//                          4 column-zones left to right (law, finance,
//                          chapel, industry - see the `zone` tags on
//                          FINANCE_BUILDING_DEFS above), separated by
//                          vertical road gaps. The chapel zone is a fixed
//                          30-wide reservation (its own width) rather than a
//                          packed group, since `temple` is a single building
//                          with an authored footprint. Placed dead-center as
//                          a landmark.
//   3. Bottom home band  - residential clusters (pico8/serene/brick style
//                          homes - the bulk of the 88), packed same as band 1.
//
// A full-width horizontal street sits between band 1->2 and band 2->3 (see
// insertStreetGap). A reserved rectangle in the bottom-right corner of band 3
// (FINANCE_FARM_ZONE, computed after this function returns) is carved out of
// the bottom band's own packable width for the ambient habitat animals/
// wealthy pet pens - see spawnHabitatAnimals/spawnWealthyPetPens below.
// ---------------------------------------------------------------------------

// Home style keys that land in the top band vs. the bottom band (see
// residentialStyleKey in tileGen.js for the 8 possible values - every one is
// assigned to exactly one of these two sets).
// 'bespoke_lisa' - see tileGen.js's residentialStyleKey/BESPOKE_HOME_STYLE_KEYS
// - joins the top band since that's her natural (wealth-based) tier before
// the bespoke-key override kicks in ($25M nets her 'woodHouse'); the override
// only needs to change WHICH cluster she lands in (a cluster of one, for
// safe overflow clearance), not which band.
const TOP_HOME_STYLES = new Set(['stone', 'woodHouse', 'hideout', 'bespoke_lisa'])
const BOTTOM_HOME_STYLES = new Set(['brick', 'stoneCottage', 'sereneRed', 'sereneGreen', 'sereneBlue'])

// Bottom-right reservation for ambient habitat animals + wealthy pet pens
// (see spawnHabitatAnimals/spawnWealthyPetPens/findPenSpot) - sized per the
// map-overhaul brief ("last ~20 columns x last ~15 rows"), carved out of the
// bottom home band's own packable width so it's guaranteed clear rather than
// hoping the row-wrap packer happens to leave the corner empty.
const FARM_ZONE_W = 20
const FARM_ZONE_H = 15
// Clear gap between the farm reservation and the bottom band's own packed
// home content, same margin motivation as STREET_MARGIN above.
const FARM_ZONE_MARGIN = 2

// Core row-wrap packer, shared by every band/zone below - the same "walk a
// cursor left to right, wrap to a new row on overflow or a street hit"
// algorithm the old single-pass packer used, just scoped to an explicit
// [colStart, colEnd] column range and starting row instead of always
// spanning the whole map. `reservedCols` is the (already STREET_MARGIN-
// padded) list of street columns to dodge - pass an empty array for a region
// that by construction contains no street (e.g. one hub zone's own column
// span, which sits strictly between two street reservations).
function packDefs(defs, colStart, colEnd, rowStart, reservedCols) {
  const packed = []
  let col = colStart
  let row = rowStart
  let rowMaxHeight = 0
  for (const b of defs) {
    if (col + b.width - 1 > colEnd) {
      col = colStart
      row += rowMaxHeight + (b.gap ?? BAND_GAP)
      rowMaxHeight = 0
    }
    let clear = firstColumnClearOfStreets(col, b.width, reservedCols, colEnd)
    if (clear === null) {
      col = colStart
      row += rowMaxHeight + (b.gap ?? BAND_GAP)
      rowMaxHeight = 0
      clear = firstColumnClearOfStreets(col, b.width, reservedCols, colEnd)
    }
    if (clear === null) {
      // Unreachable as long as the caller sized [colStart, colEnd] wider
      // than the widest def in `defs` (see layoutFinanceMap's zone-width
      // math) - failing loudly beats silently writing null tile coords.
      throw new Error(
        `packDefs: "${b.label ?? b.id}" is ${b.width} tiles wide and cannot fit within columns ` +
          `${colStart}-${colEnd} clear of the reserved streets.`
      )
    }
    col = clear
    const c0 = col
    const r0 = row
    const c1 = col + b.width - 1
    const r1 = row + b.height - 1
    packed.push({ ...b, tiles: { c0, r0, c1, r1 } })
    col += b.width + (b.gap ?? BAND_GAP)
    rowMaxHeight = Math.max(rowMaxHeight, b.height)
  }
  // Bottom-most occupied row. Monotonic: `row` only ever increases (each
  // wrap adds the previous row's rowMaxHeight + a gap), so the last row
  // processed is always the one with the greatest r1 - same assumption the
  // pre-Phase-3 single-pass packer's own `mapRows` derivation relied on.
  const contentBottomRow = defs.length ? row + rowMaxHeight - 1 : rowStart - 1
  return { buildings: packed, contentBottomRow }
}

// Map overhaul Phase 4: packs a home band's defs (every one 2x2 tiles - see
// characterHomeBuildings.js's buildDef, no size variation) into tight,
// zero-gap cluster BLOCKS, one block per residentialStyleKey sub-group,
// instead of packDefs' flowing row-wrap with a uniform gap between every
// single home. Two passes:
//   1. Group `homeDefs` by style key (3 sub-groups in the top band, 5 in the
//      bottom band - see TOP_HOME_STYLES/BOTTOM_HOME_STYLES). Each group of N
//      homes becomes a cols x rows square-ish grid (cols = ceil(sqrt(N)), rows =
//      ceil(N/cols)). Homes within a row sit at col*2 tile offsets - zero
//      horizontal gap, touching edge to edge, reading as one continuous strip
//      of houses. Rows themselves are spaced row*(2+ROW_GAP) apart instead of
//      row*2, so there's a walkable corridor between one row and the next
//      (reported: a solid zero-gap-in-every-direction block reads as one
//      impassable building, not a neighborhood you can walk through).
//      `homeDefs` arrives pre-sorted by style key (see FINANCE_BUILDING_DEFS's
//      own sort), so groups come out in a stable, deterministic order.
//   2. Pack the (up to 3) resulting cluster rectangles left to right across
//      [colStart, colEnd] with CLUSTER_GAP between adjacent clusters - same
//      row-wrap-on-overflow-or-street-hit shape packDefs uses, just against
//      a whole cluster's footprint width instead of one building's width, so
//      the wrap-to-a-new-row case (defensively handled, not assumed
//      unreachable) still respects `reservedCols`.
function packHomeBand(homeDefs, colStart, colEnd, rowStart, reservedCols) {
  const groups = new Map()
  for (const d of homeDefs) {
    const key = residentialStyleKey(d.npcId, d.kind)
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(d)
  }

  const clusters = []
  for (const [key, defs] of groups) {
    const n = defs.length
    const cols = Math.ceil(Math.sqrt(n))
    const rows = Math.ceil(n / cols)
    const placedDefs = defs.map((def, i) => ({
      def,
      dc: (i % cols) * 2,
      dr: Math.floor(i / cols) * (2 + ROW_GAP),
    }))
    // Height spans every row's own 2 tiles plus ROW_GAP between rows only -
    // (rows - 1) gaps for `rows` rows, not `rows` gaps, so there's no trailing
    // walkable strip hanging off the cluster's own last row.
    const height = rows * 2 + (rows - 1) * ROW_GAP
    clusters.push({ key, count: n, cols, rows, width: cols * 2, height, defs: placedDefs })
  }

  const packed = []
  let col = colStart
  let row = rowStart
  let rowMaxHeight = 0
  for (const cluster of clusters) {
    if (col + cluster.width - 1 > colEnd) {
      col = colStart
      row += rowMaxHeight + CLUSTER_GAP
      rowMaxHeight = 0
    }
    let clear = firstColumnClearOfStreets(col, cluster.width, reservedCols, colEnd)
    if (clear === null) {
      col = colStart
      row += rowMaxHeight + CLUSTER_GAP
      rowMaxHeight = 0
      clear = firstColumnClearOfStreets(col, cluster.width, reservedCols, colEnd)
    }
    if (clear === null) {
      // Unreachable as long as [colStart, colEnd] is wider than the widest
      // cluster - see layoutFinanceMap's band-width math - but fail loudly
      // rather than silently write null tile coords, same convention as
      // packDefs above.
      throw new Error(
        `packHomeBand: cluster "${cluster.key}" (${cluster.width}x${cluster.height}, ${cluster.count} homes) cannot fit ` +
          `within columns ${colStart}-${colEnd} clear of the reserved streets.`
      )
    }
    col = clear
    const c0 = col
    const r0 = row
    for (const { def, dc, dr } of cluster.defs) {
      const bc0 = c0 + dc
      const br0 = r0 + dr
      packed.push({ ...def, tiles: { c0: bc0, r0: br0, c1: bc0 + def.width - 1, r1: br0 + def.height - 1 } })
    }
    col += cluster.width + CLUSTER_GAP
    rowMaxHeight = Math.max(rowMaxHeight, cluster.height)
  }
  const contentBottomRow = clusters.length ? row + rowMaxHeight - 1 : rowStart - 1
  return { buildings: packed, contentBottomRow, clusters }
}

// Inserts a full-width, STREET_WIDTH-tall horizontal street centered in the
// gap below `prevBottomRow`, with `gap` rows of clearance on top of the
// street's own width (so facades on either side keep the same "art can
// overflow its footprint" margin every other street reservation in this file
// uses) - reuses STREET_WIDTH rather than introducing new tuning constants
// for a 3-band map where every inter-band gap is now known and fixed in
// advance (the old freeBands scan this replaces existed only because the
// single flat packer didn't know in advance where its gaps would land).
// `gap` defaults to BAND_GAP (every non-residential call site keeps that
// default unchanged); the two home-band call sites below pass a smaller
// value so residential rows sit close to the road, per the reference image.
function insertStreetGap(prevBottomRow, gap = BAND_GAP) {
  const gapTop = prevBottomRow + 1
  const gapRows = gap + STREET_WIDTH
  const streetTop = gapTop + Math.floor((gapRows - STREET_WIDTH) / 2)
  const streetRows = []
  for (let r = streetTop; r < streetTop + STREET_WIDTH; r++) streetRows.push(r)
  return { streetRows, nextBandTop: gapTop + gapRows }
}

// Smaller road-adjacency gap used only where a residential home band meets
// the street (see the two insertStreetGap call sites below) - the reference
// mockup shows home rows sitting tight against the road, tighter than the
// BAND_GAP spacing every other (non-residential) band keeps. Does not touch
// packHomeBand's own internal cluster-packing gaps (ROW_GAP/CLUSTER_GAP),
// only the outer gap between a home band and the road.
const HOME_BAND_STREET_GAP = 1

function layoutFinanceMap(mapCols) {
  const bandColStart = BAND_COL_START
  const bandColEnd = mapCols - BAND_COL_END_FROM_RIGHT

  const homeDefs = FINANCE_BUILDING_DEFS.filter((d) => Boolean(d.kind))
  const hubDefs = FINANCE_BUILDING_DEFS.filter((d) => !d.kind)
  const topHomeDefs = homeDefs.filter((d) => TOP_HOME_STYLES.has(residentialStyleKey(d.npcId, d.kind)))
  const bottomHomeDefs = homeDefs.filter((d) => BOTTOM_HOME_STYLES.has(residentialStyleKey(d.npcId, d.kind)))

  const zoneDefs = { law: [], finance: [], chapel: [], industry: [] }
  for (const d of hubDefs) {
    if (!zoneDefs[d.zone]) {
      throw new Error(`layoutFinanceMap: "${d.id}" has no valid zone tag (got ${JSON.stringify(d.zone)})`)
    }
    zoneDefs[d.zone].push(d)
  }
  const chapelDef = zoneDefs.chapel[0]
  const chapelWidth = chapelDef.width // 30 - temple's own width, the zone's fixed reservation.

  // 3 street gaps separate the 4 zone columns (law | finance | chapel |
  // industry). Zone widths are allocated proportionally to each zone's own
  // packed-content "weight" (sum of building widths + the gaps between them,
  // as if laid out in one row) rather than split evenly - industry has by
  // far the most buildings (17, vs. law's 6 and finance's 7), so an even
  // split would leave it packing into many more rows than law/finance and
  // make it the tallest zone by a wide margin. Weighting by content also
  // happens to keep the chapel roughly centered: it's preceded by 2 zones
  // (law, finance) and followed by only 1 (industry), so industry needs to
  // end up noticeably wider than law+finance combined for the chapel not to
  // be pushed off-center - which is exactly what content-weighting produces
  // here, since industry's weight so heavily outweighs the other two.
  const perStreetSpan = STREET_WIDTH + STREET_MARGIN * 2
  const usableWidth = bandColEnd - bandColStart + 1
  const remainingForZones = usableWidth - perStreetSpan * 3 - chapelWidth
  if (remainingForZones < 30) {
    throw new Error(
      `layoutFinanceMap: only ${remainingForZones} columns left for the law/finance/industry zones after reserving ` +
        `the chapel + 3 streets - map is too narrow. Raise MAP_COLS.`
    )
  }
  const zoneContentWeight = (defs) => defs.reduce((s, d) => s + d.width, 0) + Math.max(0, defs.length - 1) * BAND_GAP
  const lawWeight = zoneContentWeight(zoneDefs.law)
  const financeWeight = zoneContentWeight(zoneDefs.finance)
  const industryWeight = zoneContentWeight(zoneDefs.industry)
  const totalWeight = lawWeight + financeWeight + industryWeight
  const minZoneWidth = (defs) => Math.max(...defs.map((d) => d.width))
  const lawWidth = Math.max(minZoneWidth(zoneDefs.law), Math.round((remainingForZones * lawWeight) / totalWeight))
  const financeWidth = Math.max(minZoneWidth(zoneDefs.finance), Math.round((remainingForZones * financeWeight) / totalWeight))
  // Industry takes whatever's left rather than its own rounded share, so the
  // 3 widths always sum to exactly remainingForZones with no rounding gap or
  // overlap - safe because industry is always the largest-weight zone by far,
  // so "whatever's left" is always generous, never starved.
  const industryWidth = remainingForZones - lawWidth - financeWidth
  const industryMin = minZoneWidth(zoneDefs.industry)
  if (industryWidth < industryMin) {
    throw new Error(`layoutFinanceMap: industry zone only got ${industryWidth} columns (needs >= ${industryMin}) - map is too narrow. Raise MAP_COLS.`)
  }

  let cursor = bandColStart
  const lawColStart = cursor
  const lawColEnd = lawColStart + lawWidth - 1
  cursor = lawColEnd + 1 + STREET_MARGIN
  const street1Start = cursor
  cursor = street1Start + STREET_WIDTH + STREET_MARGIN
  const financeColStart = cursor
  const financeColEnd = financeColStart + financeWidth - 1
  cursor = financeColEnd + 1 + STREET_MARGIN
  const street2Start = cursor
  cursor = street2Start + STREET_WIDTH + STREET_MARGIN
  const chapelColStart = cursor
  const chapelColEnd = chapelColStart + chapelWidth - 1
  cursor = chapelColEnd + 1 + STREET_MARGIN
  const street3Start = cursor
  cursor = street3Start + STREET_WIDTH + STREET_MARGIN
  const industryColStart = cursor
  const industryColEnd = bandColEnd // soaks up any rounding slack here rather than leaving a gap before the right map margin

  const vStreetCols = []
  for (const start of [street1Start, street2Start, street3Start]) {
    for (let d = 0; d < STREET_WIDTH; d++) vStreetCols.push(start + d)
  }
  // Same margin convention as before: reserve 1 column either side of every
  // street block. These vertical streets span the FULL map height (used by
  // the top/bottom home band packers below too, not just the hub band) so
  // the 3 zone-separator roads read as continuous north-south corridors -
  // together with the 2 horizontal streets between bands, this is the
  // "cross of two main roads" the mockup describes, extended into a full
  // street grid rather than stopping at the hub band's edges.
  const reservedCols = []
  for (const c of vStreetCols) reservedCols.push(c - 1, c, c + 1)

  // ---- Band 1: top home band ----
  const topBandTop = MAP_TOP_MARGIN
  const topBand = packHomeBand(topHomeDefs, bandColStart, bandColEnd, topBandTop, reservedCols)

  // Residential band -> road gap tightened (HOME_BAND_STREET_GAP, not
  // BAND_GAP) so the top home band's homes sit close to the street, per the
  // reference image - see insertStreetGap's own doc comment.
  const gap1 = insertStreetGap(topBand.contentBottomRow, HOME_BAND_STREET_GAP)

  // ---- Band 2: middle hub band - 4 zone columns, all starting at the same
  // row. Each zone's own column span sits strictly between two street
  // reservations (or the map margin), so packing within a zone never needs
  // to dodge a street - hence the empty reservedCols array for those 3 calls.
  const hubBandTop = gap1.nextBandTop
  const law = packDefs(zoneDefs.law, lawColStart, lawColEnd, hubBandTop, [])
  const finance = packDefs(zoneDefs.finance, financeColStart, financeColEnd, hubBandTop, [])
  const chapelBuilding = {
    ...chapelDef,
    tiles: { c0: chapelColStart, r0: hubBandTop, c1: chapelColEnd, r1: hubBandTop + chapelDef.height - 1 },
  }
  const industry = packDefs(zoneDefs.industry, industryColStart, industryColEnd, hubBandTop, [])
  const hubBandBottom = Math.max(law.contentBottomRow, finance.contentBottomRow, chapelBuilding.tiles.r1, industry.contentBottomRow)

  // Same road-adjacency tightening as gap1 above, on the OTHER side of this
  // street - it borders the bottom home band (packed right after gap2,
  // below), so the same smaller gap is used here too.
  const gap2 = insertStreetGap(hubBandBottom, HOME_BAND_STREET_GAP)

  // ---- Band 3: bottom home band - packed only up to bottomBandColEnd
  // (short of the map's true right edge) so the rightmost FARM_ZONE_W
  // columns of this band are guaranteed free of home content for the farm
  // zone below, rather than hoping the row-wrap packer happens to leave the
  // corner empty.
  const bottomBandTop = gap2.nextBandTop
  const bottomBandColEnd = bandColEnd - FARM_ZONE_W - FARM_ZONE_MARGIN
  const bottomBand = packHomeBand(bottomHomeDefs, bandColStart, bottomBandColEnd, bottomBandTop, reservedCols)

  // Farm zone sits at the true bottom-right of the map: bottom-aligned with
  // whichever is taller, the bottom band's own home content or the farm
  // zone's own fixed height (so it's never pushed above band 3's top, and
  // the map only grows past the home content's natural height if the farm
  // reservation genuinely needs more room than that).
  const farmRowEnd = Math.max(bottomBand.contentBottomRow, bottomBandTop + FARM_ZONE_H - 1)
  const farmRowStart = farmRowEnd - FARM_ZONE_H + 1
  const farmColEnd = bandColEnd
  const farmColStart = farmColEnd - FARM_ZONE_W + 1
  const farmZone = { c0: farmColStart, r0: farmRowStart, c1: farmColEnd, r1: farmRowEnd }

  const mapRows = farmRowEnd + 3 // clear buffer row + bottom wall row, same convention the old single-pass packer used

  const buildings = [
    ...topBand.buildings,
    ...law.buildings,
    ...finance.buildings,
    chapelBuilding,
    ...industry.buildings,
    ...bottomBand.buildings,
  ]

  return { buildings, mapRows, hStreets: [...gap1.streetRows, ...gap2.streetRows], vStreets: vStreetCols, farmZone }
}

const MAP_COLS = 86
const {
  buildings: FINANCE_BUILDINGS,
  mapRows: MAP_ROWS,
  hStreets: FINANCE_H_STREETS,
  vStreets: FINANCE_V_STREETS,
  farmZone: FINANCE_FARM_ZONE,
} = layoutFinanceMap(MAP_COLS)
// Exported purely so the layout can be asserted against from outside (no
// building overlaps, every door reachable) without a Phaser canvas - the
// packing is generated from a 98-entry def list now, far past the point
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

// ---------------- Lisa's bespoke home interior ----------------
// Two hand-authored full-room background images (public/assets/packs/
// interior/) instead of the generic tile-drawn "residence" room every other
// character's home uses - see buildLisaHallZone/buildLisaWorkZone below.
// Both are already opaque, already close to the 480x360 (INTERIOR_COLS x
// INTERIOR_ROWS x TILE_SIZE) room canvas every interior renders at (470x356
// and 460x352 respectively), so they're stretched to fill it exactly rather
// than needing any background-removal/crop salvage pass first - unlike every
// other AI-generated asset this project has processed, these were already
// delivered as complete, rectangular room renders.
const LISA_HALL_BG_KEY = 'lisaHallBg'
const LISA_WORK_BG_KEY = 'lisaWorkBg'
const LISA_BEDROOM_BG_KEY = 'lisaBedroomBg'

// Bedroom.png is a much higher-res source (2342x1792, vs. hall/work's
// already-480x360-ish renders) - setDisplaySize in drawLisaRoomBackground
// stretches it down to the same room canvas exactly like the other two, no
// extra processing needed either way.
const LISA_HOUSE_BG_SRC = {
  [LISA_HALL_BG_KEY]: '/assets/packs/interior/hall.png',
  [LISA_WORK_BG_KEY]: '/assets/packs/interior/work.png',
  [LISA_BEDROOM_BG_KEY]: '/assets/packs/interior/Bedroom.png',
}
// Which room to redraw once a late-arriving background finally lands (see
// drawLisaRoomBackground's retry).
const LISA_ZONE_BY_BG_KEY = {
  [LISA_HALL_BG_KEY]: 'lisaHall',
  [LISA_WORK_BG_KEY]: 'lisaWork',
  [LISA_BEDROOM_BG_KEY]: 'lisaBedroom',
}
// Flat floor tone shown while a background is missing/reloading. Deliberately
// a plain dark room color rather than anything eye-catching: it should read as
// "this room hasn't finished drawing", not as a new piece of art.
const LISA_BG_FALLBACK_COLOR = 0x2b2622

function preloadLisaHouseInterior(scene) {
  // A failed fetch of one of these (dev-server hiccup, flaky connection -
  // Bedroom.png alone is 7MB) doesn't throw or block preload: Phaser's
  // loader just fires 'complete' anyway with that key never registered. The
  // room is then built from a texture that doesn't exist, which is what
  // produced the green-rectangle-with-a-diagonal screenshots - that's
  // Phaser's built-in __MISSING placeholder, stretched over the whole room.
  // Logging it here names the exact file; drawLisaRoomBackground below is
  // what actually keeps the room usable when it happens.
  scene.load.on('loaderror', (file) => {
    if (LISA_HOUSE_BG_SRC[file.key]) {
      console.error(`Lisa house background failed to load: ${file.key} (${file.src}) - falling back to a plain floor; it will be retried when that room is entered.`)
    }
  })
  Object.entries(LISA_HOUSE_BG_SRC).forEach(([key, src]) => {
    if (!scene.textures.exists(key)) scene.load.image(key, src)
  })
}

// Full-bleed room background for the 3 hand-authored Lisa rooms.
//
// Never calls add.image() on a key that isn't loaded: Phaser silently
// substitutes its __MISSING texture there, and since every caller then
// setDisplaySize()s it to the full room, a single dropped fetch at preload
// turned the entire room into a green box with a diagonal line through it -
// with no way back short of reloading the page, because preload only ever
// runs once per session.
//
// So: draw the real art when it's there, and when it isn't, draw a plain
// floor and re-request the file. The retry is deliberately here (at room-
// entry) rather than in preload's loaderror - a hiccup at boot is usually
// over by the time the player actually walks into the room, and this way the
// fetch only happens for the room being looked at. When it lands, the room is
// rebuilt in place (teleportPlayer=false, so the player doesn't get bounced
// back to the spawn tile mid-walk) - but only if they're still standing in
// it, since a slow retry can easily outlive their visit.
function drawLisaRoomBackground(scene, key) {
  const w = INTERIOR_COLS * TILE_SIZE
  const h = INTERIOR_ROWS * TILE_SIZE

  if (scene.textures.exists(key)) {
    const bg = scene.add.image(0, 0, key).setOrigin(0, 0)
    bg.setDisplaySize(w, h)
    bg.setDepth(0)
    scene.zoneObjects.push(bg)
    return
  }

  const fallback = scene.add.rectangle(0, 0, w, h, LISA_BG_FALLBACK_COLOR).setOrigin(0, 0)
  fallback.setDepth(0)
  scene.zoneObjects.push(fallback)

  // One in-flight retry per key at a time - loadZone can run several times
  // in a row (walking a door back and forth), and without this each pass
  // would queue another copy of the same 7MB file.
  if (!scene.lisaBgRetrying) scene.lisaBgRetrying = new Set()
  if (scene.lisaBgRetrying.has(key)) return
  scene.lisaBgRetrying.add(key)

  console.warn(`Retrying Lisa house background ${key}...`)
  // Listen for THIS key's own events, not the loader's generic 'complete':
  // the loader is shared, so 'complete' routinely fires for some other batch
  // that finished first, which would clear the in-flight flag and report a
  // failure while this file is still downloading.
  const onLoaded = () => {
    scene.load.off('loaderror', onError)
    scene.lisaBgRetrying.delete(key)
    // Only redraw if they're still in that room - a slow retry easily
    // outlives the visit, and loadZone on the wrong room would yank the
    // player somewhere they aren't. teleportPlayer=false keeps them on the
    // tile they're standing on rather than bouncing them to the spawn.
    if (scene.currentZoneId === LISA_ZONE_BY_BG_KEY[key]) scene.loadZone(scene.currentZoneId, false)
  }
  const onError = (file) => {
    if (file.key !== key) return
    scene.load.off(`filecomplete-image-${key}`, onLoaded)
    scene.load.off('loaderror', onError)
    scene.lisaBgRetrying.delete(key)
    console.error(`Lisa house background ${key} failed again - room stays on the fallback floor.`)
  }
  scene.load.once(`filecomplete-image-${key}`, onLoaded)
  scene.load.on('loaderror', onError)
  scene.load.image(key, LISA_HOUSE_BG_SRC[key])
  scene.load.start()
}

// Tile-rect -> Phaser.Geom.Rectangle, padded by half a tile on every side -
// the exact same convention buildGenericInteriorZone's INTERIOR_DESK zone
// uses, so standing just outside a piece of furniture still counts as "at"
// it. `extra` fields (target/spawn/npcId/label) get spread onto the returned
// zone object so this one helper covers both 'exit' and 'interiorDesk'
// zones interchangeably - triggerInteraction dispatches on `type`, not on
// which fields happen to be present.
function lisaRoomZone(type, id, tileRect, extra = {}) {
  return {
    type,
    id,
    rect: new Phaser.Geom.Rectangle(
      tileRect.c0 * TILE_SIZE - TILE_SIZE / 2,
      tileRect.r0 * TILE_SIZE - TILE_SIZE / 2,
      (tileRect.c1 - tileRect.c0 + 1) * TILE_SIZE + TILE_SIZE,
      (tileRect.r1 - tileRect.r0 + 1) * TILE_SIZE + TILE_SIZE
    ),
    ...extra,
  }
}

// Fills `set` with every "c,r" tile key in the given rect (inclusive) -
// builds up a room's this.interiorBlockedTiles the same way chapel/teaHouse
// already populate theirs from their own real tileset wall data, just from
// hand-estimated furniture bounding boxes instead (see buildLisaHallZone/
// buildLisaWorkZone/buildLisaBedroomZone - these 3 rooms are a single flat
// illustration each, not a tile-by-tile authored map, so there's no wall
// data to read collision off of directly).
function fillBlockedRect(set, c0, r0, c1, r1) {
  for (let c = c0; c <= c1; c++) {
    for (let r = r0; r <= r1; r++) set.add(`${c},${r}`)
  }
}

// ---------------- Home interior rooms ----------------
// Second pass, replacing the first: the 87 character homes/hideouts
// (characterHomeBuildings.js) now get a wholly bespoke room per wealth tier
// (buildHomeInteriorZone below) instead of overlaying furniture onto
// buildGenericInteriorZone's generic tile-drawn room - that whole path
// (drawInteriorRoom, INTERIOR_TEMPLATES.residence/hideout's "Study"/"Back
// Room" flat desk box, interiorTemplateFor's kind-based fallback) is left
// fully in place but is now dead code for homes/hideouts specifically: see
// triggerInteraction's zone.id/building.kind check, which routes them to
// 'homeInterior' before they ever reach buildGenericInteriorZone. Kept
// (not deleted) since bank/realEstateAgency still use buildGenericInteriorZone
// for real (their own explicit 'officeA' BUILDING_INTERIOR_TEMPLATE entry),
// and in case this whole approach is wanted again later.
// Each of the 4 styles below is hand-laid-out against one of the reference
// screenshots in public/assets/packs/Pixel_16_interiors_v2_free/reference/
// (image-...5591.png bedroom for cottage, ...9513.webp for tavern,
// ...3857.webp for palace, ...7746.webp for hideout) - matched as closely as
// this file's fixed 12x9 rectangular room shape allows (the references
// themselves are irregular multi-alcove L-shaped rooms a plain rectangle
// can't reproduce edge-for-edge), picking the same furniture types in
// roughly the same relative positions rather than a loose approximation.
const HOME_FURNITURE_DIR = '/assets/packs/Pixel_16_interiors_v2_free/processed'
const HOME_FURNITURE_FILES = {
  bed: 'bed.png',
  shelfWithBooks: 'shelf_with_books.png',
  bigTableAndChair: 'big_table_and_chair.png',
  tableAndChair: 'table_and_chair.png',
  tableWithBooks: 'table_with_books.png',
  carpet: 'carpet.png',
  rugPurple: 'rug_purple.png',
  orb: 'orb.png',
  wall: 'wall.png',
  floorHideout: 'floor_hideout.png',
  floorPalace: 'floor_palace.png',
  floorCottage: 'floor_cottage.png',
  floorTavern: 'floor_tavern.png',
  wallEdgeCottage: 'walledge_cottage.png',
  wallEdgeTavern: 'walledge_tavern.png',
  wallEdgePalace: 'walledge_palace.png',
  wallEdgeHideout: 'walledge_hideout.png',
  wallStripCottage: 'wallstrip_cottage.png',
  wallStripTavern: 'wallstrip_tavern.png',
  wallStripPalace: 'wallstrip_palace.png',
  wallStripHideout: 'wallstrip_hideout.png',
  window: 'window.png',
  wardrobe: 'wardrobe.png',
  pantryShelf: 'pantry_shelf.png',
  barrel: 'barrel.png',
  // Added on the "still a mess, use the reference pictures as an exact
  // blueprint" pass - production/slice_contact_sheet.py connected-
  // component-sliced these out of the pack's 73.png (palace/living-room
  // props) and 85.png (the wizard-study set reference5 itself is built
  // from) contact sheets.
  redArmchair: 'red_armchair.png',
  roundSideTable: 'round_side_table.png',
  redLoveseat: 'red_loveseat.png',
  woodDoor: 'wood_door.png',
  palaceBanquetTable: 'palace_banquet_table.png',
  paintingForest: 'painting_forest.png',
  paintingSunset: 'painting_sunset.png',
  vaseBlueFlowers: 'vase_blue_flowers.png',
  vaseRedFlowers: 'vase_red_flowers.png',
  redRugStrip: 'red_rug_strip.png',
  bookshelfA: 'bookshelf_a.png',
  bookshelfB: 'bookshelf_b.png',
  bookshelfC: 'bookshelf_c.png',
  pedestalGem: 'pedestal_gem.png',
  pedestalChalice: 'pedestal_chalice.png',
  pedestalTome: 'pedestal_tome.png',
  pedestalMask: 'pedestal_mask.png',
  readingDeskA: 'hooded_reader_a.png',
  readingDeskB: 'hooded_reader_b.png',
}

// Floor decals/wall-mounted decoration - never registered as a walk
// obstacle in placeHomeProp (unlike freestanding furniture), since nothing
// physically occupies that floor space.
// Floor decals and wall decoration - nothing physically occupies that space.
// 'rugPurple' belongs here with the other two rugs and was simply missed:
// while blockHomePropFootprint was silently writing unmatchable fractional
// keys nothing here had any effect, so the omission stayed invisible. With
// collision actually working, the tavern's rug sits squarely over its only
// doorway and walls the player into a single tile.
const HOME_PROP_NON_BLOCKING = new Set([
  'carpet', 'rugPurple', 'redRugStrip', 'window', 'wall',
  'paintingForest', 'paintingSunset',
])

function homeFurnitureTextureKey(id) {
  return `homeFurn_${id}`
}

function preloadHomeFurniture(scene) {
  for (const [id, file] of Object.entries(HOME_FURNITURE_FILES)) {
    const key = homeFurnitureTextureKey(id)
    if (!scene.textures.exists(key)) scene.load.image(key, `${HOME_FURNITURE_DIR}/${file}`)
  }
}

// ---- Per-style room definition, measured off the reference screenshots ----
// production/analyze_reference_rooms.py segments each reference out of its
// backdrop and downsamples it to a tile grid; `mask` below is that script's
// output verbatim ('#' room, '.' outside). That's why these rooms are all
// different sizes and none of them is the plain 12x9 rectangle every other
// interior in this file uses - the references are irregular multi-alcove
// floor plans at ~1.20 aspect, and forcing them into a 1.43 rectangle is what
// made earlier attempts read as "a mess" no matter how the furniture moved.
//
// Prop coordinates are likewise measured, not eyeballed: each reference was
// overlaid with a 100px grid, every piece of furniture's centre-x/bottom-y/
// width read off it in reference pixels, then converted with that room's own
// px/tile scale (printed by the same script). `col`/`row` are what
// placeHomeProp wants - the tile the prop's bottom-CENTRE sits on, hence the
// -0.5 / -1 already folded into these numbers - and `tileWidth` is its real
// width relative to the room, so a bookshelf that covers 16.6% of the
// reference's width covers 16.6% of ours.
//
// floorTex: cropped straight out of the same reference by
// production/extract_reference_floors.py (see its header - the first pass
// reused the pack's own contact-sheet floor crops, which each carried a strip
// of baseboard that tiled into repeating horizontal bands).
const HOME_ROOM_STYLES = {
  // reference/image-...5591.png - a tall portrait bedroom: bed + nightstand
  // down the left wall under a wall-mounted TV, writing desk + stool along
  // the right, reading nook (rug, armchair) filling the lower half.
  cottage: {
    zoneId: 'homeCottage',
    cols: 12,
    rows: 15,
    mask: null, // plain rectangle - the reference's own room is unnotched
    floorTex: 'floorCottage',
    wallColor: 0x4a2c1e,
    // The bedroom reference gives its whole upper ~40% over to a cream
    // striped wallpaper wall, and hangs the TV/framed pictures on it - the
    // measured prop rows above already assume that band exists (paintings sit
    // at rows 1.9-2.8), so without it they float over bare floor.
    wallBandRows: 7,
    wallStrip: 'wallStripCottage',
    wallEdge: 'wallEdgeCottage',
    deskRect: { c0: 6, r0: 5, c1: 10, r1: 7 },
    props: [
      { id: 'paintingForest', col: 6.68, row: 1.92, tileWidth: 1.35 },
      { id: 'window', col: 8.83, row: 2.64, tileWidth: 0.99 },
      { id: 'shelfWithBooks', col: 3.72, row: 3.4, tileWidth: 3.17 },
      { id: 'bed', col: 1.47, row: 7.4, tileWidth: 2.74 },
      { id: 'wardrobe', col: 3.9, row: 7.4, tileWidth: 1.75 },
      { id: 'tableWithBooks', col: 8.47, row: 7.4, tileWidth: 4.57 },
      { id: 'rugPurple', col: 3.59, row: 11.4, tileWidth: 3.9 },
      { id: 'redArmchair', col: 3.68, row: 11.61, tileWidth: 2.33 },
      { id: 'redLoveseat', col: 0.6, row: 9.6, tileWidth: 1.6 },
      { id: 'barrel', col: 10.08, row: 11.61, tileWidth: 1.7 },
      { id: 'roundSideTable', col: 9.6, row: 8.4, tileWidth: 1.1 },
    ],
  },
  // reference/image-...9513.webp - stone farmhouse: round dining table on its
  // rug dead centre, bed + bookshelf along the top wall, pantry shelf in the
  // top-right larder, barrel and arched door bottom-left.
  tavern: {
    zoneId: 'homeTavern',
    cols: 18,
    rows: 13,
    mask: [
      '.....#############',
      '....##############',
      '##################',
      '##################',
      '##################',
      '##################',
      '##################',
      '##################',
      '##################',
      '##################',
      '##################',
      '##################',
      '##################',
    ],
    floorTex: 'floorTavern',
    // sampled off the reference's own stone wall
    wallColor: 0x606772,
    wallBandRows: 3,
    wallStrip: 'wallStripTavern',
    wallEdge: 'wallEdgeTavern',
    deskRect: { c0: 6, r0: 7, c1: 10, r1: 9 },
    props: [
      { id: 'bed', col: 5.14, row: 3.53, tileWidth: 1.6 },
      { id: 'shelfWithBooks', col: 10.7, row: 3.1, tileWidth: 1.42 },
      { id: 'pantryShelf', col: 15.03, row: 2.39, tileWidth: 3.13 },
      { id: 'rugPurple', col: 8.0, row: 10.66, tileWidth: 6.13 },
      { id: 'tableAndChair', col: 7.95, row: 9.37, tileWidth: 4.2 },
      { id: 'woodDoor', col: 1.79, row: 8.66, tileWidth: 1.57 },
      { id: 'barrel', col: 3.36, row: 10.66, tileWidth: 0.85 },
      { id: 'redRugStrip', col: 14.61, row: 10.8, tileWidth: 5.41 },
    ],
  },
  // reference/image-...3857.webp - banquet hall: column frieze across the top
  // wall, long laid table centred under it, framed landscapes above, flower
  // vases flanking, long red runner across the lower hall.
  palace: {
    zoneId: 'homePalace',
    cols: 18,
    rows: 11,
    mask: [
      '....##########....',
      '....##########....',
      '##################',
      '##################',
      '##################',
      '##################',
      '##################',
      '##################',
      '##################',
      '..##############..',
      '..##############..',
    ],
    floorTex: 'floorPalace',
    // the reference's terracotta wall panels between its columns
    wallColor: 0xa8524a,
    wallBandRows: 2,
    wallStrip: 'wallStripPalace',
    wallEdge: 'wallEdgePalace',
    deskRect: { c0: 6, r0: 2, c1: 11, r1: 4 },
    props: [
      { id: 'wall', col: 8.53, row: 1.55, tileWidth: 9.0 },
      { id: 'paintingForest', col: 6.96, row: 0.8, tileWidth: 1.13 },
      { id: 'paintingSunset', col: 9.84, row: 0.8, tileWidth: 1.13 },
      { id: 'redRugStrip', col: 8.49, row: 9.05, tileWidth: 8.44 },
      { id: 'palaceBanquetTable', col: 8.61, row: 3.93, tileWidth: 5.56 },
      { id: 'vaseBlueFlowers', col: 5.1, row: 3.6, tileWidth: 0.9 },
      { id: 'vaseRedFlowers', col: 12.1, row: 3.6, tileWidth: 0.9 },
    ],
  },
  // reference/image-...7746.webp - the wizard study reused as a syndicate
  // boss's back room (see this section's header note on that): 3 bookshelves
  // across the top wall, 4 relic pedestals in a 2x2 around the central
  // floating orb, a reading desk in each of the 4 side alcoves.
  hideout: {
    zoneId: 'homeHideout',
    cols: 16,
    rows: 13,
    mask: [
      '...##########...',
      '################',
      '################',
      '################',
      '################',
      '################',
      '################',
      '################',
      '################',
      '################',
      '################',
      '################',
      '...##########...',
    ],
    floorTex: 'floorHideout',
    // the reference rings its floor with a dark navy wall carrying a thin
    // ice-blue trim line; the navy is what reads at this scale
    wallColor: 0x2f3b55,
    wallBandRows: 1,
    wallStrip: 'wallStripHideout',
    wallEdge: 'wallEdgeHideout',
    deskRect: { c0: 6, r0: 5, c1: 9, r1: 7 },
    props: [
      { id: 'bookshelfA', col: 4.46, row: 3.29, tileWidth: 2.56 },
      { id: 'bookshelfB', col: 7.5, row: 3.29, tileWidth: 2.56 },
      { id: 'bookshelfC', col: 10.54, row: 3.29, tileWidth: 2.56 },
      { id: 'readingDeskA', col: 1.99, row: 6.68, tileWidth: 3.02 },
      { id: 'readingDeskB', col: 1.99, row: 9.85, tileWidth: 3.02 },
      { id: 'readingDeskB', col: 13.07, row: 6.68, tileWidth: 3.02 },
      { id: 'readingDeskA', col: 13.07, row: 9.85, tileWidth: 3.02 },
      { id: 'pedestalGem', col: 4.94, row: 6.4, tileWidth: 1.73 },
      { id: 'pedestalChalice', col: 10.12, row: 6.4, tileWidth: 1.73 },
      { id: 'pedestalTome', col: 4.94, row: 8.84, tileWidth: 1.73 },
      { id: 'pedestalMask', col: 10.12, row: 8.84, tileWidth: 1.73 },
      { id: 'orb', col: 7.46, row: 7.26, tileWidth: 2.16 },
      { id: 'carpet', col: 7.46, row: 10.9, tileWidth: 4.2 },
    ],
  },
}

const HOME_STYLE_BY_ZONE = Object.fromEntries(
  Object.entries(HOME_ROOM_STYLES).map(([style, def]) => [def.zoneId, style])
)

// Thresholds sit in the two real gaps in the roster's net-worth spread, not
// at round numbers picked for their own sake: the 40 officials top out at
// $8M, the mid-tier handful runs $10M-$500M, and the titans start at $2.2B.
// Splitting at $10M and $1B therefore lands 40 homes in the cottage, 6 in
// the farmhouse and 22 in the palace, with no character sitting near an edge.
const HOME_TAVERN_MIN_NET_WORTH = 10_000_000
const HOME_PALACE_MIN_NET_WORTH = 1_000_000_000

// Which of the four bespoke rooms a given home/hideout opens into.
//
// Criminals get the hideout regardless of how rich they are - the room is
// chosen by what the character IS, and a mob boss's safe house shouldn't
// read as a banquet hall. Everyone else is placed by wealth.
function homeInteriorStyleFor(building) {
  if (building.kind === 'hideout') return 'hideout'
  const character = building.npcId ? getAnyCharacter(building.npcId) : null
  const netWorth = (character && character.netWorth) || 0
  if (netWorth >= HOME_PALACE_MIN_NET_WORTH) return 'palace'
  if (netWorth >= HOME_TAVERN_MIN_NET_WORTH) return 'tavern'
  return 'cottage'
}

// True where the room mask says this tile exists at all ('.' = outside the
// room's irregular outline, drawn as void).
function homeMaskAt(def, col, row) {
  if (col < 0 || row < 0 || col >= def.cols || row >= def.rows) return false
  if (!def.mask) return true
  return def.mask[row][col] === '#'
}

// A tile is WALL if it's part of the room but touches the outside - that's
// what turns each mask into a 1-tile wall band hugging its own irregular
// outline, without hand-authoring the border for every notch.
// `wallBandRows` additionally makes the top N rows wall rather than just the
// single edge row: these references don't draw a thin border, they draw a
// receding back WALL you see the face of (most extreme in the bedroom, where
// it's ~40% of the room and carries the wall-mounted props), and the measured
// prop rows assume it's there.
function homeTileIsWall(def, col, row) {
  if (!homeMaskAt(def, col, row)) return false
  if (row < (def.wallBandRows ?? 1)) return true
  // Multi-room support: `partitions` are interior wall runs that split one
  // masked outline into several rooms. Every reference here is really a
  // multi-room floor plan (the stone farmhouse alone has four rooms plus a
  // stair hall), so the renderer is built for it - but no style declares any
  // yet, deliberately: the pack doesn't have the doorway/stair/divider art
  // those extra rooms would need, so they'd be bare boxes.
  if (def.partitions && def.partitions.some((p) => rectHasTile(p, col, row))) return true
  return (
    !homeMaskAt(def, col - 1, row) ||
    !homeMaskAt(def, col + 1, row) ||
    !homeMaskAt(def, col, row - 1) ||
    !homeMaskAt(def, col, row + 1)
  )
}

function rectHasTile(r, col, row) {
  return col >= r.c0 && col <= r.c1 && row >= r.r0 && row <= r.r1
}

// Which floor texture a given tile uses. `rooms` (optional) lets each
// sub-room of a multi-room plan carry its own material - the farmhouse
// reference, for instance, has red boards in the bedroom, tan slab in the
// hall and stone in the larder. Falls back to the style's single floorTex.
function homeFloorTexAt(def, col, row) {
  if (def.rooms) {
    const hit = def.rooms.find((r) => rectHasTile(r, col, row))
    if (hit && hit.floorTex) return hit.floorTex
  }
  return def.floorTex
}

function homeTileIsFloor(def, col, row) {
  return homeMaskAt(def, col, row) && !homeTileIsWall(def, col, row)
}

// Bottom-centre-most walkable tile - where the exit door goes, and where the
// player is dropped when they walk in.
function homeDoorTile(def) {
  const mid = Math.floor(def.cols / 2)
  for (let row = def.rows - 1; row >= 0; row--) {
    for (let d = 0; d <= def.cols; d++) {
      for (const col of [mid - d, mid + d]) {
        if (homeTileIsFloor(def, col, row)) return { col, row }
      }
    }
  }
  return { col: mid, row: def.rows - 2 }
}

// Registers the tiles a freestanding piece of furniture actually sits on as
// solid, into scene.interiorBlockedTiles (reset fresh per zone load by
// loadZone itself - see its own comment - so this never leaks into an
// unrelated room). Floor decals/wall decoration (HOME_PROP_NON_BLOCKING) are
// skipped - nothing physically occupies that floor space. 2 rows deep (the
// anchor row and the one above) rather than 1: most pieces here render
// taller than a single tile even though they only ever need a 1-2 tile-wide
// footprint, and a 1-row block still let the player stand on/clip through
// the visually-taller top half of e.g. the bed or a bookshelf (reported:
// "character can walk through").
function blockHomePropFootprint(scene, id, col, row, tileWidth) {
  if (HOME_PROP_NON_BLOCKING.has(id) || !scene.interiorBlockedTiles) return
  const c0 = Math.round(col - tileWidth / 2)
  const c1 = Math.max(c0, Math.round(col + tileWidth / 2 - 1))
  // These props are authored at MEASURED, fractional rows (11.61, 7.4, ...)
  // so they sit where the reference puts them rather than snapping to the
  // grid. The blocked set is keyed by whole tiles, so passing the raw row
  // wrote keys like "3,10.61" that no integer tile lookup can ever match -
  // every piece of home furniture had no collision at all, and the player
  // walked straight through beds and tables.
  const r = Math.round(row)
  fillBlockedRect(scene.interiorBlockedTiles, c0, Math.max(0, r - 1), c1, r)
}

function placeHomeProp(scene, zoneObjects, id, col, row, tileWidth) {
  const key = homeFurnitureTextureKey(id)
  if (!scene.textures.exists(key)) return
  const src = scene.textures.get(key).getSourceImage()
  const scale = (tileWidth * TILE_SIZE) / src.width
  const img = scene.add
    .image((col + 0.5) * TILE_SIZE, (row + 1) * TILE_SIZE, key)
    .setOrigin(0.5, 1)
    .setScale(scale)
  img.setDepth((row + 1) * TILE_SIZE)
  zoneObjects.push(img)
  blockHomePropFootprint(scene, id, col, row, tileWidth)
}

// ---------------- Prison interiors ----------------
// The two jail rooms are built from public/assets/packs/prison/, laid out
// from that pack's own reference.webp rather than the shared 12x9
// drawInteriorRoom box they used to share with every other building.
//
// The reference is a 30x20 grid. That's measured off its content bbox and
// confirmed by its guard sprites landing exactly one tile wide and 1.5 tall,
// which is this game's own character-to-TILE_SIZE ratio - so the picture can
// be reproduced at true scale instead of being squeezed into the old room
// shape. jailCell IS that picture; jailMaze is a corridor assembled from the
// same materials, since the reference has no corridor of its own.
//
// See production/extract_prison_assets.py for how the art was cut, and
// production/compare_prison_rooms.py for the side-by-side check against the
// reference (it parses PRISON_ROOMS out of this file, so it can't drift).
const PRISON_DIR = '/assets/packs/prison/processed'

const PRISON_FILES = {
  wallOuter: 'wall_outer.png',
  wallCell: 'wall_cell.png',
  wallDivider: 'wall_divider.png',
  wallGate: 'wall_gate.png',
  wallCap: 'wall_cap.png',
  wallCapExt: 'wall_cap_ext.png',
  wallCapExtS: 'wall_cap_ext_s.png',
  wallBase: 'wall_base.png',
  wallBaseCell: 'wall_base_cell.png',
  barsFront: 'bars_front.png',
  barsGrid: 'bars_grid.png',
  floorStraw: 'floor_straw.png',
  floorCell: 'floor_cell.png',
  floorHall: 'floor_hall.png',
  floorCarpet: 'floor_carpet.png',
  floorStone: 'floor_stone.png',
  bunkBed: 'bunk_bed.png',
  bed: 'bed.png',
  wardenDesk: 'warden_desk.png',
  banner: 'banner.png',
  bookshelf: 'bookshelf.png',
  stool: 'stool.png',
  benchLong: 'bench_long.png',
  tableWithStools: 'table_with_stools.png',
  barrel: 'barrel.png',
  pot: 'pot.png',
  crates: 'crates.png',
  chest: 'chest.png',
  ladder: 'ladder.png',
  torch: 'torch.png',
  sconce: 'sconce.png',
  post: 'post.png',
  sack: 'sack.png',
  brazier: 'brazier.png',
  woodDoor: 'wood_door.png',
}

// One character per tile. The grid carries geometry, material AND collision
// at once, which is what keeps a room this irregular readable as source:
//   '#' outer wall             'P' partition between cells
//   'D' dark cell back wall    'B' barred cell front
//   's' straw (cell floor)     'd' shadowed stone (cell floor)
//   'f' flagstone (guard hall) 'c' carpet (warden office)
//   '.' outside the room
//
// Three wall tones, not one, because the reference has three and collapsing
// them loses the room's structure: cell backs and the outer wall are the same
// dark stone (~[72,83,106]) but the partitions between cells are markedly
// lighter (~[92,111,134]). Drawing partitions in the outer-wall material made
// the entire cell block read as one undivided slab.
//
// 's' and 'd' are both cell floors, split for the same reason: in the
// reference only the left cell is strawed, the others are bare stone, and
// strawing all of them washed the top half of the room out in tan.
const PRISON_TILE_TEX = {
  '#': 'wallOuter',
  P: 'wallDivider',
  D: 'wallCell',
  B: 'barsFront',
  s: 'floorStraw',
  d: 'floorCell',
  f: 'floorHall',
  c: 'floorCarpet',
  p: 'floorStone',
  G: 'wallGate',
}
const PRISON_WALKABLE = new Set(['s', 'd', 'f', 'c', 'p'])
// solid stone (gets a cap + footing drawn on its exposed edges); 'B' is
// excluded - a barred front is its own full-height profile, not a stone block
const PRISON_WALL_CHARS = new Set(['#', 'P', 'D'])
// cell floors, which are lit differently from the hall and take their own
// shadow-toned wall baseboard
const PRISON_CELL_FLOORS = new Set(['s', 'd'])

// Wall-mounted or flat decor the player should never collide with.
const PRISON_PROP_NON_BLOCKING = new Set(['torch', 'sconce', 'banner', 'woodDoor', 'barsFront'])

const PRISON_ROOMS = {
  // Central Booking. Read straight off the reference: three inmate cells and
  // the player's own along the top, the warden's office right, the guard hall
  // across the bottom, and a sealed shackle cell in the left wing.
  //
  // Only ONE cell is open - the player's (cell B, cols 13-16), whose barred
  // front has a gap at col 14. Every other cell is sealed behind its bars,
  // exactly as the reference shows them, so the room reads as "you are the
  // one who's locked up" while still letting the player walk out to negotiate.
  jailCell: {
    zoneId: 'jailCell',
    label: 'Capital City Central Booking',
    cols: 30,
    rows: 20,
    // Cell fronts are 4 rows deep, matching the reference - a 1-2 row band
    // reads as a fence rather than a cell, and made the guard hall swallow
    // half the room. Cell A sits two rows lower than B/C, which is the step
    // the reference has along the bottom of the cell block.
    mask: [
      '...###########################',
      '...PDDDDDDDDPDDDDPDDDDDPDDDDD#',
      '...PDDDDDDDDPDDDDPDDDDDPDDDDD#',
      '###PDDDDDDDDPDDDDPDDDDDPDDDDD#',
      '#DDPDDDDDDDDPddddPdddddPDDDDD#',
      '#DDPddddddddPddddPdddddPDDDDD#',
      '#DDPddddssssPddddPdddddPfccff#',
      '#ffPddddssssP#d##P#####Pfccff#',
      '#ffPddddssssPBdBBPBBBBBPfccff#',
      '#ffP########PBdBBPBBBBBPfccff#',
      '###PBBBBBBBBPBdBBPBBBBBPfccff#',
      '#BBPBBBBBBBBPBdBBPBBBBBPfccff#',
      '#BBPBBBBBBBBPffffffffff#f#####',
      '#BBPBBBBBBBBPffffffffff#f#####',
      '#ffffffffffffffffffffff#f#####',
      '#ffffffffffffffffffffff#f#####',
      '#ffffffffffffffffffffff#f#####',
      '#ffffffffffffffffffffffffffff#',
      '#ffffffffffffffffffffffffffff#',
      '#######GGGG###################',
    ],
    // inside the player's cell, above its open gate at col 14
    spawn: { col: 14, row: 6 },
    // the warden's desk, where bail/bribe is negotiated
    deskRect: { c0: 24, r0: 8, c1: 28, r1: 9 },
    // standing tiles in front of the wooden door down to the corridor
    exitRect: { c0: 25, r0: 17, c1: 26, r1: 17 },
    props: [
      // Sizes and positions below are MEASURED off the reference (each
      // object's bounding box in reference pixels, converted to this
      // convention), not estimated. An earlier eyeballed pass had almost
      // everything too small - the bunk bed 3 tiles instead of 4.3, the
      // warden's desk 3.2 instead of 4.6, the bookshelf 1.8 instead of 3.
      // --- cell A (other inmates), cols 4-11
      // A dark iron sconce, not a lit torch: the reference's cell fixtures
      // are unlit brackets, and 115.png's flame lit up every cell.
      { id: 'sconce', col: 5.08, row: 2.7, tileWidth: 0.6 },
      { id: 'bunkBed', col: 9.1, row: 7, tileWidth: 4.3 },
      { id: 'benchLong', col: 5.9, row: 8, tileWidth: 3.6 },
      { id: 'barrel', col: 10.7, row: 8, tileWidth: 1.2 },
      // --- cell B: the player's own, cols 13-16
      { id: 'sconce', col: 14.42, row: 2.7, tileWidth: 0.6 },
      // Width is derived from the reference's bed HEIGHT via this asset's own
      // aspect, not from its measured width: a colour-keyed width measurement
      // caught only the wooden frame and missed the pale mattress, which
      // oversized the bed until it swallowed the wall torch above it.
      // Pushed right of centre so its footprint clears col 14 - the gap in
      // this cell's bars, and the player's only way out.
      { id: 'bed', col: 15.6, row: 6, tileWidth: 1.9 },
      // a dark pot, not a wooden stool - the reference has a squat dark
      // round vessel beside each cell's bed
      { id: 'pot', col: 13, row: 6, tileWidth: 0.8 },
      // --- cell C, cols 18-22
      { id: 'sconce', col: 19.88, row: 2.7, tileWidth: 0.6 },
      { id: 'bed', col: 20.6, row: 6, tileWidth: 1.9 },
      { id: 'pot', col: 19, row: 6, tileWidth: 0.8 },
      // --- warden's office, cols 24-28, carpet runner rows 6-11
      // 2.2 wide, not 1.5: the reference's banner hangs 5.9 tiles from its
      // finial to its base, and at 1.5 this rendered barely half that.
      { id: 'banner', col: 23.8, row: 6.3, tileWidth: 2.2 },
      { id: 'bookshelf', col: 26.8, row: 4.8, tileWidth: 2.4 },
      { id: 'wardenDesk', col: 25.6, row: 9, tileWidth: 4.6 },
      // --- left wing: two stacked sealed cells. The upper one holds a
      // shackled prisoner in the reference (wrist irons on its back wall);
      // the lower one is barred and empty. Two earlier misreads here: its
      // bars were taken for a staircase and given a ladder, and the wall
      // behind the prisoner was given a post that read as furniture. Both
      // gone - what is behind that prisoner is simply wall.
      // --- guard hall. Deliberately sparse in the middle: the reference's
      // hall is a bare muster floor with one table on it, and the crowd that
      // fills it is guards, not clutter. A pass that scattered barrels,
      // crates and braziers across the open floor to "add density" made it
      // read as a storage room, so dressing is kept to the edges.
      { id: 'tableWithStools', col: 16, row: 17, tileWidth: 5 },
      { id: 'stool', col: 20, row: 17, tileWidth: 0.8 },
      { id: 'brazier', col: 5, row: 16, tileWidth: 1.2 },
      { id: 'crates', col: 2, row: 15, tileWidth: 1.5 },
      { id: 'chest', col: 21, row: 14, tileWidth: 1.3 },
      { id: 'pot', col: 1, row: 17, tileWidth: 0.8 },
      { id: 'sack', col: 3, row: 18, tileWidth: 1.1 },
      // the door down to the service corridor, set into the wall block the
      // reference puts it in (below the warden's office)
      { id: 'woodDoor', col: 25.5, row: 15, tileWidth: 2.4 },
    ],
  },

  // The escape route. Not in the reference - assembled from the same
  // materials so it reads as the same building: pale stone underfoot, the
  // cell block's own dark wall above, and a barred gate at each of the four
  // checkpoints. The gates are deliberately NON-blocking: attemptMazeSegment
  // in useGameStore.js is the authoritative sequence gate, and the room must
  // not add a second, physical one on top of it.
  jailMaze: {
    zoneId: 'jailMaze',
    label: 'Service Corridor',
    cols: 24,
    rows: 9,
    // Dark cell stone underfoot, not the pale slab: this is a service tunnel
    // under the same building, and the pale material read as a bright, clean
    // corridor pasted into a dark prison.
    mask: [
      '########################',
      '########################',
      '#dddddddddddddddddddddd#',
      '#dddddddddddddddddddddd#',
      '#dddddddddddddddddddddd#',
      '#dddddddddddddddddddddd#',
      '#dddddddddddddddddddddd#',
      '########################',
      '########################',
    ],
    spawn: { col: 2, row: 4 },
    // the four checkpoint columns, left to right
    checkpointCols: [5, 10, 15, 19],
    // standing tiles by the door back to the holding cell
    exitRect: { c0: 1, r0: 2, c1: 2, r1: 3 },
    props: [
      // sized to fit inside the 2-row wall band rather than overflowing it
      { id: 'woodDoor', col: 1, row: 1, tileWidth: 1.3 },
      { id: 'torch', col: 3, row: 1, tileWidth: 0.7 },
      { id: 'torch', col: 8, row: 1, tileWidth: 0.7 },
      { id: 'torch', col: 13, row: 1, tileWidth: 0.7 },
      { id: 'torch', col: 18, row: 1, tileWidth: 0.7 },
      { id: 'torch', col: 22, row: 1, tileWidth: 0.7 },
      { id: 'barsFront', col: 5, row: 6, tileWidth: 1.4 },
      { id: 'barsFront', col: 10, row: 6, tileWidth: 1.4 },
      { id: 'barsFront', col: 15, row: 6, tileWidth: 1.4 },
      { id: 'barsFront', col: 19, row: 6, tileWidth: 1.4 },
      { id: 'crates', col: 7, row: 6, tileWidth: 1.3 },
      { id: 'barrel', col: 12, row: 6, tileWidth: 0.9 },
      { id: 'sack', col: 17, row: 6, tileWidth: 1 },
      { id: 'ladder', col: 22, row: 6, tileWidth: 0.6 },
    ],
  },
}

function prisonTextureKey(id) {
  return `prison_${id}`
}

function preloadPrisonAssets(scene) {
  for (const [id, file] of Object.entries(PRISON_FILES)) {
    const key = prisonTextureKey(id)
    if (!scene.textures.exists(key)) scene.load.image(key, `${PRISON_DIR}/${file}`)
  }
}

function prisonTileAt(def, col, row) {
  if (col < 0 || row < 0 || row >= def.rows || col >= def.cols) return '.'
  return def.mask[row][col]
}

function placePrisonProp(scene, zoneObjects, id, col, row, tileWidth) {
  const key = prisonTextureKey(id)
  if (!scene.textures.exists(key)) return
  const src = scene.textures.get(key).getSourceImage()
  const scale = (tileWidth * TILE_SIZE) / src.width
  const img = scene.add
    .image((col + 0.5) * TILE_SIZE, (row + 1) * TILE_SIZE, key)
    .setOrigin(0.5, 1)
    .setScale(scale)
  img.setDepth((row + 1) * TILE_SIZE)
  zoneObjects.push(img)
  if (PRISON_PROP_NON_BLOCKING.has(id) || !scene.interiorBlockedTiles) return
  const c0 = Math.round(col - tileWidth / 2)
  const c1 = Math.max(c0, Math.round(col + tileWidth / 2 - 1))
  // col/row may be fractional so a prop can sit where the reference puts it
  // rather than snapping to the grid; the blocked-tile set is keyed by whole
  // tiles, so an unrounded row here would write keys nothing ever matches and
  // the prop would silently have no collision at all.
  const r = Math.round(row)
  fillBlockedRect(scene.interiorBlockedTiles, c0, Math.max(0, r - 1), c1, r)
}

// ---------------- Building interiors ----------------
// A single 12x9 room shape (INTERIOR_COLS/ROWS, matching DominoWorldScene's
// own room convention) is reused for every building's interior; only the
// palette + desk label differ per INTERIOR_TEMPLATES entry. Map overhaul
// Phase 4 trimmed the hub roster from 31 hand-authored buildings down to 10
// (see the header comment above FINANCE_BUILDING_DEFS) - bank/realEstateAgency
// are the only two still routed through buildGenericInteriorZone at all
// (both share "officeA"); every other surviving hub building
// (stockExchange/casino/trainStation/temple/underworld/businessCenter/
// governmentBuilding/industrialZone) is special-cased in triggerInteraction()
// to open a bespoke room or a React modal directly instead. The 88 character
// home/hideout buildings (characterHomeBuildings.js) would be silly to list
// by hand one at a time, so they're deliberately left out of
// BUILDING_INTERIOR_TEMPLATE entirely - interiorTemplateFor() falls back to
// "residence" or "hideout" by the building's `kind` for anything not found
// there.
const INTERIOR_COLS = 12
const INTERIOR_ROWS = 9
const INTERIOR_SPAWN = { col: 6, row: 5 }
const INTERIOR_DESK = { c0: 5, r0: 2, c1: 6, r1: 3 }
const INTERIOR_EXIT = { c0: 5, r0: 7, c1: 7, r1: 8 }

const INTERIOR_TEMPLATES = {
  cryptoHQ: { floorA: 0x1a1030, floorB: 0x241640, deskColor: 0x8a5a1f, deskLabel: 'Trading Terminal' },
  tycoonOffice: { floorA: 0x2a2420, floorB: 0x241f1c, deskColor: 0x555555, deskLabel: 'Executive Desk' },
  officeA: { floorA: 0x1e2430, floorB: 0x1a1f29, deskColor: 0x1f3a5f, deskLabel: 'Front Desk' },
  officeB: { floorA: 0x241e30, floorB: 0x1f1a29, deskColor: 0x4a3a5f, deskLabel: 'Reception Desk' },
  amenity: { floorA: 0x201c28, floorB: 0x1b1822, deskColor: 0x5a4a2a, deskLabel: 'Counter' },
  residence: { floorA: 0x2a3020, floorB: 0x1f2418, deskColor: 0x4a3a2a, deskLabel: 'Study' },
  hideout: { floorA: 0x1f1418, floorB: 0x160e12, deskColor: 0x6a1f3a, deskLabel: 'Back Room' },
  // Jail mini-map (courtAndPrison) - three palette variants of the same
  // shared room shape, one per zone: the holding cell itself, the service
  // corridor (jailMaze) dressed with crate/service-lighting colors per
  // world-builder, and the Underworld's back room the tunnel dead-ends into.
  holdingCell: { floorA: 0x28282c, floorB: 0x1e1e22, deskColor: 0x3a3a3a, deskLabel: 'Booking Desk' },
  jailMaze: { floorA: 0x201c18, floorB: 0x171310, deskColor: 0x5a4a2a, deskLabel: 'Service Corridor' },
  jailUnderworld: { floorA: 0x1f1418, floorB: 0x160e12, deskColor: 0x6a1f3a, deskLabel: 'Back Room' },
  // Underworld's walkable interior (buildUnderworldInteriorZone below) -
  // the fixed INTERIOR_DESK slot drawInteriorRoom always renders IS the
  // Boss Jobs + Standing back office (world-builder: no reason for these
  // two to be separate stops, Standing has no physical form of its own
  // beyond the ledger the Bosses already transact with you from). Purple
  // family matching the building's own exterior color (0x3a1f3a,
  // FINANCE_BUILDING_DEFS) and its escape-tunnel back room (jailUnderworld
  // above, same 0x6a1f3a-family maroon) for visual continuity across all 3.
  underworldInterior: { floorA: 0x241729, floorB: 0x1a0f1e, deskColor: 0x5a2f5a, deskLabel: 'Boss Jobs & Standing' },
}

// businessCenter/underworld/governmentBuilding/industrialZone (the 4
// Phase-2/4 tabbed-modal hub buildings) deliberately have no entry here -
// like stockExchange/casino/trainStation/temple, triggerInteraction()
// special-cases their `zone.id` and opens a React modal or bespoke room
// directly instead of ever routing through buildGenericInteriorZone, so they
// never need an interior template. trainStation/temple keep a stale-but-dead
// entry below (pre-existing, unrelated to this pass - interiorTemplateFor()
// is simply never called with their id).
const BUILDING_INTERIOR_TEMPLATE = {
  bank: 'officeA',
  realEstateAgency: 'officeA',
  trainStation: 'amenity',
  temple: 'amenity',
  courtAndPrison: 'holdingCell',
  // inceHome has no `kind` (it's a hub-shaped def, not a
  // characterHomeBuildings.js entry - see FINANCE_BUILDING_DEFS above), so
  // interiorTemplateFor's kind-based fallback would miss it and land on the
  // generic office-y 'amenity' palette. Explicit entry so her house reads as
  // a house inside too.
  inceHome: 'residence',
}

// Explicit id lookup first (the 4 hand-authored entries above); falls back
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
  buildingInterior: { cols: INTERIOR_COLS, rows: INTERIOR_ROWS },
  // Bespoke real-tileset rooms (see src/game/interiors/tmxWallInterior.js) -
  // same "own room shape, own zone id" pattern as stockExchangeInterior
  // above, just variable-sized instead of reusing INTERIOR_COLS/ROWS.
  chapelInterior: { cols: CHAPEL_ROOM.cols, rows: CHAPEL_ROOM.rows },
  chapelExterior: { cols: CHAPEL_EXTERIOR_ROOM.cols, rows: CHAPEL_EXTERIOR_ROOM.rows },
  teaHouseInterior: { cols: TEA_HOUSE_ROOM.cols, rows: TEA_HOUSE_ROOM.rows },
  // Jail mini-map - all 3 reuse the same shared INTERIOR_COLS x INTERIOR_ROWS
  // room shape every other interior uses (see buildJailCellZone/
  // buildJailMazeZone/buildJailUnderworldZone below), not a bespoke size.
  // Both jail rooms carry their own size now (PRISON_ROOMS) rather than the
  // shared 12x9 - the holding cell is the reference picture at true scale.
  jailCell: { cols: PRISON_ROOMS.jailCell.cols, rows: PRISON_ROOMS.jailCell.rows },
  jailMaze: { cols: PRISON_ROOMS.jailMaze.cols, rows: PRISON_ROOMS.jailMaze.rows },
  jailUnderworld: { cols: INTERIOR_COLS, rows: INTERIOR_ROWS },
  // Underworld's walkable interior - same shared room shape too. Deliberately
  // NOT named 'underworld': that string is already a live zone.id value
  // elsewhere (this building's own overworld footprint id, read by
  // triggerInteraction below) and 'jailUnderworld' above is a DIFFERENT
  // existing zone (the jail escape tunnel's transient back-room backdrop) -
  // reusing either name here would collide with real, already-working code.
  underworldInterior: { cols: INTERIOR_COLS, rows: INTERIOR_ROWS },
  // Lisa's bespoke two-room home interior (see buildLisaHallZone/
  // buildLisaWorkZone below) - a full-image backdrop per room rather than
  // the generic tile-drawn residence, so it reuses the same shared
  // INTERIOR_COLS x INTERIOR_ROWS room shape purely for the collision/camera
  // math every other interior already gets for free, not because the art
  // was authored to that grid.
  lisaHall: { cols: INTERIOR_COLS, rows: INTERIOR_ROWS },
  lisaWork: { cols: INTERIOR_COLS, rows: INTERIOR_ROWS },
  lisaBedroom: { cols: INTERIOR_COLS, rows: INTERIOR_ROWS },
  // The 87 character homes/hideouts - one zone per wealth tier rather than
  // one shared id, because each tier's room is a different SIZE and shape
  // (measured off its own reference - see HOME_ROOM_STYLES). Same
  // per-zone-dimensions pattern chapelInterior/teaHouseInterior already use.
  ...Object.fromEntries(
    Object.values(HOME_ROOM_STYLES).map((d) => [d.zoneId, { cols: d.cols, rows: d.rows }])
  ),
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
// roughly 3/5ths of the "everyone else" wealth tier's homes (see
// residentialHomeKit's sereneRed/sereneGreen/sereneBlue styles), not all 98
// buildings - deliberately scoped so the animation reads as "this
// recognizable house style has a working door" rather than a uniform tic
// applied to every building indiscriminately (district civic buildings,
// hideouts, and the other home facade families all keep their door as a
// static painted-on frame, same as before this change).
function drawBuildings(scene, buildings, zoneObjects) {
  for (const b of buildings) {
    const x = b.tiles.c0 * TILE_SIZE
    const y = b.tiles.r0 * TILE_SIZE
    const w = (b.tiles.c1 - b.tiles.c0 + 1) * TILE_SIZE
    const h = (b.tiles.r1 - b.tiles.r0 + 1) * TILE_SIZE
    zoneObjects.push(...placeBuildingFacade(scene, x, y, w, h, b.color, b))

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

// Physically-chasing police NPCs (see maybeSpawnPolice/updatePoliceChasers).
// Faster than NAMED_ROAMER_WALK_SPEED_PX_PER_SEC's ambient pace (this is a
// pursuit, not a stroll) but noticeably slower than the player's own
// TileMover top speed (40px per 160ms step = 250px/s), so a player who
// keeps moving away can outrun a chaser on foot - the tension is in not
// noticing one closing in, not an unwinnable footrace.
const POLICE_CHASE_SPEED_PX_PER_SEC = 140
// Contact distance that turns a chaser reaching the player into the actual
// stop-and-search encounter - one tile, so it reads as "caught up to you"
// rather than a precise pixel graze.
const POLICE_ARREST_RADIUS_PX = 40
// Distance at which the HUD's on-screen "closing in" warning lights up -
// well before POLICE_ARREST_RADIUS_PX's actual contact check, so it reads
// as an early warning the player has time to react to (duck behind a
// building, keep moving away) rather than firing at the same instant as
// the encounter itself.
const POLICE_WARNING_RADIUS_PX = 260
// Spawned just outside typical view (rather than anywhere on the map) so a
// new chaser reads as "closing in from off-screen", not a random teleport.
const POLICE_SPAWN_MIN_RADIUS_PX = 320
const POLICE_SPAWN_MAX_RADIUS_PX = 480
// Caps simultaneous pursuers at the player's current wantedLevel (0-5, see
// useGameStore's addWantedLevel), so a single star is one officer while a
// full 5-star heat can dogpile up to this many at once.
const MAX_POLICE_CHASERS = 4

// Witness system (see updateNearbyWitnesses/useGameStore's nearbyWitnesses):
// how close another NPC has to be to the player to count as someone who
// could plausibly notice a street crime. Wide enough to catch someone
// across the street, not so wide it reaches all the way to the next block.
const WITNESS_RADIUS_PX = 180
// Recomputed on a throttle rather than every frame - a street crime is a
// one-off UI action (mug/steal-car button), not something that needs
// frame-perfect witness detection, and this avoids a zustand `set()` call
// (and the store-wide notify it triggers) 60 times a second.
const WITNESS_CHECK_INTERVAL_MS = 400

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

// Two independent people's mill-in-place loops can happen to be at
// near-cancelling phases at any given instant (their phaseX/phaseY hashes
// are effectively uncorrelated) - harmless when a solo character has the
// whole door to themselves, but once the arc-slot fix above can seat two
// roamers only ~35-40px apart at rest, a socialite-tier pair (16px radius
// each) swinging toward each other can transiently close that gap to a
// handful of px, i.e. exactly the "stacking" look this whole fix targets,
// just intermittent instead of permanent. Capping the mill radius whenever a
// roamer is sharing their current building with anyone else (see `crowded`
// on the slot assigned by assignDoorSlots) keeps their arc-slot spacing the
// dominant term; CROWD_DRIFT_RADIUS_CAP is small but non-zero so the
// existing "never simultaneously motionless on both axes" property (which
// the walk-cycle/facing logic in updateNamedRoamers depends on) still holds
// for crowded roamers too.
const CROWD_DRIFT_RADIUS_CAP = 4

function idleDriftOffset(characterId, agentClock, tier, crowded) {
  let radius = IDLE_DRIFT_RADIUS_BY_TIER[tier] ?? IDLE_DRIFT_RADIUS_BY_TIER.regular
  if (crowded) radius = Math.min(radius, CROWD_DRIFT_RADIUS_CAP)
  const phaseX = ((idleDriftHash(`${characterId}:driftX`) % 1000) / 1000) * Math.PI * 2
  const phaseY = ((idleDriftHash(`${characterId}:driftY`) % 1000) / 1000) * Math.PI * 2
  const x = Math.sin((agentClock / IDLE_DRIFT_PERIOD_X) * Math.PI * 2 + phaseX) * radius
  const y = Math.cos((agentClock / IDLE_DRIFT_PERIOD_Y) * Math.PI * 2 + phaseY) * radius
  return { x, y }
}

// Group-aware "door slot" layout. An earlier version of this fix gave every
// character ONE fixed slot out of a 6-slot ring, hashed from characterId
// alone - with only 10 shared (non-home) buildings and 76+ characters,
// simulating worldPresenceEngine.js's actual output showed real convergence
// groups up to ~24 roamers at a single building at once (underworld and
// businessCenter are the worst offenders, since many characters list them as
// a work building - see characterDispositions.js's WORK_BUILDING_OVERRIDES).
// A 6-slot ring keyed only by character id can't hold that many distinct
// positions (pigeonhole guarantees overlaps once a group exceeds 6), and
// worse, being keyed only by character id meant two characters who happened
// to hash to the same slot stacked at EVERY building they ever shared, not
// just an unlucky one-off.
//
// This replaces that with a per-(building, time-block) arrangement: whoever
// is actually resolved to the same buildingId in one refreshPresenceCache()
// pass (see assignDoorSlots below, called from there) gets a distinct ring
// slot, assigned in order of a stable per-character hash so the same group
// of people always produces the same arrangement (no per-frame jitter, and
// re-running the same day/time-block/seed reproduces the same layout).
//
// Rings fan out strictly to the south (positive y / toward the viewer) of
// the door pixel - the door itself already sits just past the building's
// south edge (see buildingDoorPixel) - rather than a full circle, so a large
// group never gets a slot that pushes it back north into the building's own
// footprint. Ring 0 is the bare door pixel (offset {0,0}), so the extremely
// common case of "exactly one person at this building" (every home building,
// always) is pixel-identical to pre-fix behavior.
//
// Radii were tuned against a live screenshot check, not just sprite width:
// an initial pass sized purely off the ~48px sprite frame (chords ~27-34px)
// kept sprites themselves from overlapping but full name-tag TEXT ("Cornelius
// Vanderbilt" at the 9px monospace font used for labels, ~100px+ wide) still
// visibly collided once a dozen-plus roamers converged, which is the exact
// "unreadable garbage text" bug this whole fix targets - sprites not
// overlapping isn't the same bar as labels not overlapping. These wider
// radii (chords ~35-49px) meaningfully cut that down for the common
// convergence sizes (simulateWorldPresence shows most real convergences are
// well under 10 - see the worker's histogram notes) without pretending
// perfect never-overlap is achievable for the rare (~24-person) tail: fully
// eliminating text overlap at that count would need a footprint wide enough
// to start reading as "scattered across the block" rather than "a crowd at
// the door", or shortening/hiding labels outright, either of which is a
// bigger behavior change than this fix's brief (spatial positioning only).
// Max radius (150) stays under half the map's tightest real door-to-door
// spacing (320px, casino<->foodCourt/realEstateAgency) so even a maxed-out
// crowd never visually reads as bleeding into a neighboring building's own
// crowd.
// Capacities cut roughly in half from the original [1,3,6,9,12] (a live
// screenshot showed unreadably tight crowds even after the WORK_BUILDING_
// OVERRIDES rebalance that cut typical crowd sizes down - the ring geometry
// itself was still packing people too close together). Radii are unchanged
// (see the max-radius comment above) since that ceiling is a real map-
// geometry constraint, not a taste call - fewer people per ring at the same
// radius means a bigger angular gap between any two adjacent people, which
// is the only lever available without either exceeding that ceiling or
// changing the "fan south from the door" shape. A crowd that used to fill
// rings 1-4 now spills into ring 5 and the overflow bands sooner, which
// pushes them further out (more radius) rather than packing tighter - the
// intended direction for a bigger crowd, not a regression.
const ARC_RINGS = [
  { radius: 0, capacity: 1 },
  { radius: 45, capacity: 2 },
  { radius: 85, capacity: 4 },
  { radius: 120, capacity: 6 },
  { radius: 150, capacity: 8 },
]
const ARC_MAX_ANGLE = (75 * Math.PI) / 180 // half-spread either side of due south

// Name-tag labels float at a fixed y-26 above their sprite (see
// updateNamedRoamers). At radius 0 (the solo case) that's unchanged from
// pre-fix behavior; every other slot nudges its label up/down a little more
// by ring, purely so two roamers whose ARC positions happen to put them at a
// similar x don't also share the exact same label baseline - it staggers
// overlapping text onto different rows instead of directly on top of each
// other, which reads far better even when the text still overlaps some.
const ARC_RING_LABEL_DY = [26, 20, 32, 16, 38]

// Per-character standoff, added on top of whatever arc-ring slot
// assignDoorSlots gave them - separate from that shared crowd system (which
// only spaces roamers out from EACH OTHER) so this doesn't touch anyone
// else's positioning. Lisa is pinned to just entertainmentComplex now (see
// WORK_BUILDING_OVERRIDES.lisa in characterDispositions.js), so as the only
// or near-only roamer there she'd normally land on ring 0 - literally the
// bare door pixel (see arcSlotOffset) - which reads as blocking the
// entrance rather than "hanging around nearby". This nudges her off to the
// side and further out instead.
//
// The y value matters a lot more than it looks: buildingDoorPixel's base
// (no-slot) y is EXACTLY the south edge of that building's own interaction
// rect (buildOverworldZones pads every side by TILE_SIZE/2, which lands
// precisely on the same pixel as the door - see isBuildingSolidTile's south-
// padding comment). updateNearbyZone checks the building zone before ever
// calling findNearbyNamedRoamer (30px radius, see that method), so any
// player position close enough to talk to Lisa has to be entirely OUTSIDE
// that zone too, or "enter Entertainment Complex" always wins the tie and
// she becomes untalkable - which is exactly what a 14px nudge did (still
// well inside the 30px talk radius of the zone boundary). 56px clears the
// zone edge by a full 30px-radius-plus-margin, so her ENTIRE talk radius
// sits outside the building's zone rect, not just her center point.
const NAMED_ROAMER_DOOR_STANDOFF = {
  lisa: { x: 24, y: 56 },
}

function arcSlotOffset(index) {
  let remaining = index
  for (let ringIndex = 0; ringIndex < ARC_RINGS.length; ringIndex++) {
    const ring = ARC_RINGS[ringIndex]
    if (remaining < ring.capacity) {
      if (ring.radius === 0) return { x: 0, y: 0, labelDy: ARC_RING_LABEL_DY[0] }
      const t = ring.capacity === 1 ? 0 : remaining / (ring.capacity - 1) // 0..1 across the arc
      const angle = -ARC_MAX_ANGLE + t * (ARC_MAX_ANGLE * 2)
      return {
        x: Math.sin(angle) * ring.radius,
        y: Math.cos(angle) * ring.radius,
        labelDy: ARC_RING_LABEL_DY[ringIndex] ?? 26,
      }
    }
    remaining -= ring.capacity
  }
  // Beyond the last authored ring (>21 at one door with the reduced
  // capacities above - keeps growing radius in the same bands instead of
  // crashing or collapsing back onto an existing slot):
  const OVERFLOW_BAND = 14
  const band = Math.floor(remaining / OVERFLOW_BAND)
  const posInBand = remaining % OVERFLOW_BAND
  const radius = 150 + 30 * (band + 1)
  const t = posInBand / (OVERFLOW_BAND - 1)
  const angle = -ARC_MAX_ANGLE + t * (ARC_MAX_ANGLE * 2)
  return { x: Math.sin(angle) * radius, y: Math.cos(angle) * radius, labelDy: 26 + (band % 2) * 12 }
}

// Assigns one arcSlotOffset to every entry in a single presence snapshot
// (either "everyone's current-block building" or "everyone's next-block
// building" - see refreshPresenceCache, which calls this twice per resolve).
// `entries` is [{characterId, buildingId}, ...] for every named roamer.
// Grouping + sorting happens fresh each call rather than being cached
// per-character, so it naturally reflects exactly who is at a building
// THIS resolve - no stale slot claims from a previous block carry over.
function assignDoorSlots(entries) {
  const byBuilding = new Map()
  for (const entry of entries) {
    if (!byBuilding.has(entry.buildingId)) byBuilding.set(entry.buildingId, [])
    byBuilding.get(entry.buildingId).push(entry.characterId)
  }
  const slotByCharacterId = new Map()
  for (const ids of byBuilding.values()) {
    // Stable order derived from each id's own hash (not alphabetical - that
    // would visually cluster people whose names/ids happen to sort near
    // each other) so the same group of people always fans out the same way.
    ids.sort((a, b) => idleDriftHash(`${a}:doorSlotOrder`) - idleDriftHash(`${b}:doorSlotOrder`))
    const crowded = ids.length > 1
    ids.forEach((id, index) => slotByCharacterId.set(id, { ...arcSlotOffset(index), crowded }))
  }
  return slotByCharacterId
}

// ---------------------------------------------------------------------------
// Local pacing/loitering for roamers who have already arrived at their
// resolved building and have nothing to do for the rest of the block (the
// !traveling branch of updateNamedRoamers below). idleDriftOffset above
// already gives every such roamer a small mill-in-place fidget; this layers
// a second, occasional behavior on top for a SUBSET of them: walk out to a
// short, nearby point, linger, walk back, repeat - real point-to-point
// locomotion via the same seekTo() step-and-arrive mechanic
// updateNamedRoamers already uses for door-to-door travel, just with a
// short local round trip instead of a different building's door.
//
// Determinism convention (matches idleDriftHash/presencePhaseOffset above
// and worldPresenceEngine.js's own house rule): every parameter - whether a
// character paces at all, which direction, how far, how long they rest
// between walks - is derived once from a hash of the character's id, never
// Math.random(). The one thing that ISN'T hash-seeded is the real-time
// countdown driving state transitions (paceTimer counts down by the actual
// frame delta) - exactly like idleDriftOffset's own agentClock dependency
// above, this makes a given character's pacing PERSONALITY reproducible
// (same odds, distance, cadence every time) without pretending the literal
// wall-clock moment they start walking is meaningful to reproduce too.
function paceHash01(characterId, salt) {
  return (idleDriftHash(`${characterId}:${salt}`) % 1000) / 1000
}

// Only a minority of roamers pace at all - the brief asked for "a reasonable
// subset", not everyone, so most of the crowd still reads as settled.
// Weighted by the same personality tiers idleDriftOffset uses: recluses and
// fugitives overwhelmingly stay put, socialites/regulars are the ones who
// plausibly step out and circulate.
const PACE_ELIGIBILITY_BY_TIER = {
  recluse: 0.05,
  fugitive: 0.08,
  homebody: 0.16,
  regular: 0.28,
  socialite: 0.42,
}

const PACE_DISTANCE_MIN = 55 // px - short enough to stay "in front of the building"
const PACE_DISTANCE_MAX = 120 // px - stays well under the ~320px min door-to-door gap
const PACE_REST_MS_MIN = 5000 // how long they mill at the door before walking out
const PACE_REST_MS_MAX = 11000
const PACE_LINGER_MS_MIN = 1800 // how long they pause at the far point before returning
const PACE_LINGER_MS_MAX = 4000

// Fraction of eligible pacers whose round trips are a real "home errand"
// (walk all the way to their own home building's door, linger, walk back)
// rather than the short local point-and-return below - see
// computeErrandOrPaceTarget. A stable per-character personality trait, not
// re-rolled per trip, so a given character reads consistently as "the type
// who steps out to swing by home" or not.
const PACE_HOME_ERRAND_CHANCE = 0.4

// One-time, per-character pacing "personality" - cached on the roamer the
// first time it's needed (see updateNamedRoamers). Direction is constrained
// to the same south-facing cone assignDoorSlots' arc rings fan into (the
// door already sits just past the building's south edge), so a pacing walk
// naturally reads as "stepping out front", never back through the building.
function paceProfileFor(characterId, tier) {
  const threshold = PACE_ELIGIBILITY_BY_TIER[tier] ?? PACE_ELIGIBILITY_BY_TIER.regular
  const eligible = paceHash01(characterId, 'paceEligible') < threshold
  const angle = -ARC_MAX_ANGLE + paceHash01(characterId, 'paceAngle') * (ARC_MAX_ANGLE * 2)
  const distance = PACE_DISTANCE_MIN + paceHash01(characterId, 'paceDistance') * (PACE_DISTANCE_MAX - PACE_DISTANCE_MIN)
  const restMs = PACE_REST_MS_MIN + paceHash01(characterId, 'paceRestMs') * (PACE_REST_MS_MAX - PACE_REST_MS_MIN)
  const lingerMs = PACE_LINGER_MS_MIN + paceHash01(characterId, 'paceLingerMs') * (PACE_LINGER_MS_MAX - PACE_LINGER_MS_MIN)
  const isHomeErrand = paceHash01(characterId, 'paceIsHomeErrand') < PACE_HOME_ERRAND_CHANCE
  return { eligible, angle, distance, restMs, lingerMs, isHomeErrand }
}

// Picks a walkable local pacing destination near `restPos` (the roamer's
// door+slot position), trying the profile's own angle/distance first and
// then a couple of shorter fallbacks if that lands inside a building
// footprint, on a blocked/water tile, or on a tile another creature already
// occupies (isOccupiedByCreature - the same collision check driving-mode
// already uses elsewhere in this file). Returns null (stay milling instead)
// if every attempt is blocked, rather than ever forcing an overlapping or
// inside-a-wall destination.
function computePaceTarget(scene, restPos, profile) {
  const attempts = [1, 0.65, 0.4]
  for (const scale of attempts) {
    const dist = profile.distance * scale
    const tx = restPos.x + Math.sin(profile.angle) * dist
    const ty = restPos.y + Math.cos(profile.angle) * dist
    const col = Math.floor(tx / TILE_SIZE)
    const row = Math.floor(ty / TILE_SIZE)
    const insideBuilding = FINANCE_BUILDINGS.some(
      (b) => col >= b.tiles.c0 && col <= b.tiles.c1 && row >= b.tiles.r0 && row <= b.tiles.r1
    )
    if (insideBuilding) continue
    if (scene.isSingleTileObstacle(col, row)) continue
    if (scene.isOccupiedByCreature(col, row)) continue
    return { x: tx, y: ty }
  }
  return null
}

// Chooses the OUT-leg destination for a fresh pacing round trip: a real
// walk to the character's own home door (homeDoorPixel) for the
// isHomeErrand-rolled subset of pacers (see paceProfileFor above) - giving
// eligible roamers a visible "stepped out to swing by home" beat DURING the
// current time block, not just the once-per-End-Day block-to-block glide
// (see the house rule above nextTimeBlock()) - falling back to the existing
// short local point (computePaceTarget) whenever there's no usable home
// door, or the roamer is already resting at home (nothing to errand to).
// The BACK leg (advanceRoamerPacing's PACE_PHASE_BACK) always returns to
// restPos regardless of which of these the OUT leg used, so an errand never
// disturbs worldPresenceEngine.js's ground truth of which building this
// roamer is actually resolved to for the block - it's a there-and-back
// visit layered on top, exactly like the short local pace it replaces.
function computeErrandOrPaceTarget(scene, restPos, profile, homeDoorPixel, atHome) {
  if (profile.isHomeErrand && homeDoorPixel && !atHome) return homeDoorPixel
  return computePaceTarget(scene, restPos, profile)
}

const PACE_PHASE_OUT = 'out'
const PACE_PHASE_LINGER = 'linger'
const PACE_PHASE_BACK = 'back'

// Advances one roamer's pacing state machine by `delta` ms and returns the
// seek target for THIS frame (or null if they should just mill in place via
// idleDriftOffset, same as before this feature existed). Pure state-machine
// step - all actual movement still goes through updateNamedRoamers' own
// seekTo(), so pacing gets the exact same constant walk speed, arrival
// tolerance, and (via the caller adding it to the moving/facing logic
// downstream) walk-cycle/facing behavior as any other roamer movement.
function advanceRoamerPacing(scene, roamer, restPos, delta, homeDoorPixel, atHome) {
  const profile = roamer.paceProfile
  if (!profile || !profile.eligible) return null

  if (!roamer.paceState) {
    if (roamer.paceTimer == null) roamer.paceTimer = profile.restMs
    roamer.paceTimer -= delta
    if (roamer.paceTimer <= 0) {
      const target = computeErrandOrPaceTarget(scene, restPos, profile, homeDoorPixel, atHome)
      if (target) roamer.paceState = { phase: PACE_PHASE_OUT, target }
      else roamer.paceTimer = profile.restMs // no safe spot this cycle - try again next
    }
    return null // still milling
  }

  const arriveTolerance = NAMED_ROAMER_WALK_SPEED_PX_PER_SEC * (delta / 1000) + 1

  if (roamer.paceState.phase === PACE_PHASE_OUT) {
    const dist = Math.hypot(roamer.actor.x - roamer.paceState.target.x, roamer.actor.y - roamer.paceState.target.y)
    if (dist <= arriveTolerance) {
      roamer.paceState = { phase: PACE_PHASE_LINGER, target: roamer.paceState.target, timer: profile.lingerMs }
    }
    return roamer.paceState.target
  }

  if (roamer.paceState.phase === PACE_PHASE_LINGER) {
    roamer.paceState.timer -= delta
    if (roamer.paceState.timer <= 0) roamer.paceState = { phase: PACE_PHASE_BACK, target: restPos }
    return roamer.paceState.target
  }

  // PACE_PHASE_BACK
  const dist = Math.hypot(roamer.actor.x - restPos.x, roamer.actor.y - restPos.y)
  if (dist <= arriveTolerance) {
    roamer.paceState = null
    roamer.paceTimer = profile.restMs // rest at the door before the next round trip
    return null // resume milling this same frame
  }
  return restPos
}
// ---------------------------------------------------------------------------

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
    // Set only while UnderworldMapScene.jsx/CasinoMapScene.jsx's walkable
    // DOM hub is open (see enterHubWithWalkIn/resumeFromModal below) - NOT
    // the same as interactionLocked, which every modal in the game sets.
    // See update()'s own comment on why this needs to exist at all.
    this.heavySimSuspended = false
    this.zoneObjects = []
    this.currentZoneId = 'overworld'
    this.currentInteriorBuildingId = null
    // One-shot override for loadZone's teleport spawn (see lisaRoomZone's
    // `spawn` field / the 'exit' zone.type handler in triggerInteraction) -
    // Lisa's hall has TWO distinct entry points (the front door from the
    // overworld, and the stairs coming back down from the study) that need
    // to land the player in two different spots, which a single per-zoneId
    // default (every other interior's shared INTERIOR_SPAWN) can't express.
    // Read once by loadZone then cleared, so it never leaks into an
    // unrelated later zone load that didn't set it.
    this.pendingInteriorSpawn = null
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
    // Physically-chasing police/FBI NPCs (see maybeSpawnPolice) - unlike the
    // three arrays above, this one is NOT repopulated by buildOverworldZone;
    // it's event-driven (spawned over time by policeTimer while wantedLevel
    // > 0), so ducking into any building interior clears the pursuit
    // (clearZoneObjects destroys them below) without needing special-case
    // "escape" logic - new ones only spawn on the next roll after returning.
    this.policeChasers = []
    // Throttle timer for updateNearbyWitnesses (see WITNESS_CHECK_INTERVAL_MS) -
    // publishes a live nearby-NPC count into useGameStore's nearbyWitnesses
    // so a street crime (mug, vehicle theft) can tell whether anyone was
    // actually around to see it happen.
    this.witnessCheckTimer = 0
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
    preloadNpcRealSprites(this)
    preloadPlayerRealSprite(this)
    preloadVehicleAssets(this)
    preloadChapelPack(this)
    preloadChapelMap(this)
    preloadChapelExterior(this)
    preloadCuteTerrain(this)
    preloadCuteTrees(this)
    preloadTopDownVehicles(this)
    preloadLisaHouseInterior(this)
    preloadHomeFurniture(this)
    preloadPrisonAssets(this)
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

    // Fixed-camera "Press E to..." prompt, centered near the bottom of the
    // viewport. Was hardcoded to (320, 460) - correct only for the old
    // 800x500 logical resolution (canvas widened to 1200x600 in
    // GameCanvas.jsx); this.scale.width/height keeps it centered/anchored
    // near the bottom regardless of the canvas's configured resolution.
    this.promptText = this.add
      .text(this.scale.width / 2, this.scale.height - 40, '', { fontFamily: 'monospace', fontSize: '14px', color: '#ffe066' })
      .setScrollFactor(0)
      .setOrigin(0.5)
      .setDepth(2000)
    this.regionLabel = this.add
      .text(10, 10, '', { fontFamily: 'monospace', fontSize: '13px', color: '#c9a8ff' })
      .setScrollFactor(0)
      .setDepth(2000)

    this.cursors = this.input.keyboard.createCursorKeys()
    this.wasd = this.input.keyboard.addKeys('W,A,S,D,E,R')

    // Must run after preload() has landed every BUILDING_IMAGE_FILES texture
    // (it has, by the time create() runs) and before loadZone/createPlayer
    // start driving collision queries against isBuildingSolidTile.
    this.computeBuildingOverflowPads()

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
    // Reset before ANY build*Zone below runs, not just buildGenericInterior
    // Zone's own home/hideout branch - isBlockedTile's shared bucket (bank/
    // stockExchange/casino/jail*/underworldInterior/buildingInterior) all
    // read this same field, but only home/hideout buildings (via
    // blockHomePropFootprint) and chapel/teaHouse/Lisa's rooms ever WRITE to
    // it. Without a reset here, walking out of a furnished home and into,
    // say, the stock exchange would carry that home's furniture collision
    // over into a room that never asked for any.
    this.interiorBlockedTiles = new Set()

    if (zoneId === 'overworld') this.buildOverworldZone()
    else if (zoneId === 'stockExchangeInterior') this.buildStockExchangeInteriorZone()
    else if (zoneId === 'chapelInterior') this.buildChapelInteriorZone()
    else if (zoneId === 'chapelExterior') this.buildChapelExteriorZone()
    else if (zoneId === 'teaHouseInterior') this.buildTeaHouseInteriorZone()
    else if (PRISON_ROOMS[zoneId]) this.buildPrisonZone(zoneId)
    else if (zoneId === 'jailUnderworld') this.buildJailUnderworldZone()
    else if (zoneId === 'underworldInterior') this.buildUnderworldInteriorZone()
    else if (zoneId === 'lisaHall') this.buildLisaHallZone()
    else if (zoneId === 'lisaWork') this.buildLisaWorkZone()
    else if (zoneId === 'lisaBedroom') this.buildLisaBedroomZone()
    else if (HOME_STYLE_BY_ZONE[zoneId]) this.buildHomeInteriorZone(zoneId, this.currentInteriorBuildingId)
    else this.buildGenericInteriorZone(this.currentInteriorBuildingId)

    const zone = ZONES[zoneId]
    const roomWidth = zone.cols * TILE_SIZE
    const roomHeight = zone.rows * TILE_SIZE
    // Phaser's camera bounds-clamp (Camera.clampX/clampY) has no built-in
    // centering: when bounds are smaller than the viewport on an axis, it
    // clamps scroll to exactly 0 on that axis, pinning the room to the
    // viewport's top-left corner instead of centering it - every interior
    // room here (480x360, INTERIOR_COLS/ROWS) is smaller than the 1200x600
    // canvas, so without this every building interior/jail room/maze
    // rendered flush top-left with dead space filling the rest of the
    // canvas. Padding the bounds rect symmetrically out to viewport size
    // (while leaving the room's own tile-coordinate origin at (0,0), and
    // physics.world.setBounds below untouched) makes that same clamp lock
    // scroll to the padding offset instead of 0, which centers the room -
    // for zones already bigger than the viewport (just 'overworld' today)
    // pad is 0 on both axes and behavior is unchanged from before.
    const padX = Math.max(0, (this.cameras.main.width - roomWidth) / 2)
    const padY = Math.max(0, (this.cameras.main.height - roomHeight) / 2)
    this.cameras.main.setBounds(-padX, -padY, roomWidth + padX * 2, roomHeight + padY * 2)
    // Arcade Physics world bounds default to the 800x500 canvas size, not
    // the zone size - without this the player's collideWorldBounds body
    // gets clamped back inside that small box while walking. Deliberately
    // NOT padded like the camera bounds above - collision must stay keyed
    // to the room's real tile coordinates (origin (0,0)), which is what
    // every wall/desk/zone rect in this file already assumes.
    this.physics.world.setBounds(0, 0, roomWidth, roomHeight)
    if (teleportPlayer) {
      // chapelInterior/teaHouseInterior carry their own room-specific spawn
      // tile (their rooms aren't INTERIOR_COLS/ROWS-shaped) - every other
      // interior still reuses the one shared INTERIOR_SPAWN, EXCEPT
      // pendingInteriorSpawn (set by the 'exit' zone that triggered this
      // load - see lisaRoomZone's `spawn` field) always wins when present:
      // Lisa's hall/work/bedroom each have more than one entry point (front
      // door vs. stairs, board vs. door) that need to land the player next
      // to whichever one was actually used, which a single fixed
      // per-zoneId default can't express.
      const spawn =
        this.pendingInteriorSpawn ||
        (zoneId === 'overworld'
          ? this.overworldReturnSpawn
          : zoneId === 'chapelInterior'
            ? CHAPEL_ROOM.spawn
            : zoneId === 'chapelExterior'
              ? CHAPEL_EXTERIOR_ROOM.spawn
              : zoneId === 'teaHouseInterior'
                ? TEA_HOUSE_ROOM.spawn
                : HOME_STYLE_BY_ZONE[zoneId]
                  // Each home tier's room is its own size, so the shared
                  // INTERIOR_SPAWN tile can be a wall (or outside the mask)
                  // entirely - drop the player on that room's own door tile.
                  ? homeDoorTile(HOME_ROOM_STYLES[HOME_STYLE_BY_ZONE[zoneId]])
                  : PRISON_ROOMS[zoneId]
                    // Same reason, plus one of its own: arriving in the
                    // holding cell has to land the player INSIDE their cell
                    // (the one cell whose bars have a gap), not on the shared
                    // spawn tile, which in that room is another inmate's cell.
                    ? PRISON_ROOMS[zoneId].spawn
                    : INTERIOR_SPAWN)
      this.pendingInteriorSpawn = null
      this.tileMover.teleport(spawn.col, spawn.row)
    }
    this.cameras.main.startFollow(this.playerActor.sprite, true)

    // clearZoneObjects() above just destroyed every chaser that was mid-
    // pursuit (interiors have no chasers of their own) - without this, a
    // still-wanted player stepping back onto the street had to wait up to
    // policeTimer's full 9s before the next maybeSpawnPolice roll even had
    // a chance to notice. One immediate roll here (same 40% chance/
    // MAX_POLICE_CHASERS cap as the timer - see maybeSpawnPolice) means heat
    // can pick back up right away instead of reading as "the police forgot
    // about me" for however long the next tick takes. Placed after the
    // teleport above so findPoliceSpawnSpot rings around where the player
    // actually lands, not their pre-teleport position in whatever zone they
    // just left.
    if (zoneId === 'overworld') this.maybeSpawnPolice()
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
    for (const actor of this.financeAmbientActors) {
      actor.destroy()
      actor.label.destroy()
    }
    for (const animal of this.habitatAnimalActors) animal.destroy()
    for (const vehicle of this.vehicleActors) vehicle.actor.destroy()
    for (const chaser of this.policeChasers) {
      chaser.actor.destroy()
      chaser.label.destroy()
    }
    this.namedRoamers = []
    this.financeNamedNpcActors = {}
    this.financeAmbientActors = []
    this.habitatAnimalActors = []
    this.vehicleActors = []
    this.policeChasers = []
    // No overworld NPCs exist to witness anything while any other zone is
    // loaded - stale count from the last overworld frame would otherwise
    // sit in the store until the next throttled recompute.
    useGameStore.getState().setNearbyWitnesses(0)
    // Same staleness problem as nearbyWitnesses above: updatePoliceChasers
    // only runs while currentZoneId === 'overworld', so without this a
    // warning still lit the instant you stepped into a building would just
    // sit there frozen instead of clearing.
    useGameStore.getState().setPoliceWarning(null)
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

  // Homes/hideouts no longer reach this function at all - triggerInteraction
  // routes them to 'homeInterior'/buildHomeInteriorZone before they ever get
  // here (see that check's own comment). What's left is exactly what this
  // function looked like before that overlay-furniture experiment: only
  // bank/realEstateAgency (their own explicit 'officeA' entry in
  // BUILDING_INTERIOR_TEMPLATE) still actually call this - the flat
  // drawInteriorRoom floor/desk box below is genuinely still live for them,
  // not dead code, even though it's now unreachable for every home/hideout
  // that used to share it.
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

  // The 87 character homes/hideouts' bespoke per-wealth-tier room (see
  // HOME_ROOM_STYLES' own header for which reference screenshot each style is
  // measured from). Draws the room's own irregular outline - void outside the
  // mask, a 1-tile wall band hugging it, real reference-cropped floor inside -
  // then every measured piece of furniture, and finally the exit door + a
  // desk zone placed where that reference's own desk/table/altar sits. Does
  // NOT use drawInteriorRoom (see buildGenericInteriorZone's header for why
  // that path is now unreachable for these buildings).
  // One horizontal run of floor tiles sharing a material, as a single
  // tileSprite offset into world space so the pattern stays continuous
  // across runs instead of restarting at every segment.
  paintHomeFloorRun(colStart, colEnd, row, texId) {
    const key = homeFurnitureTextureKey(texId)
    if (!texId || !this.textures.exists(key)) return
    const t = this.add
      .tileSprite(colStart * TILE_SIZE, row * TILE_SIZE, (colEnd - colStart) * TILE_SIZE, TILE_SIZE, key)
      .setOrigin(0, 0)
    t.tilePositionX = colStart * TILE_SIZE
    t.tilePositionY = row * TILE_SIZE
    t.setDepth(-1)
    this.zoneObjects.push(t)
  }

  buildHomeInteriorZone(zoneId, buildingId) {
    const style = HOME_STYLE_BY_ZONE[zoneId]
    const def = HOME_ROOM_STYLES[style]
    const building = FINANCE_BUILDINGS.find((b) => b.id === buildingId)

    const bandRows = def.wallBandRows ?? 1
    const stripKey = def.wallStrip ? homeFurnitureTextureKey(def.wallStrip) : null
    const hasStrip = Boolean(stripKey) && this.textures.exists(stripKey)
    const edgeKey = def.wallEdge ? homeFurnitureTextureKey(def.wallEdge) : null
    const hasEdge = Boolean(edgeKey) && this.textures.exists(edgeKey)

    const g = this.add.graphics()
    this.zoneObjects.push(g)
    for (let row = 0; row < def.rows; row++) {
      for (let col = 0; col < def.cols; col++) {
        const x = col * TILE_SIZE
        const y = row * TILE_SIZE
        if (!homeMaskAt(def, col, row)) continue
        if (homeTileIsWall(def, col, row)) {
          // Flat colour underneath the strip too, so the side/bottom frame
          // and any seam never shows the void through.
          g.fillStyle(def.wallColor, 1)
          g.fillRect(x, y, TILE_SIZE, TILE_SIZE)
        } else if (!this.textures.exists(homeFurnitureTextureKey(homeFloorTexAt(def, col, row)))) {
          g.fillStyle(0x2a2a2a, 1)
          g.fillRect(x, y, TILE_SIZE, TILE_SIZE)
        }
      }
    }

    // Back wall: one tileSprite per contiguous run of columns whose WHOLE
    // band is inside the mask, drawn full-band-height and repeating on X
    // only. That's what preserves the reference's vertical wall profile -
    // cornice/cap, face, skirting - which tiling a square swatch in both
    // axes destroys. Columns only partly in the band keep the flat colour
    // already painted above.
    // Side/bottom walls first (the one-tile-thick edges), so the top band's
    // profile strip below draws over them at the corners rather than under.
    if (hasEdge) {
      for (let row = 0; row < def.rows; row++) {
        for (let col = 0; col < def.cols; col++) {
          if (row < bandRows || !homeTileIsWall(def, col, row)) continue
          const e = this.add
            .image(col * TILE_SIZE, row * TILE_SIZE, edgeKey)
            .setOrigin(0, 0)
            .setDisplaySize(TILE_SIZE, TILE_SIZE)
          e.setDepth(-2)
          this.zoneObjects.push(e)
        }
      }
    }
    if (hasStrip) {
      const fullBandCol = (c) => {
        for (let r = 0; r < bandRows; r++) if (!homeMaskAt(def, c, r)) return false
        return true
      }
      let runStart = null
      for (let col = 0; col <= def.cols; col++) {
        const hit = col < def.cols && fullBandCol(col)
        if (hit && runStart === null) runStart = col
        if (!hit && runStart !== null) {
          const t = this.add
            .tileSprite(runStart * TILE_SIZE, 0, (col - runStart) * TILE_SIZE, bandRows * TILE_SIZE, stripKey)
            .setOrigin(0, 0)
          t.tilePositionX = runStart * TILE_SIZE
          t.setDepth(-2)
          this.zoneObjects.push(t)
          runStart = null
        }
      }
    }
    // Floor: one tileSprite per contiguous run of floor tiles SHARING a
    // texture, so the material stays continuous across the room instead of
    // restarting per tile, while respecting both the mask's notches and any
    // per-room floor override (see homeFloorTexAt).
    {
      for (let row = 0; row < def.rows; row++) {
        let runStart = null
        let runTex = null
        for (let col = 0; col <= def.cols; col++) {
          const isFloor = col < def.cols && homeTileIsFloor(def, col, row)
          const tex = isFloor ? homeFloorTexAt(def, col, row) : null
          if (isFloor && runStart !== null && tex !== runTex) {
            this.paintHomeFloorRun(runStart, col, row, runTex)
            runStart = col
            runTex = tex
          } else if (isFloor && runStart === null) {
            runStart = col
            runTex = tex
          }
          if (!isFloor && runStart !== null) {
            this.paintHomeFloorRun(runStart, col, row, runTex)
            runStart = null
            runTex = null
          }
        }
      }
    }

    // Wall/void tiles are solid. Furniture adds to this same set via
    // placeHomeProp -> blockHomePropFootprint.
    for (let row = 0; row < def.rows; row++) {
      for (let col = 0; col < def.cols; col++) {
        if (!homeTileIsFloor(def, col, row)) this.interiorBlockedTiles.add(`${col},${row}`)
      }
    }


    this.regionLabel.setText(building.label)

    for (const prop of def.props) {
      placeHomeProp(this, this.zoneObjects, prop.id, prop.col, prop.row, prop.tileWidth)
    }

    const door = homeDoorTile(def)
    // The door tile itself must stay walkable even if a rug/prop overlapped
    // it - it's the only way out.
    this.interiorBlockedTiles.delete(`${door.col},${door.row}`)

    // ...and it needs to LOOK like a door. The exit was previously an
    // invisible zone on a blank stretch of wall, so there was nothing telling
    // the player where to leave (reported: "the door is missing"). Drawn on
    // the wall tile BELOW the walkable door tile so it reads as set into the
    // bottom wall, and deliberately not via placeHomeProp - that wall tile is
    // already solid and must not be re-blocked over the doorway.
    const doorKey = homeFurnitureTextureKey('woodDoor')
    if (this.textures.exists(doorKey)) {
      const src = this.textures.get(doorKey).getSourceImage()
      const doorW = TILE_SIZE * 1.1
      const d = this.add
        .image((door.col + 0.5) * TILE_SIZE, (door.row + 2) * TILE_SIZE, doorKey)
        .setOrigin(0.5, 1)
        .setScale(doorW / src.width)
      d.setDepth((door.row + 2) * TILE_SIZE)
      this.zoneObjects.push(d)
    }

    this.zones = [
      {
        type: 'exit',
        id: 'toOverworld',
        label: 'Exit to Capital Syndicate',
        rect: new Phaser.Geom.Rectangle(
          (door.col - 1) * TILE_SIZE,
          (door.row - 1) * TILE_SIZE,
          TILE_SIZE * 3,
          TILE_SIZE * 3
        ),
      },
      lisaRoomZone('interiorDesk', building.id, def.deskRect, {
        npcId: building.npcId,
        label: 'talk to them',
      }),
    ]
  }

  // Lisa's home (home_lisa) - bespoke three-room interior instead of
  // buildGenericInteriorZone's shared tile-drawn residence, per the supplied
  // hall.png/work.png/Bedroom.png art: ground-floor hall -> (stairs) ->
  // upstairs study -> (a wall board) -> her private bedroom, each connection
  // a real door/landmark you walk up to and press E at, not an abstract
  // zone edge - and each one two-way (the far side's own door/landmark
  // brings you straight back). All 3 build*Zone methods below share the same
  // shape: draw the single background image full-bleed, populate
  // interiorBlockedTiles with the art's actual furniture/wall footprints
  // (measured against a 12x9 grid overlaid on the reference art - see
  // production/ for how - not literally pixel-perfect against a live
  // render, so nudge these if a specific piece of furniture still reads as
  // walkable or a doorway reads as blocked once this is actually played),
  // and list this.zones for whichever doors/desk live in that room.
  buildLisaHallZone() {
    drawLisaRoomBackground(this, LISA_HALL_BG_KEY)

    const building = FINANCE_BUILDINGS.find((b) => b.id === 'home_lisa')
    this.regionLabel.setText(building?.label || "Lisa's House")

    // The room's own drawn wall margin (top/left/right full, bottom split
    // around the door so interiorExitZone's cols 5-7 stay walkable) plus
    // furniture the player can't walk through - the two curved staircases
    // (their walkable steps are the stairUp zone below, cols 4-7, left
    // deliberately open), the two flanking statues, and the corner
    // plant/bench decor. The open floor (the seal medallion, cols 4-7 rows
    // 4-6) stays walkable.
    this.interiorBlockedTiles = new Set()
    fillBlockedRect(this.interiorBlockedTiles, 0, 0, 11, 0)
    fillBlockedRect(this.interiorBlockedTiles, 0, 0, 0, 8)
    fillBlockedRect(this.interiorBlockedTiles, 11, 0, 11, 8)
    fillBlockedRect(this.interiorBlockedTiles, 0, 8, 4, 8)
    fillBlockedRect(this.interiorBlockedTiles, 8, 8, 11, 8)
    fillBlockedRect(this.interiorBlockedTiles, 2, 0, 4, 3)
    fillBlockedRect(this.interiorBlockedTiles, 7, 0, 9, 3)
    fillBlockedRect(this.interiorBlockedTiles, 1, 2, 1, 4)
    fillBlockedRect(this.interiorBlockedTiles, 10, 2, 10, 4)
    fillBlockedRect(this.interiorBlockedTiles, 1, 6, 1, 8)
    fillBlockedRect(this.interiorBlockedTiles, 10, 5, 10, 8)

    this.zones = [
      interiorExitZone(),
      lisaRoomZone('exit', 'stairUp', { c0: 4, r0: 1, c1: 7, r1: 3 }, {
        label: 'Climb the stairs',
        target: 'lisaWork',
        spawn: { col: 6, row: 6 },
      }),
    ]
  }

  // Upstairs - her study/office. The desk trigger lives here now (moved off
  // the generic fixed slot since there's no generic desk box drawn here -
  // the desks are baked into work.png itself), still emitting the exact
  // same {type:'building', id:'home_lisa', npcId:'lisa'} shape
  // buildGenericInteriorZone's desk always has, so WorldScreen.jsx's
  // existing LisaModal routing needs no changes at all. The wall board at
  // the far end of the room (opposite the door) is the way through to her
  // bedroom.
  buildLisaWorkZone() {
    drawLisaRoomBackground(this, LISA_WORK_BG_KEY)

    const building = FINANCE_BUILDINGS.find((b) => b.id === 'home_lisa')
    this.regionLabel.setText(`${building?.label || "Lisa's House"} - Study`)

    // The room's own drawn wall margin (top split around the board at cols
    // 4-7, bottom/left/right full - the door at rows 6-7 sits one row shy of
    // the true bottom wall, so it doesn't need its own gap) plus the 4 desk
    // clusters (2x2, each ~3 cols wide) and the furniture columns running
    // down both side walls. Row 1 at the left wall (the standing figure -
    // the desk-interact zone below) stays walkable.
    this.interiorBlockedTiles = new Set()
    fillBlockedRect(this.interiorBlockedTiles, 0, 0, 3, 0)
    fillBlockedRect(this.interiorBlockedTiles, 8, 0, 11, 0)
    fillBlockedRect(this.interiorBlockedTiles, 0, 8, 11, 8)
    fillBlockedRect(this.interiorBlockedTiles, 0, 0, 0, 8)
    fillBlockedRect(this.interiorBlockedTiles, 11, 0, 11, 8)
    fillBlockedRect(this.interiorBlockedTiles, 2, 1, 4, 3)
    fillBlockedRect(this.interiorBlockedTiles, 7, 1, 9, 3)
    fillBlockedRect(this.interiorBlockedTiles, 2, 4, 4, 6)
    fillBlockedRect(this.interiorBlockedTiles, 7, 4, 9, 6)
    // Deliberately NOT blocking col 1 (unlike col 10-11's mirrored
    // furniture column) - the desk-interact zone below sits at col 1, row 1
    // (the standing figure by the left wall), and that column's own
    // furniture (shelf/monitor stack/washers) would wall it in with no
    // walkable tile connecting it to the rest of the room otherwise. Left
    // fully open (floor-level walk-through) rather than half-blocked, so
    // there's no leftover isolated pocket.
    fillBlockedRect(this.interiorBlockedTiles, 10, 1, 11, 6)

    this.zones = [
      lisaRoomZone('exit', 'workDoor', { c0: 4, r0: 6, c1: 7, r1: 7 }, {
        label: 'Head back downstairs',
        target: 'lisaHall',
        spawn: { col: 6, row: 2 },
      }),
      lisaRoomZone('exit', 'workBoard', { c0: 4, r0: 0, c1: 7, r1: 1 }, {
        label: 'Check the board',
        target: 'lisaBedroom',
        spawn: { col: 6, row: 7 },
      }),
      lisaRoomZone('interiorDesk', 'home_lisa', { c0: 1, r0: 0, c1: 2, r1: 1 }, {
        npcId: 'lisa',
        label: 'talk to Lisa',
      }),
    ]
  }

  // Her bedroom - the last stop, only reachable through the study's board.
  // No NPC trigger of its own (talking to her stays in the study); the only
  // interactive is the "LALISA'S ROOM - PRIVATE" door back out.
  buildLisaBedroomZone() {
    drawLisaRoomBackground(this, LISA_BEDROOM_BG_KEY)

    const building = FINANCE_BUILDINGS.find((b) => b.id === 'home_lisa')
    this.regionLabel.setText(`${building?.label || "Lisa's House"} - Bedroom`)

    // The room's own drawn wall margin (top/left/right full, bottom split
    // around the door at cols 5-7) plus the bed, both nightstands, the
    // wardrobe+bookshelf wall, the vanity/cat-tree/guitar corner, the
    // desk+chair, and the right-side shelf/couch - leaves the rug (cols 5-9,
    // rows 4-7) walkable.
    this.interiorBlockedTiles = new Set()
    fillBlockedRect(this.interiorBlockedTiles, 0, 0, 11, 0)
    fillBlockedRect(this.interiorBlockedTiles, 0, 0, 0, 8)
    fillBlockedRect(this.interiorBlockedTiles, 11, 0, 11, 8)
    fillBlockedRect(this.interiorBlockedTiles, 0, 8, 4, 8)
    fillBlockedRect(this.interiorBlockedTiles, 8, 8, 11, 8)
    fillBlockedRect(this.interiorBlockedTiles, 2, 1, 4, 4)
    fillBlockedRect(this.interiorBlockedTiles, 1, 1, 1, 2)
    fillBlockedRect(this.interiorBlockedTiles, 5, 2, 6, 3)
    fillBlockedRect(this.interiorBlockedTiles, 7, 1, 9, 3)
    fillBlockedRect(this.interiorBlockedTiles, 9, 1, 11, 4)
    fillBlockedRect(this.interiorBlockedTiles, 1, 5, 1, 8)
    fillBlockedRect(this.interiorBlockedTiles, 3, 5, 5, 7)
    fillBlockedRect(this.interiorBlockedTiles, 1, 6, 2, 8)
    fillBlockedRect(this.interiorBlockedTiles, 10, 5, 11, 8)
    fillBlockedRect(this.interiorBlockedTiles, 8, 8, 9, 8)

    this.zones = [
      lisaRoomZone('exit', 'bedroomDoor', { c0: 5, r0: 7, c1: 7, r1: 8 }, {
        label: "Leave Lisa's room",
        target: 'lisaWork',
        spawn: { col: 6, row: 1 },
      }),
    ]
  }

  // Paints one horizontal run of same-material tiles as a single tileSprite
  // with its pattern origin pinned to world coordinates, so a material stays
  // continuous across the run instead of restarting (and seaming) per tile.
  paintPrisonRun(colStart, colEnd, row, texId, depth) {
    const key = prisonTextureKey(texId)
    if (!this.textures.exists(key)) return
    const width = (colEnd - colStart + 1) * TILE_SIZE
    const strip = this.add
      .tileSprite(colStart * TILE_SIZE, row * TILE_SIZE, width, TILE_SIZE, key)
      .setOrigin(0, 0)
    strip.tilePositionX = colStart * TILE_SIZE
    strip.tilePositionY = row * TILE_SIZE
    strip.setDepth(depth)
    this.zoneObjects.push(strip)
  }

  // One wall edge band (cap or footing): a fixed-height strip repeating
  // across X only, drawn at an arbitrary y rather than snapped to the grid.
  paintPrisonBand(colStart, colEnd, y, texId) {
    const key = prisonTextureKey(texId)
    if (!this.textures.exists(key)) return
    const src = this.textures.get(key).getSourceImage()
    const strip = this.add
      .tileSprite(colStart * TILE_SIZE, y, (colEnd - colStart + 1) * TILE_SIZE, src.height, key)
      .setOrigin(0, 0)
    strip.tilePositionX = colStart * TILE_SIZE
    strip.setDepth(-1)
    this.zoneObjects.push(strip)
  }

  // One barred cell front: straw laid as real floor, then the bars over it as
  // a transparent grid repeating across X.
  //
  // Drawn in two layers rather than as one baked texture because the cell
  // interior behind the bars is continuous - one unbroken hay floor. A single
  // texture containing both bars AND hay repeats its contents every tile or
  // two, which turned one cell's two chairs into four and chopped the hay
  // into blocks.
  paintPrisonBars(colStart, colEnd, row, bandRows) {
    const width = (colEnd - colStart + 1) * TILE_SIZE
    const height = bandRows * TILE_SIZE
    for (const [texId, tileY] of [['floorStraw', true], ['barsGrid', false]]) {
      const key = prisonTextureKey(texId)
      if (!this.textures.exists(key)) continue
      const layer = this.add
        .tileSprite(colStart * TILE_SIZE, row * TILE_SIZE, width, height, key)
        .setOrigin(0, 0)
      layer.tilePositionX = colStart * TILE_SIZE
      // the straw is a floor material and keeps world alignment on both axes;
      // the grid is a full-band profile and must not repeat vertically
      if (tileY) layer.tilePositionY = row * TILE_SIZE
      layer.setDepth(-1)
      this.zoneObjects.push(layer)
    }
  }

  // Builds either prison room from its PRISON_ROOMS mask. Replaces the flat
  // drawInteriorRoom box both jail rooms used to share - see the dead-code
  // note on buildJailCellZone below for why those are kept rather than
  // deleted. The interactables this creates are deliberately the SAME set,
  // with the same ids/types/targets, as the old builders produced: only where
  // they sit in the room changed, because the room did.
  buildPrisonZone(zoneId) {
    const def = PRISON_ROOMS[zoneId]

    // Arrest drops the player in here without going through
    // triggerInteraction, so the walk-back-out spawn is resolved here (same
    // reason buildJailCellZone did it).
    if (zoneId === 'jailCell') {
      const building = FINANCE_BUILDINGS.find((b) => b.id === 'courtAndPrison')
      if (building) {
        this.overworldReturnSpawn = {
          col: Math.round((building.tiles.c0 + building.tiles.c1) / 2),
          row: building.tiles.r1 + 1,
        }
      }
    }

    // Floors and walls: batched into runs of the same material per row.
    // 'B' is skipped here and handled below - it's the one material that
    // can't be painted a tile at a time.
    for (let row = 0; row < def.rows; row += 1) {
      let runStart = null
      let runCh = null
      for (let col = 0; col <= def.cols; col += 1) {
        const ch = col < def.cols ? prisonTileAt(def, col, row) : null
        if (ch !== runCh) {
          if (runStart !== null && runCh && runCh !== '.' && runCh !== 'B') {
            this.paintPrisonRun(runStart, col - 1, row, PRISON_TILE_TEX[runCh], -1)
          }
          runStart = col
          runCh = ch
        }
      }
    }

    // Wall edges. A wall here is a 3D block - bright cap on its top surface,
    // brick face, then a shadow line and pale footing where it meets the
    // floor. The face is already painted above; these two passes add the cap
    // to every wall tile with a non-wall above it and the footing to every
    // wall tile with a non-wall below it. Without them the walls are a flat
    // repeating pattern with no top and no bottom, which is what made them
    // look nothing like the reference.
    // Which band an edge gets depends on what it faces. A top edge against
    // the outer void is the building's silhouette and carries a brown
    // parapet above its coping; a top edge against another room gets coping
    // alone. A bottom edge against the void is that same parapet mirrored;
    // a bottom edge against floor gets the baseboard instead.
    const isWall = (c, r) => PRISON_WALL_CHARS.has(prisonTileAt(def, c, r))
    const isVoid = (c, r) => prisonTileAt(def, c, r) === '.'
    const bandFor = (c, r, edge) => {
      if (isWall(c, r + (edge === 'top' ? -1 : 1))) return null
      if (edge === 'top') return isVoid(c, r - 1) ? 'wallCapExt' : 'wallCap'
      if (isVoid(c, r + 1)) return 'wallCapExtS'
      // the baseboard is warm tan (cropped against hall flagstone); the cells'
      // floor is dark blue-grey, so they take a shadow-toned variant
      return PRISON_CELL_FLOORS.has(prisonTileAt(def, c, r + 1))
        ? 'wallBaseCell'
        : 'wallBase'
    }
    for (const edge of ['top', 'bottom']) {
      for (let row = 0; row < def.rows; row += 1) {
        let col = 0
        while (col < def.cols) {
          const tex = isWall(col, row) ? bandFor(col, row, edge) : null
          if (!tex) {
            col += 1
            continue
          }
          let end = col
          while (
            end + 1 < def.cols
            && isWall(end + 1, row)
            && bandFor(end + 1, row, edge) === tex
          ) end += 1
          const key = prisonTextureKey(tex)
          const h = this.textures.exists(key)
            ? this.textures.get(key).getSourceImage().height
            : 0
          const y = edge === 'top' ? row * TILE_SIZE : (row + 1) * TILE_SIZE - h
          this.paintPrisonBand(col, end, y, tex)
          col = end + 1
        }
      }
    }

    // Cell fronts. Each contiguous block of 'B' is drawn as ONE strip at the
    // band's full height, tiling on X only: bars are a vertical profile (top
    // rail, uprights, bottom rail) and repeating that on Y turns a cell front
    // into a ladder of rails. bars_front is cut to exactly one band tall, so
    // matching the strip to the band keeps the phase locked.
    for (let row = 0; row < def.rows; row += 1) {
      let col = 0
      while (col < def.cols) {
        const isBandTop = (c) =>
          prisonTileAt(def, c, row) === 'B' && prisonTileAt(def, c, row - 1) !== 'B'
        if (!isBandTop(col)) {
          col += 1
          continue
        }
        let end = col
        while (end + 1 < def.cols && isBandTop(end + 1)) end += 1
        let bandRows = 1
        while (prisonTileAt(def, col, row + bandRows) === 'B') bandRows += 1
        this.paintPrisonBars(col, end, row, bandRows)
        col = end + 1
      }
    }

    // Collision: anything that isn't a walkable material is solid.
    for (let row = 0; row < def.rows; row += 1) {
      for (let col = 0; col < def.cols; col += 1) {
        if (!PRISON_WALKABLE.has(prisonTileAt(def, col, row))) {
          this.interiorBlockedTiles.add(`${col},${row}`)
        }
      }
    }

    this.regionLabel.setText(def.label)

    for (const p of def.props) {
      placePrisonProp(this, this.zoneObjects, p.id, p.col, p.row, p.tileWidth)
    }

    this.zones = zoneId === 'jailCell' ? this.prisonCellZones(def) : this.prisonMazeZones(def)
  }

  // Holding cell interactables. Same two the old buildJailCellZone made: the
  // guard desk (which resolves bail/bribe) and the corridor entrance. There
  // is still deliberately no plain "exit to overworld" - leaving jail only
  // resolves through the desk or a maze clear, never a free walk-out.
  prisonCellZones(def) {
    const d = def.deskRect
    const e = def.exitRect
    return [
      {
        type: 'interiorDesk',
        id: 'courtAndPrison',
        label: 'Warden’s Desk',
        rect: new Phaser.Geom.Rectangle(
          d.c0 * TILE_SIZE - TILE_SIZE / 2,
          d.r0 * TILE_SIZE - TILE_SIZE / 2,
          (d.c1 - d.c0 + 1) * TILE_SIZE + TILE_SIZE,
          (d.r1 - d.r0 + 1) * TILE_SIZE + TILE_SIZE
        ),
      },
      {
        type: 'exit',
        id: 'jailMazeEntry',
        target: 'jailMaze',
        label: 'Service Corridor',
        rect: new Phaser.Geom.Rectangle(
          e.c0 * TILE_SIZE,
          e.r0 * TILE_SIZE,
          (e.c1 - e.c0 + 1) * TILE_SIZE,
          (e.r1 - e.r0 + 1) * TILE_SIZE
        ),
      },
    ]
  }

  // Corridor interactables: the retreat door FIRST, then the 4 checkpoints.
  //
  // Order matters and is load-bearing. triggerInteraction resolves a standing
  // spot with this.zones.find(...), first match wins, and the door's rect
  // overlaps the nearest checkpoint's. With the door last, the sliver where
  // they overlap resolved to the checkpoint, so pressing E in the doorway
  // could relaunch that checkpoint's minigame instead of retreating - it read
  // as "stuck, can't get back to the guard desk". Door first makes the door
  // win that overlap without shrinking either hitbox.
  prisonMazeZones(def) {
    const e = def.exitRect
    const zones = [
      {
        type: 'exit',
        id: 'jailMazeRetreat',
        target: 'jailCell',
        label: 'Back to Holding Cell',
        rect: new Phaser.Geom.Rectangle(
          e.c0 * TILE_SIZE,
          e.r0 * TILE_SIZE,
          (e.c1 - e.c0 + 1) * TILE_SIZE,
          (e.r1 - e.r0 + 1) * TILE_SIZE
        ),
      },
    ]
    def.checkpointCols.forEach((col, segmentIndex) => {
      zones.push({
        type: 'jailMazeCheckpoint',
        id: `jailMazeCheckpoint${segmentIndex}`,
        segmentIndex,
        label: `Checkpoint ${segmentIndex + 1}/4`,
        rect: new Phaser.Geom.Rectangle(
          col * TILE_SIZE - TILE_SIZE / 2,
          4 * TILE_SIZE - TILE_SIZE / 2,
          TILE_SIZE * 2,
          TILE_SIZE * 2
        ),
      })
    })
    return zones
  }

  // DEAD CODE, kept deliberately (not deleted) so the flat-box version of
  // both jail rooms can be restored if the art-driven rooms above ever need
  // to be rolled back. Nothing reaches buildJailCellZone/buildJailMazeZone
  // any more: loadZone routes both 'jailCell' and 'jailMaze' to
  // buildPrisonZone. Their mechanics live on unchanged in prisonCellZones/
  // prisonMazeZones above - same zone types, ids and targets, re-placed into
  // the new room shape.
  //
  // Jail mini-map (bespoke, not buildGenericInteriorZone, since this room
  // needs two distinct interactables rather than one desk + one plain exit -
  // see useGameStore.js's attemptJailBribe/attemptMazeSegment for the
  // mechanics these interactables trigger). Entered via the 'enterJail'
  // bridge event (GameCanvas.jsx) on arrest, not by walking through
  // triggerInteraction, so the overworld return spawn is computed here
  // rather than at the usual triggerInteraction call site (mirrors the
  // stockExchange/casino pattern above, just relocated).
  buildJailCellZone() {
    const building = FINANCE_BUILDINGS.find((b) => b.id === 'courtAndPrison')
    if (building) {
      this.overworldReturnSpawn = {
        col: Math.round((building.tiles.c0 + building.tiles.c1) / 2),
        row: building.tiles.r1 + 1,
      }
    }

    drawInteriorRoom(this, this.zoneObjects, INTERIOR_TEMPLATES.holdingCell)
    this.regionLabel.setText('Court & Jail')

    this.zones = [
      // Guard desk - id 'courtAndPrison' reuses the exact same
      // 'interiorDesk' -> {type:'building', id, npcId} path every other
      // desk uses (see triggerInteraction's generic interiorDesk branch
      // below); WorldScreen.jsx tells this apart from the "walked up to the
      // building while free" case by checking jail.inJail, since the two
      // can never both be true at once.
      {
        type: 'interiorDesk',
        id: 'courtAndPrison',
        label: 'Booking Desk',
        rect: new Phaser.Geom.Rectangle(
          INTERIOR_DESK.c0 * TILE_SIZE - TILE_SIZE / 2,
          INTERIOR_DESK.r0 * TILE_SIZE - TILE_SIZE / 2,
          (INTERIOR_DESK.c1 - INTERIOR_DESK.c0 + 1) * TILE_SIZE + TILE_SIZE,
          (INTERIOR_DESK.r1 - INTERIOR_DESK.r0 + 1) * TILE_SIZE + TILE_SIZE
        ),
      },
      // The inmate's hinted escape route (world-builder: "a corridor a
      // bribed staffer forgot to seal") - a plain 'exit' zone with a custom
      // target instead of the default overworld, so entering the maze needs
      // no new triggerInteraction branch at all. Deliberately no ordinary
      // "exit to overworld" zone here - leaving jail only resolves through
      // the guard desk (bail/bribe) or a maze clear, never a free walk-out.
      {
        type: 'exit',
        id: 'jailMazeEntry',
        target: 'jailMaze',
        label: 'Service Corridor',
        rect: new Phaser.Geom.Rectangle(
          INTERIOR_EXIT.c0 * TILE_SIZE,
          INTERIOR_EXIT.r0 * TILE_SIZE,
          (INTERIOR_EXIT.c1 - INTERIOR_EXIT.c0 + 1) * TILE_SIZE,
          (INTERIOR_EXIT.r1 - INTERIOR_EXIT.r0 + 1) * TILE_SIZE
        ),
      },
    ]
  }

  // 4 checkpoints laid left-to-right across the shared room shape (row 6,
  // clear of the desk-shaped prop drawInteriorRoom always draws around
  // INTERIOR_DESK). All 4 are always present rather than revealed one at a
  // time - useGameStore.js's attemptMazeSegment is the authoritative
  // sequence gate (silently ignores an out-of-order segmentIndex), so
  // interacting with a later checkpoint before clearing an earlier one is
  // harmless rather than something the scene needs to prevent.
  buildJailMazeZone() {
    drawInteriorRoom(this, this.zoneObjects, INTERIOR_TEMPLATES.jailMaze)
    this.regionLabel.setText('Service Corridor')

    const checkpointCols = [2, 4, 6, 8]
    this.zones = checkpointCols.map((col, segmentIndex) => ({
      type: 'jailMazeCheckpoint',
      id: `jailMazeCheckpoint${segmentIndex}`,
      segmentIndex,
      label: `Checkpoint ${segmentIndex + 1}/4`,
      rect: new Phaser.Geom.Rectangle(
        col * TILE_SIZE - TILE_SIZE / 2,
        6 * TILE_SIZE - TILE_SIZE / 2,
        TILE_SIZE * 2,
        TILE_SIZE * 2
      ),
    }))

    // "Retreat" exit back to the cell, at the same door position every
    // other room's exit uses (INTERIOR_EXIT) - matches the entry the player
    // just walked in through from buildJailCellZone. This is a pure zone
    // swap with zero store call, so it's always free: no checkpoint state
    // (mazeProgress/mazeAttemptedToday) is touched, unlike failing or
    // walking away mid-checkpoint (JailMazeMinigame.jsx), which already
    // route through the store's real failure consequence. Without this the
    // corridor had no way back at all short of engaging checkpoint 1 - see
    // production/backlog.md's 2026-08-02 note.
    //
    // unshift, not push: this rect's row (INTERIOR_EXIT, rows 7-8) overlaps
    // the bottom edge of every checkpoint's 2-tile-tall rect (row 6, so it
    // spans rows 5.5-7.5) - checkpoints 1-3 all clip into the door's column
    // range too. triggerInteraction resolves a standing spot to a zone via
    // `this.zones.find(...)`, first match wins, so whichever rect is EARLIER
    // in this array wins that overlap. Pushing the exit last (the original
    // bug) meant the sliver where the door and a checkpoint overlap always
    // resolved to the checkpoint - pressing E right at the doorway could
    // silently relaunch that checkpoint's minigame instead of retreating,
    // reading as "stuck, can't get back to the guard desk" even though a
    // checkpoint-free strip of the doorway does exist a step further in.
    // Putting the exit first makes the door win that tie everywhere it
    // overlaps a checkpoint, without shrinking either rect's real hitbox.
    this.zones.unshift({
      type: 'exit',
      id: 'jailMazeRetreat',
      target: 'jailCell',
      label: 'Back to Holding Cell',
      rect: new Phaser.Geom.Rectangle(
        INTERIOR_EXIT.c0 * TILE_SIZE,
        INTERIOR_EXIT.r0 * TILE_SIZE,
        (INTERIOR_EXIT.c1 - INTERIOR_EXIT.c0 + 1) * TILE_SIZE,
        (INTERIOR_EXIT.r1 - INTERIOR_EXIT.r0 + 1) * TILE_SIZE
      ),
    })
  }

  // Transient visual beat only - "framed as emerging through the tunnel"
  // (world-builder) - WorldScreen.jsx opens the real UnderworldModal on top
  // of this immediately after loading it, so it needs no interactables of
  // its own; dressed the same as underworld's own back-room palette.
  buildJailUnderworldZone() {
    drawInteriorRoom(this, this.zoneObjects, INTERIOR_TEMPLATES.jailUnderworld)
    this.regionLabel.setText('The Underworld - Back Room')
    this.zones = []
  }

  // Underworld's bare-box walkable interior - used to be reached from the
  // overworld front door too (the first tabbed hub building to get a real
  // walk-in room), but that front door now goes straight to UnderworldModal
  // (see triggerInteraction's straight-to-modal id list above), whose
  // default 'map' tab is a proper walkable hub built from the actual
  // reference illustration (UnderworldMapScene.jsx) instead of this
  // generic-facade room. This room and its 6 desks are NOT dead code
  // though: enterUnderworldFromJail (below) still lands the jail-tunnel
  // escape beat here on purpose, as a real physical room to walk out of -
  // ripping it out would turn that "framed as emerging through the tunnel"
  // beat into a teleport straight to a menu. Layout per the original
  // scoping pass: the front counter (Black Market) and the two side rackets
  // (Call Center Ops, Crime Alley) sit in the open floor; Speakeasy Hotel by
  // the stairs-down flavor; the fixed INTERIOR_DESK slot drawInteriorRoom
  // always renders (the room's one "real" desk facade + label, same
  // prominence jail's guard desk gets) IS the Boss Jobs + Standing back
  // office - no separate Standing stop, see
  // INTERIOR_TEMPLATES.underworldInterior's own comment for why. Gun Store
  // got its own 6th desk in a later pass (top-right corner) rather than
  // staying tab-only. All 6 interactables use the bespoke 'underworldDesk'
  // zone.type (see triggerInteraction) rather than the generic
  // 'interiorDesk' one, so none of their ids can collide with
  // DISTRICT_BUILDING_IDS.
  buildUnderworldInteriorZone() {
    drawInteriorRoom(this, this.zoneObjects, INTERIOR_TEMPLATES.underworldInterior)
    this.regionLabel.setText('The Underworld')

    const deskSpots = [
      { col: 3, row: 4, initialTab: 'blackMarket', label: 'Black Market' },
      { col: 8, row: 4, initialTab: 'callCenterOps', label: 'Call Center Ops' },
      { col: 3, row: 6, initialTab: 'crimeAlley', label: 'Crime Alley' },
      { col: 8, row: 6, initialTab: 'speakeasy', label: 'Speakeasy Hotel' },
      // 6th desk (later addition, same pattern as the 4 above): the empty
      // top-right corner, clear of the fixed Boss Jobs desk (INTERIOR_DESK,
      // roughly cols4-7/rows1-4) and the Call Center/Speakeasy column (col8)
      // - the only genuinely free spot left in this room.
      { col: 10, row: 2, initialTab: 'gunStore', label: 'Gun Store' },
    ]

    this.zones = [
      // The room's built-in desk facade (INTERIOR_DESK, same rect shape
      // buildJailCellZone's guard desk uses) - Boss Jobs + Standing.
      {
        type: 'underworldDesk',
        id: 'underworldBossJobs',
        initialTab: 'bossJobs',
        label: 'Boss Jobs & Standing',
        rect: new Phaser.Geom.Rectangle(
          INTERIOR_DESK.c0 * TILE_SIZE - TILE_SIZE / 2,
          INTERIOR_DESK.r0 * TILE_SIZE - TILE_SIZE / 2,
          (INTERIOR_DESK.c1 - INTERIOR_DESK.c0 + 1) * TILE_SIZE + TILE_SIZE,
          (INTERIOR_DESK.r1 - INTERIOR_DESK.r0 + 1) * TILE_SIZE + TILE_SIZE
        ),
      },
      ...deskSpots.map((spot) => ({
        type: 'underworldDesk',
        id: `underworld${spot.initialTab}`,
        initialTab: spot.initialTab,
        label: spot.label,
        rect: new Phaser.Geom.Rectangle(
          spot.col * TILE_SIZE - TILE_SIZE,
          spot.row * TILE_SIZE - TILE_SIZE,
          TILE_SIZE * 2,
          TILE_SIZE * 2
        ),
      })),
      interiorExitZone(),
    ]
  }

  // Called by GameCanvas.jsx's 'enterJailUnderworld' handler when the final
  // jailMaze checkpoint clears. Lands the player in this SAME persistent
  // underworldInterior room a normal front-door visit reaches - not the
  // disposable jailUnderworld backdrop this used to swap to, which had no
  // interactables of its own and force-exited straight back to the
  // overworld the moment its auto-opened UnderworldModal closed. That read
  // as "teleported into a black market menu for a second, then kicked back
  // outside" instead of "escaped into the Underworld" - matches the maze's
  // own lore spec more literally too (production/next-session-plan.md: the
  // tunnel "dead-ends at the *existing* Underworld building's back room").
  //
  // overworldReturnSpawn is set to the Underworld building's front door
  // first, the same lookup triggerInteraction's normal 'underworld' walk-in
  // branch does - without this, walking back out through this room's own
  // exit door later would drop the player outside the jail instead (it was
  // last set there by buildJailCellZone on arrest).
  enterUnderworldFromJail() {
    const building = FINANCE_BUILDINGS.find((b) => b.id === 'underworld')
    if (building) {
      this.overworldReturnSpawn = {
        col: Math.round((building.tiles.c0 + building.tiles.c1) / 2),
        row: building.tiles.r1 + 1,
      }
    }
    this.loadZone('underworldInterior')
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

  // Real per-building, per-axis collision pad for BUILDING_IMAGE_FILES
  // buildings - see isBuildingSolidTile below for why this can't just be
  // the flat PREFAB_IMAGE_MAX_OVERFLOW_TILES budget. Computed once here
  // (must run after preload() lands every bldg_* texture - see create())
  // rather than inside isBuildingSolidTile itself, which runs every frame
  // per moving actor (player + every named roamer) and can't afford to
  // re-fetch getSourceImage()/redo the scale math that many times a frame.
  // Keyed by building id -> { x, y } pad in whole tiles per axis.
  computeBuildingOverflowPads() {
    this.buildingOverflowPad = new Map()
    for (const b of FINANCE_BUILDINGS) {
      if (!BUILDING_IMAGE_FILES[b.id]) continue
      const key = buildingImageTextureKey(b.id)
      // Guaranteed loaded by now (preload() completes before create() runs,
      // and preloadBuildingImages loads every BUILDING_IMAGE_FILES entry
      // unconditionally) - this existence check is just defensive, same
      // spirit as drawPrefabImageFacade's own guard.
      if (!this.textures.exists(key)) continue
      const src = this.textures.get(key).getSourceImage()
      const wPx = (b.tiles.c1 - b.tiles.c0 + 1) * TILE_SIZE
      const hPx = (b.tiles.r1 - b.tiles.r0 + 1) * TILE_SIZE
      const overflow = computePrefabImageOverflowPx(src.width, src.height, wPx, hPx, TILE_SIZE)
      // Tile collision is a whole-tile decision (TileMover snaps the player
      // to exact tile centers - tileMover.js - there's no sub-tile position
      // to partially block), so round each axis to the NEAREST whole tile
      // rather than always rounding up: overflow under half a tile reads as
      // a minor decorative overhang (fine to leave that neighboring tile
      // walkable), overflow over half a tile reads as substantially
      // "inside" the building (worth losing that tile to keep it solid).
      // Math.round, not Math.ceil - ceil is exactly what reintroduces this
      // bug, since any nonzero overflow would again claim a full extra tile.
      this.buildingOverflowPad.set(b.id, {
        x: Math.round(overflow.x / TILE_SIZE),
        y: Math.round(overflow.y / TILE_SIZE),
      })
    }
  }

  // Shared by isBlockedTile (player collision, via TileMover) and named-
  // roamer building collision (updateNamedRoamers below) - the single
  // source of truth for "is this exact tile covered by a building's solid
  // footprint", including the temple's courtyard exception: the chapel
  // draws a whole authored courtyard, most of which is walkable ground, so
  // it uses the authored per-tile collision (TEMPLE_SOLID_OFFSETS) instead
  // of blocking its whole footprint rect like a normal building.
  isBuildingSolidTile(col, row) {
    for (const b of FINANCE_BUILDINGS) {
      if (b.id === 'temple') {
        if (col >= b.tiles.c0 && col <= b.tiles.c1 && row >= b.tiles.r0 && row <= b.tiles.r1) {
          return TEMPLE_SOLID_OFFSETS.has(`${col - b.tiles.c0},${row - b.tiles.r0}`)
        }
        continue
      }
      // Buildings drawn via the single bespoke facade image
      // (BUILDING_IMAGE_FILES -> drawPrefabImageFacade in packRender.js) let
      // their source art overflow up to PREFAB_IMAGE_MAX_OVERFLOW_TILES
      // tiles past the nominal footprint, but that's only the BUDGET the
      // scale-clamp is allowed to spend - not a promise every building
      // spends all of it on every axis. A near-square source image (e.g.
      // the bank) ends up height-bound, spending its whole budget
      // vertically but only a fraction of it horizontally - padding every
      // axis by the flat budget (as this used to) blocked a full extra
      // tile of walkable-looking grass on the bank's west/east sides where
      // the art barely reaches past the nominal footprint (reported: a
      // dead-looking gap between the player and the bank's visible edges).
      // computeBuildingOverflowPads (called once from create()) computes
      // each building's REAL per-axis overflow from its actual source
      // image dimensions and caches it here instead.
      //
      // South/r1 is deliberately left unpadded: buildingDoorPixel stands a
      // character exactly one tile south of tiles.r1, and the interaction
      // zone built in buildOverworldZones spans that same south row across
      // the building's whole width - padding it would make that entire row
      // solid and lock everyone out of the building's own door. That south
      // overflow strip is the door's visual overhang the player is already
      // meant to stand under (this scene's y-depth ordering already draws
      // the player in front of the building there), so leaving it open
      // doesn't reintroduce the "reads as inside the building" bug at the
      // one spot where standing under the art is intentional.
      const cached = this.buildingOverflowPad?.get(b.id)
      // Fallback to the old flat 1-tile assumption only if the per-building
      // cache somehow isn't populated yet (e.g. called before create()'s
      // computeBuildingOverflowPads runs) - safe/conservative, never used
      // in normal play.
      const padX = cached ? cached.x : (BUILDING_IMAGE_FILES[b.id] ? PREFAB_IMAGE_MAX_OVERFLOW_TILES : 0)
      const padY = cached ? cached.y : (BUILDING_IMAGE_FILES[b.id] ? PREFAB_IMAGE_MAX_OVERFLOW_TILES : 0)
      if (
        col >= b.tiles.c0 - padX &&
        col <= b.tiles.c1 + padX &&
        row >= b.tiles.r0 - padY &&
        row <= b.tiles.r1
      ) {
        return true
      }
    }
    return false
  }

  // ---------------- named-roamer pathfinding ----------------
  //
  // Roamers used to move by pure straight-line seek, with building
  // collision resolved as an axis-separated slide. Sliding is not
  // pathfinding: it only ever CLAMPS the blocked axis, and the seek
  // re-points into the same wall on the very next frame, so a roamer whose
  // door target sits behind a building walks into the face and stays there
  // forever (reported as NPCs stuck in place / pinned against walls). The
  // slide is kept below as a last-resort guard, but routing is now a real
  // search so a roamer walks AROUND a building instead of into it.
  //
  // Buildings are the entire obstacle set here - trees/rocks aren't solid
  // for anyone (see scatterEnvironment), and roamers deliberately don't
  // collide with each other or the player.
  isRoamerBlockedTile(col, row) {
    if (col < 0 || row < 0 || col >= MAP_COLS || row >= MAP_ROWS) return true
    return this.isBuildingSolidTile(col, row)
  }

  // Straight-line walkability, sampled at half-tile steps (small enough
  // that a 1-tile-thick wall can't be stepped over). Checked before any
  // search runs, because the overwhelmingly common case - a roamer idling
  // near its own door or pacing a few tiles - has a clear line and should
  // never pay for A*.
  roamerHasLineOfSight(x0, y0, x1, y1) {
    const dist = Math.hypot(x1 - x0, y1 - y0)
    const steps = Math.max(1, Math.ceil(dist / (TILE_SIZE / 2)))
    for (let i = 1; i <= steps; i++) {
      const t = i / steps
      const px = x0 + (x1 - x0) * t
      const py = y0 + (y1 - y0) * t
      if (this.isRoamerBlockedTile(Math.floor(px / TILE_SIZE), Math.floor(py / TILE_SIZE))) return false
    }
    return true
  }

  // Spiral outward for a walkable tile. A goal that lands inside a footprint
  // would make the search unsolvable, and "unsolvable" degrades to the old
  // walk-into-the-wall behaviour, so re-aim at the nearest open tile instead.
  nearestOpenRoamerTile(col, row, maxRadius = 10) {
    if (!this.isRoamerBlockedTile(col, row)) return { col, row }
    for (let r = 1; r <= maxRadius; r++) {
      for (let dc = -r; dc <= r; dc++) {
        for (let dr = -r; dr <= r; dr++) {
          if (Math.max(Math.abs(dc), Math.abs(dr)) !== r) continue
          if (!this.isRoamerBlockedTile(col + dc, row + dr)) return { col: col + dc, row: row + dr }
        }
      }
    }
    return null
  }

  // 8-way A* over the tile grid, returned as pixel waypoints and then
  // string-pulled against line-of-sight so a roamer walks a few long legs
  // instead of stair-stepping tile to tile (which reads as jittering).
  findRoamerPath(startX, startY, goalX, goalY) {
    const W = MAP_COLS
    const H = MAP_ROWS
    const sc = Math.floor(startX / TILE_SIZE)
    const sr = Math.floor(startY / TILE_SIZE)
    const goalTile = this.nearestOpenRoamerTile(Math.floor(goalX / TILE_SIZE), Math.floor(goalY / TILE_SIZE))
    if (!goalTile) return null
    const gc = goalTile.col
    const gr = goalTile.row
    if (sc === gc && sr === gr) return []
    if (sc < 0 || sr < 0 || sc >= W || sr >= H) return null

    const size = W * H
    const startIdx = sr * W + sc
    const goalIdx = gr * W + gc
    const gScore = new Float64Array(size).fill(Infinity)
    const cameFrom = new Int32Array(size).fill(-1)
    const closed = new Uint8Array(size)

    // Binary heap - a linear-scan open list is fine for one search but this
    // can run for many roamers in a burst right after a presence refresh.
    const heap = []
    const push = (f, idx) => {
      heap.push([f, idx])
      let i = heap.length - 1
      while (i > 0) {
        const p = (i - 1) >> 1
        if (heap[p][0] <= heap[i][0]) break
        const t = heap[p]; heap[p] = heap[i]; heap[i] = t
        i = p
      }
    }
    const pop = () => {
      const top = heap[0]
      const last = heap.pop()
      if (heap.length) {
        heap[0] = last
        let i = 0
        for (;;) {
          const l = 2 * i + 1
          const r = l + 1
          let m = i
          if (l < heap.length && heap[l][0] < heap[m][0]) m = l
          if (r < heap.length && heap[r][0] < heap[m][0]) m = r
          if (m === i) break
          const t = heap[m]; heap[m] = heap[i]; heap[i] = t
          i = m
        }
      }
      return top
    }
    // Octile distance - the admissible heuristic for 8-way movement with
    // diagonals costing sqrt(2).
    const h = (idx) => {
      const dc = Math.abs((idx % W) - gc)
      const dr = Math.abs(((idx / W) | 0) - gr)
      return dc + dr + (Math.SQRT2 - 2) * Math.min(dc, dr)
    }

    gScore[startIdx] = 0
    push(h(startIdx), startIdx)
    let expansions = 0
    const MAX_EXPANSIONS = 6000
    let found = false
    while (heap.length) {
      const cur = pop()[1]
      if (closed[cur]) continue
      closed[cur] = 1
      if (cur === goalIdx) { found = true; break }
      if (++expansions > MAX_EXPANSIONS) break
      const cc = cur % W
      const cr = (cur / W) | 0
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (!dc && !dr) continue
          const nc = cc + dc
          const nr = cr + dr
          if (this.isRoamerBlockedTile(nc, nr)) continue
          // No corner cutting - a diagonal is only legal if both of its
          // orthogonal components are open, otherwise roamers clip through
          // the exact corner pixel of a building.
          if (dc && dr && (this.isRoamerBlockedTile(cc + dc, cr) || this.isRoamerBlockedTile(cc, cr + dr))) continue
          const nIdx = nr * W + nc
          if (closed[nIdx]) continue
          const ng = gScore[cur] + (dc && dr ? Math.SQRT2 : 1)
          if (ng < gScore[nIdx]) {
            gScore[nIdx] = ng
            cameFrom[nIdx] = cur
            push(ng + h(nIdx), nIdx)
          }
        }
      }
    }
    if (!found) return null

    const tiles = []
    let cur = goalIdx
    while (cur !== -1 && cur !== startIdx) {
      tiles.push(cur)
      cur = cameFrom[cur]
    }
    tiles.reverse()
    const pts = tiles.map((idx) => ({
      x: (idx % W) * TILE_SIZE + TILE_SIZE / 2,
      y: ((idx / W) | 0) * TILE_SIZE + TILE_SIZE / 2,
    }))

    // String-pull: from the current anchor, jump to the furthest waypoint
    // still in line of sight and drop everything between.
    const out = []
    let fromX = startX
    let fromY = startY
    let i = 0
    while (i < pts.length) {
      let j = pts.length - 1
      while (j > i && !this.roamerHasLineOfSight(fromX, fromY, pts[j].x, pts[j].y)) j--
      out.push(pts[j])
      fromX = pts[j].x
      fromY = pts[j].y
      i = j + 1
    }
    return out
  }

  // One frame of movement toward `target`, routing around buildings when the
  // straight line is blocked. Returns the new raw position; the caller still
  // runs its own collision guard on the result.
  stepRoamerToward(roamer, target, stepPx) {
    const ax = roamer.actor.x
    const ay = roamer.actor.y
    const stepTo = (tx, ty) => {
      const dx = tx - ax
      const dy = ty - ay
      const dist = Math.hypot(dx, dy)
      if (dist <= stepPx || dist === 0) return { x: tx, y: ty }
      return { x: ax + (dx / dist) * stepPx, y: ay + (dy / dist) * stepPx }
    }

    if (this.roamerHasLineOfSight(ax, ay, target.x, target.y)) {
      roamer.path = null
      return stepTo(target.x, target.y)
    }

    const goalKey = `${Math.floor(target.x / TILE_SIZE)},${Math.floor(target.y / TILE_SIZE)}`
    if (!roamer.path || !roamer.path.length || roamer.pathGoalKey !== goalKey) {
      // Budgeted per frame: a presence refresh can retarget many of the 88
      // roamers at once, and running every search in one frame is a visible
      // hitch. Whoever misses out keeps walking on the direct seek and picks
      // up a real path within the next frame or two.
      if (this.roamerPathBudget <= 0) return stepTo(target.x, target.y)
      this.roamerPathBudget--
      roamer.path = this.findRoamerPath(ax, ay, target.x, target.y)
      roamer.pathGoalKey = goalKey
      if (!roamer.path) return stepTo(target.x, target.y)
    }

    // Drop waypoints already reached. Tolerance is at least the frame's own
    // step so a fast frame can't overshoot a waypoint and then orbit it.
    const reach = Math.max(stepPx, 3)
    while (roamer.path.length && Math.hypot(roamer.path[0].x - ax, roamer.path[0].y - ay) <= reach) {
      roamer.path.shift()
    }
    if (!roamer.path.length) {
      roamer.path = null
      return stepTo(target.x, target.y)
    }
    return stepTo(roamer.path[0].x, roamer.path[0].y)
  }

  isBlockedTile(col, row) {
    if (
      this.currentZoneId === 'chapelInterior' ||
      this.currentZoneId === 'chapelExterior' ||
      this.currentZoneId === 'teaHouseInterior' ||
      // Lisa's 3-room house (buildLisaHallZone/buildLisaWorkZone/
      // buildLisaBedroomZone) - same shape as chapel/teaHouse above (border
      // + a hand-populated interiorBlockedTiles set), just estimated from a
      // flat reference illustration instead of read off real tileset wall
      // data.
      this.currentZoneId === 'lisaHall' ||
      this.currentZoneId === 'lisaWork' ||
      this.currentZoneId === 'lisaBedroom' ||
      // The 87 character homes/hideouts' bespoke rooms (buildHomeInteriorZone) -
      // same border + interiorBlockedTiles shape, populated from the room's
      // own irregular mask plus blockHomePropFootprint per piece of furniture.
      HOME_STYLE_BY_ZONE[this.currentZoneId] ||
      // Both prison rooms (buildPrisonZone) - same shape again, populated
      // from each room's own PRISON_ROOMS mask plus its props' footprints.
      // They used to sit in the fixed 12x9 border+desk bucket below, which
      // can't express a room with sealed cells and an L-shaped hall.
      PRISON_ROOMS[this.currentZoneId]
    ) {
      const zone = ZONES[this.currentZoneId]
      if (col < 0 || col >= zone.cols || row < 0 || row >= zone.rows) return true
      return this.interiorBlockedTiles?.has(`${col},${row}`) ?? false
    }
    if (
      this.currentZoneId === 'stockExchangeInterior' ||
      this.currentZoneId === 'buildingInterior' ||
      this.currentZoneId === 'jailUnderworld' ||
      this.currentZoneId === 'underworldInterior'
    ) {
      if (col < 0 || col >= INTERIOR_COLS || row < 0 || row >= INTERIOR_ROWS) return true
      const isBorder = row === 0 || col === 0 || row === INTERIOR_ROWS - 1 || col === INTERIOR_COLS - 1
      if (isBorder) return true
      const d = INTERIOR_DESK
      if (col >= d.c0 && col <= d.c1 && row >= d.r0 && row <= d.r1) return true
      // Populated for home/hideout buildings only (blockHomePropFootprint,
      // via buildGenericInteriorZone's fresh-per-load reset) - every other
      // building in this bucket (bank/realEstateAgency/jail/etc.) never
      // touches this field, so it stays an empty Set and this is a no-op.
      if (this.interiorBlockedTiles?.has(`${col},${row}`)) return true
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
    if (this.isBuildingSolidTile(col, row)) return true
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
  // physically at this building", not just narrating it. `slot` is optional
  // (omitting it returns the bare center-door pixel, used by
  // teleportToCity/spawn code that has no per-character concept); when
  // given, it's one of assignDoorSlots' arcSlotOffset results, spreading
  // that character out from whoever else currently shares this building so
  // multiple roamers converging on one door don't stack.
  buildingDoorPixel(buildingId, slot) {
    const b = FINANCE_BUILDINGS.find((bd) => bd.id === buildingId)
    if (!b) return null
    const base = {
      x: ((b.tiles.c0 + b.tiles.c1 + 1) / 2) * TILE_SIZE,
      y: (b.tiles.r1 + 1) * TILE_SIZE + TILE_SIZE / 2,
    }
    if (!slot) return base
    return { x: base.x + slot.x, y: base.y + slot.y }
  }

  // Resolves every named roamer's current-block and next-block buildingId
  // from worldPresenceEngine.js (the same single source of truth the text
  // modals read) and caches the pair, keyed by characterId. Called on block
  // change and on a throttle (see PRESENCE_RESOLVE_INTERVAL_MS in
  // updateNamedRoamers) rather than every frame - resolving all 88
  // characters twice (current + next block) is cheap at that cadence but
  // wasteful at 60fps. Also (re-)runs assignDoorSlots per resolve for the
  // current-block and next-block buildingId sets independently, so a
  // roamer's current-door slot and next-door slot are each sized to
  // whoever's actually sharing THAT building, not two people who happen to
  // share a next-building but not a current one (or vice versa) fighting
  // over the same slot index.
  refreshPresenceCache() {
    if (!this.namedRoamers.length) return
    const store = useGameStore.getState()
    const worldClock = store.worldClock || { day: 1, timeBlockIndex: 0 }
    const upcoming = nextTimeBlock(worldClock.day, worldClock.timeBlockIndex)
    const ids = this.namedRoamers.map((r) => r.agent.id)
    const baseCtx = { runSeed: store.runSeed, wantedLevel: store.wantedLevel }
    const currentPresence = simulateWorldPresence(ids, { ...baseCtx, day: worldClock.day, timeBlockIndex: worldClock.timeBlockIndex })
    const nextPresence = simulateWorldPresence(ids, { ...baseCtx, day: upcoming.day, timeBlockIndex: upcoming.timeBlockIndex })
    const currentSlots = assignDoorSlots(ids.map((id, i) => ({ characterId: id, buildingId: currentPresence[i].buildingId })))
    const nextSlots = assignDoorSlots(ids.map((id, i) => ({ characterId: id, buildingId: nextPresence[i].buildingId })))
    const cache = new Map()
    for (let i = 0; i < ids.length; i++) {
      const standoff = NAMED_ROAMER_DOOR_STANDOFF[ids[i]]
      const currentSlot = currentSlots.get(ids[i])
      const nextSlot = nextSlots.get(ids[i])
      cache.set(ids[i], {
        currentBuildingId: currentPresence[i].buildingId,
        nextBuildingId: nextPresence[i].buildingId,
        action: currentPresence[i].action,
        currentSlot: standoff && currentSlot ? { ...currentSlot, x: currentSlot.x + standoff.x, y: currentSlot.y + standoff.y } : currentSlot,
        nextSlot: standoff && nextSlot ? { ...nextSlot, x: nextSlot.x + standoff.x, y: nextSlot.y + standoff.y } : nextSlot,
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
    // How many A* searches this frame is allowed to run across all roamers
    // (see stepRoamerToward). A presence refresh retargets many of the 88 at
    // once; capping keeps that from landing as a single-frame hitch, and a
    // roamer that misses its slot just keeps walking and paths a frame later.
    this.roamerPathBudget = 6
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

    for (const roamer of this.namedRoamers) {
      if (roamer.dead) continue
      const presence = this.presenceCache.get(roamer.agent.id)
      roamer.currentAction = presence?.action || ''
      // worldPresenceEngine.js guarantees buildingId is always a real
      // building id (home_<id> or one of the 10 hand-authored ones), so
      // doorA/doorB should always resolve - the final else branch is
      // defensive only, for a roster id that somehow has no disposition.
      const doorA = presence ? this.buildingDoorPixel(presence.currentBuildingId, presence.currentSlot) : null
      const doorB = presence ? this.buildingDoorPixel(presence.nextBuildingId, presence.nextSlot) : null
      const traveling = doorA && doorB && presence?.currentBuildingId !== presence?.nextBuildingId
      // Whichever slot is actually driving the seek target right now (see
      // dest/doorB selection below) also drives the label's vertical
      // stagger, so a roamer's name tag moves with them rather than
      // snapping between two different offsets while they walk.
      const activeSlot = traveling ? presence?.nextSlot : presence?.currentSlot
      roamer.labelDy = activeSlot?.labelDy ?? 26

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
      // Routes around buildings when the straight line is blocked - see
      // stepRoamerToward / findRoamerPath. Previously a plain straight-line
      // seek, which is what let a roamer press into a wall indefinitely
      // whenever its target sat behind a building.
      const seekTo = (target) => ({ pos: this.stepRoamerToward(roamer, target, stepPx) })

      let rawPos = { x: roamer.actor.x, y: roamer.actor.y }
      let onFoot = true

      if (!traveling) {
        roamer.travelPhase = null
        const dest = doorA || doorB
        if (dest) {
          const tier = doorA ? getDisposition(roamer.agent.id)?.tier : null
          if (!roamer.paceProfile) roamer.paceProfile = paceProfileFor(roamer.agent.id, tier)
          // A mid-block presence refresh (PRESENCE_RESOLVE_INTERVAL_MS) can
          // reassign this roamer to a different building without ever
          // passing through `traveling` (e.g. wantedLevel swings who's
          // "currently" here) - stale pacing state pointing at the OLD
          // building's vicinity would walk them toward a target near the
          // wrong door, so drop it whenever the resting building changes.
          if (roamer.paceRestBuildingId !== presence.currentBuildingId) {
            roamer.paceRestBuildingId = presence.currentBuildingId
            roamer.paceState = null
            roamer.paceTimer = null
          }
          // Resolved once per roamer per frame (cheap - same category of
          // lookup as getDisposition/npcVehicleFor just above/below) rather
          // than cached, since which building counts as "home" never changes
          // but which building they're CURRENTLY resting at does.
          const homeDef = getHomeBuildingDef(roamer.agent.id)
          const homeDoorPixel = homeDef ? this.buildingDoorPixel(homeDef.id) : null
          const atHome = homeDef ? presence.currentBuildingId === homeDef.id : true
          const paceTarget = advanceRoamerPacing(this, roamer, dest, delta, homeDoorPixel, atHome)
          if (paceTarget) {
            // Mid pacing round-trip (walking out / lingering / walking
            // back) - reuses the exact same seekTo step-and-arrive used for
            // door-to-door travel below, just with a short local
            // destination instead of a different building's door.
            rawPos = seekTo(paceTarget).pos
          } else {
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
            const drift = doorA ? idleDriftOffset(roamer.agent.id, this.agentClock, tier, activeSlot?.crowded) : { x: 0, y: 0 }
            rawPos = seekTo({ x: dest.x + drift.x, y: dest.y + drift.y }).pos
          }
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
        // Real door-to-door travel supersedes any in-progress local pacing
        // round trip - drop it so arriving at the new building starts fresh
        // (paceRestBuildingId reset forces a re-check next !traveling tick).
        roamer.paceState = null
        roamer.paceRestBuildingId = null
        rawPos = seekTo(doorB).pos
      }
      roamer.inCar = !onFoot
      // Named roamers now push against building collision the same way the
      // player does (isBuildingSolidTile - exact tile membership, no
      // padding), but resolved as an axis-separated slide rather than
      // resolveOpenPosition's "snap to nearest padded edge" used by
      // wanderActor. That nearest-edge snap is fine for wanderActor's tiny,
      // randomly-re-rolled steps, but fighting it every frame against a
      // roamer's constant-speed seek toward a stationary, possibly-distant
      // door target (or a small idle drift near that door) is what
      // previously read as shaking in place or a permanent stall (reported
      // against both buildings and a parked car): the closest-edge choice
      // can flip between two edges frame to frame right at a corner, and
      // each snap-back gets immediately re-approached by the next frame's
      // seek. Axis separation - try the full (x,y) step, and if that lands
      // on a solid tile, try x-only and y-only independently - only ever
      // clamps forward progress on the blocked axis (never teleports the
      // sprite backward), so a roamer walking past a building's corner
      // slides along its face instead of vibrating, and a roamer whose
      // drift/pace target dips into a wall just stops at the edge instead
      // of snapping. Doors themselves sit one full tile below their
      // building's footprint (buildingDoorPixel), so this never blocks a
      // roamer from reaching or standing at its own door. Trees/rocks are
      // no longer solid for anyone (see scatterEnvironment) so they're not
      // a factor here either way.
      const prevX = roamer.actor.x
      const prevY = roamer.actor.y
      let x = rawPos.x
      let y = rawPos.y
      const tileAt = (px, py) => this.isBuildingSolidTile(Math.floor(px / TILE_SIZE), Math.floor(py / TILE_SIZE))
      // Only guard a roamer that is currently STANDING somewhere legal. If it
      // is already inside a footprint (spawned there, or a building's padded
      // overflow grew over where it was resting), every candidate position is
      // solid too, so the guard below would pin it there permanently - which
      // is exactly how siegel/remus ended up frozen inside a building with no
      // way out. While inside, movement is left unguarded so pathfinding can
      // walk it back out; the guard resumes as soon as it is clear.
      if (!tileAt(prevX, prevY) && tileAt(x, y)) {
        const xBlocked = tileAt(x, prevY)
        const yBlocked = tileAt(prevX, y)
        x = xBlocked ? prevX : x
        y = yBlocked ? prevY : y
        // Neither axis alone clears it either (walked straight into a wall
        // with no open slide direction) - hold the previous position rather
        // than committing a still-solid combined point. Pathing normally
        // avoids this; the stuck timer below re-routes if it happens anyway.
        if (xBlocked && yBlocked) {
          x = prevX
          y = prevY
        }
      }
      const dx = x - roamer.actor.x
      const dy = y - roamer.actor.y
      const movedDist = Math.abs(dx) + Math.abs(dy)
      // Last-resort unstick. Pathing should prevent this, but a roamer can
      // still end up pinned - e.g. spawned inside a footprint, or a target
      // that genuinely has no route - and the old failure mode was to press
      // into the wall silently forever. Standing still while holding a real
      // target means the current route is not working, so throw it away and
      // let the next frame search again from where it actually is.
      if (doorA || doorB) {
        if (movedDist < 0.05) {
          roamer.stuckMs = (roamer.stuckMs || 0) + delta
          if (roamer.stuckMs > 500) {
            roamer.path = null
            roamer.pathGoalKey = null
            roamer.stuckMs = 0
          }
        } else {
          roamer.stuckMs = 0
        }
      }
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

      // Name floats above the sprite; no action text, just the name.
      const wanted = roamer.character.name
      if (roamer.label.text !== wanted) roamer.label.setText(wanted)
      roamer.label.setPosition(x, y - (roamer.labelDy ?? 26))
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
    const npcs = generateAmbientNpcs('finance_ambient', 6)
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
      // Floating name tag, same style/convention named roamers use
      // (spawnNamedRoamers) - these 6 are the team's own names
      // (Tah/Jeff/Ince/Franc/Poom/Tan, see npcGenerator.js), so they read as
      // named characters visually too, not anonymous wander filler. Fixed
      // labelDy of 26 (the solo/no-crowding case named roamers use) is
      // correct here - these 6 never converge at a shared door the way
      // named roamers can, so there's no group to fan out a wider ring for.
      actor.label = this.add
        .text(actor.x, actor.y - 26, npc.name, {
          fontFamily: 'monospace',
          fontSize: '9px',
          color: '#ffe066',
          align: 'center',
          stroke: '#000000',
          strokeThickness: 3,
        })
        .setOrigin(0.5, 1)
        .setDepth(actor.y + 500)
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

  // Map overhaul Phase 3: cluster anchors (and every per-animal spot within
  // a cluster) are now constrained to FINANCE_FARM_ZONE, the bottom-right
  // reservation computed by layoutFinanceMap - habitat animals no longer
  // scatter across the whole map. Tree/rock bias still applies (see below)
  // but `treeTiles` itself is pre-filtered to the farm zone, so the bias only
  // ever points at a tree/rock that's already inside it.
  spawnHabitatAnimals() {
    const zone = FINANCE_FARM_ZONE
    const treeTiles = []
    for (const key of this.blockedEnvironmentTiles) {
      const [r, c] = key.split(',').map(Number)
      if (r >= zone.r0 && r <= zone.r1 && c >= zone.c0 && c <= zone.c1) treeTiles.push({ r, c })
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
          r = zone.r0 + Math.floor(Math.random() * (zone.r1 - zone.r0 + 1))
          c = zone.c0 + Math.floor(Math.random() * (zone.c1 - zone.c0 + 1))
        }
        if (r < zone.r0 || r > zone.r1 || c < zone.c0 || c > zone.c1) continue
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
          if (rr < zone.r0 || rr > zone.r1 || cc < zone.c0 || cc > zone.c1) continue
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

  // Map overhaul Phase 3: no longer searches adjacent to a specific home's
  // footprint - wealthy characters' homes ended up wherever their
  // residentialStyleKey put them (top or bottom band), unrelated to where
  // their pet pen should visually group up. Pens now all live together in
  // FINANCE_FARM_ZONE, so this just scans that zone's own grid, top-left to
  // bottom-right, for the first open (grass, not a building/other-pen/
  // scattered-tree) WxH rectangle - `usedPenTiles` accumulates across calls
  // (see spawnWealthyPetPens), so successive pens naturally pack left-to-
  // right/top-to-bottom within the zone instead of colliding.
  findPenSpot(zone, w, h, buildingTileSet, usedPenTiles) {
    for (let r0 = zone.r0; r0 + h - 1 <= zone.r1; r0++) {
      for (let c0 = zone.c0; c0 + w - 1 <= zone.c1; c0++) {
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
    }
    return null
  }

  // The "exotic pets as a wealth flex" detail: a small, fixed number of the
  // wealthiest characters (by the SAME billionaire signal tileGen.js's
  // packFacadeFor uses for the stone-cottage tier - see WEALTH_STONE_THRESHOLD)
  // get a small fenced pen with 1-2 animals wandering only inside it.
  // Deliberately capped at PET_PEN_COUNT - this is flavor for a handful of
  // the richest characters, not a mechanic for all 88 homes. Map overhaul
  // Phase 3: all pens now group together in FINANCE_FARM_ZONE (bottom-right
  // corner of the map) instead of sitting next to each character's own home
  // - which home band (top/bottom) that character's home ended up in no
  // longer has any bearing on where their pen is.
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

    // Loops `wealthyHomes.length` times (not `for...of` over the array) since
    // the per-character home/building is no longer read inside the loop at
    // all - only the count of qualifying wealthy characters matters now that
    // pens are placed independently of any specific home (see findPenSpot).
    for (let i = 0; i < wealthyHomes.length; i++) {
      const spot = this.findPenSpot(FINANCE_FARM_ZONE, PET_PEN_W, PET_PEN_H, buildingTileSet, usedPenTiles)
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

  // Publishes how many NPCs are currently close enough to the player to
  // plausibly witness a street crime (see useGameStore's nearbyWitnesses -
  // applyCrimeOutcome reads it when a caller opts into checkWitnesses).
  // Counts police chasers, ambient pedestrians, and named roamers alike -
  // "someone noticed" doesn't care which kind of someone. Ambient NPCs and
  // roamers already carry a `dead` flag once killed; a dead one obviously
  // can't witness anything.
  updateNearbyWitnesses(delta) {
    this.witnessCheckTimer += delta
    if (this.witnessCheckTimer < WITNESS_CHECK_INTERVAL_MS) return
    this.witnessCheckTimer = 0
    const px = this.playerActor.x
    const py = this.playerActor.y
    let count = 0
    for (const chaser of this.policeChasers) {
      if (!chaser.dead && Phaser.Math.Distance.Between(px, py, chaser.actor.x, chaser.actor.y) < WITNESS_RADIUS_PX) count++
    }
    for (const actor of this.financeAmbientActors) {
      if (!actor.dead && Phaser.Math.Distance.Between(px, py, actor.x, actor.y) < WITNESS_RADIUS_PX) count++
    }
    for (const roamer of this.namedRoamers) {
      if (!roamer.dead && Phaser.Math.Distance.Between(px, py, roamer.actor.x, roamer.actor.y) < WITNESS_RADIUS_PX) count++
    }
    useGameStore.getState().setNearbyWitnesses(count)
  }

  // Ticks every 9s (this.policeTimer, set up in create()) while wantedLevel
  // > 0. Used to open the encounter modal directly; now it spawns a real
  // patrol NPC that has to physically walk over and catch the player
  // (updatePoliceChasers below does the actual pursuit + contact check) -
  // "police ambush you" reads very differently when you can see them
  // coming and have a real chance to duck away before they arrive.
  maybeSpawnPolice() {
    if (!this.bridge) return
    if (this.currentZoneId !== 'overworld') return
    const state = useGameStore.getState()
    if (!state.player.alive) return
    if (state.wantedLevel <= 0) {
      // Heat cleared (bribed off, served time, etc.) since the last chaser
      // spawned - whoever's still out looking gives up rather than lingering
      // as a pursuit nobody can now trigger a resolution for.
      if (this.policeChasers.length) this.despawnPoliceChasers()
      return
    }
    if (this.policeChasers.length >= Math.min(MAX_POLICE_CHASERS, state.wantedLevel)) return
    if (Math.random() > 0.4) return
    this.spawnPoliceChaser(state.wantedLevel)
  }

  // Finds an open tile on a ring around the player (see
  // POLICE_SPAWN_MIN/MAX_RADIUS_PX) so a new chaser appears "closing in from
  // off-screen" rather than teleporting in point-blank or from across the
  // map. Falls back to null if 24 tries all land on solid ground (dense
  // building clusters, map edge) - the caller just skips that spawn tick.
  findPoliceSpawnSpot() {
    const px = this.playerActor.x
    const py = this.playerActor.y
    for (let tries = 0; tries < 24; tries++) {
      const angle = Math.random() * Math.PI * 2
      const radius = POLICE_SPAWN_MIN_RADIUS_PX + Math.random() * (POLICE_SPAWN_MAX_RADIUS_PX - POLICE_SPAWN_MIN_RADIUS_PX)
      const x = px + Math.cos(angle) * radius
      const y = py + Math.sin(angle) * radius
      const col = Math.floor(x / TILE_SIZE)
      const row = Math.floor(y / TILE_SIZE)
      if (col < 0 || col >= MAP_COLS || row < 0 || row >= this.financeLayout.length) continue
      if (this.isBlockedTile(col, row)) continue
      return { x: col * TILE_SIZE + TILE_SIZE / 2, y: row * TILE_SIZE + TILE_SIZE / 2 }
    }
    return null
  }

  // wantedLevel 4-5 ("FBI-grade" heat) spawns a Tactical Officer label
  // instead of a beat cop - cosmetic for now (same walk sprite/speed either
  // way, since there's no separate FBI walk-cycle sheet), but the flag rides
  // along in financePoliceEncounter's payload so the Talk/Fight rework
  // (later tasks) can have the encounter actually respond like the agency
  // implied by the label, not just the generic "police" persona.
  spawnPoliceChaser(wantedLevel) {
    const spot = this.findPoliceSpawnSpot()
    if (!spot) return
    const isFBI = wantedLevel >= 4
    const palette = { skin: '#e0c090', hair: '#1a1a1a', outfit: '#1f2b4a' }
    const actor = new SpriteActor(this, spot.x, spot.y, 'npc_police', palette)
    const label = this.add
      .text(spot.x, spot.y - 26, isFBI ? 'FBI Agent' : 'Officer', {
        fontFamily: 'monospace',
        fontSize: '9px',
        color: '#8fd3ff',
        align: 'center',
        stroke: '#000000',
        strokeThickness: 3,
      })
      .setOrigin(0.5, 1)
    this.policeChasers.push({ actor, label, isFBI, path: null, pathGoalKey: null, dead: false })
  }

  despawnPoliceChasers() {
    for (const chaser of this.policeChasers) {
      chaser.actor.destroy()
      chaser.label.destroy()
    }
    this.policeChasers = []
  }

  // Steps every active chaser toward the player's current position (same
  // A*-with-line-of-sight seek roamers use, see stepRoamerToward) and fires
  // the actual stop-and-search the instant one gets within
  // POLICE_ARREST_RADIUS_PX. Mirrors updateNamedRoamers' axis-separated
  // building-collision guard so a chaser slides along a wall it's cutting
  // the corner of instead of vibrating against it, but skips all of that
  // function's door/pacing/car machinery - a chaser has exactly one
  // destination (the player) for its entire lifetime.
  updatePoliceChasers(delta) {
    if (!this.policeChasers.length) {
      useGameStore.getState().setPoliceWarning(null)
      return
    }
    // Namedroamers/ambient NPCs are deliberately still animated while a
    // modal is open (see update()'s interactionLocked early-return further
    // down) so the world doesn't visibly freeze - but a chaser's contact
    // check has a real side effect (opening a SECOND encounter on top of
    // whichever one is already up), so this one genuinely has to pause.
    if (this.interactionLocked) return
    const stepPx = POLICE_CHASE_SPEED_PX_PER_SEC * (delta / 1000)
    const px = this.playerActor.x
    const py = this.playerActor.y
    const tileAt = (qx, qy) => this.isBuildingSolidTile(Math.floor(qx / TILE_SIZE), Math.floor(qy / TILE_SIZE))
    // Tracks the closest chaser this tick so the HUD warning (see
    // POLICE_WARNING_RADIUS_PX) reflects whoever's actually nearest, not
    // just whichever chaser happens to iterate first below.
    let nearestDist = Infinity
    let nearestIsFBI = false
    for (const chaser of this.policeChasers) {
      if (chaser.dead) continue
      const prevX = chaser.actor.x
      const prevY = chaser.actor.y
      const raw = this.stepRoamerToward(chaser, { x: px, y: py }, stepPx)
      let x = raw.x
      let y = raw.y
      if (!tileAt(prevX, prevY) && tileAt(x, y)) {
        const xBlocked = tileAt(x, prevY)
        const yBlocked = tileAt(prevX, y)
        x = xBlocked ? prevX : x
        y = yBlocked ? prevY : y
        if (xBlocked && yBlocked) {
          x = prevX
          y = prevY
        }
      }
      const dx = x - prevX
      const dy = y - prevY
      chaser.actor.sprite.setPosition(x, y)
      chaser.actor.setMoving(true)
      if (Math.abs(dx) > Math.abs(dy)) chaser.actor.setFacing(dx > 0 ? 'right' : 'left')
      else if (dy !== 0) chaser.actor.setFacing(dy > 0 ? 'down' : 'up')
      chaser.actor.update(delta)
      chaser.label.setPosition(chaser.actor.x, chaser.actor.y - 26)
      chaser.label.setDepth(chaser.actor.y + 500)

      const dist = Phaser.Math.Distance.Between(px, py, chaser.actor.x, chaser.actor.y)
      if (dist < nearestDist) {
        nearestDist = dist
        nearestIsFBI = chaser.isFBI
      }
      if (dist < POLICE_ARREST_RADIUS_PX) {
        this.triggerPoliceArrestEncounter(chaser.isFBI)
        return
      }
    }
    useGameStore.getState().setPoliceWarning(
      nearestDist < POLICE_WARNING_RADIUS_PX ? { isFBI: nearestIsFBI } : null
    )
  }

  triggerPoliceArrestEncounter(isFBI) {
    if (!this.bridge) return
    const state = useGameStore.getState()
    if (!state.player.alive) return
    // The encounter modal takes over resolving this pursuit (bribe/talk/
    // fight/escape) - whether it clears wantedLevel or not, whoever caught
    // up has done their job, and a fresh spawn roll on the next timer tick
    // is what puts new pressure on the player, not a leftover chaser still
    // standing on top of them when the modal closes.
    this.despawnPoliceChasers()
    this.pauseForModal()
    this.bridge.emit('financePoliceEncounter', { wantedLevel: state.wantedLevel, isFBI })
  }

  pauseForModal() {
    this.tileMover.locked = true
    this.playerActor.setMoving(false)
    this.interactionLocked = true
  }

  resumeFromModal() {
    this.interactionLocked = false
    this.heavySimSuspended = false
    // Only set by enterHubWithWalkIn below - every other pauseForModal()
    // call site never faded the camera out, so this only ever fires the fade
    // BACK in for the one flow that faded out in the first place.
    if (this._fadedForModal) {
      this._fadedForModal = false
      this.cameras.main.fadeIn(240, 0, 0, 0)
    }
  }

  // Underworld/Casino open their own walkable interior INSIDE a React
  // modal now (UnderworldMapScene.jsx/CasinoMapScene.jsx), not a Phaser
  // walk-in room - see triggerInteraction's straight-to-modal comment. But
  // an instant modal popup while the overworld player sprite just stands
  // frozen at the door reads as "a menu opened", not "I walked inside" -
  // per the user's own explicit complaint after playing it. This plays a
  // short, PURELY COSMETIC step-through-the-door beat first: face up, tween
  // half a tile forward (into the doorway the building's own facade art
  // already draws), fade the camera to black, then open the modal once the
  // screen is actually dark - so the modal's own walkable scene is the
  // first thing you see AFTER visibly walking in, not a popup over your
  // still-outside self. The tween deliberately bypasses tileMover/collision
  // entirely (this is a scripted beat the game itself is playing, not a
  // player-directed move, and the building's footprint tiles are normally
  // solid) and the sprite snaps back to its exact starting tile the instant
  // the screen goes black, before the modal ever opens - so the persisted
  // overworld position is untouched and stepping back out through the same
  // door next time looks identical. resumeFromModal (above) fades the
  // camera back in once the modal closes.
  enterHubWithWalkIn(id) {
    this.interactionLocked = true
    const actor = this.playerActor
    const startY = actor.sprite.y
    const stepPx = TILE_SIZE * 0.55
    actor.setFacing('up')
    actor.setMoving(true)
    this.tweens.add({
      targets: actor.sprite,
      y: startY - stepPx,
      duration: 260,
      ease: 'Sine.easeIn',
      onComplete: () => {
        actor.setMoving(false)
        this.cameras.main.fadeOut(240, 0, 0, 0)
        this.cameras.main.once('camerafadeoutcomplete', () => {
          actor.sprite.setPosition(actor.sprite.x, startY)
          this._fadedForModal = true
          this.pauseForModal()
          // These two hubs open onto a real, player-controlled walkable
          // scene of their own (UnderworldMapScene.jsx/CasinoMapScene.jsx) -
          // a DOM rAF loop moving a sprite in real time, on TOP of this
          // still-running Phaser canvas. update()'s own named-roamer/
          // ambient-NPC/habitat-animal simulation is deliberately left
          // running through an ordinary modal (see that method's comment -
          // the backdrop is translucent, so the world stays visibly, if
          // dimly, alive behind it) but that background work - up to 88
          // roamers doing A* pathing every frame - was competing directly
          // with the DOM loop for main-thread time, and it's why walking
          // inside either hub read as laggy/barely-moving: real elapsed
          // time between the DOM loop's rAF frames balloons, but its dt is
          // clamped (see WALK_SPEED usage in either scene file), so the
          // player's average speed craters instead of just looking choppy.
          // Suspending it for exactly this one case - not interactionLocked
          // generally, which would also mute the "world stays alive" effect
          // behind every other modal in the game - fixes the walk without
          // touching that design elsewhere. Cleared in resumeFromModal().
          this.heavySimSuspended = true
          this.bridge.emit('interact', { type: 'building', id })
        })
      },
    })
  }

  removeFinanceAmbientNpc(npcId) {
    const actor = this.financeAmbientActors.find((a) => a.npcId === npcId)
    if (actor) {
      actor.dead = true
      actor.sprite.setVisible(false)
      actor.label.setVisible(false)
    }
  }

  findNearbyFinanceAmbientNpc() {
    const px = this.playerActor.x
    const py = this.playerActor.y
    return this.financeAmbientActors.find((a) => !a.dead && Phaser.Math.Distance.Between(px, py, a.x, a.y) < 26)
  }

  updateAllAmbientNpcs(delta) {
    for (const actor of this.financeAmbientActors) {
      if (!actor.dead) {
        wanderActor(this, actor, delta)
        actor.label.setPosition(actor.x, actor.y - 26)
        actor.label.setDepth(actor.y + 500)
      }
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
      // keeps every pre-existing exit behaving exactly as before. `spawn`
      // (lisaRoomZone's doors/stairs/board) overrides loadZone's own
      // per-zoneId default so arriving via a specific door/stair/board lands
      // the player next to whichever one was actually used - see
      // pendingInteriorSpawn's own comment in the constructor.
      const target = zone.target || 'overworld'
      if (zone.spawn) this.pendingInteriorSpawn = zone.spawn
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
      // The 3 remaining Phase-2/4 consolidated hubs (Business Center/
      // Government Building/Industrial Zone) are multi-tenant tabbed React
      // modals, not a walk-in interior - same pattern as trainStation above:
      // open the modal straight from the overworld footprint, no interior
      // zone load. foodCourt (header cleanup pass) joins this list for the
      // same reason - it routes straight to InteractiveLocationModal via
      // WorldScreen.jsx's BUILDING_TO_INTERACTIVE_LOCATION intercept, not a
      // generic walk-in interior. wharf (Cast & Reel fishing) joins for the
      // same reason too, but routes to a bespoke WharfModal instead - see
      // WorldScreen.jsx's `activeModal.id === 'wharf'` case. entertainmentComplex
      // (Concert Hall/Sports Stadium) joins the same way, routing to
      // EntertainmentComplexModal. Underworld REJOINED this list - it used
      // to be a real walk-in interior (the bare-box underworldInterior room
      // below, the first tabbed hub to get one), but UnderworldModal now
      // opens its own walkable hub (UnderworldMapScene.jsx, the real
      // reference-art cutaway with a proper 'Enter room' interaction) as its
      // default 'map' tab, so front-door entry goes straight to the modal
      // exactly like these other hubs rather than making the player walk
      // twice (once out here, once again inside a second bare room). The
      // underworldInterior zone/its 6 desks are NOT deleted - they're still
      // exactly how enterUnderworldFromJail (below) lands the jail-tunnel
      // escape beat, unchanged.
      // Casino joins for the exact same reason Underworld did: it used to
      // load its own bespoke bare-box casinoInterior zone (a flat pink
      // "Casino Floor" prop, buildCasinoInteriorZone - deleted outright, not
      // kept dormant like underworldInterior, since nothing else ever
      // re-enters it) via a dedicated `if (zone.id === 'casino')` branch
      // that used to sit further down where the stockExchange/casino
      // special-cases below now only have stockExchange left. CasinoModal
      // now opens its own walkable floor (CasinoMapScene.jsx, the real
      // reference-art cutaway) as the first thing it shows, with the actual
      // game-picker tab bar reached by walking up to the 777 machine and
      // pressing Enter/E - so front-door entry goes straight to the modal
      // here too, same shape as Underworld, at the user's explicit request.
      // inceHome deliberately does NOT join this
      // list - it's a house, not a hub, so it should feel like one: walking
      // up to it enters a real walk-in interior (the generic buildingInterior
      // fallback further down, same as any other building with no special
      // case here) and IncModal only opens once you reach the desk inside
      // (buildGenericInteriorZone's interiorDesk emits
      // `{type:'building', id:'inceHome', npcId: building.npcId}` - see
      // WorldScreen.jsx's `activeModal.id === 'inceHome'` case).
      if (
        zone.id === 'businessCenter' ||
        zone.id === 'governmentBuilding' ||
        zone.id === 'industrialZone' ||
        zone.id === 'foodCourt' ||
        zone.id === 'wharf' ||
        zone.id === 'entertainmentComplex'
      ) {
        this.pauseForModal()
        this.bridge.emit('interact', { type: 'building', id: zone.id })
        return
      }
      // Underworld/Casino get the walk-through-the-door beat (see
      // enterHubWithWalkIn's own header comment) instead of the instant
      // pauseForModal()+emit every other straight-to-modal hub above uses -
      // their modals both open onto a real walkable interior scene
      // (UnderworldMapScene.jsx/CasinoMapScene.jsx), so it's worth the extra
      // beat to actually walk in first, rather than a scene worth walking
      // around in appearing as an abrupt popup over your still-outside self.
      if (zone.id === 'underworld' || zone.id === 'casino') {
        this.enterHubWithWalkIn(zone.id)
        return
      }
      // Court & Prison: walking up while free is a flavor no-op, never a
      // real entrance (see WorldScreen.jsx's courtAndPrison interact
      // handler) - joins the list above so it never falls into the generic
      // walk-in interior below. The real jailCell room is only ever entered
      // via the 'enterJail' bridge event on arrest (buildJailCellZone).
      if (zone.id === 'courtAndPrison') {
        this.pauseForModal()
        this.bridge.emit('interact', { type: 'building', id: zone.id })
        return
      }

      const building = FINANCE_BUILDINGS[zone.uid] || FINANCE_BUILDINGS.find((b) => b.id === zone.id)
      
      if (zone.id === 'stockExchange') {
        this.overworldReturnSpawn = {
          col: Math.round((building.tiles.c0 + building.tiles.c1) / 2),
          row: building.tiles.r1 + 1,
        }
        this.loadZone('stockExchangeInterior')
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
      // Lisa's home gets the bespoke two-room interior (buildLisaHallZone/
      // buildLisaWorkZone) instead of the generic single-room fallback below
      // - same overworldReturnSpawn-then-loadZone shape every other special-
      // cased entry above uses, just landing on 'lisaHall' (the ground
      // floor) rather than 'buildingInterior'.
      if (zone.id === 'home_lisa') {
        this.loadZone('lisaHall')
        return
      }
      // Every other character home/hideout (the 87 characterHomeBuildings.js
      // entries) gets the bespoke per-wealth-tier room (buildHomeInteriorZone)
      // instead of the generic single-room fallback below - see that
      // method's own header for why buildGenericInteriorZone/drawInteriorRoom's
      // "Study"/"Back Room" desk box is now dead code for these specifically.
      // inceHome deliberately has no `kind` field (she isn't in the roster
      // wealth-tier system at all - see its own def comment), so this check
      // is false for her and she correctly keeps the generic room untouched.
      if (building.kind === 'home' || building.kind === 'hideout') {
        this.currentInteriorBuildingId = zone.id
        this.loadZone(HOME_ROOM_STYLES[homeInteriorStyleFor(building)].zoneId)
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
      // buildingId is where worldPresenceEngine currently has this roamer -
      // LisaModal uses it to pick a conversation backdrop that matches where
      // she actually is. Harmless for every other roamer (NamedNpcModal
      // ignores it).
      this.bridge.emit('interact', {
        type: 'building',
        id: 'namedRoamer',
        npcId: zone.roamer.agent.id,
        buildingId: this.presenceCache.get(zone.roamer.agent.id)?.currentBuildingId,
      })
    } else if (zone.type === 'financeAmbientNpc') {
      this.bridge.emit('interact', { type: 'ambientNpc', npcId: zone.npcRef.npcId, npcName: zone.npcRef.npcName })
    } else if (zone.type === 'jailMazeCheckpoint') {
      this.bridge.emit('interact', { type: 'jailMazeCheckpoint', segmentIndex: zone.segmentIndex })
    } else if (zone.type === 'underworldDesk') {
      // Deliberately its own zone.type rather than reusing 'interiorDesk'
      // (which emits `id: zone.id` verbatim): 'blackMarket'/'callCenterOps'/
      // 'crimeAlley' are already live keys in DISTRICT_BUILDING_IDS
      // (districtBuildings.js), so a desk literally named one of those would
      // ALSO match WorldScreen.jsx's DistrictBuildingModal branch and pop a
      // second, bare modal alongside the real tabbed UnderworldModal - the
      // exact "two conditions match one activeModal" bug this file's own
      // Crime Alley comment already documents having been hit and fixed
      // once before. Always emits the literal building id 'underworld' plus
      // which tab this desk should open to.
      this.bridge.emit('interact', { type: 'building', id: 'underworld', initialTab: zone.initialTab })
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

    // Skipped only while heavySimSuspended (Underworld/Casino's walkable DOM
    // hub - see enterHubWithWalkIn's own comment on why). Every other modal
    // in the game leaves these running on purpose, so gate on that flag
    // specifically, not interactionLocked - which is true for every modal.
    if (!this.heavySimSuspended) {
      this.updateAllAmbientNpcs(delta)
      this.updateHabitatAnimals(delta)
      if (this.currentZoneId === 'overworld') this.updateNamedRoamers(delta)
    }
    if (this.currentZoneId === 'overworld') this.updatePoliceChasers(delta)
    if (this.currentZoneId === 'overworld') this.updateNearbyWitnesses(delta)

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
