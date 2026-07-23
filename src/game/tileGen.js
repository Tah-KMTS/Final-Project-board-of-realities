// Terrain, decoration and building rendering. Base grass/road/water tiles,
// trees/flowers/rocks and building facades all now come from the real
// "Cute Fantasy Free" asset pack (public/assets/cute_fantasy/...) instead of
// being drawn procedurally - a deliberate, user-confirmed exception to this
// project's usual "no external art assets" rule (see read_me.txt in that
// folder for the pack's license, and spriteGen.js for the same exception
// applied to the player/NPC sprite).
//
// Two procedural pieces are kept exactly as before because the pack simply
// has no equivalent asset for them: the Tokyo "slate marble" and Kyoto
// "cobblestone" district ground reskins (drawSlateMarbleTile /
// drawCobblestoneTile, used only for those two cities' otherwise-grass
// tiles), and the screen-space vignette overlay (addScreenVignette, a
// camera-space lighting effect, not a tile/sprite).

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
// Real asset loading (Cute Fantasy Free pack)
// ---------------------------------------------------------------------------

const ASSET_BASE = '/assets/cute_fantasy/Cute_Fantasy_Free'
// "Outdoor decoration" has a literal space in its folder name - %20 keeps
// the URL well-formed instead of relying on the browser to paper over it.
const DECOR_DIR = `${ASSET_BASE}/Outdoor%20decoration`

export const ASSET_KEYS = {
  tileGrass: 'cf_tile_grass',
  tilePath: 'cf_tile_path',
  tileWater: 'cf_tile_water',
  treeBig: 'cf_tree_big',
  treeSmall: 'cf_tree_small',
  decor: 'cf_decor',
  house: 'cf_house',
}

// Call from every scene's preload() - queues the tile/decoration/building
// images (the player sheet is preloaded separately by spriteGen.js since
// SpriteActor needs it regardless of which scene owns the map). Guards on
// scene.textures.exists so re-entering a zone/scene doesn't re-queue loads
// for textures that already made it into the Texture Manager.
export function preloadTerrainAssets(scene) {
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
}

// ---------------------------------------------------------------------------
// Terrain tile layer (grass/path/water)
// ---------------------------------------------------------------------------
// Grass_Middle/Path_Middle/Water_Middle are each a single flat 16x16 tile
// (the pack's simplest option - no autotile edges, which this game's grid
// doesn't do anyway). Rather than one Phaser GameObject per tile (thousands
// of them on the finance map), they're combined once into a small 3-cell
// canvas atlas and rendered through a real Phaser Tilemap layer - one draw
// call for the whole terrain instead of one Image per cell.

export const TERRAIN_TILE_INDEX = { grass: 0, path: 1, water: 2 }
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

// Builds (and scales up to `tileSize`) one Tilemap layer covering `cols` x
// `rows` cells. `tileIndexAt(row, col)` should return a TERRAIN_TILE_INDEX
// value, or null/undefined to leave that cell blank (e.g. tiles this game
// still wants rendered as procedural marble/cobblestone/wall - see
// OverworldScene's fallback Graphics pass for those).
//
// Tile-size note: the pack's native tile size is 16x16 but this game's grid
// uses TILE_SIZE=40 (40/16 = 2.5x, a non-integer scale). Kept TILE_SIZE=40
// rather than switching to a clean multiple of 16 because it's the least
// invasive option - every map/building/spawn/camera coordinate in
// OverworldScene and DominoWorldScene is already parameterized by
// TILE_SIZE, so nothing else needed to change. A 2.5x nearest-neighbor
// scale reads slightly softer at tile seams than an integer scale would,
// but is not noticeable at normal play zoom.
export function buildTerrainLayer(scene, cols, rows, tileSize, tileIndexAt) {
  const atlasKey = ensureTerrainAtlas(scene)
  const map = scene.make.tilemap({ tileWidth: 16, tileHeight: 16, width: cols, height: rows })
  const tileset = map.addTilesetImage('cf_terrain', atlasKey, 16, 16, 0, 0)
  const layer = map.createBlankLayer('ground', tileset, 0, 0)
  layer.setScale(tileSize / 16)
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const idx = tileIndexAt(r, c)
      if (idx !== null && idx !== undefined) layer.putTileAt(idx, c, r)
    }
  }
  return layer
}

// ---------------------------------------------------------------------------
// Decoration (trees / flowers / rocks)
// ---------------------------------------------------------------------------
// Frame indices below were picked by visually inspecting the sheets - see
// the cells identified during asset inspection: Oak_Tree_Small.png frame 0
// is a small stump (unused here), frames 1-2 are two small round trees;
// Outdoor_Decor_Free.png (7 cols x 12 rows of 16x16, frame = row*7+col)
// frames 7-9 are flower clusters (row 1), frames 15-16 are rocks (row 2).

const SMALL_TREE_FRAMES = [1, 2]
const FLOWER_FRAMES = [7, 8, 9]
const ROCK_FRAMES = [15, 16]

export function placeTree(scene, cx, cy) {
  if (Math.random() < 0.22) {
    // Oak_Tree.png (64x80) - occasional bigger tree for variety.
    const img = scene.add.image(cx, cy, ASSET_KEYS.treeBig).setOrigin(0.5, 0.82)
    return [img]
  }
  const frame = SMALL_TREE_FRAMES[Math.floor(Math.random() * SMALL_TREE_FRAMES.length)]
  const img = scene.add.image(cx, cy, ASSET_KEYS.treeSmall, frame).setOrigin(0.5, 0.88)
  return [img]
}

export function placeFlower(scene, cx, cy) {
  const frame = FLOWER_FRAMES[Math.floor(Math.random() * FLOWER_FRAMES.length)]
  const img = scene.add.image(cx, cy, ASSET_KEYS.decor, frame).setScale(1.4)
  return [img]
}

export function placeRock(scene, cx, cy) {
  const frame = ROCK_FRAMES[Math.floor(Math.random() * ROCK_FRAMES.length)]
  const img = scene.add.image(cx, cy, ASSET_KEYS.decor, frame).setScale(1.4)
  return [img]
}

// ---------------------------------------------------------------------------
// Buildings
// ---------------------------------------------------------------------------
// The pack ships exactly one building texture (House_1_Wood_Base_Blue.png,
// 96x128). Every building/desk in the game reuses it, tinted per-building
// with the same color FINANCE_BUILDING_DEFS already carried (so the roster
// stays visually distinguishable by color exactly like before) instead of
// each getting a unique hand-drawn facade.
//
// Rather than stretching the one texture to each building's exact
// (w, h) tile footprint (which ranges from 3x2 to 4x3 tiles and would
// squash/stretch the art unevenly), it's scaled uniformly so its width
// matches the footprint width and anchored bottom-center on the footprint's
// bottom edge - so every building looks like a proportional house of about
// the right footprint width, with its own natural height, the same way the
// old procedural facade's roof always extended above the footprint rect.
export function placeBuildingFacade(scene, x, y, w, h, tintColor) {
  const shadow = scene.add.ellipse(x + w / 2, y + h + 3, w * 0.7, 10, 0x000000, 0.28)
  const scale = w / 96
  const img = scene.add.image(x + w / 2, y + h, ASSET_KEYS.house).setOrigin(0.5, 1).setScale(scale)
  img.setTint(tintColor)
  return [shadow, img]
}
