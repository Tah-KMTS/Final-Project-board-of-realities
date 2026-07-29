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

// Ground types that should render as grass. 'slate' (Tokyo) and 'cobblestone'
// (Kyoto) are the per-district ground reskins; before this they were the only
// thing still drawn as flat procedural blocks, which is why most of the map
// stayed dark after the first pass of this overlay while only the roads and
// their immediate borders looked right.
//
// Deliberate call: districts no longer differ by GROUND COLOUR, they differ by
// what's built on them. That's what the reference picture does (buildings and
// props on common grass, roads doing the structuring) and the human's stated
// priority is a coherent map over per-district tinting. District identity can
// come back through props/decor in a later step if it's wanted.
export const GRASS_TYPES = new Set(['grass', 'slate', 'cobblestone'])

// Overlays real grass/path tiles onto `baseLayer` (the procedural Graphics
// pass) and returns a Container holding both.
// PERFORMANCE: this used to add one Game Object per tile - about 10,700 of
// them on a 160x67 map, each carrying its own transform, cull check and
// render entry, and all rebuilt on every zone load. They are now stamped once
// into a single RenderTexture, so the scene keeps ONE object instead. The
// output is pixel-identical; only the object count changes.
export function buildCuteTerrainOverlay(scene, baseLayer, cols, rows, tileSize, tileTypeAt) {
  const scale = tileSize / 16
  const container = scene.add.container(0, 0)
  container.setDepth(baseLayer.depth ?? 0)
  container.add(baseLayer)

  const rt = scene.add.renderTexture(0, 0, cols * tileSize, rows * tileSize).setOrigin(0, 0)
  // A reusable stamp: moved, re-framed and drawn per tile, then discarded.
  // Never added to the display list, so it costs nothing at render time.
  const stamp = scene.make.image({ key: CUTE_TERRAIN_KEYS.grass, add: false }).setOrigin(0, 0).setScale(scale)

  const isPath = (r, c) => {
    if (r < 0 || c < 0 || r >= rows || c >= cols) return false
    const t = tileTypeAt(r, c)
    return t === 'path' || t === 'bridge'
  }

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const type = tileTypeAt(r, c)
      const isGrass = GRASS_TYPES.has(type)
      if (!isGrass && type !== 'path') continue
      const x = c * tileSize
      const y = r * tileSize
      if (isGrass) stamp.setTexture(CUTE_TERRAIN_KEYS.grass)
      else stamp.setTexture(CUTE_TERRAIN_KEYS.pathEdges, pathFrame(isPath, r, c))
      rt.draw(stamp, x, y)
    }
  }

  stamp.destroy()
  container.add(rt)
  return container
}

// ---------------------------------------------------------------------------
// Trees. The reference picture the human keeps comparing against IS this pack,
// but trees were still coming from kenney_rpg-urban-pack, whose "tree" is a
// single 16px tile - at 40px tiles that renders as a small canopy blob sitting
// on what reads as a crate, nothing like the reference's full oaks. These are
// the pack's own trees, drawn at their real size.
export const CUTE_TREE_KEYS = { oak: 'cuteOakTree', oakSmall: 'cuteOakTreeSmall' }

// Oak_Tree.png is one 64x80 tree. Oak_Tree_Small.png is 96x48 = three 32x48
// saplings/bushes.
const OAK = { w: 64, h: 80 }
const OAK_SMALL = { w: 32, h: 48, count: 3 }

export function preloadCuteTrees(scene) {
  const dir = '/assets/packs/Cute_Fantasy_Free/Outdoor%20decoration'
  if (!scene.textures.exists(CUTE_TREE_KEYS.oak)) {
    scene.load.image(CUTE_TREE_KEYS.oak, `${dir}/Oak_Tree.png`)
  }
  if (!scene.textures.exists(CUTE_TREE_KEYS.oakSmall)) {
    scene.load.spritesheet(CUTE_TREE_KEYS.oakSmall, `${dir}/Oak_Tree_Small.png`, {
      frameWidth: OAK_SMALL.w,
      frameHeight: OAK_SMALL.h,
    })
  }
}

export function cuteTreesReady(scene) {
  return scene.textures.exists(CUTE_TREE_KEYS.oak) && scene.textures.exists(CUTE_TREE_KEYS.oakSmall)
}

// Draws a tree centred on (cx, cy) with its TRUNK at that point - origin
// (0.5, 0.9) rather than centre, so the canopy rises above the tile the tree
// occupies the way the reference does, instead of the tile bisecting it.
// `rand` is the caller's deterministic 0..1 roll so scatter stays reproducible.
export function drawCuteTree(scene, cx, cy, tileSize, rand = Math.random()) {
  const big = rand < 0.62
  const key = big ? CUTE_TREE_KEYS.oak : CUTE_TREE_KEYS.oakSmall
  const frame = big ? undefined : Math.floor(rand * 1000) % OAK_SMALL.count
  // Scale so a big oak spans ~2 tiles wide, matching the reference's
  // tree-to-house proportions rather than the old one-tile blob.
  const scale = big ? (tileSize * 2) / OAK.w : (tileSize * 1.1) / OAK_SMALL.w
  const img =
    frame === undefined
      ? scene.add.image(cx, cy, key)
      : scene.add.image(cx, cy, key, frame)
  img.setOrigin(0.5, 0.9).setScale(scale).setDepth(cy)
  return [img]
}
