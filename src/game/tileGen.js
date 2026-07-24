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

// Call from every scene's preload() - queues the tile/decoration/building
// images (the player sheet is preloaded separately by spriteGen.js).
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

export const TERRAIN_TILE_INDEX = {
  grass: 4,
  path: 285,
  water: 79,
  wall: 304,
  slate: 220,
  cobblestone: 57,
  bridge: 327,
  snow: 76,
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

export function buildTerrainLayer(scene, cols, rows, tileSize, tileIndexAt) {
  const map = scene.make.tilemap({ tileWidth: 16, tileHeight: 16, width: cols, height: rows })
  const tilesetKey = scene.textures.exists(ASSET_KEYS.sereneVillage) ? ASSET_KEYS.sereneVillage : ensureTerrainAtlas(scene)
  const tileset = map.addTilesetImage('serene_terrain', tilesetKey, 16, 16, 0, 0)
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

const SMALL_TREE_FRAMES = [1, 2]
const FLOWER_FRAMES = [7, 8, 9]
const ROCK_FRAMES = [15, 16]

export function placeTree(scene, cx, cy) {
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
  const frame = FLOWER_FRAMES[Math.floor(Math.random() * FLOWER_FRAMES.length)]
  const img = scene.add.image(cx, cy, ASSET_KEYS.decor, frame).setScale(1.4)
  img.setDepth(cy)
  return [img]
}

export function placeRock(scene, cx, cy) {
  const frame = ROCK_FRAMES[Math.floor(Math.random() * ROCK_FRAMES.length)]
  const img = scene.add.image(cx, cy, ASSET_KEYS.decor, frame).setScale(1.4)
  img.setDepth(cy)
  return [img]
}

// ---------------------------------------------------------------------------
// Buildings & Structures
// ---------------------------------------------------------------------------

export function placeBuildingFacade(scene, x, y, w, h, tintColor, buildingId = '') {
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
  const INTERIOR_COLS = 12
  const INTERIOR_ROWS = 9
  const TILE_SIZE = 40
  const d = { c0: 5, r0: 2, c1: 6, r1: 3 }

  const map = scene.make.tilemap({ tileWidth: 16, tileHeight: 16, width: INTERIOR_COLS, height: INTERIOR_ROWS })
  const tilesetKey = scene.textures.exists(ASSET_KEYS.modernRoomBuilder)
    ? ASSET_KEYS.modernRoomBuilder
    : (scene.textures.exists(ASSET_KEYS.modernInteriors) ? ASSET_KEYS.modernInteriors : 'cf_terrain_atlas')
  
  const tileset = map.addTilesetImage('modern_interior', tilesetKey, 16, 16, 0, 0)
  const layer = map.createBlankLayer('interior_room', tileset, 0, 0)
  layer.setScale(TILE_SIZE / 16)

  const wallTile = template.wallTile ?? 2
  const floorA = template.floorTileA ?? 34
  const floorB = template.floorTileB ?? 35

  for (let r = 0; r < INTERIOR_ROWS; r++) {
    for (let c = 0; c < INTERIOR_COLS; c++) {
      const isBorder = r === 0 || c === 0 || r === INTERIOR_ROWS - 1 || c === INTERIOR_COLS - 1
      const idx = isBorder ? wallTile : ((r + c) % 2 === 0 ? floorA : floorB)
      layer.putTileAt(idx, c, r)
    }
  }
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

