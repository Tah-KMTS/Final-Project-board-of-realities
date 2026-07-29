// Real grass/road ground tiles from Cute_Fantasy_Free, replacing the
// procedural Graphics ground (which rendered as flat navy blocks and is why
// the map read as "a bit of a mess" rather than a place).
//
// Step 2 of the map coherence overhaul (production/next-session-plan.md).
// Chosen because this pack is the style of the human's reference picture and
// is the only one on disk with a complete road kit - crucially Path_Tile.png,
// a 3x6 autotile block holding the road EDGE and CORNER pieces, which is what
// makes a road look connected to the grass instead of painted over it.
//
// House rules:
//  1. This does NOT replace the whole terrain pass. The procedural Graphics
//     layer still draws first and still owns water/wall/slate/cobblestone;
//     only 'grass' and 'path' get real tiles overlaid on top. That keeps
//     every other tile type working exactly as before instead of needing all
//     of them ported at once.
//  2. Everything goes in one Container so the caller's
//     `zoneObjects.push(terrainLayer)` contract (a single destroyable object)
//     is unchanged.
const DIR = '/assets/packs/Cute_Fantasy_Free/Tiles'

export const CUTE_TERRAIN_KEYS = {
  grass: 'cuteGrassMiddle',
  path: 'cutePathMiddle',
  pathEdges: 'cutePathTile',
}

// Path_Tile.png is 48x96 = a 3-wide x 6-tall grid of 16px cells. Rows 0-2 are
// the standard 3x3 autotile block (corners/edges/centre); the lower rows are
// additional variants. Only the 3x3 block is used here.
const PATH_TILE_COLS = 3

export function preloadCuteTerrain(scene) {
  if (!scene.textures.exists(CUTE_TERRAIN_KEYS.grass)) {
    scene.load.image(CUTE_TERRAIN_KEYS.grass, `${DIR}/Grass_Middle.png`)
  }
  if (!scene.textures.exists(CUTE_TERRAIN_KEYS.path)) {
    scene.load.image(CUTE_TERRAIN_KEYS.path, `${DIR}/Path_Middle.png`)
  }
  if (!scene.textures.exists(CUTE_TERRAIN_KEYS.pathEdges)) {
    scene.load.spritesheet(CUTE_TERRAIN_KEYS.pathEdges, `${DIR}/Path_Tile.png`, {
      frameWidth: 16,
      frameHeight: 16,
    })
  }
}

export function cuteTerrainReady(scene) {
  return scene.textures.exists(CUTE_TERRAIN_KEYS.grass) && scene.textures.exists(CUTE_TERRAIN_KEYS.path)
}

// Picks the autotile frame for a path cell from which of its 4 neighbours are
// also path. Standard 3x3 block: col 0 = left edge, 1 = middle, 2 = right
// edge; row 0 = top edge, 1 = middle, 2 = bottom edge. A cell with path on
// both sides in an axis uses the middle of that axis, so straight runs and
// junctions resolve to the interior tile and only the outer rim gets edges.
function pathFrame(isPath, r, c) {
  const up = isPath(r - 1, c)
  const down = isPath(r + 1, c)
  const left = isPath(r, c - 1)
  const right = isPath(r, c + 1)
  const col = left && right ? 1 : left ? 2 : right ? 0 : 1
  const row = up && down ? 1 : up ? 2 : down ? 0 : 1
  return row * PATH_TILE_COLS + col
}

// Overlays real grass/path tiles onto `baseLayer` (the procedural Graphics
// pass) and returns a Container holding both.
export function buildCuteTerrainOverlay(scene, baseLayer, cols, rows, tileSize, tileTypeAt) {
  const scale = tileSize / 16
  const container = scene.add.container(0, 0)
  container.setDepth(baseLayer.depth ?? 0)
  container.add(baseLayer)

  const isPath = (r, c) => {
    if (r < 0 || c < 0 || r >= rows || c >= cols) return false
    const t = tileTypeAt(r, c)
    return t === 'path' || t === 'bridge'
  }

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const type = tileTypeAt(r, c)
      if (type !== 'grass' && type !== 'path') continue
      const x = c * tileSize
      const y = r * tileSize
      const img =
        type === 'grass'
          ? scene.add.image(x, y, CUTE_TERRAIN_KEYS.grass)
          : scene.add.image(x, y, CUTE_TERRAIN_KEYS.pathEdges, pathFrame(isPath, r, c))
      img.setOrigin(0, 0).setScale(scale)
      container.add(img)
    }
  }

  return container
}
