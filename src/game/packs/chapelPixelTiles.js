// Hand-curated frame catalog for the chapel-pixel- pack (public/assets/packs/
// chapel-pixel-), derived from actually parsing the pack's real Tiled maps
// (Interior.tmx) with a throwaway build-time script (scratchpad/parseTmx.cjs
// - not shipped) rather than guessed. Same "real data hand-curated into a JS
// module" convention as pico8CityTiles.js/rpgUrbanTiles.js - no runtime
// XML/TMX parsing happens in the game itself, just plain frame-index data.
//
// SOURCE OF TRUTH (verified against interior_parsed.json + a composited PNG
// render of the authored map - both tools/renders are throwaway artifacts,
// not shipped):
//   Walls_Interior.png      160x496  10 cols x 31 rows @16px  (general-purpose
//                            brick/stone/window tileset - reused by a SECOND
//                            building's interior too, see tmxWallInterior.js)
//   Interior_objects.png    304x160  19 cols x 10 rows @16px  (benches/carpet/
//                            icons/plants)
//   Animation/Altar.png     192x32   12 cols x 2 rows  @16px
//   Animation/Statues.png   336x80   21 cols x 5 rows  @16px  (a repeating
//                            ghostly-bride + blue-dragon statue pair - the
//                            authored map's own placement (cols0-3,rows0-2)
//                            already captures ONE full pair side by side,
//                            confirmed by eye against the composited render -
//                            reused whole rather than risking a mid-sprite
//                            crop to split bride/dragon apart)
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
//       every one of the 11 files, see PARISHIONER_DIMS).
//
// All of the above were confirmed against the composited render
// (scratchpad/chapel_interior_composed.png / _cropped.png) before being
// trusted here - the render's altar/statues/candelabra/windows all land
// exactly where the authored map places them.
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
  [CHAPEL_KEYS.wallsInterior]: { path: `${PACK_DIR}/PNG/Walls_Interior.png`, cols: 10, rows: 31 },
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

// The authored bride+dragon statue pair, kept as one 4x3 unit (see file
// header for why it isn't split into two independent statues).
export function statuesBlock() {
  const k = CHAPEL_KEYS.statues
  const cells = []
  for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) cells.push({ dc: c, dr: r, key: k, frame: frameIndex(k, c, r) })
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

export function plantNarrowBlock() {
  const k = CHAPEL_KEYS.interiorObjects
  return [
    { dc: 0, dr: 0, key: k, frame: frameIndex(k, 4, 3) },
    { dc: 0, dr: 1, key: k, frame: frameIndex(k, 4, 4) },
  ]
}

export function carpetTile() {
  const k = CHAPEL_KEYS.interiorObjects
  return { key: k, frame: frameIndex(k, 0, 0) }
}

// A single robed face stacked 3 tall - the authored map's own "two small
// figures peeking from wall alcoves" decoration.
export function alcoveFaceColumn() {
  const k = CHAPEL_KEYS.alcoveFace
  return [
    { dc: 0, dr: 0, key: k, frame: frameIndex(k, 0, 0) },
    { dc: 0, dr: 1, key: k, frame: frameIndex(k, 0, 1) },
    { dc: 0, dr: 2, key: k, frame: frameIndex(k, 0, 2) },
  ]
}

export function wallFrame() {
  return { key: CHAPEL_KEYS.wallsInterior, frame: frameIndex(CHAPEL_KEYS.wallsInterior, 1, 1) }
}

// Two alternating stone-floor tiles for a plain checkerboard - both verified
// against the composited render (the authored room's own floor uses this
// same pair, just with row-parity swapped - the exact parity doesn't matter,
// only that the two tiles read as a coherent checkerboard together).
export function floorFrame(parity) {
  const k = CHAPEL_KEYS.wallsInterior
  return parity ? { key: k, frame: frameIndex(k, 9, 21) } : { key: k, frame: frameIndex(k, 8, 20) }
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
