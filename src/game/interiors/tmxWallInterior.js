// Generic "real tile-based interior room" builder, introduced for the
// Whispering Temple -> chapel reskin (see production/ for the full writeup)
// but deliberately NOT chapel-specific: buildTmxWallInteriorZone(scene, spec)
// takes a plain-data roomSpec and knows nothing about chapels, altars, or
// pews - it just draws a floor/wall grid from a tileset plus a flat list of
// furniture blocks and character sprites. chapelPixelTiles.js supplies the
// chapel-pack frame data; TEA_HOUSE_ROOM below is a second, simpler room
// built from the SAME Walls_Interior tileset to prove this is actually
// reusable (see that spec for why teaHouse was picked) rather than a
// one-off helper only the chapel calls.
//
// Coordinate system: every roomSpec works in its own room-local (col, row)
// grid starting at (0,0) - OverworldScene positions/scales everything into
// world pixels via TILE_SIZE, same as every other zone.
import {
  wallFrame,
  floorFrame,
  altarBlock,
  statuesBlock,
  candelabraColumn,
  benchRow,
  plantNarrowBlock,
  alcoveFaceColumn,
  priestIdleFrame,
  monkPrayFrame,
  parishionerFrame,
} from '../packs/chapelPixelTiles'

const CHAPEL_NATIVE_TILE = 16

// roomSpec shape (see CHAPEL_TEMPLE_ROOM / TEA_HOUSE_ROOM below for concrete
// examples):
// {
//   cols, rows,                      // room size in tiles
//   regionLabel,                     // shown in the HUD region label
//   spawn: {col, row},               // where the player appears on entry
//   exitRect: {c0, r0, c1, r1},      // tile rect that exits back to overworld
//   isWall(col, row) -> boolean,     // true = solid wall cell (also blocked)
//   blocks: [                        // furniture, drawn after the floor
//     { col, row, cells: [{dc,dr,key,frame,animFrames?}], blocking? }
//   ],
//   sprites: [                       // character art, drawn last
//     { col, row, key, frame, nativeHeight, targetHeight, blocking?, flipX?, dy? }
//   ],
// }

function tileScale() {
  return 40 / CHAPEL_NATIVE_TILE // TILE_SIZE / native pack tile size (both fixed constants)
}

// Registers a looping flicker animation for one candelabra-style cell the
// first time it's needed (idempotent - matches this project's
// `!scene.anims.exists` guard convention used everywhere else). Returns the
// anim key, or null if the cell has no animFrames (a plain static tile).
function ensureFlickerAnim(scene, key, animFrames) {
  if (!animFrames) return null
  const animKey = `${key}_flicker_${animFrames.join('-')}`
  if (!scene.anims.exists(animKey)) {
    scene.anims.create({
      key: animKey,
      frames: animFrames.map((frame) => ({ key, frame })),
      frameRate: 1000 / 150, // 150ms/frame, matching the pack's own baked <animation> timing
      repeat: -1,
    })
  }
  return animKey
}

// Draws roomSpec into `scene`, pushing every created object into
// `zoneObjects` (destroyed by OverworldScene.clearZoneObjects the same way
// as every other zone's content) and returns { zones, blockedTiles } -
// `zones` is the interaction-zone list (interiorDesk/exit) OverworldScene
// already expects; `blockedTiles` is a Set of "col,row" strings the caller
// should assign to whatever interior-collision Set isBlockedTile consults.
export function buildTmxWallInteriorZone(scene, spec, zoneObjects, Phaser, TILE_SIZE) {
  const scale = tileScale()
  const blockedTiles = new Set()

  // ---- floor + walls -------------------------------------------------------
  for (let row = 0; row < spec.rows; row++) {
    for (let col = 0; col < spec.cols; col++) {
      const wall = spec.isWall(col, row)
      const px = col * TILE_SIZE
      const py = row * TILE_SIZE
      if (wall) {
        const f = wallFrame()
        const img = scene.add.image(px, py, f.key, f.frame).setOrigin(0, 0).setScale(scale).setDepth(-1000)
        zoneObjects.push(img)
        blockedTiles.add(`${col},${row}`)
      } else {
        const f = floorFrame((row + col) % 2 === 0)
        const img = scene.add.image(px, py, f.key, f.frame).setOrigin(0, 0).setScale(scale).setDepth(-1000)
        zoneObjects.push(img)
      }
    }
  }

  // ---- furniture blocks ------------------------------------------------------
  for (const block of spec.blocks || []) {
    for (const cell of block.cells) {
      const col = block.col + cell.dc
      const row = block.row + cell.dr
      const px = col * TILE_SIZE
      const py = row * TILE_SIZE
      // Only animated cells (candelabra flicker) need a Sprite - plain
      // Image game objects don't have .play()/an anims component at all,
      // so using add.image() unconditionally here threw
      // "img.play is not a function" the moment a candelabra was drawn.
      const animKey = cell.animFrames ? ensureFlickerAnim(scene, cell.key, cell.animFrames) : null
      const img = animKey
        ? scene.add.sprite(px, py, cell.key, cell.frame).setOrigin(0, 0).setScale(scale).setDepth(py + 1)
        : scene.add.image(px, py, cell.key, cell.frame).setOrigin(0, 0).setScale(scale).setDepth(py + 1)
      zoneObjects.push(img)
      if (animKey) img.play(animKey)
      if (block.blocking) blockedTiles.add(`${col},${row}`)
    }
  }

  // ---- character sprites -----------------------------------------------------
  for (const sp of spec.sprites || []) {
    const scaleTo = sp.targetHeight / sp.nativeHeight
    const cx = sp.col * TILE_SIZE + TILE_SIZE / 2
    const cy = sp.row * TILE_SIZE + TILE_SIZE + (sp.dy || 0)
    const img = scene.add
      .image(cx, cy, sp.key, sp.frame)
      .setOrigin(0.5, 1)
      .setScale(scaleTo)
      .setDepth(sp.row * TILE_SIZE + TILE_SIZE + 1)
    if (sp.flipX) img.setFlipX(true)
    zoneObjects.push(img)
    if (sp.blocking) blockedTiles.add(`${sp.col},${sp.row}`)
  }

  // ---- interaction zones -------------------------------------------------------
  const zones = []
  if (spec.deskZone) {
    zones.push({
      type: 'interiorDesk',
      id: spec.deskZone.id,
      npcId: spec.deskZone.npcId,
      label: spec.deskZone.label,
      rect: new Phaser.Geom.Rectangle(
        spec.deskZone.c0 * TILE_SIZE,
        spec.deskZone.r0 * TILE_SIZE,
        (spec.deskZone.c1 - spec.deskZone.c0 + 1) * TILE_SIZE,
        (spec.deskZone.r1 - spec.deskZone.r0 + 1) * TILE_SIZE
      ),
    })
  }
  zones.push({
    type: 'exit',
    id: 'toOverworld',
    label: 'Exit to Capital Syndicate',
    rect: new Phaser.Geom.Rectangle(
      spec.exitRect.c0 * TILE_SIZE,
      spec.exitRect.r0 * TILE_SIZE,
      (spec.exitRect.c1 - spec.exitRect.c0 + 1) * TILE_SIZE,
      (spec.exitRect.r1 - spec.exitRect.r0 + 1) * TILE_SIZE
    ),
  })

  scene.regionLabel.setText(spec.regionLabel)

  return { zones, blockedTiles }
}

// ---------------------------------------------------------------------------
// CHAPEL_TEMPLE_ROOM - the Whispering Temple's real interior (upgrades the
// existing `temple` building, FINANCE_BUILDING_DEFS/OverworldScene.js,
// Kyoto District - see OverworldScene.js's triggerInteraction for the
// `zone.id === 'temple'` route into this room). Reusing that building rather
// than adding a new one keeps TempleModal's donate/embezzle mechanic (it
// keys off `activeModal.id === 'temple'`, not an npcId) working unchanged -
// the desk zone below still emits {type:'building', id:'temple'} exactly
// like the old generic room did.
//
// Layout (15 cols x 14 rows, room-local, north=altar/statues, south=door):
//   rows 0/13, cols 0/14        - border walls
//   altar (2x2)  cols 6-7  rows 1-2   - the far end of the nave
//   statues (4x3) cols 5-8 rows 3-5   - bride+dragon pair, right behind the
//                                       altar (kept as ONE unit - see
//                                       chapelPixelTiles.js's statuesBlock
//                                       header for why it isn't split)
//   priest + 2 monks            row 6, cols 6-8 - facing the nave, standing
//                                (non-blocking) right where the deskZone
//                                below lets the player interact
//   alcove faces                cols 2 & 12, rows 1-3 (wall-mounted, non-
//                                blocking - "small figures in wall alcoves")
//   candelabra columns           cols 1 & 13, rows 2-4 and 7-9 (flickering,
//                                see chapelPixelTiles.candelabraColumn)
//   pew blocks (parishioners)   cols 2-4 and 10-12, rows 7-9 (solid - real
//                                churches don't let you walk through pews
//                                either)
//   plants                      cols 2 & 12, rows 11-12 (entrance accents)
// The center aisle (cols 6-8) is kept clear from row 6 down to the exit so
// the player can always walk from the door up to the priest.
export const CHAPEL_TEMPLE_ROOM = {
  cols: 15,
  rows: 14,
  regionLabel: 'Whispering Temple',
  spawn: { col: 7, row: 9 },
  exitRect: { c0: 6, r0: 11, c1: 8, r1: 12 },
  deskZone: { id: 'temple', label: 'Whispering Temple', c0: 6, r0: 6, c1: 8, r1: 6 },
  isWall(col, row) {
    return col === 0 || col === 14 || row === 0 || row === 13
  },
  blocks: [
    { col: 6, row: 1, cells: altarBlock(), blocking: true },
    { col: 5, row: 3, cells: statuesBlock(), blocking: true },
    { col: 2, row: 1, cells: alcoveFaceColumn(), blocking: false },
    { col: 12, row: 1, cells: alcoveFaceColumn(), blocking: false },
    { col: 1, row: 2, cells: candelabraColumn(), blocking: true },
    { col: 13, row: 2, cells: candelabraColumn(), blocking: true },
    { col: 1, row: 7, cells: candelabraColumn(), blocking: true },
    { col: 13, row: 7, cells: candelabraColumn(), blocking: true },
    { col: 2, row: 7, cells: benchRow(3), blocking: true },
    { col: 2, row: 8, cells: benchRow(3), blocking: true },
    { col: 2, row: 9, cells: benchRow(3), blocking: true },
    { col: 10, row: 7, cells: benchRow(3), blocking: true },
    { col: 10, row: 8, cells: benchRow(3), blocking: true },
    { col: 10, row: 9, cells: benchRow(3), blocking: true },
    { col: 2, row: 11, cells: plantNarrowBlock(), blocking: true },
    { col: 12, row: 11, cells: plantNarrowBlock(), blocking: true },
  ],
  sprites: [
    { col: 7, row: 6, ...priestIdleFrame(), targetHeight: 56, blocking: false },
    { col: 6, row: 6, ...monkPrayFrame(1), targetHeight: 40, blocking: false },
    { col: 8, row: 6, ...monkPrayFrame(2), targetHeight: 40, blocking: false },
    { col: 3, row: 7, ...parishionerFrame(1), targetHeight: 36, blocking: false },
    { col: 3, row: 8, ...parishionerFrame(3), targetHeight: 36, blocking: false },
    { col: 3, row: 9, ...parishionerFrame(5), targetHeight: 36, blocking: false },
    { col: 11, row: 7, ...parishionerFrame(2), targetHeight: 36, blocking: false, flipX: true },
    { col: 11, row: 8, ...parishionerFrame(4), targetHeight: 36, blocking: false, flipX: true },
    { col: 11, row: 9, ...parishionerFrame(6), targetHeight: 36, blocking: false, flipX: true },
  ],
}

// TEA_HOUSE_ROOM - proves Walls_Interior.png (the chapel pack's wall/floor
// tileset) is genuinely a general-purpose interior wall option, not chapel-
// only: this reskins the `teaHouse` building (Cherry Coke Tea House, Kyoto
// District) with the SAME wallFrame()/floorFrame() tiles and the generic
// builder above, zero chapel-specific assets. teaHouse already opens
// DistrictBuildingModal (WorldScreen.jsx's DISTRICT_BUILDING_IDS check) via
// its own id, unrelated to npcId, so this is a pure visual reskin - the
// interact contract is untouched.
export const TEA_HOUSE_ROOM = {
  cols: 10,
  rows: 9,
  regionLabel: 'Cherry Coke Tea House',
  spawn: { col: 4, row: 6 },
  exitRect: { c0: 3, r0: 7, c1: 5, r1: 7 },
  deskZone: { id: 'teaHouse', label: 'Order Counter', c0: 3, r0: 4, c1: 5, r1: 4 },
  isWall(col, row) {
    return col === 0 || col === 9 || row === 0 || row === 8
  },
  blocks: [
    { col: 3, row: 2, cells: benchRow(3), blocking: true },
    { col: 1, row: 1, cells: plantNarrowBlock(), blocking: true },
    { col: 7, row: 1, cells: plantNarrowBlock(), blocking: true },
  ],
  sprites: [],
}
