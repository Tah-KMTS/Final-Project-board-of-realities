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

// The authored Fence layer runs unbroken across cols 8-21 on rows 16-17 -
// the ornate gate in the middle is drawn with fence tiles too, so blocking
// the whole layer sealed the courtyard and made the chapel door impossible
// to reach (reported as "we can't enter the door"). These two columns are
// the gate opening, directly below the chapel's own doors; they stay drawn
// but don't block, so the gate reads as standing open.
const GATE_COLS = new Set([14, 15])
const GATE_ROWS = new Set([16, 17])
const isGateOpening = (col, row) => GATE_COLS.has(col) && GATE_ROWS.has(row)

export const CHAPEL_EXTERIOR_ROOM = {
  cols: CHAPEL_MAP.cols, // 30
  rows: CHAPEL_MAP.rows, // 22
  regionLabel: 'Whispering Temple Courtyard',
  // On the dirt just south of the gate. Verified reachable-to-the-doors by
  // BFS over the authored collision (408 tiles reachable from here).
  spawn: { col: 15, row: 20 },
  // Leaving from the southern edge returns to the overworld.
  exitRect: { c0: 12, r0: 21, c1: 18, r1: 21 },
  // The chapel's arched double doors are the bottom row of the House layer
  // (row 15; House spans cols 11-18, so the doors are the centre pair).
  // Walking north through the gate opening puts the player on row 16,
  // directly below them - the door tiles themselves stay solid, same as any
  // building facade. An earlier version put this rect on rows 16-17, which
  // is the fence, not the door.
  doorRect: { c0: 14, r0: 15, c1: 15, r1: 15 },
}

export function buildChapelExteriorZone(scene, zoneObjects, Phaser, TILE_SIZE) {
  const blockedTiles = new Set()
  const scale = TILE_SIZE / CHAPEL_MAP.tileW
  // Gate leaves, captured so they can swing open as the player walks up (see
  // updateChapelGate). The pack has no open-gate art, so "opening" is the
  // existing tiles sliding apart and fading rather than a different sprite -
  // stated plainly instead of pretending there's an animation asset.
  const gate = { left: [], right: [], open: 0 }

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
      if (layer.name === 'Fence' && isGateOpening(col, row)) {
        img.setData('baseX', img.x)
        ;(col === 14 ? gate.left : gate.right).push(img)
      }
      if (blocks && !(layer.name === 'Fence' && isGateOpening(col, row))) {
        blockedTiles.add(`${col},${row}`)
      }
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
  scene.chapelGate = gate

  return { zones, blockedTiles }
}

// World-pixel centre of the gate opening, used for the proximity test.
const GATE_CENTRE_COL = 14.5
const GATE_ROW = 16.5

// Swings the gate open when the player is within a couple of tiles and shuts
// it again behind them. Called every frame while the courtyard zone is
// active; a no-op if the zone isn't built.
export function updateChapelGate(scene, playerX, playerY, TILE_SIZE) {
  const gate = scene.chapelGate
  if (!gate || (!gate.left.length && !gate.right.length)) return
  const dx = playerX - GATE_CENTRE_COL * TILE_SIZE
  const dy = playerY - GATE_ROW * TILE_SIZE
  const near = Math.hypot(dx, dy) < TILE_SIZE * 2.5
  const target = near ? 1 : 0
  // Ease toward the target so it reads as a swing, not a snap.
  gate.open += (target - gate.open) * 0.18
  if (Math.abs(gate.open) < 0.001) gate.open = 0
  const shift = gate.open * TILE_SIZE * 0.8
  for (const img of gate.left) {
    img.x = img.getData('baseX') - shift
    img.setAlpha(1 - gate.open * 0.55)
  }
  for (const img of gate.right) {
    img.x = img.getData('baseX') + shift
    img.setAlpha(1 - gate.open * 0.55)
  }
}

// ---------------------------------------------------------------------------
// Overworld facade (map coherence overhaul step 4)
//
// Resolves the "double exterior" the human reported: the map used to draw the
// temple with a generic Serene-Village-style facade while the real authored
// chapel lived only inside a separate courtyard zone. Now the map draws the
// authored chapel itself, so there is exactly one chapel exterior.
//
// Only the building layers are drawn - House, Wings, Dragon_body_head - not
// the courtyard's ground, graves or fence, which belong to the standalone
// zone. Those three layers occupy exactly cols 6-21 x rows 2-15 of the
// authored map, i.e. 16x14 tiles, which is why the `temple` building def is
// sized 16x14: the art fits its footprint exactly with no overflow onto
// neighbours.
// The whole authored scene now goes on the map - graveyard, flower plots,
// hedges, wrought-iron fence and gate included - because the human wants the
// courtyard visible in the world rather than hidden behind a zone load. So
// there is no layer filter any more, and the footprint is the full 30x22
// authored map rather than just the building's 16x14.
export const CHAPEL_FACADE_TILES = { cols: CHAPEL_MAP.cols, rows: CHAPEL_MAP.rows, col0: 0, row0: 0 }

export function chapelFacadeReady(scene) {
  return Object.keys(CHAPEL_MAP_TILESETS).every((base) => scene.textures.exists(textureKey(base)))
}

// Draws the chapel building at (x, y) in world pixels. Returns the created
// images so the caller can push them into zoneObjects, matching what
// placeBuildingFacade's other branches return.
export function drawChapelExteriorFacade(scene, x, y, tileSize) {
  const scale = tileSize / CHAPEL_MAP.tileW
  const objects = []
  CHAPEL_MAP_LAYERS.forEach((layer, layerIndex) => {
    for (const [col, row, base, frame, flags] of layer.tiles) {
      const dc = col - CHAPEL_FACADE_TILES.col0
      const dr = row - CHAPEL_FACADE_TILES.row0
      if (dc < 0 || dr < 0 || dc >= CHAPEL_FACADE_TILES.cols || dr >= CHAPEL_FACADE_TILES.rows) continue
      const px = x + dc * tileSize
      const py = y + dr * tileSize
      const img = scene.add
        .image(px, py, textureKey(base), frame)
        .setOrigin(0, 0)
        .setScale(scale)
        // Sort by the tile's own bottom edge so the player passes behind the
        // chapel's upper rows and in front of its base, same as every other
        // facade in the overworld.
        .setDepth(py + tileSize + layerIndex)
      if (flags & 1) img.setFlipX(true)
      if (flags & 2) img.setFlipY(true)
      objects.push(img)
    }
  })
  return objects
}
