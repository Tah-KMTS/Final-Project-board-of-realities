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
// pass) and returns a Container holding both. See the grass-run comment
// inside for how this is batched and why RenderTexture was ruled out.
export function buildCuteTerrainOverlay(scene, baseLayer, cols, rows, tileSize, tileTypeAt) {
  const scale = tileSize / 16
  const container = scene.add.container(0, 0)
  container.setDepth(baseLayer.depth ?? 0)
  container.add(baseLayer)

  // Grass is a SINGLE repeated tile, so it does not need one Game Object per
  // cell. Each row's grass is emitted as a few TileSprites - one per
  // contiguous RUN of grass columns - which the renderer repeats internally.
  // That covers exactly the grass tiles and nothing else, so the water band
  // and the wall border still show through from the layer underneath (a
  // single full-map TileSprite was tried and painted over both).
  //
  // Why not a RenderTexture: attempted three times and verified broken on
  // screen each time via production/probeGame.mjs. In Phaser 4 the
  // RenderTexture is an Image wrapping a DynamicTexture; rt.beginDraw and
  // rt.batchDraw do not exist, and both rt.draw() and rt.texture.draw()
  // silently leave the surface empty. This achieves the same object-count win
  // with an API that demonstrably works.
  const emitGrassRun = (row, colStart, colEnd) => {
    const w = (colEnd - colStart + 1) * tileSize
    const ts = scene.add
      .tileSprite(colStart * tileSize, row * tileSize, w, tileSize, CUTE_TERRAIN_KEYS.grass)
      .setOrigin(0, 0)
    ts.tileScaleX = scale
    ts.tileScaleY = scale
    container.add(ts)
  }

  const isPath = (r, c) => {
    if (r < 0 || c < 0 || r >= rows || c >= cols) return false
    const t = tileTypeAt(r, c)
    return t === 'path' || t === 'bridge'
  }

  for (let r = 0; r < rows; r++) {
    // Collapse this row's grass into runs before drawing anything else.
    let runStart = -1
    for (let c = 0; c <= cols; c++) {
      const isGrassCell = c < cols && GRASS_TYPES.has(tileTypeAt(r, c))
      if (isGrassCell && runStart < 0) runStart = c
      else if (!isGrassCell && runStart >= 0) {
        emitGrassRun(r, runStart, c - 1)
        runStart = -1
      }
    }
    for (let c = 0; c < cols; c++) {
      const type = tileTypeAt(r, c)
      // Grass is already covered by the runs emitted above.
      if (type !== 'path') continue
      const x = c * tileSize
      const y = r * tileSize
      const img = scene.add.image(x, y, CUTE_TERRAIN_KEYS.pathEdges, pathFrame(isPath, r, c))
      img.setOrigin(0, 0).setScale(scale)
      container.add(img)
    }
  }

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
// (0.5, 0.8) rather than centre, so the canopy rises above the tile the tree
// occupies the way the reference does, instead of the tile bisecting it.
// The 0.8 (not a rounder-looking 0.9) is load-bearing: scatterEnvironment
// blocks the WHOLE ground tile (cx,cy) sits in for collision, and at this
// image's displayed height (2.5 tiles, see `scale` below) origin 0.8 is the
// value that puts the image's bottom edge exactly on that tile's bottom
// edge. Origin 0.9 (the previous value) left the bottom quarter of the
// blocked tile with no tree pixels in it at all - bare grass the player
// could see but not step on, reported as "an invisible barrier below the
// tree". `rand` used to pick between the big oak and a small sapling
// variant; that variant's gone (it read as a stumpy dark blob rather than a
// proper tree, reported as "trunk[s] to remove"), so `rand` is unused now
// but kept as an accepted param so every call site (which still passes a
// seeded roll) doesn't need updating.
// Scale so the oak spans ~2 tiles wide, matching the reference's
// tree-to-house proportions rather than the old one-tile blob.
export function drawCuteTree(scene, cx, cy, tileSize) {
  const scale = (tileSize * 2) / OAK.w
  const img = scene.add.image(cx, cy, CUTE_TREE_KEYS.oak)
  img.setOrigin(0.5, 0.8).setScale(scale).setDepth(cy)
  return [img]
}
