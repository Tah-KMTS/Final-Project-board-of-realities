// Renders the chapel pack's OWN authored interior map (Tiled_files/
// Interior.tmx, extracted to ../packs/chapelInteriorMap.js) instead of the
// hand-placed room in tmxWallInterior.js.
//
// Why this exists, since it replaces something that already "worked":
// tmxWallInterior.js's CHAPEL_TEMPLE_ROOM hand-guessed every furniture
// position and every sprite crop, and after five rounds of fixes it still
// didn't match the reference (production/chapel-reference.md). The reference
// IS this .tmx - it's the pack artist's own composition, shipped with the
// pack. So there is nothing to guess: draw the authored tiles, in the
// authored order, from the authored tilesets.
//
// House rules / deliberate deviations, disclosed rather than hidden:
//  1. The authored map is a display composition, not a playable room - it has
//     no door and no spawn point. CHAPEL_ROOM below adds those as the only
//     invented data: spawn/exit at the bottom of the nave aisle, desk zone at
//     the altar end. Everything else is verbatim from the file.
//  2. Draw order is the file's layer order, flattened to fixed depths BELOW
//     the player rather than y-sorted per object. That's correct here because
//     the only walkable tiles are the centre aisle (verified by BFS - see
//     CHAPEL_ROOM.spawn), which no authored object occupies, so the player is
//     never legitimately behind a piece of furniture. It also preserves the
//     authored composition exactly, which per-object y-sorting would not.
//  3. Collision blocks every non-decor layer (see SOLID_LAYERS). This is what
//     makes the priest solid - the previous room let the player stand inside
//     him.
import { CHAPEL_MAP, CHAPEL_MAP_TILESETS, CHAPEL_MAP_LAYERS } from '../packs/chapelInteriorMap'

// The .tmx resolves its tilesets against the images sitting NEXT TO it in
// Tiled_files/, which are NOT the same files as the similarly-named ones in
// PNG/ (different dimensions and layouts - see chapelInteriorMap.js's header).
// Loading the PNG/ copies here would silently mis-crop every tile.
const TILED_DIR = '/assets/packs/chapel-pixel-/Tiled_files'

const textureKey = (base) => `chapelMap_${base}`

export function preloadChapelMap(scene) {
  for (const [base, ts] of Object.entries(CHAPEL_MAP_TILESETS)) {
    const key = textureKey(base)
    if (scene.textures.exists(key)) continue
    scene.load.spritesheet(key, `${TILED_DIR}/${ts.file}`, {
      frameWidth: ts.cellW,
      frameHeight: ts.cellH,
    })
  }
}

// Layers whose tiles are floor/wall-surface decoration the player stands on
// or in front of. Everything NOT listed here blocks movement.
const DECOR_LAYERS = new Set(['Floor1', 'Floor2', 'Carpet', 'Windows', 'Icons'])

// The playable room: authored map + the three bits of gameplay data the
// authored file doesn't carry (see house rule 1 above). The aisle runs
// cols 10-11, rows 8-12; spawn/exit sit at its south end, the altar/priest
// at its north end.
export const CHAPEL_ROOM = {
  cols: CHAPEL_MAP.cols, // 22
  rows: CHAPEL_MAP.rows, // 17
  regionLabel: 'Whispering Temple Chapel',
  spawn: { col: 10, row: 12 },
  exitRect: { c0: 10, r0: 12, c1: 11, r1: 12 },
  deskZone: { id: 'temple', label: 'Whispering Temple Chapel', c0: 10, r0: 8, c1: 11, r1: 9 },
}

export function buildChapelMapZone(scene, zoneObjects, Phaser, TILE_SIZE) {
  const blockedTiles = new Set()
  const scale = TILE_SIZE / CHAPEL_MAP.tileW

  CHAPEL_MAP_LAYERS.forEach((layer, layerIndex) => {
    const blocks = !DECOR_LAYERS.has(layer.name)
    for (const [col, row, base, frame, flags] of layer.tiles) {
      const img = scene.add
        .image(col * TILE_SIZE, row * TILE_SIZE, textureKey(base), frame)
        .setOrigin(0, 0)
        .setScale(scale)
        // Fixed per-layer depth preserves the authored draw order exactly and
        // keeps every tile below the player (whose depth tracks world y).
        .setDepth(-1000 + layerIndex)
      if (flags & 1) img.setFlipX(true)
      if (flags & 2) img.setFlipY(true)
      // flags & 4 is Tiled's diagonal flip (a transpose, drawn as a rotation).
      // No tile in this map uses it - verified during extraction - so it is
      // deliberately not implemented rather than implemented untested.
      zoneObjects.push(img)
      if (blocks) blockedTiles.add(`${col},${row}`)
    }
  })

  const zones = [
    {
      type: 'interiorDesk',
      id: CHAPEL_ROOM.deskZone.id,
      label: CHAPEL_ROOM.deskZone.label,
      rect: new Phaser.Geom.Rectangle(
        CHAPEL_ROOM.deskZone.c0 * TILE_SIZE,
        CHAPEL_ROOM.deskZone.r0 * TILE_SIZE,
        (CHAPEL_ROOM.deskZone.c1 - CHAPEL_ROOM.deskZone.c0 + 1) * TILE_SIZE,
        (CHAPEL_ROOM.deskZone.r1 - CHAPEL_ROOM.deskZone.r0 + 1) * TILE_SIZE
      ),
    },
    {
      type: 'exit',
      id: 'toOverworld',
      label: 'Exit to Capital Syndicate',
      rect: new Phaser.Geom.Rectangle(
        CHAPEL_ROOM.exitRect.c0 * TILE_SIZE,
        CHAPEL_ROOM.exitRect.r0 * TILE_SIZE,
        (CHAPEL_ROOM.exitRect.c1 - CHAPEL_ROOM.exitRect.c0 + 1) * TILE_SIZE,
        (CHAPEL_ROOM.exitRect.r1 - CHAPEL_ROOM.exitRect.r0 + 1) * TILE_SIZE
      ),
    },
  ]

  scene.regionLabel.setText(CHAPEL_ROOM.regionLabel)

  return { zones, blockedTiles }
}
