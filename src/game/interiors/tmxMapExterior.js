// Renders the chapel pack's authored EXTERIOR courtyard (Tiled_files/
// Exterior.tmx, extracted to ../packs/chapelExteriorMap.js) as its own zone.
//
// Why a zone and not an overworld facade: the authored courtyard is 30x22
// tiles. The `temple` building's overworld footprint is 4x2, and Kyoto
// District packs buildings far too tightly to widen it by 7x. So the chapel
// becomes a two-step location, which also matches how the reference reads
// (a walled courtyard you enter, with the chapel doors at the far end):
//
//     overworld --E on temple--> chapelExterior --E on doors--> chapelInterior
//
// and both inner zones exit back one step rather than straight to the
// overworld (see the `target` field on exit zones, honoured by
// OverworldScene's exit handler).
//
// House rules, same as tmxMapInterior.js: the authored map is a display
// scene, so spawn/exit/door zones are the only invented data; draw order is
// the file's layer order flattened to fixed depths below the player.
import { CHAPEL_MAP, CHAPEL_MAP_TILESETS, CHAPEL_MAP_LAYERS } from '../packs/chapelExteriorMap'

const TILED_DIR = '/assets/packs/chapel-pixel-/Tiled_files'

const textureKey = (base) => `chapelExt_${base}`

export function preloadChapelExterior(scene) {
  for (const [base, ts] of Object.entries(CHAPEL_MAP_TILESETS)) {
    const key = textureKey(base)
    if (scene.textures.exists(key)) continue
    scene.load.spritesheet(key, `${TILED_DIR}/${ts.file}`, {
      frameWidth: ts.cellW,
      frameHeight: ts.cellH,
    })
  }
}

// Layers that block movement. Everything else (Floor, Floor_details,
// Grass_Walls, Grass_details, Flowers) is ground the player walks on -
// note Grass_Walls is mostly lawn fill despite the name, so blocking it
// walls off the whole courtyard.
const SOLID_LAYERS = new Set(['House', 'Fence', 'Graves', 'Wings', 'Dragon_body_head'])

export const CHAPEL_EXTERIOR_ROOM = {
  cols: CHAPEL_MAP.cols, // 30
  rows: CHAPEL_MAP.rows, // 22
  regionLabel: 'Whispering Temple Courtyard',
  // On the dirt just south of the gate. Verified reachable-to-the-doors by
  // BFS over the authored collision (408 tiles reachable from here).
  spawn: { col: 15, row: 20 },
  // Leaving from the southern edge returns to the overworld.
  exitRect: { c0: 12, r0: 21, c1: 18, r1: 21 },
  // The chapel's arched double doors, at the base of the House layer. The
  // player stands in front (row 18) and presses E - the door tiles
  // themselves are solid, same as any building facade.
  doorRect: { c0: 13, r0: 16, c1: 16, r1: 17 },
}

export function buildChapelExteriorZone(scene, zoneObjects, Phaser, TILE_SIZE) {
  const blockedTiles = new Set()
  const scale = TILE_SIZE / CHAPEL_MAP.tileW

  CHAPEL_MAP_LAYERS.forEach((layer, layerIndex) => {
    const blocks = SOLID_LAYERS.has(layer.name)
    for (const [col, row, base, frame, flags] of layer.tiles) {
      const img = scene.add
        .image(col * TILE_SIZE, row * TILE_SIZE, textureKey(base), frame)
        .setOrigin(0, 0)
        .setScale(scale)
        .setDepth(-1000 + layerIndex)
      if (flags & 1) img.setFlipX(true)
      if (flags & 2) img.setFlipY(true)
      zoneObjects.push(img)
      if (blocks) blockedTiles.add(`${col},${row}`)
    }
  })

  const rect = (r) =>
    new Phaser.Geom.Rectangle(
      r.c0 * TILE_SIZE,
      r.r0 * TILE_SIZE,
      (r.c1 - r.c0 + 1) * TILE_SIZE,
      (r.r1 - r.r0 + 1) * TILE_SIZE
    )

  const zones = [
    {
      type: 'exit',
      id: 'toChapelInterior',
      target: 'chapelInterior',
      label: 'Enter the chapel',
      rect: rect(CHAPEL_EXTERIOR_ROOM.doorRect),
    },
    {
      type: 'exit',
      id: 'toOverworld',
      target: 'overworld',
      label: 'Exit to Capital Syndicate',
      rect: rect(CHAPEL_EXTERIOR_ROOM.exitRect),
    },
  ]

  scene.regionLabel.setText(CHAPEL_EXTERIOR_ROOM.regionLabel)

  return { zones, blockedTiles }
}
