// Kenney tile-pack rendering helpers (modern-city / tiny-town / rpg-urban /
// pico-8-city).
//
// This module is self-contained and NOT wired into tileGen.js or
// OverworldScene.js yet - the manager does that once the sibling catalog
// agents (modernCityTiles.js, tinyTownTiles.js, rpgUrbanTiles.js,
// pico8CityTiles.js) land the real tile-index maps for each pack. This file
// only provides the generic loading + nine-slice/tiling/prefab machinery; it
// never invents tile indices of its own - all indices come from the `kit`
// objects callers pass in.
//
// All four packed spritesheets are clean grids with zero spacing/margin, so
// frame index = row * cols + col (Phaser's default spritesheet frame
// numbering already matches this) - but they are NOT all the same native
// tile size: modern-city/tiny-town/rpg-urban are 16px grids, while
// pico-8-city is an 8px grid (confirmed via its own Tiled/sample-sheet.tsx:
// tilewidth=8 tileheight=8, 24 cols x 15 rows = 360 tiles). PACK_SHEET_DEFS
// below records each sheet's own native tile size so preloadPacks can load
// each spritesheet with the right frameWidth/frameHeight, and placeFrame/
// placePackProp can derive the correct per-sheet scale (world TILE_SIZE /
// that sheet's native size) instead of assuming 16 for everything - a plain
// generalization, not a behavior change: the three original packs still
// resolve to TILE_SIZE / 16 exactly as before.
//
// World TILE_SIZE is 40px, so a 16px frame draws at 2.5x and an 8px frame
// draws at 5x. pixelArt: true is already set globally in GameCanvas.jsx, so
// nearest-neighbor scaling is automatic - this module never touches texture
// filtering itself.

export const USE_KENNEY_PACKS = true

// ---------------------------------------------------------------------------
// Sheet keys + preload
// ---------------------------------------------------------------------------

export const PACK_SHEET_KEYS = {
  modernCity: 'kenney_modern_city_sheet',
  tinyTown: 'kenney_tiny_town_sheet',
  rpgUrban: 'kenney_rpg_urban_sheet',
  // NOTE: deliberately NOT 'kenney_pico8_city' - vehicleGen.js already loads
  // the same tilemap_packed.png under that exact key (as a plain image, for
  // its own manual 8x16 car-frame carving via ensurePico8CarFrames). Reusing
  // that key here would either collide or - if Phaser preload de-dupes by
  // key and just skips the second load call - leave this module holding a
  // plain-image texture with no frame grid instead of the spritesheet it
  // asked for. A distinct key means both loaders fetch the same PNG under
  // their own texture, which is the same one-loader-per-key pattern already
  // used by every other pack here.
  pico8City: 'kenney_pico8_city_sheet',
  // NOT reusing ASSET_KEYS.sereneVillage ('serene_village') from tileGen.js -
  // that key belongs to a different, currently-dead asset path (an older
  // Serene_Village_revamped_v1.9/RPG_MAKER_MV re-export only ever loaded
  // behind the `!USE_PROCEDURAL_GRAPHICS` branch, which never runs since
  // USE_PROCEDURAL_GRAPHICS is hardcoded true - see preloadTerrainAssets).
  // This key loads the real SERENE_VILLAGE_REVAMPED/Serene_Village_16x16.png
  // sheet unconditionally, same as the four packs above.
  sereneVillage: 'serene_village_cottage_sheet',
}

const PACK_SHEET_DEFS = {
  [PACK_SHEET_KEYS.modernCity]: { path: '/assets/packs/kenney_roguelike-modern-city/Tilemap/tilemap_packed.png', tileSize: 16 },
  [PACK_SHEET_KEYS.tinyTown]: { path: '/assets/packs/kenney_tiny-town/Tilemap/tilemap_packed.png', tileSize: 16 },
  [PACK_SHEET_KEYS.rpgUrban]: { path: '/assets/packs/kenney_rpg-urban-pack/Tilemap/tilemap_packed.png', tileSize: 16 },
  [PACK_SHEET_KEYS.pico8City]: { path: '/assets/packs/kenney_pico-8-city/Tilemap/tilemap_packed.png', tileSize: 8 },
  [PACK_SHEET_KEYS.sereneVillage]: { path: '/assets/packs/SERENE_VILLAGE_REVAMPED/Serene_Village_16x16.png', tileSize: 16 },
}

// ---------------------------------------------------------------------------
// Serene Village animated door (Animated stuff/door_16x16.png)
// ---------------------------------------------------------------------------
// A clean 4-frame horizontal strip (64x16px, frameWidth/frameHeight 16,
// 0 spacing/margin) confirmed by direct inspection: frame 0 = fully closed,
// frame 1 = slightly ajar, frame 2 = more open, frame 3 = fully open (dark
// opening). Loaded/animated separately from the main sheet above - it's its
// own small PNG, not a slice of Serene_Village_16x16.png. See
// OverworldScene.js for how the resulting sprite is positioned (over the
// wall tile a Serene Village cottage prefab's own door slot occupies - see
// prefabTileWorldPos below) and driven (played on building-entry proximity).
export const SERENE_VILLAGE_DOOR_KEY = 'serene_village_door_sheet'
const SERENE_VILLAGE_DOOR_PATH = '/assets/packs/SERENE_VILLAGE_REVAMPED/Animated%20stuff/door_16x16.png'
export const SERENE_DOOR_ANIM_OPEN = 'serene_door_open'
export const SERENE_DOOR_ANIM_CLOSE = 'serene_door_close'

// Call alongside preloadPacks (see preloadTerrainAssets in tileGen.js) -
// guarded the same way.
export function preloadSereneVillageDoor(scene) {
  if (!scene.textures.exists(SERENE_VILLAGE_DOOR_KEY)) {
    scene.load.spritesheet(SERENE_VILLAGE_DOOR_KEY, SERENE_VILLAGE_DOOR_PATH, { frameWidth: 16, frameHeight: 16, spacing: 0, margin: 0 })
  }
}

// Call from a scene's create() (after preload assets have landed, same
// reasoning as vehicleGen.js's ensurePico8CarFrames) - registers the two
// anims on the scene's AnimationManager once. 'open' plays frames 0->3
// (closed to fully open); 'close' reverses it (Phaser's generateFrameNumbers
// counts down when start > end). repeat: 0 so each anim plays once and holds
// on its last frame instead of looping.
export function ensureSereneVillageDoorAnims(scene) {
  if (!scene.anims.exists(SERENE_DOOR_ANIM_OPEN)) {
    scene.anims.create({
      key: SERENE_DOOR_ANIM_OPEN,
      frames: scene.anims.generateFrameNumbers(SERENE_VILLAGE_DOOR_KEY, { start: 0, end: 3 }),
      frameRate: 8,
      repeat: 0,
    })
  }
  if (!scene.anims.exists(SERENE_DOOR_ANIM_CLOSE)) {
    scene.anims.create({
      key: SERENE_DOOR_ANIM_CLOSE,
      frames: scene.anims.generateFrameNumbers(SERENE_VILLAGE_DOOR_KEY, { start: 3, end: 0 }),
      frameRate: 8,
      repeat: 0,
    })
  }
}

// Call from a scene's preload(). Guards each load with textures.exists(),
// matching the pattern already used in tileGen.js's preloadTerrainAssets().
export function preloadPacks(scene) {
  for (const [key, def] of Object.entries(PACK_SHEET_DEFS)) {
    if (!scene.textures.exists(key)) {
      scene.load.spritesheet(key, def.path, { frameWidth: def.tileSize, frameHeight: def.tileSize, spacing: 0, margin: 0 })
    }
  }
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

// A sheet's own native tile size in source pixels - 16 for the three
// original packs, 8 for pico-8-city. Falls back to 16 (the pre-existing
// hardcoded assumption) for any sheetKey this module doesn't recognize, so a
// caller passing an unregistered key degrades to old behavior instead of
// dividing by undefined.
function nativeTileSize(sheetKey) {
  return PACK_SHEET_DEFS[sheetKey]?.tileSize ?? 16
}

// Places a single native-size frame as a scaled Phaser image with top-left
// origin at (px, py) in world pixels. Depth is set by the caller (nine-slice
// functions depth-sort the whole facade at once; placePackProp depth-sorts
// per prop).
function placeFrame(scene, px, py, tileSize, sheetKey, frame) {
  const scale = tileSize / nativeTileSize(sheetKey)
  const img = scene.add.image(px, py, sheetKey, frame).setOrigin(0, 0).setScale(scale)
  return img
}

// Resolves a possibly-missing kit slot to a fallback frame index (or null if
// nothing usable is available at all). Used so a partial/incomplete kit
// (e.g. tiny-town cottages that lack some wall slots) degrades gracefully
// instead of throwing or leaving gaps.
function resolveFrame(kit, key, fallbackKey) {
  if (kit && kit[key] !== undefined && kit[key] !== null) return kit[key]
  if (fallbackKey && kit && kit[fallbackKey] !== undefined && kit[fallbackKey] !== null) return kit[fallbackKey]
  return null
}

// ---------------------------------------------------------------------------
// Nine-slice facade
// ---------------------------------------------------------------------------

// kit = {
//   roof: { l, m, r } | null,       // optional flat roof row across the top
//   wall: { tl, t, tr, l, m, r, bl, b, br },  // nine-slice wall frames
//   window: number | null,          // optional frame stamped mid-wall
//   door: number,                   // frame stamped bottom-center
// }
//
// Tiles an arbitrary w x h footprint (in TILE_SIZE units) using corner
// frames at the 4 corners, edge frames along the 4 edges, center fill
// everywhere else, an optional roof row replacing the top wall row, and a
// door frame at bottom-center. Degenerate sizes (1 column and/or 1 row) are
// handled explicitly below so nothing throws or leaves a gap.
export function drawNineSliceFacade(scene, x, y, wPx, hPx, TILE_SIZE, sheetKey, kit) {
  const objs = []
  const cols = Math.max(1, Math.round(wPx / TILE_SIZE))
  const rows = Math.max(1, Math.round(hPx / TILE_SIZE))
  const wall = kit.wall || {}
  const hasRoof = !!kit.roof
  const roofRow = hasRoof ? 0 : -1 // row index (within this facade) used by the roof, if any
  const wallRows = hasRoof ? rows - 1 : rows // remaining rows are wall rows (>= 0)

  // --- Roof row (optional), spans full width ---------------------------------
  if (hasRoof && wallRows >= 0) {
    for (let c = 0; c < cols; c++) {
      let frame
      if (cols === 1) frame = resolveFrame(kit.roof, 'm', 'l') ?? resolveFrame(kit.roof, 'l')
      else if (c === 0) frame = resolveFrame(kit.roof, 'l', 'm')
      else if (c === cols - 1) frame = resolveFrame(kit.roof, 'r', 'm')
      else frame = resolveFrame(kit.roof, 'm', 'l')
      if (frame === null || frame === undefined) continue
      const px = x + c * TILE_SIZE
      const py = y + roofRow * TILE_SIZE
      objs.push(placeFrame(scene, px, py, TILE_SIZE, sheetKey, frame))
    }
  }

  // --- Wall rows ---------------------------------------------------------------
  // rowOffset: pixel row index (0-based within the facade) where wall rows begin.
  const rowOffset = hasRoof ? 1 : 0
  for (let r = 0; r < wallRows; r++) {
    const isTopWallRow = r === 0
    const isBottomWallRow = r === wallRows - 1
    for (let c = 0; c < cols; c++) {
      const isLeftCol = c === 0
      const isRightCol = c === cols - 1
      let frame

      if (wallRows === 1) {
        // Single wall row: no distinct top/bottom, only left/mid/right (or tl/tr as best corners).
        if (cols === 1) {
          frame = resolveFrame(wall, 'm', 'tl')
        } else if (isLeftCol) {
          frame = resolveFrame(wall, 'l', 'tl')
        } else if (isRightCol) {
          frame = resolveFrame(wall, 'r', 'tr')
        } else {
          frame = resolveFrame(wall, 'm', 't')
        }
      } else if (isTopWallRow && isLeftCol) frame = resolveFrame(wall, 'tl', 'l')
      else if (isTopWallRow && isRightCol) frame = resolveFrame(wall, 'tr', 'r')
      else if (isBottomWallRow && isLeftCol) frame = resolveFrame(wall, 'bl', 'l')
      else if (isBottomWallRow && isRightCol) frame = resolveFrame(wall, 'br', 'r')
      else if (isTopWallRow) frame = resolveFrame(wall, 't', 'm')
      else if (isBottomWallRow) frame = resolveFrame(wall, 'b', 'm')
      else if (isLeftCol) frame = resolveFrame(wall, 'l', 'm')
      else if (isRightCol) frame = resolveFrame(wall, 'r', 'm')
      else frame = resolveFrame(wall, 'm')

      if (frame === null || frame === undefined) continue
      const px = x + c * TILE_SIZE
      const py = y + (rowOffset + r) * TILE_SIZE
      objs.push(placeFrame(scene, px, py, TILE_SIZE, sheetKey, frame))
    }
  }

  // --- Optional window, stamped mid-wall on the top wall row if there's room ---
  if (kit.window !== undefined && kit.window !== null && wallRows >= 1 && cols >= 3) {
    const c = Math.floor(cols / 2)
    const px = x + c * TILE_SIZE
    const py = y + rowOffset * TILE_SIZE
    objs.push(placeFrame(scene, px, py, TILE_SIZE, sheetKey, kit.window))
  }

  // --- Door, stamped bottom-center over whatever wall tile is already there ---
  if (kit.door !== undefined && kit.door !== null && wallRows >= 1) {
    const c = Math.floor((cols - 1) / 2)
    const px = x + c * TILE_SIZE
    const py = y + (rowOffset + wallRows - 1) * TILE_SIZE
    objs.push(placeFrame(scene, px, py, TILE_SIZE, sheetKey, kit.door))
  }

  const depth = y + hPx
  for (const o of objs) o.setDepth(depth)
  return objs
}

// ---------------------------------------------------------------------------
// Peaked-roof cottage variant (tiny-town style)
// ---------------------------------------------------------------------------

// Same as drawNineSliceFacade but kit.roof = { l, peak, r } is drawn as a
// single PEAKED roof row: left slope tile, peak tile(s) across the middle,
// right slope tile. If tiny-town's wall kit turns out to only have a subset
// of the nine slots (e.g. no distinct corners), resolveFrame's fallback
// chain (falling back to wall.m) keeps this from crashing or leaving holes -
// write kit.wall with as many or as few slots as actually exist in the pack.
export function drawPeakedCottage(scene, x, y, wPx, hPx, TILE_SIZE, sheetKey, kit) {
  const objs = []
  const cols = Math.max(1, Math.round(wPx / TILE_SIZE))
  const rows = Math.max(1, Math.round(hPx / TILE_SIZE))
  const roof = kit.roof || {}
  const wallRows = Math.max(0, rows - 1)

  // --- Peaked roof row ---------------------------------------------------------
  for (let c = 0; c < cols; c++) {
    let frame
    if (cols === 1) {
      frame = resolveFrame(roof, 'peak', 'l') ?? resolveFrame(roof, 'l')
    } else if (c === 0) {
      frame = resolveFrame(roof, 'l', 'peak')
    } else if (c === cols - 1) {
      frame = resolveFrame(roof, 'r', 'peak')
    } else {
      frame = resolveFrame(roof, 'peak', 'l')
    }
    if (frame === null || frame === undefined) continue
    const px = x + c * TILE_SIZE
    objs.push(placeFrame(scene, px, y, TILE_SIZE, sheetKey, frame))
  }

  // --- Walls + door below the roof, reusing the nine-slice wall logic ---------
  if (wallRows > 0) {
    const wallKit = { wall: kit.wall || {}, window: kit.window ?? null, door: kit.door ?? null }
    const wallObjs = drawNineSliceFacade(
      scene,
      x,
      y + TILE_SIZE,
      wPx,
      wallRows * TILE_SIZE,
      TILE_SIZE,
      sheetKey,
      wallKit,
    )
    objs.push(...wallObjs)
  }

  const depth = y + hPx
  for (const o of objs) o.setDepth(depth)
  return objs
}

// ---------------------------------------------------------------------------
// Prefab (fixed-size, non-nine-slicing) facade
// ---------------------------------------------------------------------------

// Some Kenney facade families are discrete pre-made building blocks (a
// complete building outline baked at one fixed size, e.g. 2x2 tiles) rather
// than a true nine-slice - naively repeating their edge/fill frames past
// their native size reproduces the closed outline mid-wall and shows up as
// a visible seam. Use this path for those families instead of
// drawNineSliceFacade.
//
// block = { cols, rows, frames } where frames is a 2D array frames[row][col]
// of frame indices (row 0 = top), sized exactly cols x rows - i.e. the
// prefab's OWN native size, not the target footprint.
//
// HOUSE RULE for target footprints that don't match the prefab's native
// size: rather than re-tiling the prefab (which produces the seam this
// function exists to avoid), the prefab is drawn at its native pixel size
// and CENTERED within the requested footprint; any leftover footprint area
// around it is filled with `fillFrame` (a single flat frame index, e.g. a
// plain wall/ground fill tile) if the caller supplies one, or simply left
// empty if not - centering was chosen over stretching because Kenney's
// pixel-art frames distort visibly under non-integer scale, and over
// corner-anchoring because centering reads as "one building on its lot"
// for both larger and smaller target sizes. If the footprint is SMALLER
// than the prefab's native size, the prefab is drawn at native size anyway
// (an oversized-but-undistorted building reads better than a cropped or
// squashed one) - callers that care should snap building sizes to the
// prefab's native size instead of relying on this fallback.
// Shared centering math for a fixed-size prefab drawn within a possibly
// larger/smaller footprint (see drawPrefabFacade's HOUSE RULE above for why
// centering-not-stretching was chosen). Snaps to whole tiles for the same
// grid-alignment reason drawPrefabFacade itself needs it. Exported so a
// caller that needs to know exactly WHERE within the footprint the prefab
// landed - e.g. placing an overlay sprite on one specific tile inside it,
// see prefabTileWorldPos below - reuses this instead of re-deriving it and
// risking drift from what drawPrefabFacade actually drew.
export function prefabOrigin(x, y, wPx, hPx, TILE_SIZE, cols, rows) {
  const nativeW = cols * TILE_SIZE
  const nativeH = rows * TILE_SIZE
  const offsetTilesX = Math.round((wPx - nativeW) / 2 / TILE_SIZE)
  const offsetTilesY = Math.round((hPx - nativeH) / 2 / TILE_SIZE)
  return { x: x + offsetTilesX * TILE_SIZE, y: y + offsetTilesY * TILE_SIZE, offsetTilesX, offsetTilesY }
}

// Resolves the world-pixel top-left of one specific tile WITHIN a prefab
// block (e.g. the door tile in a Serene Village cottage's wall row) given
// the exact same (x, y, wPx, hPx, TILE_SIZE) a drawPrefabFacade call for
// that same block used - so the two always agree on where the block landed.
// tileCol/tileRow are 0-based coordinates in the prefab's OWN grid (not the
// target footprint).
export function prefabTileWorldPos(x, y, wPx, hPx, TILE_SIZE, cols, rows, tileCol, tileRow) {
  const origin = prefabOrigin(x, y, wPx, hPx, TILE_SIZE, cols, rows)
  return { x: origin.x + tileCol * TILE_SIZE, y: origin.y + tileRow * TILE_SIZE }
}

export function drawPrefabFacade(scene, x, y, wPx, hPx, TILE_SIZE, sheetKey, block, fillFrame = null) {
  const objs = []
  const cols = Math.max(1, block?.cols || (block?.frames?.[0]?.length ?? 1))
  const rows = Math.max(1, block?.rows || (block?.frames?.length ?? 1))
  const frames = block?.frames || []

  const origin = prefabOrigin(x, y, wPx, hPx, TILE_SIZE, cols, rows)
  const originX = origin.x
  const originY = origin.y

  // Optional fill for footprint tiles outside the centered prefab.
  if (fillFrame !== null && fillFrame !== undefined) {
    const footprintCols = Math.max(1, Math.round(wPx / TILE_SIZE))
    const footprintRows = Math.max(1, Math.round(hPx / TILE_SIZE))
    const blockC0 = origin.offsetTilesX
    const blockR0 = origin.offsetTilesY
    for (let r = 0; r < footprintRows; r++) {
      for (let c = 0; c < footprintCols; c++) {
        const insideBlock = c >= blockC0 && c < blockC0 + cols && r >= blockR0 && r < blockR0 + rows
        if (insideBlock) continue
        const px = x + c * TILE_SIZE
        const py = y + r * TILE_SIZE
        objs.push(placeFrame(scene, px, py, TILE_SIZE, sheetKey, fillFrame))
      }
    }
  }

  // The prefab itself, at native size, centered.
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      // Defensive: a ragged/partial frames array falls back to any frame
      // already seen in that row, then skips the cell rather than crashing.
      let frame = frames?.[r]?.[c]
      if (frame === undefined || frame === null) frame = frames?.[r]?.find((f) => f !== undefined && f !== null)
      if (frame === undefined || frame === null) continue
      const px = originX + c * TILE_SIZE
      const py = originY + r * TILE_SIZE
      objs.push(placeFrame(scene, px, py, TILE_SIZE, sheetKey, frame))
    }
  }

  const depth = y + hPx
  for (const o of objs) o.setDepth(depth)
  return objs
}

// ---------------------------------------------------------------------------
// Single- or multi-tile props
// ---------------------------------------------------------------------------

// Places a prop whose BASE is centered at (cx, cy) - cx,cy are the pixel
// center of the prop's ground cell (matching placeTree's convention in
// tileGen.js).
//
// Multi-tile convention: `frames` may be a single frame index, or an array
// laid out along `axis`. Array order is always LEFT-TO-RIGHT for axis 'x'
// and TOP-TO-BOTTOM for axis 'y' - i.e. the order you'd read the tiles off
// the spritesheet, so a catalog entry can be pasted in unreordered.
//
// House rule: axis defaults to 'x' because every multi-tile prop actually
// confirmed in these packs is horizontal (rpgUrbanTiles.js's 2x1 big trees
// and 3x1 forest clumps - their canopies join side to side). Vertical 'y' is
// kept for stacked props (a pole + head), but no such multi-tile prop has
// been confirmed in a pack yet, so nothing passes 'y' today.
//
// Horizontal props are centered on cx so the joined canopy straddles the
// scatter cell rather than hanging off one side; the bottom row always sits
// on the base line (cy + TILE_SIZE/2) so a prop reads as standing on its
// ground cell, not floating.
export function placePackProp(scene, cx, cy, sheetKey, frames, TILE_SIZE = 40, axis = 'x') {
  const list = Array.isArray(frames) ? frames : [frames]
  const objs = []
  const scale = TILE_SIZE / nativeTileSize(sheetKey)
  const n = list.length
  const baseY = cy + TILE_SIZE / 2
  for (let i = 0; i < n; i++) {
    const frame = list[i]
    if (frame === null || frame === undefined) continue
    let px
    let py
    if (axis === 'y') {
      // frames[0] is the topmost tile; the last frame's bottom edge sits on baseY.
      px = cx - TILE_SIZE / 2
      py = baseY - (n - i) * TILE_SIZE
    } else {
      // frames[0] is the leftmost tile; the whole strip is centered on cx and
      // sits on baseY.
      px = cx - (n * TILE_SIZE) / 2 + i * TILE_SIZE
      py = baseY - TILE_SIZE
    }
    const img = scene.add.image(px, py, sheetKey, frame).setOrigin(0, 0).setScale(scale)
    objs.push(img)
  }
  const depth = cy
  for (const o of objs) o.setDepth(depth)
  return objs
}

// ---------------------------------------------------------------------------
// Single pre-rendered image prefab (Cute_Fantasy_Free house sprites: one
// complete baked building image loaded via a plain scene.load.image(), not a
// 16px-cell spritesheet - see drawPrefabFacade's house rule above, which is
// reused here verbatim: the prefab is centered at its OWN native pixel size
// within the requested footprint (never stretched, since pixel art distorts
// visibly under non-integer scale), snapped to whole tiles so it stays grid
// -aligned against neighboring ground tiles. Differs from drawPrefabFacade
// only in the source shape (one flat image vs. a frames[row][col] grid into
// a shared sheetKey) - a plain image has no per-cell frames to reassemble.
//
// MAX_OVERFLOW_TILES guard: House_1_Wood_Base_Blue.png is 96x128px (6x8
// tiles at native 2.5x) drawn on a 2x2 home footprint - at native size that's
// 2 tiles of overflow on every side, but OverworldScene.js packs adjacent
// homes only HOME_GAP=2 tiles apart. Two neighboring homes that BOTH hit this
// tier (confirmed to actually happen in the live 88-character roster -
// home_walker/home_livermore, Osaka District row r0=50, gapCols=2) would
// therefore render with a real 2-tile pixel overlap - not a collision/
// reachability bug (the 2x2 tile rects driving those are untouched), but a
// visible art clash. Rather than re-tile/distort the source image (the whole
// point of "never stretch" above), this clamps the render to at most 1 tile
// of overflow per side - the same safe margin already proven out by the
// pico8-city prefab tier (packFacadeFor/PICO8_HOME_VARIANTS in tileGen.js,
// 4x3/4x4 native on a 2x2 footprint = exactly 1 tile overflow/side, verified
// to just touch and never overlap at HOME_GAP=2) - by uniformly downscaling
// when the requested TILE_SIZE/16 scale would exceed that budget, instead of
// assuming every future single-image prefab is small enough to skip this
// check.
function clampedPrefabImageScale(srcWidth, srcHeight, wPx, hPx, TILE_SIZE, maxOverflowTiles = 1) {
  const nativeScale = TILE_SIZE / 16
  const maxW = wPx + 2 * maxOverflowTiles * TILE_SIZE
  const maxH = hPx + 2 * maxOverflowTiles * TILE_SIZE
  const capScale = Math.min(maxW / srcWidth, maxH / srcHeight)
  return Math.min(nativeScale, capScale)
}

export function drawPrefabImageFacade(scene, x, y, wPx, hPx, TILE_SIZE, imageKey) {
  if (!scene.textures.exists(imageKey)) return []
  const src = scene.textures.get(imageKey).getSourceImage()
  const scale = clampedPrefabImageScale(src.width, src.height, wPx, hPx, TILE_SIZE)
  const nativeW = src.width * scale
  const nativeH = src.height * scale
  const offsetTilesX = Math.round((wPx - nativeW) / 2 / TILE_SIZE)
  const offsetTilesY = Math.round((hPx - nativeH) / 2 / TILE_SIZE)
  const img = scene.add
    .image(x + offsetTilesX * TILE_SIZE, y + offsetTilesY * TILE_SIZE, imageKey)
    .setOrigin(0, 0)
    .setScale(scale)
  img.setDepth(y + hPx)
  return [img]
}

// ---------------------------------------------------------------------------
// Fence pen (Fences.png perimeter-only rectangle)
// ---------------------------------------------------------------------------

// Fences.png is a clean 4x4 16px grid but NOT a true nine-slice (verified by
// cropping every cell): col 0 holds a 3-tall standalone vertical post run
// (top/mid/bottom cap) plus a separate single free-standing post at row 3;
// row 0 cols 1-3 hold a left-cap/mid/right-cap horizontal rail; rows 1-3 x
// cols 1-3 hold a sample assembled pen corner/cross lattice that doesn't
// cleanly decompose into reusable corner pieces. Rather than over-fit to
// that ambiguous lattice, this draws a simple perimeter (post at the 4
// corners, the plain horizontal-rail-with-post frame tiled along the top/
// bottom edges, the plain vertical-rail frame tiled along the left/right
// edges) and leaves the interior completely open - animals/the player can
// walk into the pen, they just can't cross the fence line (see
// OverworldScene.js's spawnWealthyPetPens, which additionally registers the
// perimeter cells as blocked tiles so this reads as a real enclosure).
// kit = { post, hRail, vRail } - frame indices into the 4x4 Fences.png grid.
export function drawFencePen(scene, x, y, wPx, hPx, TILE_SIZE, sheetKey, kit) {
  const objs = []
  const cols = Math.max(2, Math.round(wPx / TILE_SIZE))
  const rows = Math.max(2, Math.round(hPx / TILE_SIZE))
  for (let c = 0; c < cols; c++) {
    for (let r = 0; r < rows; r++) {
      const isCorner = (c === 0 || c === cols - 1) && (r === 0 || r === rows - 1)
      const isTopOrBottomEdge = !isCorner && (r === 0 || r === rows - 1)
      const isLeftOrRightEdge = !isCorner && (c === 0 || c === cols - 1)
      let frame = null
      if (isCorner) frame = kit.post
      else if (isTopOrBottomEdge) frame = kit.hRail
      else if (isLeftOrRightEdge) frame = kit.vRail
      else continue // interior stays open - no fill tile, this isn't a nine-slice fill
      if (frame === null || frame === undefined) continue
      const px = x + c * TILE_SIZE
      const py = y + r * TILE_SIZE
      objs.push(placeFrame(scene, px, py, TILE_SIZE, sheetKey, frame))
    }
  }
  const depth = y + hPx
  for (const o of objs) o.setDepth(depth)
  return objs
}
