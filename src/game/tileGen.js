import {
  PACK_SHEET_KEYS,
  preloadPacks,
  drawNineSliceFacade,
  drawPeakedCottage,
  drawPrefabFacade,
  drawPrefabImageFacade,
  drawFencePen,
  placePackProp,
  prefabTileWorldPos,
  preloadSereneVillageDoor,
  USE_KENNEY_PACKS,
} from './packs/packRender'
import { MODERN_CITY } from './packs/modernCityTiles'
import { TINY_TOWN } from './packs/tinyTownTiles'
import { RPG_URBAN } from './packs/rpgUrbanTiles'
import { PICO8_CITY } from './packs/pico8CityTiles'
import { SERENE_VILLAGE_HOMES } from './packs/sereneVillageTiles'
import { getAnyCharacter } from '../features/agents/characterLookup'
import { cuteTerrainReady, buildCuteTerrainOverlay, cuteTreesReady, drawCuteTree } from './packs/cuteFantasyTerrain'
import { chapelFacadeReady, drawChapelExteriorFacade, CHAPEL_FACADE_TILES } from './interiors/tmxMapExterior'

const USE_PROCEDURAL_GRAPHICS = true;

// Terrain, decoration and building rendering, real architecture (the header
// comment that used to live here described an unrelated, never-shipped
// "cute_fantasy procedural replacement" plan and was stale - this replaces
// it with what the code below actually does).
//
// Two independent, additive gates:
// - USE_KENNEY_PACKS (packs/packRender.js) - real Kenney tile-pack art
//   (kenney_roguelike-modern-city / kenney_tiny-town / kenney_rpg-urban-pack,
//   catalogued in packs/modernCityTiles.js, packs/tinyTownTiles.js,
//   packs/rpgUrbanTiles.js) for building FACADES and TREES specifically.
//   Checked first in placeBuildingFacade/placeTree below; when it applies,
//   procedural drawing for that one thing is skipped.
// - USE_PROCEDURAL_GRAPHICS (this flag) - the base ground/road/water tile
//   grid, flowers/rocks, interiors, and the Tokyo "slate marble"/Kyoto
//   "cobblestone" district ground reskins (drawSlateMarbleTile /
//   drawCobblestoneTile) are ALWAYS drawn this way at runtime with Phaser's
//   Graphics API - there is no tile-pack equivalent wired in for these, and
//   the screen-space vignette overlay (addScreenVignette) is a camera-space
//   lighting effect, not a tile/sprite, so it isn't part of either system.
//
// Net effect: a building drawn via USE_KENNEY_PACKS still sits on
// procedurally-drawn ground. Both flags are additive, not a global
// procedural-vs-asset switch - do not "flip" USE_PROCEDURAL_GRAPHICS off
// expecting an all-asset renderer; nothing currently replaces the ground
// layer.

export function drawSlateMarbleTile(graphics, x, y, size) {
  graphics.fillStyle(0x0a101f, 1)
  graphics.fillRect(x, y, size, size)
  graphics.fillStyle(0x131d36, 1)
  graphics.fillRect(x + 1, y + 1, size - 2, size - 2)
  graphics.fillStyle(0xf59e0b, 0.4)
  graphics.fillRect(x, y, size, 1)
  graphics.fillRect(x, y, 1, size)
}

export function drawCobblestoneTile(graphics, x, y, size) {
  graphics.fillStyle(0x2c2621, 1)
  graphics.fillRect(x, y, size, size)
  graphics.fillStyle(0x423831, 1)
  graphics.fillRect(x + 2, y + 2, size - 4, size - 4)
  graphics.fillStyle(0x854d0e, 0.5)
  graphics.fillRect(x + 4, y + 4, size - 8, 2)
}

// A screen-space radial vignette (dark, transparent-centered canvas texture
// pinned to the camera) - a cheap, standard trick that makes flat 2D scenes
// read as lit/cinematic instead of a uniformly-bright "toy" look.
export function addScreenVignette(scene, width = 640, height = 480) {
  const key = 'screen_vignette'
  if (!scene.textures.exists(key)) {
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    const cx = width / 2
    const cy = height / 2
    const radius = Math.hypot(cx, cy)
    const gradient = ctx.createRadialGradient(cx, cy, radius * 0.55, cx, cy, radius)
    gradient.addColorStop(0, 'rgba(0,0,0,0)')
    gradient.addColorStop(1, 'rgba(0,0,0,0.55)')
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, width, height)
    scene.textures.addCanvas(key, canvas)
  }
  return scene.add
    .image(width / 2, height / 2, key)
    .setScrollFactor(0)
    .setDepth(1000)
}

// ---------------------------------------------------------------------------
// Asset loading (Serene Village & Modern Interiors asset packs)
// ---------------------------------------------------------------------------

const ASSET_BASE = '/assets/cute_fantasy/Cute_Fantasy_Free'
const DECOR_DIR = `${ASSET_BASE}/Outdoor%20decoration`

export const ASSET_KEYS = {
  tileGrass: 'cf_tile_grass',
  tilePath: 'cf_tile_path',
  tileWater: 'cf_tile_water',
  treeBig: 'cf_tree_big',
  treeSmall: 'cf_tree_small',
  decor: 'cf_decor',
  house: 'cf_house',
  modernInteriors: 'modern_interiors',
  modernRoomBuilder: 'modern_room_builder',
  sereneVillage: 'serene_village',
  sereneHouses: 'serene_houses',
  sereneOutside: 'serene_outside',
}

// ---------------------------------------------------------------------------
// Habitat assets (Cute_Fantasy_Free pack) - wood-house wealth-tier variant,
// fenced pet pens, and the small roaming-animal decoration layer. Kept as a
// separate pack from the four Kenney sheets above (own base path, own load
// calls) since it's used piecemeal (one prefab image, one fence spritesheet,
// four animal spritesheets) rather than as a whole facade family.
// ---------------------------------------------------------------------------
const CUTE_FANTASY_BASE = '/assets/packs/Cute_Fantasy_Free'
const CUTE_DECOR_DIR = `${CUTE_FANTASY_BASE}/Outdoor%20decoration`
const CUTE_ANIMALS_DIR = `${CUTE_FANTASY_BASE}/Animals`

export const HABITAT_ASSET_KEYS = {
  houseWood: 'cf_house_wood_blue',
  fences: 'cf_fences',
  chicken: 'cf_animal_chicken',
  cow: 'cf_animal_cow',
  pig: 'cf_animal_pig',
  sheep: 'cf_animal_sheep',
}

// Frame indices into the 4x4 16px Fences.png grid (frame = row*4+col) - see
// drawFencePen's doc comment in packRender.js for how these three were
// picked out of that sheet's actual (non-nine-slice) layout.
const FENCE_PEN_KIT = { post: 12, hRail: 2, vRail: 4 }

// Called from preloadTerrainAssets below, unconditionally (not gated behind
// either USE_KENNEY_PACKS or USE_PROCEDURAL_GRAPHICS - this is a third,
// independent asset source used regardless of which of those two flags is
// set, same reasoning as preloadPacks above it).
function preloadHabitatAssets(scene) {
  if (!scene.textures.exists(HABITAT_ASSET_KEYS.houseWood)) {
    scene.load.image(HABITAT_ASSET_KEYS.houseWood, `${CUTE_DECOR_DIR}/House_1_Wood_Base_Blue.png`)
  }
  if (!scene.textures.exists(HABITAT_ASSET_KEYS.fences)) {
    scene.load.spritesheet(HABITAT_ASSET_KEYS.fences, `${CUTE_DECOR_DIR}/Fences.png`, { frameWidth: 16, frameHeight: 16, spacing: 0, margin: 0 })
  }
  // Each animal file is a confirmed clean 2x2 grid of 32px frames (a short
  // walk cycle) - loaded as a spritesheet so a single frame can be picked
  // for a static pose (see OverworldScene.js's AnimalActor); using it as a
  // plain image would render all 4 poses squished into one 64x64 image.
  const animalFrames = { frameWidth: 32, frameHeight: 32, spacing: 0, margin: 0 }
  if (!scene.textures.exists(HABITAT_ASSET_KEYS.chicken)) scene.load.spritesheet(HABITAT_ASSET_KEYS.chicken, `${CUTE_ANIMALS_DIR}/Chicken/Chicken.png`, animalFrames)
  if (!scene.textures.exists(HABITAT_ASSET_KEYS.cow)) scene.load.spritesheet(HABITAT_ASSET_KEYS.cow, `${CUTE_ANIMALS_DIR}/Cow/Cow.png`, animalFrames)
  if (!scene.textures.exists(HABITAT_ASSET_KEYS.pig)) scene.load.spritesheet(HABITAT_ASSET_KEYS.pig, `${CUTE_ANIMALS_DIR}/Pig/Pig.png`, animalFrames)
  if (!scene.textures.exists(HABITAT_ASSET_KEYS.sheep)) scene.load.spritesheet(HABITAT_ASSET_KEYS.sheep, `${CUTE_ANIMALS_DIR}/Sheep/Sheep.png`, animalFrames)
}

// Draws a perimeter-only fence rectangle (see drawFencePen in packRender.js)
// using the Fences.png sheet - exported so OverworldScene.js's
// spawnWealthyPetPens can drop one next to a wealthy character's home
// without reaching into packRender.js/FENCE_PEN_KIT directly.
export function placeFencePen(scene, x, y, wPx, hPx, TILE_SIZE) {
  if (!scene.textures.exists(HABITAT_ASSET_KEYS.fences)) return []
  return drawFencePen(scene, x, y, wPx, hPx, TILE_SIZE, HABITAT_ASSET_KEYS.fences, FENCE_PEN_KIT)
}

// ---------------------------------------------------------------------------
// Kenney pack zoning (rpg-urban / roguelike-modern-city / tiny-town / pico-8-city)
// ---------------------------------------------------------------------------
// The packs clash tonally on purpose-built art (pastel village vs. grim
// concrete city vs. medieval fantasy vs. tiny retro top-down), so each is
// assigned a COHERENT ZONE / PURPOSE rather than being mixed on one structure:
//
//   roguelike-modern-city -> the three "city" district bands. It is the only
//     pack with real multi-story WALL facades, so every hand-authored
//     civic/corporate/industrial building uses it. Tokyo (luxury finance) and
//     Sapporo (industrial/agency) take the grey concrete-and-glass family;
//     Osaka (entertainment/crime/market) takes the grimier red brick.
//   tiny-town -> Kyoto District (whose ground is already the JRPG cobblestone
//     reskin, the closest existing tonal match) plus MOST of the 88 character
//     homes/hideouts, which read as village residences rather than office
//     towers.
//   pico-8-city -> an ADDITIVE variety layer inside the tiny-town home bucket
//     only (see brickOrPico8HomeKit/packFacadeFor below), not its own zone. Its buildings are
//     flat top-down rooftops (fixed-size prefabs, not wall nine-slices - see
//     pico8CityTiles.js), so it reads as "a different little building on the
//     block" dropped in among the cottages rather than a clashing district.
//     Hideouts are deliberately excluded (their brick+open-archway look is
//     the "seedier" identity signal and shouldn't get diluted), and the
//     billionaire stone tier is also excluded (stone is the wealth signal;
//     the variety layer only applies inside the "everyone else" bucket).
//   rpg-urban -> decoration only (trees/props). It has no facades at all, so
//     it can't clash with any facade pack - it's a separate layer.
//
// Both modern-city families are true nine-slices (verified assembled at 2x2 /
// 3x2 / 3x3 / 4x3); tiny-town is NOT - it has one self-contained peaked-roof
// tile per material and only two wall registers (plain upper / baseboard
// ground), so cottages repeat that gable per column, which reads as a village
// terrace row. pico-8-city is NOT a nine-slice either - it's cataloged as
// fixed-size PREFABS (drawPrefabFacade), each verified to close cleanly only
// at its own native size (packRender.js's prefab doc explains why a prefab
// isn't retiled to arbitrary footprints). See modernCityTiles.js /
// tinyTownTiles.js / pico8CityTiles.js for the per-index evidence.
const TILE_PX = 40 // world tile size these packs are scaled up to (16px art -> 2.5x; pico-8's 8px art -> 5x)

const DISTRICT_FACADE = {
  'Tokyo District': { sheetKey: PACK_SHEET_KEYS.modernCity, kit: MODERN_CITY.concreteGlass },
  'Sapporo District': { sheetKey: PACK_SHEET_KEYS.modernCity, kit: MODERN_CITY.concreteGlass },
  'Osaka District': { sheetKey: PACK_SHEET_KEYS.modernCity, kit: MODERN_CITY.redBrick },
  'Kyoto District': { sheetKey: PACK_SHEET_KEYS.tinyTown, kit: null, peaked: true, cottage: 'stoneCottage' },
}

// House rule: a character's home is skinned by their real wealth rather than
// every one of the 88 residences looking identical - stone (the grander,
// lighter material) for the billionaire tier, brick for everyone else. The
// building's tile rect is NOT touched by this (the verified 129-building
// layout geometry must not change), only which material it draws with.
// Exported so OverworldScene.js's spawnWealthyPetPens (fenced exotic-pet
// pens for a handful of the wealthiest homes) can pick its candidates using
// the exact same billionaire signal, rather than a second hardcoded number.
export const WEALTH_STONE_THRESHOLD = 1_000_000_000

// A third, middle wealth tier sitting between "everyone else" (brick/pico8,
// below) and the billionaire stone tier above: characters with a real but
// non-billionaire fortune (the $10M-$999M financial-titan band - Fed/FTC
// chairmen, agency leaders, and low-end titans all sit under this, so they
// stay in the brick/pico8 bucket) draw the Cute_Fantasy_Free wood house
// instead - a distinct, comfortably-upper-middle-class silhouette that isn't
// just another brick cottage but also isn't the billionaire's stone manor.
// Reuses the exact same getAnyCharacter(...).netWorth signal as the stone
// tier above (see packFacadeFor) rather than inventing a second wealth
// source. House_1_Wood_Base_Blue.png is a single complete pre-rendered house
// image (96x128px = 6x8 tiles), not a tileset - see drawPrefabImageFacade in
// packRender.js for how it's centered on the home's 2x2 footprint.
const WEALTH_WOOD_HOUSE_THRESHOLD = 10_000_000

// Adapts a tinyTownTiles cottage entry (roof: single frame, wall: {upper,
// ground}) to the generic kit shape packRender's nine-slice/cottage helpers
// expect. The single gable frame is repeated across all roof columns (the
// pack has no separate left/peak/right slope pieces - verified), and the
// baseboard "ground" register is used for the bottom wall row only.
function cottageKit(cottage, doorFrame) {
  const { upper, ground } = cottage.wall
  return {
    roof: { l: cottage.roof, peak: cottage.roof, r: cottage.roof },
    wall: { tl: upper, t: upper, tr: upper, l: upper, m: upper, r: upper, bl: ground, b: ground, br: ground },
    window: null,
    door: doorFrame ?? cottage.door,
  }
}

// Deterministic per-id hash (same tiny FNV-ish/multiply-31 shape already
// used in characterHomeBuildings.js's own hashId) - used below purely to
// pick a stable pico8-vs-cottage variant per character so a given home
// always renders the same way across reloads instead of re-rolling.
function hashId(id) {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0
  return h
}

// Homes below the billionaire/stone tier mostly keep the tiny-town brick
// cottage, but a quarter (id-hashed, stable) draw a pico8-city prefab
// instead - a flat-roof warehouse block or a detailed portico townhouse,
// each in one of two color variants - and a further quarter draw a Serene
// Village cottage prefab (see sereneVillageTiles.js) in one of three roof
// colors. Both are purely to break up the visual monotony of ~80+
// near-identical brick cottages sitting side by side (half the bucket still
// stays plain brick, so brick remains the visible majority "everyone else"
// look, not a minority option). This is an ADDITIVE variety layer only: it
// never touches the wealth signal (stone is still exclusively the
// billionaire tier, wood-house still exclusively the $10M-$999M tier) and
// never applies to hideouts (see packFacadeFor). The pico8 prefabs are
// natively 4x3/4x4 world tiles and the Serene Village cottages are natively
// 3x4, all larger than a home's fixed 2x2 footprint - drawPrefabFacade's
// documented house rule centers the prefab on the footprint rather than
// distorting it, so these draw slightly oversized. That overflow was
// checked against OverworldScene.js's actual home packing (HOME_GAP=2 tiles
// horizontal, BAND_GAP=4 tiles between rows) and fits inside the existing
// gaps without overlapping a neighboring building - see report for the
// arithmetic (Serene Village's 3x4 overflows by 1 tile at the sides and 2 at
// the top, the same safe margin already proven out by the pico8 tier).
const PICO8_HOME_VARIANTS = [
  PICO8_CITY.warehouse.purple,
  PICO8_CITY.warehouse.grey,
  PICO8_CITY.manor.purple,
  PICO8_CITY.manor.pink,
]

const SERENE_HOME_VARIANTS = [SERENE_VILLAGE_HOMES.cottage.red, SERENE_VILLAGE_HOMES.cottage.green, SERENE_VILLAGE_HOMES.cottage.blue]

function brickOrPico8HomeKit(npcId) {
  const h = hashId(npcId || '')
  const bucket = h % 4
  // House rule (bug found via live introspection while wiring the Serene
  // Village bucket below): hashId builds h with `>>> 0`, i.e. a full 32-bit
  // UNSIGNED value, so h can exceed 2^31 and have its sign bit set. `%` on a
  // plain positive JS number is unaffected, but `>>` first coerces its
  // operand to a SIGNED int32 - for those large h values `h >> 2` comes out
  // negative, and a negative array index (e.g. -1) silently resolves to
  // `undefined` rather than throwing on its own, which then blew up one line
  // below on `variant.door` for real npcIds (confirmed: 'yellen' and
  // 'miller' both hash to a negative variantIdx) and would have equally
  // broken the pico8 line beneath it for any npcId hashing the same way.
  // `>>> 2` (unsigned shift) keeps this consistent with the unsigned value
  // hashId actually produces - never negative, so never an invalid index.
  if (bucket === 0) {
    const variant = PICO8_HOME_VARIANTS[(h >>> 2) % PICO8_HOME_VARIANTS.length]
    return { sheetKey: PACK_SHEET_KEYS.pico8City, kit: variant, prefab: true }
  }
  if (bucket === 1) {
    // Serene Village cottages carry a documented door slot (see
    // sereneVillageTiles.js) - recorded on the returned spec as `doorSlot`
    // so buildingDoorAnimSpec below can find it without re-deriving the
    // bucket/variant choice a second time (it just re-runs this same
    // deterministic hash, see that function).
    const variant = SERENE_HOME_VARIANTS[(h >>> 2) % SERENE_HOME_VARIANTS.length]
    return {
      sheetKey: PACK_SHEET_KEYS.sereneVillage,
      kit: variant,
      prefab: true,
      doorSlot: variant?.door ? { cols: variant.cols, rows: variant.rows, col: variant.door.col, row: variant.door.row } : null,
    }
  }
  return { sheetKey: PACK_SHEET_KEYS.tinyTown, kit: cottageKit(TINY_TOWN.brickCottage), peaked: true }
}

// Style FAMILY a residential building (home or hideout) will render in,
// reusing the exact same wealth-threshold/hash logic packFacadeFor uses to
// pick a facade - without resolving the actual sheet/kit, just which visual
// family it lands in. Lets OverworldScene.js sort home/hideout defs into
// same-style clusters before packing them (reported: wildly different home
// styles - a log cabin, a flat office-style facade, a stone manor - kept
// landing directly side by side with no visual grouping).
export function residentialStyleKey(npcId, kind) {
  if (kind === 'hideout') return 'hideout'
  const netWorth = getAnyCharacter(npcId)?.netWorth ?? 0
  if (netWorth >= WEALTH_STONE_THRESHOLD) return 'stone'
  if (netWorth >= WEALTH_WOOD_HOUSE_THRESHOLD) return 'woodHouse'
  const bucket = hashId(npcId || '') % 4
  if (bucket === 0) return 'pico8'
  if (bucket === 1) return 'serene'
  return 'brick'
}

// Resolves which pack + kit a building draws with. Returns null for anything
// that should keep the procedural facade (interior desks, unknown districts).
function packFacadeFor(building) {
  if (!building || typeof building !== 'object' || !building.district) return null

  if (building.kind === 'home' || building.kind === 'hideout') {
    // Hideouts use brick + the OPEN archway instead of a closed door, so a
    // criminal's hideout reads as a seedier open doorway at a glance. Kept
    // 100% tiny-town (no pico8 variety) so that signal stays legible.
    if (building.kind === 'hideout') {
      const c = TINY_TOWN.brickCottage
      return { sheetKey: PACK_SHEET_KEYS.tinyTown, kit: cottageKit(c, c.archway), peaked: true }
    }
    const netWorth = getAnyCharacter(building.npcId)?.netWorth ?? 0
    if (netWorth >= WEALTH_STONE_THRESHOLD) {
      return { sheetKey: PACK_SHEET_KEYS.tinyTown, kit: cottageKit(TINY_TOWN.stoneCottage), peaked: true }
    }
    if (netWorth >= WEALTH_WOOD_HOUSE_THRESHOLD) {
      return { prefabImage: true, imageKey: HABITAT_ASSET_KEYS.houseWood }
    }
    return brickOrPico8HomeKit(building.npcId)
  }

  const spec = DISTRICT_FACADE[building.district]
  if (!spec) return null
  if (spec.cottage) {
    return { sheetKey: spec.sheetKey, kit: cottageKit(TINY_TOWN[spec.cottage]), peaked: true }
  }
  return { sheetKey: spec.sheetKey, kit: spec.kit, peaked: false }
}

// Resolves the world-pixel position of an animated-door overlay sprite for a
// building, if (and only if) that building's facade resolved to a Serene
// Village cottage prefab with a documented door slot (brickOrPico8HomeKit's
// bucket 1, above) - null for every other facade family (district civic
// buildings, hideouts, the stone/wood-house wealth tiers, brick cottages,
// pico8 prefabs). Those all keep their door as a static frame baked into the
// wall/prefab art with nothing overlaid on it - see OverworldScene.js's
// drawBuildings for why the animation is scoped to just this one family.
// Called with the SAME (x, y, w, h) already passed to placeBuildingFacade
// for this building, so prefabTileWorldPos agrees exactly with where that
// call actually drew the cottage.
export function buildingDoorAnimSpec(building, x, y, w, h) {
  const spec = packFacadeFor(building)
  if (!spec?.doorSlot) return null
  const { cols, rows, col, row } = spec.doorSlot
  const pos = prefabTileWorldPos(x, y, w, h, TILE_PX, cols, rows, col, row)
  return { x: pos.x, y: pos.y, buildingId: building.id }
}

// Call from every scene's preload() - queues the tile/decoration/building
// images (the player sheet is preloaded separately by spriteGen.js).
export function preloadTerrainAssets(scene) {
  // Kenney packs load regardless of the procedural flag below - they're the
  // facade/decoration source now, and preloading here means no scene's
  // preload() needed changing.
  if (USE_KENNEY_PACKS) preloadPacks(scene)
  // Habitat assets (wood-house wealth tier, pet-pen fences, roaming animals)
  // are a third, independent asset source - loaded unconditionally, same as
  // preloadPacks above, regardless of which of the two flags below is set.
  preloadHabitatAssets(scene)
  // Serene Village's animated door strip (a separate small PNG, not part of
  // the Serene_Village_16x16.png sheet preloadPacks already queues via
  // PACK_SHEET_KEYS.sereneVillage) - loaded unconditionally for the same
  // reason: it must land before OverworldScene.create()'s
  // ensureSereneVillageDoorAnims() call regardless of either flag below.
  preloadSereneVillageDoor(scene)
  if (USE_PROCEDURAL_GRAPHICS) return // Procedural mode: no external assets needed
  const L = scene.load
  if (!scene.textures.exists(ASSET_KEYS.tileGrass)) L.image(ASSET_KEYS.tileGrass, `${ASSET_BASE}/Tiles/Grass_Middle.png`)
  if (!scene.textures.exists(ASSET_KEYS.tilePath)) L.image(ASSET_KEYS.tilePath, `${ASSET_BASE}/Tiles/Path_Middle.png`)
  if (!scene.textures.exists(ASSET_KEYS.tileWater)) L.image(ASSET_KEYS.tileWater, `${ASSET_BASE}/Tiles/Water_Middle.png`)
  if (!scene.textures.exists(ASSET_KEYS.treeBig)) L.image(ASSET_KEYS.treeBig, `${DECOR_DIR}/Oak_Tree.png`)
  if (!scene.textures.exists(ASSET_KEYS.treeSmall)) {
    L.spritesheet(ASSET_KEYS.treeSmall, `${DECOR_DIR}/Oak_Tree_Small.png`, { frameWidth: 32, frameHeight: 48 })
  }
  if (!scene.textures.exists(ASSET_KEYS.decor)) {
    L.spritesheet(ASSET_KEYS.decor, `${DECOR_DIR}/Outdoor_Decor_Free.png`, { frameWidth: 16, frameHeight: 16 })
  }
  if (!scene.textures.exists(ASSET_KEYS.house)) L.image(ASSET_KEYS.house, `${DECOR_DIR}/House_1_Wood_Base_Blue.png`)
  if (!scene.textures.exists(ASSET_KEYS.modernInteriors)) {
    L.image(ASSET_KEYS.modernInteriors, '/assets/packs/Modern_Interiors_Free_v2.2/Modern%20tiles_Free/Interiors_free/16x16/Interiors_free_16x16.png')
  }
  if (!scene.textures.exists(ASSET_KEYS.modernRoomBuilder)) {
    L.image(ASSET_KEYS.modernRoomBuilder, '/assets/packs/Modern_Interiors_Free_v2.2/Modern%20tiles_Free/Interiors_free/16x16/Room_Builder_free_16x16.png')
  }
  if (!scene.textures.exists(ASSET_KEYS.sereneVillage)) {
    L.image(ASSET_KEYS.sereneVillage, '/assets/packs/Serene_Village_revamped_v1.9/SERENE_VILLAGE_REVAMPED/Serene_Village_16x16.png')
  }
  if (!scene.textures.exists(ASSET_KEYS.sereneHouses)) {
    L.image(ASSET_KEYS.sereneHouses, '/assets/packs/Serene_Village_revamped_v1.9/SERENE_VILLAGE_REVAMPED/RPG_MAKER_MV/Houses_TILESET_B-C-D-E.png')
  }
  if (!scene.textures.exists(ASSET_KEYS.sereneOutside)) {
    L.image(ASSET_KEYS.sereneOutside, '/assets/packs/Serene_Village_revamped_v1.9/SERENE_VILLAGE_REVAMPED/RPG_MAKER_MV/Outside_Stuff_TILESET_B-C-D-E.png')
  }
}

// ---------------------------------------------------------------------------
// Terrain tile layer (Serene Village spritesheet: 19 cols x 45 rows)
// ---------------------------------------------------------------------------

// Tile indices into Serene_Village_16x16.png (19 tiles wide).
// Formula: row * 19 + col. Kept to safe row 0-10 range.
export const TERRAIN_TILE_INDEX = {
  grass: 4,      // row 0, col 4
  path: 23,      // row 1, col 4  (sandy path)
  water: 38,     // row 2, col 0
  wall: 0,       // row 0, col 0  (solid dark border)
  slate: 57,     // row 3, col 0
  cobblestone: 76, // row 4, col 0
  bridge: 23,    // reuse path for bridges
  snow: 95,      // row 5, col 0
}

const TERRAIN_ATLAS_KEY = 'cf_terrain_atlas'

function ensureTerrainAtlas(scene) {
  if (scene.textures.exists(TERRAIN_ATLAS_KEY)) return TERRAIN_ATLAS_KEY
  const grass = scene.textures.get(ASSET_KEYS.tileGrass).getSourceImage()
  const path = scene.textures.get(ASSET_KEYS.tilePath).getSourceImage()
  const water = scene.textures.get(ASSET_KEYS.tileWater).getSourceImage()
  const canvas = document.createElement('canvas')
  canvas.width = 16 * 3
  canvas.height = 16
  const ctx = canvas.getContext('2d')
  ctx.imageSmoothingEnabled = false
  ctx.drawImage(grass, 0, 0)
  ctx.drawImage(path, 16, 0)
  ctx.drawImage(water, 32, 0)
  scene.textures.addCanvas(TERRAIN_ATLAS_KEY, canvas)
  return TERRAIN_ATLAS_KEY
}

export function buildTerrainLayer(scene, cols, rows, tileSize, tileTypeAt) {
  if (USE_PROCEDURAL_GRAPHICS) {
    const base = procedural_buildTerrainLayer(scene, cols, rows, tileSize, tileTypeAt)
    // Map coherence overhaul step 2: if the Cute Fantasy ground tiles loaded,
    // overlay real grass/road art on top of the procedural pass. The base
    // layer still draws (and still owns water/wall/slate/cobblestone), so
    // this degrades cleanly to the old look if the textures are missing.
    if (cuteTerrainReady(scene)) {
      return buildCuteTerrainOverlay(scene, base, cols, rows, tileSize, tileTypeAt)
    }
    return base
  }
  const data = []
  for (let r = 0; r < rows; r++) {
    const row = []
    for (let c = 0; c < cols; c++) {
      const type = tileTypeAt(r, c)
      row.push(type && TERRAIN_TILE_INDEX[type] !== undefined ? TERRAIN_TILE_INDEX[type] : -1)
    }
    data.push(row)
  }

  const map = scene.make.tilemap({ data, tileWidth: 16, tileHeight: 16 })
  const tilesetKey = scene.textures.exists(ASSET_KEYS.sereneVillage) ? ASSET_KEYS.sereneVillage : ensureTerrainAtlas(scene)
  const tileset = map.addTilesetImage('serene_terrain', tilesetKey, 16, 16, 0, 0)
  const layer = map.createLayer(0, tileset, 0, 0)
  layer.setScale(tileSize / 16)
  
  return layer
}

// ---------------------------------------------------------------------------
// Decoration (trees / flowers / rocks)
// ---------------------------------------------------------------------------

const SMALL_TREE_FRAMES = [1, 2]
const FLOWER_FRAMES = [7, 8, 9]
const ROCK_FRAMES = [15, 16]

// CORRECTED: these were previously placed as joined 2x1 "big tree" pairs, on
// the catalog's claim that each pair's canopy spanned both tiles. It doesn't -
// frames 259/260 (and 286/287) are each a COMPLETE little tree, canopy and
// trunk, verified by viewing the pack's own per-tile PNGs (Tiles/tile_0259.png
// etc). Placing them as a pair therefore drew TWO trees jammed into adjacent
// tiles, spilling half a tile outside the tile that owns them - which is what
// read as trees looking doubled-up and clipped, and why only one of the two
// tiles ever blocked movement.
// Every entry here is now a single self-contained tile.
const PACK_TREE_VARIANTS = [
  RPG_URBAN.trees.green.treeA,
  RPG_URBAN.trees.green.treeB,
  RPG_URBAN.trees.autumn.treeA,
  RPG_URBAN.trees.autumn.treeB,
  RPG_URBAN.trees.green.sapling,
  RPG_URBAN.trees.autumn.sapling,
  RPG_URBAN.trees.green.roundBush,
  RPG_URBAN.trees.rust.treeA,
  RPG_URBAN.trees.rust.treeB,
]

export function placeTree(scene, cx, cy) {
  // Cute Fantasy's own oaks first - this pack is what the reference picture
  // shows, and rpg-urban's one-tile tree below never resembled it.
  if (cuteTreesReady(scene)) {
    return drawCuteTree(scene, cx, cy, TILE_PX, seededRand(cx, cy, 71))
  }
  if (USE_KENNEY_PACKS && scene.textures.exists(PACK_SHEET_KEYS.rpgUrban)) {
    const frames = PACK_TREE_VARIANTS[Math.floor(seededRand(cx, cy, 71) * PACK_TREE_VARIANTS.length)]
    return placePackProp(scene, cx, cy, PACK_SHEET_KEYS.rpgUrban, frames, TILE_PX, 'x')
  }
  if (USE_PROCEDURAL_GRAPHICS) {
    return procedural_placeTree(scene, cx, cy)
  }
  if (Math.random() < 0.22) {
    const img = scene.add.image(cx, cy, ASSET_KEYS.treeBig).setOrigin(0.5, 0.82)
    img.setDepth(cy)
    return [img]
  }
  const frame = SMALL_TREE_FRAMES[Math.floor(Math.random() * SMALL_TREE_FRAMES.length)]
  const img = scene.add.image(cx, cy, ASSET_KEYS.treeSmall, frame).setOrigin(0.5, 0.88)
  img.setDepth(cy)
  return [img]
}

export function placeFlower(scene, cx, cy) {
  if (USE_PROCEDURAL_GRAPHICS) {
    return procedural_placeFlower(scene, cx, cy)
  }
  const frame = FLOWER_FRAMES[Math.floor(Math.random() * FLOWER_FRAMES.length)]
  const img = scene.add.image(cx, cy, ASSET_KEYS.decor, frame).setScale(1.4)
  img.setDepth(cy)
  return [img]
}

export function placeRock(scene, cx, cy) {
  if (USE_PROCEDURAL_GRAPHICS) {
    return procedural_placeRock(scene, cx, cy)
  }
  const frame = ROCK_FRAMES[Math.floor(Math.random() * ROCK_FRAMES.length)]
  const img = scene.add.image(cx, cy, ASSET_KEYS.decor, frame).setScale(1.4)
  img.setDepth(cy)
  return [img]
}

export function placeCampfire(scene, cx, cy) {
  return procedural_placeCampfire(scene, cx, cy)
}

// ---------------------------------------------------------------------------
// Buildings & Structures
// ---------------------------------------------------------------------------

// `building` is the full building def object for overworld buildings (so the
// pack/kit can be chosen from its district/kind/npcId - see packFacadeFor);
// interior desk calls still pass a plain id string, which falls through to
// the procedural facade below exactly as before.
export function placeBuildingFacade(scene, x, y, w, h, tintColor, building = '') {
  // Map coherence overhaul step 4: the temple draws the pack's OWN authored
  // chapel instead of a generic facade, so the map and the chapel's own art
  // are the same building (the human's "double exterior" report). Its def is
  // sized 16x14 to match the art exactly - see drawChapelExteriorFacade.
  if (building && building.id === 'temple' && chapelFacadeReady(scene)) {
    // w is the footprint in pixels and the def is CHAPEL_FACADE_TILES.cols
    // wide, so this recovers the scene's tile size without importing it.
    return drawChapelExteriorFacade(scene, x, y, w / CHAPEL_FACADE_TILES.cols)
  }

  if (USE_KENNEY_PACKS && building && typeof building === 'object') {
    const spec = packFacadeFor(building)
    // prefabImage specs (the Cute_Fantasy_Free wood house) carry an imageKey
    // instead of a sheetKey - a plain scene.load.image(), not a spritesheet -
    // so they're checked/drawn via drawPrefabImageFacade, not the frame-index
    // based helpers below.
    if (spec?.prefabImage && scene.textures.exists(spec.imageKey)) {
      const objs = drawPrefabImageFacade(scene, x, y, w, h, TILE_PX, spec.imageKey)
      if (objs.length) return objs
    } else if (spec && spec.sheetKey && scene.textures.exists(spec.sheetKey)) {
      const objs = spec.prefab
        ? drawPrefabFacade(scene, x, y, w, h, TILE_PX, spec.sheetKey, spec.kit)
        : spec.peaked
        ? drawPeakedCottage(scene, x, y, w, h, TILE_PX, spec.sheetKey, spec.kit)
        : drawNineSliceFacade(scene, x, y, w, h, TILE_PX, spec.sheetKey, spec.kit)
      if (objs.length) return objs
    }
  }
  const buildingId = typeof building === 'string' ? building : building?.id || ''
  if (USE_PROCEDURAL_GRAPHICS) {
    return procedural_placeBuildingFacade(scene, x, y, w, h, tintColor, buildingId)
  }
  const shadow = scene.add.ellipse(x + w / 2, y + h + 3, w * 0.7, 10, 0x000000, 0.28)
  
  let assetKey = ASSET_KEYS.house
  if (scene.textures.exists(ASSET_KEYS.sereneHouses) && buildingId !== 'desk') {
    assetKey = ASSET_KEYS.sereneHouses
  }
  
  const scale = w / 96
  const img = scene.add.image(x + w / 2, y + h, assetKey).setOrigin(0.5, 1).setScale(scale)
  if (tintColor && tintColor !== 0xffffff) {
    img.setTint(tintColor)
  }
  img.setDepth(y + h)
  shadow.setDepth(y + h - 1)
  return [shadow, img]
}

// ---------------------------------------------------------------------------
// Interior Room Renderer (Modern_Interiors tileset)
// ---------------------------------------------------------------------------

export function drawInteriorRoom(scene, zoneObjects, template = {}) {
  if (USE_PROCEDURAL_GRAPHICS) {
    return procedural_drawInteriorRoom(scene, zoneObjects, template)
  }
  const INTERIOR_COLS = 12
  const INTERIOR_ROWS = 9
  const TILE_SIZE = 40
  const d = { c0: 5, r0: 2, c1: 6, r1: 3 }

  const wallTile = template.wallTile ?? 2
  const floorA = template.floorTileA ?? 34
  const floorB = template.floorTileB ?? 35

  // Build tile data as a 2D array — avoids putTileAt out-of-bounds crashes
  const data = []
  for (let r = 0; r < INTERIOR_ROWS; r++) {
    const row = []
    for (let c = 0; c < INTERIOR_COLS; c++) {
      const isBorder = r === 0 || c === 0 || r === INTERIOR_ROWS - 1 || c === INTERIOR_COLS - 1
      row.push(isBorder ? wallTile : ((r + c) % 2 === 0 ? floorA : floorB))
    }
    data.push(row)
  }

  const map = scene.make.tilemap({ data, tileWidth: 16, tileHeight: 16 })
  const tilesetKey = scene.textures.exists(ASSET_KEYS.modernRoomBuilder)
    ? ASSET_KEYS.modernRoomBuilder
    : (scene.textures.exists(ASSET_KEYS.modernInteriors) ? ASSET_KEYS.modernInteriors : 'cf_terrain_atlas')
  
  const tileset = map.addTilesetImage('modern_interior', tilesetKey, 16, 16, 0, 0)
  const layer = map.createLayer(0, tileset, 0, 0)
  layer.setScale(TILE_SIZE / 16)
  zoneObjects.push(layer)

  const dx = d.c0 * TILE_SIZE
  const dy = d.r0 * TILE_SIZE
  const dw = (d.c1 - d.c0 + 1) * TILE_SIZE
  const dh = (d.r1 - d.r0 + 1) * TILE_SIZE
  const deskLabel = template.deskLabel || 'Counter'
  const deskColor = template.deskColor || 0x555555
  zoneObjects.push(...placeBuildingFacade(scene, dx, dy, dw, dh, deskColor, 'desk'))
  const label = scene.add
    .text(dx + dw / 2, dy - 12, deskLabel, { fontFamily: 'monospace', fontSize: '10px', color: '#ffffff' })
    .setOrigin(0.5, 1)
    .setDepth(dy + dh + 10)
  zoneObjects.push(label)
  return { dx, dy, dw, dh }
}



// --- PROCEDURAL FUNCTIONS --- 
// Shared drawing helpers so every world's tilemap reads as a textured,
// populated place (grass with blades, roads with lane lines, water with
// waves, buildings with windows/doors/roofs) instead of flat color squares
// or external art assets. Shading follows the same upper-left light source
// used for character sprites (spriteGen.js), so the whole game reads as one
// consistently-lit scene instead of flat, toy-like color fills. 100% Phaser
// Graphics/canvas drawing - no images are loaded.

function seededRand(seedX, seedY, salt = 0) {
  const s = Math.sin(seedX * 127.1 + seedY * 311.7 + salt * 74.3) * 43758.5453
  return s - Math.floor(s)
}

function shadeHex(color, amount) {
  const r = Math.max(0, Math.min(255, ((color >> 16) & 0xff) + amount))
  const g = Math.max(0, Math.min(255, ((color >> 8) & 0xff) + amount))
  const b = Math.max(0, Math.min(255, (color & 0xff) + amount))
  return (r << 16) | (g << 8) | b
}

// ---------------------------------------------------------------------------
// Per-cell tile fills. Each one draws directly into a shared Graphics object
// at the given pixel rect - see buildTerrainLayer() below for the dispatcher
// that loops every map cell and calls the right one.
// ---------------------------------------------------------------------------

export function procedural_drawGrassTile(graphics, x, y, size) {
  graphics.fillStyle(0x35722f, 1)
  graphics.fillRect(x, y, size, size)
  // subtle AO band along the bottom/right edge (upper-left light source)
  graphics.fillStyle(0x2c5f27, 0.5)
  graphics.fillRect(x, y + size - 5, size, 5)
  graphics.fillRect(x + size - 5, y, 5, size)
  // Blade count scales with tile size so a bigger tile stays as densely
  // detailed as a smaller one instead of the same handful of blades just
  // being stretched across more area.
  const bladeCount = Math.max(3, Math.round(size / 9))
  graphics.fillStyle(0x274f22, 1)
  for (let i = 0; i < bladeCount; i++) {
    const bx = x + seededRand(x, y, i) * (size - 4)
    const by = y + seededRand(x, y, i + 10) * (size - 4)
    graphics.fillRect(bx, by, 2, 4)
  }
  // lighter blades catching the light, also scaled with size
  const litBladeCount = Math.max(1, Math.round(size / 22))
  graphics.fillStyle(0x4a8f42, 1)
  for (let i = 0; i < litBladeCount; i++) {
    if (seededRand(x, y, 99 + i) <= 0.55) continue
    graphics.fillRect(x + seededRand(x, y, 5 + i) * (size - 3), y + seededRand(x, y, 6 + i) * (size - 3), 2, 3)
  }
}

// Tokyo's "luxury financial district" ground reskin - no grass, a dark
// marble-with-gold-seam floor instead.
export function procedural_drawSlateMarbleTile(graphics, x, y, size) {
  graphics.fillStyle(0x0a101f, 1)
  graphics.fillRect(x, y, size, size)
  graphics.fillStyle(0x131d36, 1)
  graphics.fillRect(x + 1, y + 1, size - 2, size - 2)
  graphics.fillStyle(0xf59e0b, 0.4)
  graphics.fillRect(x, y, size, 1)
  graphics.fillRect(x, y, 1, size)
}

// Kyoto's JRPG-cobblestone ground reskin.
export function procedural_drawCobblestoneTile(graphics, x, y, size) {
  graphics.fillStyle(0x2c2621, 1)
  graphics.fillRect(x, y, size, size)
  graphics.fillStyle(0x423831, 1)
  graphics.fillRect(x + 2, y + 2, size - 4, size - 4)
  graphics.fillStyle(0x854d0e, 0.5)
  graphics.fillRect(x + 4, y + 4, size - 8, 2)
}

export function procedural_drawRoadTile(graphics, x, y, size, horizontal, dashPhaseIndex) {
  graphics.fillStyle(0x3d3d3d, 1)
  graphics.fillRect(x, y, size, size)
  // asphalt speckle for texture instead of a flat fill - count scales with
  // tile size so bigger tiles don't read as sparser
  const darkSpeckleCount = Math.max(4, Math.round(size / 10))
  const lightSpeckleCount = Math.max(3, Math.round(size / 13))
  graphics.fillStyle(0x333333, 1)
  for (let i = 0; i < darkSpeckleCount; i++) {
    const sx = x + seededRand(x, y, i + 60) * (size - 2)
    const sy = y + seededRand(x, y, i + 70) * (size - 2)
    graphics.fillRect(sx, sy, 2, 2)
  }
  graphics.fillStyle(0x505050, 1)
  for (let i = 0; i < lightSpeckleCount; i++) {
    const sx = x + seededRand(x, y, i + 80) * (size - 2)
    const sy = y + seededRand(x, y, i + 90) * (size - 2)
    graphics.fillRect(sx, sy, 2, 2)
  }
  graphics.fillStyle(0x5a5a5a, 1)
  if (horizontal) {
    graphics.fillRect(x, y + size / 2 - 1, size, 2)
    if (dashPhaseIndex % 2 === 0) {
      graphics.fillStyle(0xd4b83f, 1)
      graphics.fillRect(x + size / 2 - 4, y + size / 2 - 1, 8, 2)
    }
  } else {
    graphics.fillRect(x + size / 2 - 1, y, 2, size)
    if (dashPhaseIndex % 2 === 0) {
      graphics.fillStyle(0xd4b83f, 1)
      graphics.fillRect(x + size / 2 - 1, y + size / 2 - 4, 2, 8)
    }
  }
}

export function procedural_drawWaterTile(graphics, x, y, size, phase) {
  graphics.fillStyle(0x27587f, 1)
  graphics.fillRect(x, y, size, size)
  graphics.fillStyle(0x35729e, 1)
  const waveY = y + size / 2 + Math.sin(phase + x * 0.05) * 3
  graphics.fillRect(x, waveY, size, 2)
  graphics.fillStyle(0x4a8bc2, 0.6)
  graphics.fillRect(x, waveY - 6, size, 1)
}

export function procedural_drawSandTile(graphics, x, y, size) {
  graphics.fillStyle(0xb08f4f, 1)
  graphics.fillRect(x, y, size, size)
  graphics.fillStyle(0x9c7c40, 1)
  for (let i = 0; i < 2; i++) {
    const bx = x + seededRand(x, y, i + 20) * (size - 2)
    const by = y + seededRand(x, y, i + 30) * (size - 2)
    graphics.fillRect(bx, by, 2, 2)
  }
}

// Impassable border/mountain tile, used at every map edge (and Kyoto's
// mountain rows, Sapporo's non-peak border). No pack precedent - a simple
// dark stone fill matching the old asset-era fallback color.
export function procedural_drawWallTile(graphics, x, y, size) {
  graphics.fillStyle(0x5b4636, 1)
  graphics.fillRect(x, y, size, size)
  graphics.fillStyle(0x4a3929, 1)
  graphics.fillRect(x, y + size - 6, size, 6)
  graphics.fillStyle(0x6f5a45, 1)
  graphics.fillRect(x, y, size, 4)
}

// Wooden river-crossing tile (Kyoto's Kamo River bridge, Sapporo's Ishikari
// River bridge). No pack precedent - new procedural tile invented for the
// Four Towns work, kept flat-fill + shade/highlight passes, same style as
// every other tile here.
export function procedural_drawBridgeTile(graphics, x, y, size) {
  graphics.fillStyle(0x6a4a2a, 1)
  graphics.fillRect(x, y, size, size)
  graphics.fillStyle(0x5a3d22, 1)
  const plankGap = Math.max(6, Math.round(size / 4))
  for (let px = plankGap; px < size; px += plankGap) {
    graphics.fillRect(x + px, y, 2, size)
  }
  graphics.fillStyle(0x7d5a35, 0.6)
  graphics.fillRect(x, y, size, 3)
}

// Snow-capped mountain peak tile (Sapporo's northern border rows). No pack
// precedent - new procedural tile invented for the Four Towns work.
export function procedural_drawSnowTile(graphics, x, y, size) {
  graphics.fillStyle(0xe8f0f7, 1)
  graphics.fillRect(x, y, size, size)
  graphics.fillStyle(0xd3e2ee, 1)
  graphics.fillRect(x, y + size - 5, size, 5)
  graphics.fillRect(x + size - 5, y, 5, size)
  graphics.fillStyle(0xffffff, 0.9)
  const sparkleCount = Math.max(2, Math.round(size / 16))
  for (let i = 0; i < sparkleCount; i++) {
    const sx = x + seededRand(x, y, i + 200) * (size - 3)
    const sy = y + seededRand(x, y, i + 210) * (size - 3)
    graphics.fillRect(sx, sy, 2, 2)
  }
}

// A screen-space radial vignette (dark, transparent-centered canvas texture
// pinned to the camera) - a cheap, standard trick that makes flat 2D scenes
// read as lit/cinematic instead of a uniformly-bright "toy" look.
export function procedural_addScreenVignette(scene, width = 640, height = 480) {
  const key = 'screen_vignette'
  if (!scene.textures.exists(key)) {
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    const cx = width / 2
    const cy = height / 2
    const radius = Math.hypot(cx, cy)
    const gradient = ctx.createRadialGradient(cx, cy, radius * 0.55, cx, cy, radius)
    gradient.addColorStop(0, 'rgba(0,0,0,0)')
    gradient.addColorStop(1, 'rgba(0,0,0,0.55)')
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, width, height)
    scene.textures.addCanvas(key, canvas)
  }
  return scene.add
    .image(width / 2, height / 2, key)
    .setScrollFactor(0)
    .setDepth(1000)
}

// ---------------------------------------------------------------------------
// Terrain layer dispatcher. `tileTypeAt(row, col)` returns a tile-type
// string ('grass' | 'path' | 'water' | 'wall' | 'slate' | 'cobblestone' |
// 'bridge' | 'snow') or null/undefined to skip the cell entirely. Road
// orientation (needed for lane-marking direction) isn't passed explicitly -
// it's inferred from whether the left/right or top/bottom neighbor is also
// a path/bridge cell, so every scene's existing tileTypeAt callback (which
// already only returns a bare type string) needed no restructuring.
// ---------------------------------------------------------------------------

function isPathLike(type) {
  return type === 'path' || type === 'bridge'
}

export function procedural_buildTerrainLayer(scene, cols, rows, tileSize, tileTypeAt) {
  const graphics = scene.add.graphics()
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const type = tileTypeAt(r, c)
      if (!type) continue
      const x = c * tileSize
      const y = r * tileSize
      switch (type) {
        case 'grass':
          procedural_drawGrassTile(graphics, x, y, tileSize)
          break
        case 'slate':
          procedural_drawSlateMarbleTile(graphics, x, y, tileSize)
          break
        case 'cobblestone':
          procedural_drawCobblestoneTile(graphics, x, y, tileSize)
          break
        case 'path':
        case 'bridge': {
          const left = c > 0 ? tileTypeAt(r, c - 1) : null
          const right = c < cols - 1 ? tileTypeAt(r, c + 1) : null
          const horizontal = isPathLike(left) || isPathLike(right)
          if (type === 'bridge') procedural_drawBridgeTile(graphics, x, y, tileSize)
          else procedural_drawRoadTile(graphics, x, y, tileSize, horizontal, c)
          break
        }
        case 'water':
          procedural_drawWaterTile(graphics, x, y, tileSize, 0)
          break
        case 'wall':
          procedural_drawWallTile(graphics, x, y, tileSize)
          break
        case 'snow':
          procedural_drawSnowTile(graphics, x, y, tileSize)
          break
        default:
          break
      }
    }
  }
  return graphics
}

// ---------------------------------------------------------------------------
// Decoration (trees / flowers / rocks / campfires)
// ---------------------------------------------------------------------------

const FLOWER_COLORS = [0xd68fc4, 0xd9c23f, 0xe07a8c, 0xe8e8e8]

function setAllDepth(objs, depth) {
  for (const o of objs) o.setDepth(depth)
  return objs
}

export function procedural_placeTree(scene, cx, cy) {
  const shadow = scene.add.ellipse(cx, cy + 11, 16, 5, 0x000000, 0.25)
  const trunk = scene.add.rectangle(cx, cy + 6, 4, 10, 0x4a2f18)
  const trunkLit = scene.add.rectangle(cx - 1, cy + 6, 1.5, 10, 0x5b3a1f)
  const canopy1 = scene.add.circle(cx, cy - 4, 10, 0x244f20)
  const canopy2 = scene.add.circle(cx - 5, cy, 7, 0x2a5c25)
  const canopy3 = scene.add.circle(cx + 5, cy, 7, 0x2a5c25)
  const canopyLit = scene.add.circle(cx - 4, cy - 8, 5, 0x3d7a35)
  return setAllDepth([shadow, trunk, trunkLit, canopy1, canopy2, canopy3, canopyLit], cy)
}

export function procedural_placeFlower(scene, cx, cy) {
  const color = FLOWER_COLORS[Math.floor(seededRand(cx, cy, 40) * FLOWER_COLORS.length)]
  const petals = [
    scene.add.circle(cx - 2, cy, 1.6, color),
    scene.add.circle(cx + 2, cy, 1.6, color),
    scene.add.circle(cx, cy - 2, 1.6, color),
    scene.add.circle(cx, cy + 2, 1.6, color),
  ]
  const center = scene.add.circle(cx, cy, 1.4, 0xd9a730)
  return setAllDepth([...petals, center], cy)
}

export function procedural_placeRock(scene, cx, cy) {
  const shadow = scene.add.ellipse(cx, cy + 3, 14, 5, 0x000000, 0.25)
  const base = scene.add.circle(cx, cy, 7, 0x6f6f6f)
  const shade = scene.add.circle(cx + 2, cy + 2, 5, 0x5a5a5a)
  const highlight = scene.add.circle(cx - 2, cy - 2, 3, 0x8f8f8f)
  return setAllDepth([shadow, base, shade, highlight], cy)
}

// Simplified campfire (used only by Sapporo's alpine district) - a couple of
// stacked logs plus a two-tone flame. Not animated (no frame-cycling), a
// deliberate simplification vs. a true flicker-animated sprite.
export function procedural_placeCampfire(scene, cx, cy) {
  const shadow = scene.add.ellipse(cx, cy + 6, 18, 6, 0x000000, 0.3)
  const logs = scene.add.rectangle(cx, cy + 3, 14, 4, 0x4a2f18)
  const logsLit = scene.add.rectangle(cx - 3, cy + 3, 5, 4, 0x5b3a1f)
  const flameOuter = scene.add.circle(cx, cy - 2, 6, 0xff6a00, 0.9)
  const flameInner = scene.add.circle(cx, cy - 4, 3, 0xffd23f, 0.95)
  return setAllDepth([shadow, logs, logsLit, flameOuter, flameInner], cy)
}

// ---------------------------------------------------------------------------
// Buildings & Structures
// ---------------------------------------------------------------------------

const ROOF_COLORS = { default: 0x1e1e1e }

export function procedural_drawBuildingFacade(graphics, x, y, w, h, baseColor, options = {}) {
  const roofHeight = 10

  // ground shadow so the building reads as sitting on the ground, not
  // pasted on top of it
  graphics.fillStyle(0x000000, 0.25)
  graphics.fillRect(x + 4, y + h, w, 5)

  graphics.fillStyle(options.roofColor ?? ROOF_COLORS.default, 1)
  graphics.fillRect(x - 2, y - roofHeight, w + 4, roofHeight)
  graphics.fillStyle(shadeHex(options.roofColor ?? ROOF_COLORS.default, 30), 1)
  graphics.fillRect(x - 2, y - roofHeight, w + 4, 2)

  graphics.fillStyle(baseColor, 1)
  graphics.fillRect(x, y, w, h)
  // right-edge AO strip, consistent upper-left light source
  graphics.fillStyle(shadeHex(baseColor, -30), 1)
  graphics.fillRect(x + w - 10, y, 10, h)
  // left-edge highlight catching the light
  graphics.fillStyle(shadeHex(baseColor, 18), 1)
  graphics.fillRect(x, y, 5, h)

  // window grid, each with a frame so it reads as glass in a wall rather
  // than a flat colored square
  const winW = 10
  const winH = 12
  const gapX = 8
  const gapY = 10
  const cols = Math.max(1, Math.floor((w - gapX) / (winW + gapX)))
  const rows = Math.max(1, Math.floor((h - gapY - 18) / (winH + gapY)))
  const startX = x + (w - cols * winW - (cols - 1) * gapX) / 2
  const startY = y + 12

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const wx = startX + c * (winW + gapX)
      const wy = startY + r * (winH + gapY)
      const lit = seededRand(x + wx, y + wy, 5) > 0.4
      graphics.fillStyle(0x14141c, 1)
      graphics.fillRect(wx - 1, wy - 1, winW + 2, winH + 2)
      graphics.fillStyle(lit ? 0xf2c14e : 0x232f45, 1)
      graphics.fillRect(wx, wy, winW, winH)
      if (lit) {
        graphics.fillStyle(0xfbe08a, 1)
        graphics.fillRect(wx, wy, winW, 3)
      }
    }
  }

  // door with frame and a subtle shadow inside the doorway
  const doorW = 16
  graphics.fillStyle(0x14141c, 1)
  graphics.fillRect(x + w / 2 - doorW / 2 - 1, y + h - 21, doorW + 2, 21)
  graphics.fillStyle(0x2c1d10, 1)
  graphics.fillRect(x + w / 2 - doorW / 2, y + h - 20, doorW, 20)
  graphics.fillStyle(0xc99b3c, 1)
  graphics.fillRect(x + w / 2 - doorW / 2 + doorW - 4, y + h - 12, 2, 4)
}

// Per-building-call adapter: creates its own Graphics object, draws the
// facade onto it, depth-sorts it against the player/NPCs by its ground (y+h)
// position, and returns it wrapped in an array so every call site's existing
// `zoneObjects.push(...placeBuildingFacade(...))` pattern keeps working
// unchanged. `buildingId` is accepted but unused - it only mattered for
// asset-key selection when this drew from an external tileset.
export function procedural_placeBuildingFacade(scene, x, y, w, h, tintColor, buildingId = '') {
  void buildingId
  const graphics = scene.add.graphics()
  procedural_drawBuildingFacade(graphics, x, y, w, h, tintColor ?? 0xffffff)
  graphics.setDepth(y + h)
  return [graphics]
}

// ---------------------------------------------------------------------------
// Interior Room Renderer
// ---------------------------------------------------------------------------

// Draws a generic interior room (checkerboard floor + a desk/counter facade
// + its label) into `scene`, using an INTERIOR_TEMPLATES-shaped
// `{ floorA, floorB, deskColor, deskLabel }` entry (all plain color hex
// values / strings - no tileset indices needed). Shared by BaseTownScene's
// generic buildingInterior zone and Sapporo's own template set.
export function procedural_drawInteriorRoom(scene, zoneObjects, template = {}) {
  const INTERIOR_COLS = 12
  const INTERIOR_ROWS = 9
  const TILE_SIZE = 40
  const d = { c0: 5, r0: 2, c1: 6, r1: 3 }

  const floorA = template.floorA ?? 0x201c28
  const floorB = template.floorB ?? 0x1b1822

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

  const dx = d.c0 * TILE_SIZE
  const dy = d.r0 * TILE_SIZE
  const dw = (d.c1 - d.c0 + 1) * TILE_SIZE
  const dh = (d.r1 - d.r0 + 1) * TILE_SIZE
  const deskLabel = template.deskLabel || 'Counter'
  const deskColor = template.deskColor ?? 0x555555
  zoneObjects.push(...procedural_placeBuildingFacade(scene, dx, dy, dw, dh, deskColor, 'desk'))
  const label = scene.add
    .text(dx + dw / 2, dy - 12, deskLabel, { fontFamily: 'monospace', fontSize: '10px', color: '#ffffff' })
    .setOrigin(0.5, 1)
    .setDepth(dy + dh + 10)
  zoneObjects.push(label)
  return { dx, dy, dw, dh }
}
