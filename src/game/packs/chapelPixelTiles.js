// Hand-curated frame catalog for the chapel-pixel- pack (public/assets/packs/
// chapel-pixel-), derived from actually parsing the pack's real Tiled maps
// (Interior.tmx) with a throwaway build-time script (scratchpad/parseTmx.cjs
// - not shipped) rather than guessed. Same "real data hand-curated into a JS
// module" convention as pico8CityTiles.js/rpgUrbanTiles.js - no runtime
// XML/TMX parsing happens in the game itself, just plain frame-index data.
//
// SOURCE OF TRUTH - CORRECTED a second time this project. The very first
// version of this file claimed its frame indices were "confirmed by eye
// against a composited render," and that claim was false: the room built
// from it rendered as a black void with a truncated statue and props on the
// pews. This round re-derived every index from scratch, cross-checking THREE
// independent sources against each other rather than trusting one render:
// (1) the actual pack PNGs, viewed tile-by-tile with a grid overlay via a
// disposable puppeteer+canvas harness (not shipped - see the manager's
// session notes, not a repo file); (2) the real Tiled map that ships with
// the pack, public/assets/packs/chapel-pixel-/Tiled_files/Interior.tmx,
// grepped directly for its own layer GIDs; (3) a magenta-background alpha
// test per tile to catch transparent/near-empty frames a plain screenshot
// can hide. Two concrete errors that first pass got wrong, now fixed:
//   - Walls_Interior.png is 160x528 (10 cols x 33 rows), not 160x496/31 rows
//     as originally claimed - a real discrepancy, though harmless here since
//     frameIndex() only ever needed the (correct) column count.
//   - The statue pair's real footprint is 8 cols x 5 rows (bride ~cols0-3,
//     dragon ~cols4-7, both reaching row4 for their candle/rock bases) - NOT
//     4x3 as previously claimed. The 4x3 crop was silently taking only the
//     bride's head and torso and omitting the dragon completely; nothing in
//     that crop would have thrown, so nothing caught it except looking.
//
//   Walls_Interior.png      160x528  10 cols x 33 rows @16px (general-purpose
//                            PROP sheet - pillars, arches, pedestals, plaques,
//                            the dragon-medallion "window" - see wallFrame()/
//                            floorFrame() comments below for why there is no
//                            plain brick/floor tile anywhere in this file
//                            despite the misleading original file name)
//   Interior_objects.png    304x160  19 cols x 10 rows @16px  (benches/carpet/
//                            icons/plants)
//   Animation/Altar.png     192x32   12 cols x 2 rows  @16px
//   Animation/Statues.png   336x80   21 cols x 5 rows  @16px  (a repeating
//                            ghostly-bride + blue-dragon statue pair, one
//                            full pair per 8-column period - see
//                            statuesBlock())
//   Animation/Candelabra_alternative_fit.png  384x48  24 cols x 3 rows @16px
//                            - each of the 12 tiles in the authored 4x3 block
//                            (cols0-3,rows0-2) has its own baked <animation>
//                            in Interior.tmx: 3 frames advancing the SAME
//                            row by +8/+16 columns, 150ms each (grepped
//                            straight from the .tmx XML, not guessed).
//   Animation/Priest_speech.png  192x96  12 cols x 6 rows @16px (the small
//                            16x16-tile-grid version used AS wall-alcove
//                            decoration in the authored map, distinct from
//                            the full character sheet below)
//   Animation_packed/Priest/Priest_Idle_front.png       96x144  3x3 @32x48
//   Animation_packed/Monks/Monks_with_shadow/
//     Mon{1..4}k_Pray_front-Sheet.png                    96x96   3x3 @32x32
//   Animation_packed/Parishioners/Parishioner{1..11}_packed.png
//     - each a 4-column (facing/pose) x 12-row (frame) grid; cell size varies
//       per variant (native character art size differs slightly), computed
//       from each file's own pixel dimensions below - confirmed evenly
//       divisible (imageWidth/4 and imageHeight/12 are both whole numbers for
//       every one of the 11 files, see PARISHIONER_DIMS). Frame 0 (used
//       throughout) is a back/kneeling view - rendered and viewed directly:
//       each of the 11 is a genuinely distinct small creature/robe bust, not
//       a shared placeholder. They read as bust icons rather than full
//       seated bodies at this scale - a real art-style limitation of this
//       pack, not a further-fixable index bug.
const PACK_DIR = '/assets/packs/chapel-pixel-'

// Native pixel size every tile-grid (non-character) sheet below is sliced at.
export const CHAPEL_TILE = 16

export const CHAPEL_KEYS = {
  wallsInterior: 'chapelWallsInterior',
  interiorObjects: 'chapelInteriorObjects',
  altar: 'chapelAltar',
  statues: 'chapelStatues',
  candelabra: 'chapelCandelabra',
  alcoveFace: 'chapelAlcoveFace',
  priestIdle: 'chapelPriestIdle',
  monkPray: (n) => `chapelMonk${n}Pray`,
  parishioner: (n) => `chapelParishioner${n}`,
}

// { cols, rows } for each tile-grid sheet (native 16x16 cells) - frame index
// for (col,row) is row*cols+col, matching Phaser's spritesheet slicing order
// exactly (and matching the localId the parser resolved gids to, since both
// are the same row-major math over the same column count).
const TILE_SHEETS = {
  [CHAPEL_KEYS.wallsInterior]: { path: `${PACK_DIR}/PNG/Walls_Interior.png`, cols: 10, rows: 33 },
  [CHAPEL_KEYS.interiorObjects]: { path: `${PACK_DIR}/PNG/Interior_objects.png`, cols: 19, rows: 10 },
  [CHAPEL_KEYS.altar]: { path: `${PACK_DIR}/PNG/Animation/Altar.png`, cols: 12, rows: 2 },
  [CHAPEL_KEYS.statues]: { path: `${PACK_DIR}/PNG/Animation/Statues.png`, cols: 21, rows: 5 },
  [CHAPEL_KEYS.candelabra]: { path: `${PACK_DIR}/PNG/Animation/Candelabra_alternative_fit.png`, cols: 24, rows: 3 },
  [CHAPEL_KEYS.alcoveFace]: { path: `${PACK_DIR}/PNG/Animation/Priest_speech.png`, cols: 12, rows: 6 },
}

// Character sheets: { path, cols, rows } with a NATIVE cell size that differs
// per sheet (not 16x16) - frameWidth/frameHeight computed from each file's
// own pixel dimensions (imageWidth/cols, imageHeight/rows), all confirmed
// evenly divisible against the real PNGs (see file header).
const PRIEST_IDLE = { path: `${PACK_DIR}/PNG/Animation_packed/Priest/Priest_Idle_front.png`, w: 96, h: 144, cols: 3, rows: 3 }
const MONK_PRAY = { path: (n) => `${PACK_DIR}/PNG/Animation_packed/Monks/Monks_with_shadow/Mon${n}k_Pray_front-Sheet.png`, w: 96, h: 96, cols: 3, rows: 3 }
// n -> { w, h } of Parishioner{n}_packed.png (confirmed via decode, see file header).
const PARISHIONER_DIMS = {
  1: { w: 144, h: 576 },
  2: { w: 160, h: 384 },
  3: { w: 144, h: 384 },
  4: { w: 144, h: 384 },
  5: { w: 144, h: 384 },
  6: { w: 144, h: 384 },
  7: { w: 144, h: 384 },
  8: { w: 144, h: 384 },
  9: { w: 144, h: 384 },
  10: { w: 144, h: 384 },
  11: { w: 160, h: 576 },
}
const PARISHIONER_GRID = { cols: 4, rows: 12 }

export const CHAPEL_PARISHIONER_IDS = Object.keys(PARISHIONER_DIMS).map(Number)

// Guarded like every other pack loader in this project (preloadVehicleAssets,
// preloadPacks) - safe to call every scene create()/preload() without
// double-queuing loads on scene restart.
export function preloadChapelPack(scene) {
  for (const [key, def] of Object.entries(TILE_SHEETS)) {
    if (!scene.textures.exists(key)) {
      scene.load.spritesheet(key, def.path, { frameWidth: CHAPEL_TILE, frameHeight: CHAPEL_TILE, spacing: 0, margin: 0 })
    }
  }
  if (!scene.textures.exists(CHAPEL_KEYS.priestIdle)) {
    scene.load.spritesheet(CHAPEL_KEYS.priestIdle, PRIEST_IDLE.path, {
      frameWidth: PRIEST_IDLE.w / PRIEST_IDLE.cols,
      frameHeight: PRIEST_IDLE.h / PRIEST_IDLE.rows,
    })
  }
  for (let n = 1; n <= 4; n++) {
    const key = CHAPEL_KEYS.monkPray(n)
    if (!scene.textures.exists(key)) {
      scene.load.spritesheet(key, MONK_PRAY.path(n), {
        frameWidth: MONK_PRAY.w / MONK_PRAY.cols,
        frameHeight: MONK_PRAY.h / MONK_PRAY.rows,
      })
    }
  }
  for (const n of CHAPEL_PARISHIONER_IDS) {
    const key = CHAPEL_KEYS.parishioner(n)
    if (!scene.textures.exists(key)) {
      const dims = PARISHIONER_DIMS[n]
      scene.load.spritesheet(key, `${PACK_DIR}/PNG/Animation_packed/Parishioners/Parishioner${n}_packed.png`, {
        frameWidth: dims.w / PARISHIONER_GRID.cols,
        frameHeight: dims.h / PARISHIONER_GRID.rows,
      })
    }
  }
}

function frameIndex(key, col, row) {
  const sheet = TILE_SHEETS[key]
  return row * sheet.cols + col
}

// ---- Furniture/decoration blocks (each cell: {dc, dr, key, frame}, offsets
// relative to the block's own anchor col/row) --------------------------------

export function altarBlock() {
  const k = CHAPEL_KEYS.altar
  return [
    { dc: 0, dr: 0, key: k, frame: frameIndex(k, 0, 0) },
    { dc: 1, dr: 0, key: k, frame: frameIndex(k, 1, 0) },
    { dc: 0, dr: 1, key: k, frame: frameIndex(k, 0, 1) },
    { dc: 1, dr: 1, key: k, frame: frameIndex(k, 1, 1) },
  ]
}

// The authored bride+dragon statue pair as one 8x5 unit. Kept for callers
// that want both together (none currently do - see brideStatueBlock() /
// dragonStatueBlock() below for the split version production/
// chapel-reference.md actually calls for: bride flanking one side of the
// pews, dragon flanking the other, NOT standing together).
//
// CORRECTED this round: a prior version of this function cropped only 4x3
// cols0-3/rows0-2, which - confirmed by actually rendering it and looking,
// not by re-reading this comment - captured just the bride statue's head and
// torso and cut off her base entirely, while excluding the dragon (which
// starts at col4) altogether. Re-measured directly against the real PNG
// (public/assets/packs/chapel-pixel-/PNG/Animation/Statues.png, viewed tile
// by tile with a grid overlay): one full pair occupies cols0-7 x rows0-4 -
// bride roughly cols0-3, dragon roughly cols4-7, both figures' bases/candles
// reaching down to row4. That is the region actually used here now.
export function statuesBlock() {
  const k = CHAPEL_KEYS.statues
  const cells = []
  for (let r = 0; r < 5; r++) for (let c = 0; c < 8; c++) cells.push({ dc: c, dr: r, key: k, frame: frameIndex(k, c, r) })
  return cells
}

// Bride only - left half (cols0-3) of the same 8x5 pair region above.
export function brideStatueBlock() {
  const k = CHAPEL_KEYS.statues
  const cells = []
  for (let r = 0; r < 5; r++) for (let c = 0; c < 4; c++) cells.push({ dc: c, dr: r, key: k, frame: frameIndex(k, c, r) })
  return cells
}

// Dragon only - right half (cols4-7) of the same 8x5 pair region above.
export function dragonStatueBlock() {
  const k = CHAPEL_KEYS.statues
  const cells = []
  for (let r = 0; r < 5; r++) for (let c = 0; c < 4; c++) cells.push({ dc: c, dr: r, key: k, frame: frameIndex(k, 4 + c, r) })
  return cells
}

// The dragon-crest medallion "window" - confirmed against Interior.tmx's own
// Windows layer (grepped the real GIDs it paints: they resolve into this
// exact 3x3 region of Walls_Interior.png, not a separate windows tileset).
// Doubles as the reference's "tall stained-glass window" and "red dragon
// banner" - the pack only has one dragon-crest asset, used for both roles in
// the authored map, so this project does the same rather than fabricate a
// second graphic the pack doesn't ship.
export function dragonMedallionBlock() {
  const k = CHAPEL_KEYS.wallsInterior
  const cells = []
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) cells.push({ dc: c, dr: r, key: k, frame: frameIndex(k, 2 + c, 22 + r) })
  return cells
}

// The narrow pointed-arch accent flanking the medallion in the authored map
// (same Windows layer, same source region) - used as a smaller window/banner
// accent where a full 3x3 medallion won't fit.
export function windowAccentColumn() {
  const k = CHAPEL_KEYS.wallsInterior
  const cells = []
  for (let r = 0; r < 3; r++) cells.push({ dc: 0, dr: r, key: k, frame: frameIndex(k, 1, 22 + r) })
  return cells
}

// 4x3 candelabra block; each cell also carries its baked 3-frame flicker
// animation (base, base+8, base+16 - grepped from Interior.tmx, see header).
export function candelabraBlock() {
  const k = CHAPEL_KEYS.candelabra
  const cells = []
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 4; c++) {
      const base = frameIndex(k, c, r)
      cells.push({ dc: c, dr: r, key: k, frame: base, animFrames: [base, base + 8, base + 16] })
    }
  }
  return cells
}

// A single animated candelabra column (just the left slice of the 4x3 block,
// 1 wide x 3 tall) - used for the smaller wall-mounted accents lining the
// nave, so "candelabras along the side walls" reads as more than one fixture
// without needing the full 4-wide block to fit against a 1-tile-thick wall.
export function candelabraColumn() {
  const k = CHAPEL_KEYS.candelabra
  const cells = []
  for (let r = 0; r < 3; r++) {
    const base = frameIndex(k, 0, r)
    cells.push({ dc: 0, dr: r, key: k, frame: base, animFrames: [base, base + 8, base + 16] })
  }
  return cells
}

export function benchRow(width = 3) {
  const k = CHAPEL_KEYS.interiorObjects
  const cells = []
  for (let c = 0; c < width; c++) cells.push({ dc: c, dr: 0, key: k, frame: frameIndex(k, 8 + c, 2) })
  return cells
}

export function iconCrossBlock() {
  const k = CHAPEL_KEYS.interiorObjects
  return [
    { dc: 0, dr: 0, key: k, frame: frameIndex(k, 0, 8) },
    { dc: 1, dr: 0, key: k, frame: frameIndex(k, 1, 8) },
    { dc: 0, dr: 1, key: k, frame: frameIndex(k, 0, 9) },
    { dc: 1, dr: 1, key: k, frame: frameIndex(k, 1, 9) },
  ]
}

export function plantWideBlock() {
  const k = CHAPEL_KEYS.interiorObjects
  const cells = []
  for (let r = 0; r < 3; r++) for (let c = 0; c < 2; c++) cells.push({ dc: c, dr: r, key: k, frame: frameIndex(k, 10 + c, 5 + r) })
  return cells
}

// CORRECTED this round (found during a fresh side-by-side pass against
// production/chapel-reference.md, not because it was named directly): the
// previous crop, col4/rows3-4, actually lands INSIDE the dragon statue
// artwork's bounding box (Statues.png's dragon spans roughly cols4-7 - wait,
// this is a DIFFERENT sheet, Interior_objects.png, where cols4-5/rows2-4
// hold a small necklace-pendant icon, not a plant at all. Confirmed by
// rendering the full Interior_objects.png sheet with a grid overlay: the
// real flower-in-a-vase art (matching the reference's "flower vases
// (blue/purple flowers)") is a 1-wide x 3-tall column at rows5-7, repeated
// with minor variations at cols 2, 5, 9, and 10. `variant` picks one of
// those four so the four vase placements in the room aren't all identical.
export function plantNarrowBlock(variant = 0) {
  const k = CHAPEL_KEYS.interiorObjects
  const col = [2, 5, 9, 10][variant % 4]
  return [
    { dc: 0, dr: 0, key: k, frame: frameIndex(k, col, 5) },
    { dc: 0, dr: 1, key: k, frame: frameIndex(k, col, 6) },
    { dc: 0, dr: 2, key: k, frame: frameIndex(k, col, 7) },
  ]
}

// CORRECTED this round: the human flagged "the rug on the floor feels
// wrong." The previous carpetTile()/carpetRun() repeated a SINGLE frame
// (col0, row0 - just the runner's top cap) for every tile of the aisle,
// which is why it read as a flat repeating pattern rather than a coherent
// light-strip. Rendering the full Interior_objects.png sheet showed the
// carpet is actually a real 2-col x 8-row vertical runner graphic with a
// distinct bright cross-band partway down (the closest thing this pack has
// to a "glowing light spilling onto the floor" effect) - cross-checked
// against Interior.tmx's own Carpet layer GIDs, which do use all 8 rows of
// both columns, not just row0. carpetFrame(colParity, rowInRun) exposes the
// full sequence; rowInRun wraps every 8 tiles so a longer aisle repeats the
// whole runner motif (cap, glow band, shaft, base) instead of one frame.
export function carpetFrame(colParity, rowInRun) {
  const k = CHAPEL_KEYS.interiorObjects
  return { key: k, frame: frameIndex(k, colParity % 2, rowInRun % 8) }
}

// CORRECTED this round (see production/chapel-reference.md - the human's
// exact reference doc, flagged "person was split in half"): the previous
// version of this function cropped 1 col x 3 rows starting at (0,0) of
// Priest_speech.png. Rendering that sheet full-size and looking at it
// directly showed the real character art is 2 COLUMNS wide per figure (the
// face/robe spans cols[0-1], with row0 being blank headroom and the actual
// portrait occupying rows[1-2]) - the 1-wide crop was taking only the left
// half of the figure every time, which is exactly what "split in half"
// looks like. Every column checked (0 through 11) shows the same portrait
// repeated rather than distinct hair colors, so this pack does not appear to
// ship the reference's distinct green-haired/auburn-haired alcove variants -
// both alcove positions reuse this one portrait, an honest simplification
// rather than a fabricated second variant.
export function alcoveFaceBlock() {
  const k = CHAPEL_KEYS.alcoveFace
  const cells = []
  for (let r = 0; r < 2; r++) for (let c = 0; c < 2; c++) cells.push({ dc: c, dr: r, key: k, frame: frameIndex(k, c, 1 + r) })
  return cells
}

// CORRECTED this round: production/chapel-reference.md (the human's precise
// description of the actual target image, which does not exist anywhere in
// the pack folder - it's an external marketing composite) says the floor and
// walls are "light blue-grey stone... cool tone," not the near-black flat
// fill used previously. That near-black tile WAS confirmed real and opaque
// (see git history), but it was the wrong color family entirely, not a
// broken tile.
//
// Re-scanned the full Walls_Interior.png sheet (all 33 rows, not just the
// 0-26 range checked last round) specifically for a lighter cool tile, and
// found a genuinely matching one: rows 28-30 hold a large flat blue-grey
// panel (used here for the wall fill, col1 row29 - opaque, confirmed via a
// magenta-background alpha test), and rows 31-32 hold a 2x2 diamond/checker
// motif in the same blue-grey (cols2-3) - "light blue-grey stone, subtle
// diamond/checker pattern" from the reference, almost exactly. Both were
// outside the tileset's own declared 310-tile/31-row count in Interior.tmx
// (a stale count in that file, not something this project controls) but
// Phaser's spritesheet loader slices by pixel dimensions, not that count, so
// the extra rows load and render fine - confirmed by rendering them.
export function wallFrame() {
  const k = CHAPEL_KEYS.wallsInterior
  return { key: k, frame: frameIndex(k, 1, 29) }
}

// floorFrame(col, row) - picks the correct one of the 2x2 diamond sub-tiles
// so adjacent floor cells tile into one continuous diamond/checker pattern
// instead of a single tile repeated (which would look like a grid of
// separate diamonds, not a woven checker floor).
export function floorFrame(col, row) {
  const k = CHAPEL_KEYS.wallsInterior
  return { key: k, frame: frameIndex(k, 2 + (col % 2), 31 + (row % 2)) }
}

export function priestIdleFrame() {
  return { key: CHAPEL_KEYS.priestIdle, frame: 0, nativeHeight: PRIEST_IDLE.h / PRIEST_IDLE.rows }
}

export function monkPrayFrame(n) {
  return { key: CHAPEL_KEYS.monkPray(n), frame: 0, nativeHeight: MONK_PRAY.h / MONK_PRAY.rows }
}

export function parishionerFrame(n) {
  const dims = PARISHIONER_DIMS[n]
  return { key: CHAPEL_KEYS.parishioner(n), frame: 0, nativeHeight: dims.h / PARISHIONER_GRID.rows }
}
