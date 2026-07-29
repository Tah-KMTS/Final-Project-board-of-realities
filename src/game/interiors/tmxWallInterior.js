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
  brideStatueBlock,
  dragonStatueBlock,
  candelabraColumn,
  benchRow,
  plantNarrowBlock,
  alcoveFaceBlock,
  priestIdleFrame,
  monkPrayFrame,
  parishionerFrame,
  dragonMedallionBlock,
  windowAccentColumn,
  carpetFrame,
  CHAPEL_PARISHIONER_IDS,
} from '../packs/chapelPixelTiles'

// A run of carpet cells down one aisle column, `height` tiles tall, using
// the pack's real 8-frame vertical runner sequence (cap / glow-band / shaft
// / base, repeating every 8 tiles for longer aisles) instead of one frame
// repeated - see chapelPixelTiles.carpetFrame's comment for why that was the
// "rug feels wrong" bug. `colParity` (0 or 1) picks which of the runner's
// two real columns this aisle column uses.
function carpetRun(height, colParity) {
  const cells = []
  for (let r = 0; r < height; r++) {
    const { key, frame } = carpetFrame(colParity, r)
    cells.push({ dc: 0, dr: r, key, frame })
  }
  return cells
}

// Fills a bench row's seats with parishioner sprites - one distinct
// species/color per seat, cycling through every variant the pack ships
// (CHAPEL_PARISHIONER_IDS, 11 total) so the pews read as "full of many
// different parishioners" per the reference, instead of one lone sprite on
// an otherwise-empty 3-seat bench. targetHeight 44 is calibrated against the
// player's real on-screen size (44x80 native frame x 0.8 scale = 35x64px,
// see spriteGen.js/playerSpriteArt.js) - seated congregants read shorter
// than a standing adult, but shouldn't look like toys next to the player.
function pewSeats(startCol, row, count, flipX, idOffset) {
  const seats = []
  for (let i = 0; i < count; i++) {
    const id = CHAPEL_PARISHIONER_IDS[(idOffset + i) % CHAPEL_PARISHIONER_IDS.length]
    seats.push({ col: startCol + i, row, ...parishionerFrame(id), targetHeight: 44, blocking: false, flipX })
  }
  return seats
}

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
        const f = floorFrame(col, row)
        const img = scene.add.image(px, py, f.key, f.frame).setOrigin(0, 0).setScale(scale).setDepth(-1000)
        zoneObjects.push(img)
      }
    }
  }

  // ---- furniture blocks ------------------------------------------------------
  for (const block of spec.blocks || []) {
    // Optional per-block visual scale (default 1 - unchanged for every
    // existing block). Added specifically to let a block render SMALLER
    // than its native tile-grid footprint without leaving gaps between its
    // cells: cell spacing is compacted by the same factor as the image
    // scale, around the block's own (col,row) anchor, rather than each cell
    // staying pinned to its full-size tile position. Collision still uses
    // the ORIGINAL integer col/row per cell (not the shrunk visual
    // position) - simpler than fractional-tile blocking, at the cost of a
    // blocked-but-visually-empty margin around a shrunk block. Introduced
    // to calibrate the chapel statues against the player's real on-screen
    // size (see CHAPEL_TEMPLE_ROOM's comment) after they rendered far
    // larger than a person at native scale.
    const blockScale = block.scale ?? 1
    for (const cell of block.cells) {
      const px = block.col * TILE_SIZE + cell.dc * TILE_SIZE * blockScale
      const py = block.row * TILE_SIZE + cell.dr * TILE_SIZE * blockScale
      // Only animated cells (candelabra flicker) need a Sprite - plain
      // Image game objects don't have .play()/an anims component at all,
      // so using add.image() unconditionally here threw
      // "img.play is not a function" the moment a candelabra was drawn.
      const animKey = cell.animFrames ? ensureFlickerAnim(scene, cell.key, cell.animFrames) : null
      const img = animKey
        ? scene.add.sprite(px, py, cell.key, cell.frame).setOrigin(0, 0).setScale(scale * blockScale).setDepth(py + 1)
        : scene.add.image(px, py, cell.key, cell.frame).setOrigin(0, 0).setScale(scale * blockScale).setDepth(py + 1)
      zoneObjects.push(img)
      if (animKey) img.play(animKey)
      if (block.blocking) {
        // Collapse the collision footprint onto the SHRUNK visual bounds
        // (floor(dc*blockScale)) rather than the original unscaled grid -
        // at blockScale 1 this is a no-op (dc===floor(dc*1)); at 0.5 it
        // avoids blocking a footprint twice the size of what's actually
        // drawn, which would read as bumping into an invisible wall well
        // past the visible edge of a shrunk statue.
        const bc = block.col + Math.floor(cell.dc * blockScale)
        const br = block.row + Math.floor(cell.dr * blockScale)
        blockedTiles.add(`${bc},${br}`)
      }
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
// REBUILT A SECOND TIME this round. The first rebuild fixed a black-void/
// broken-tile rendering bug and was structurally sound, but the human then
// compared it directly against the ACTUAL reference image (an external
// marketing composite, not shipped in the pack - see
// production/chapel-reference.md for the full precise description written
// while that image was still visible) and it still didn't match: wrong
// palette, wrong layout, and a distinct "person split in half" bug the first
// rebuild didn't cover. This version targets chapel-reference.md directly:
//   - Palette: floor/walls were a flat near-black fill (confirmed-opaque,
//     but the wrong color family). Re-scanned the full 33-row tileset
//     looking specifically for cool blue-grey, found a real match at rows
//     28-32 - see chapelPixelTiles.wallFrame()/floorFrame() comments.
//   - "Split in half": alcoveFaceColumn() cropped 1 column x 3 rows from a
//     sheet where the actual character art is 2 columns wide - literally
//     grabbing only the left half of the portrait every time. Fixed as
//     alcoveFaceBlock() (2x2). Every other character/statue crop
//     (statuesBlock, priestIdleFrame, monkPrayFrame, parishionerFrame) was
//     re-checked by rendering each one at full size and none of the others
//     show this problem.
//   - Layout: chapel-reference.md places the bride/dragon statues flanking
//     the PEW blocks, not the altar; wants 4 monks (2 per side) rather than
//     2; and a second, lower tier of two more dragon-medallion windows below
//     the single top-center one. All three are reflected below.
//   - The statue pair itself was ALSO wrong the first pass at this: placing
//     statuesBlock() (bride+dragon together) on BOTH flanks drew both
//     figures twice - confirmed by rendering it, not assumed. Split into
//     brideStatueBlock()/dragonStatueBlock() (4x5 each, chapelPixelTiles.js)
//     so the west side is bride-only and the east side is dragon-only,
//     matching "LEFT: bride... RIGHT: dragon... mirroring" from the
//     reference. Room narrowed from 25 to 17 cols accordingly (4-wide
//     statues, not 8-wide).
//
// REVISED A THIRD TIME after the human's next look ("much better but not
// quite there yet"): three more concrete fixes, all confirmed by rendering
// and comparing again rather than assumed fixed:
//   - Scale: everything in this room was sized independently of the actual
//     player, who renders at a measured ~35x64px on screen (44x80 native
//     frame x 0.8 scale - see playerSpriteArt.js). The statues at native
//     tile-scale were 160x200px / 160x200px - two and a half times the
//     player's HEIGHT alone, let alone how oversized that reads next to a
//     person. Added `block.scale` support to buildTmxWallInteriorZone (see
//     above) and set it to 0.5 for both statues (now ~80x100px, ~1.5x
//     player height - a tall statue, not a kaiju). Priest/monk/parishioner
//     targetHeight values were bumped similarly against the same 64px
//     reference (see the sprite list below).
//   - The "rug": chapelPixelTiles.carpetFrame() replaced carpetTile() - the
//     old version repeated one frame (the runner's top cap) for the whole
//     aisle, which is what read as "wrong" rather than as the reference's
//     "glowing blue light-strip." The real asset is an 8-frame runner with
//     a bright cross-band partway down; the aisle now cycles through the
//     real sequence.
//   - plantNarrowBlock() was found to be cropping a necklace-pendant icon
//     instead of the actual flower-vase art during a fresh full read-through
//     of chapel-reference.md against the render (not a named complaint,
//     found by re-checking everything) - fixed in chapelPixelTiles.js.
// Known gaps vs. the reference, stated honestly rather than faked:
//   - The reference's distinct green-haired/auburn-haired alcove portraits
//     don't appear to exist in this pack (every column of the source sheet
//     showed the same portrait) - both alcove positions reuse one portrait.
//   - The reference shows each lower-tier window flanked by pairs of thin
//     arch windows; only the top-center window gets that treatment (now 2
//     accents per side) - the two lower windows still stand alone, to keep
//     an already-dense layout legible.
//   - CORRECTED: an earlier version of this list claimed "this pack's Priest
//     sheet only has the idle-front frame, not [the arms-out preaching]
//     pose." That was wrong - it was written from the one sheet already
//     wired up (Priest_Idle_front.png) without listing the pack's Priest
//     folder. The pack DOES ship the pose:
//     PNG/Animation_packed/Priest/Priest_speech.png, 128x144 = 4 cols x 3
//     rows @32x48 (same 32x48 cell size as the idle sheet already used by
//     priestIdleFrame(), so it slices with the identical convention), plus
//     Priest_making_spell.png (96x96) and Priest_Walk_*.png. Not yet wired
//     in only because picking WHICH of the 12 frames is the arms-out one
//     needs a look at the rendered frames, not because the art is missing.
//     Note the file name collision to avoid confusion: PNG/Animation/
//     Priest_speech.png (192x96, a 16px tile grid) is a DIFFERENT file,
//     already used here as the wall-alcove portrait via CHAPEL_KEYS
//     .alcoveFace - which is also why both alcoves show the same face (see
//     the alcove gap above): that "portrait" is a tile-scale crop of this
//     same priest-speech art, not a separate set of saint portraits.
//   - The reference's room silhouette is a stepped gothic shape (narrower at
//     the altar end, wider at the pew end), matching the exterior roofline.
//     This room is still a plain rectangle - reworking isWall() into a
//     stepped shape touches every other element's column placement (several
//     currently sit right at the border columns that would become wall),
//     and was judged too likely to introduce a new reachability or
//     collision bug to do carefully in this pass. Flagging honestly rather
//     than attempting a rushed version.
//   - The statues' collision footprint is collapsed to match the shrunk
//     visual bounds (floor(dc*blockScale) - see buildTmxWallInteriorZone),
//     not left at the full original 4x5 grid, but it's still a rectangular
//     approximation of an irregular statue silhouette, so the player may
//     bump an invisible wall slightly past the visible edge in places.
//
// Layout (17 cols x 22 rows, room-local, north=altar, south=door):
//   cols 1-4 / 12-15   statue columns (west=bride, east=dragon), rows 12-16,
//                       drawn at half scale (see block.scale note above)
//   cols 5-6 / 10-11   pew columns (2 seats wide), rows 12-14
//   cols 7-9           center aisle/nave (altar, carpet, exit all live here)
//   rows 1-3           top-center window + 2 flanking accents per side +
//                       alcove faces
//   rows 4-5           altar
//   row 6              priest
//   rows 7-9           second-tier windows (west cols4-6, east cols10-12)
//   row 9              4 monks (2 inner-left cols5-6, 2 inner-right 10-11)
//   row 15             flower vase at the south end of each pew block (see
//                       known-gaps note above for why there's no north one)
//   rows 12-14         pews, every one of the 12 seats filled with a
//                       distinct parishioner (matches the reference's "~12
//                       total, visibly varied species" count)
//   rows 4-19, cols 7-9   carpet aisle, cycling the pack's real 8-frame
//                       runner sequence (the reference's glowing blue
//                       light-strip down the center)
export const CHAPEL_TEMPLE_ROOM = {
  cols: 17,
  rows: 22,
  regionLabel: 'Whispering Temple Chapel',
  spawn: { col: 8, row: 20 },
  exitRect: { c0: 7, r0: 19, c1: 9, r1: 20 },
  deskZone: { id: 'temple', label: 'Whispering Temple Chapel', c0: 5, r0: 6, c1: 11, r1: 6 },
  isWall(col, row) {
    return col === 0 || col === 16 || row === 0 || row === 21
  },
  blocks: [
    // carpet aisle first so later furniture (the altar) wins equal-depth
    // ties. colParity 0/1/0 spreads the real 2-wide runner asset across the
    // 3-wide aisle (see chapelPixelTiles.carpetFrame) - a minor seam at the
    // repeat, but a real multi-frame runner instead of one tile repeated.
    { col: 7, row: 4, cells: carpetRun(16, 0), blocking: false },
    { col: 8, row: 4, cells: carpetRun(16, 1), blocking: false },
    { col: 9, row: 4, cells: carpetRun(16, 0), blocking: false },
    { col: 7, row: 1, cells: dragonMedallionBlock(), blocking: false },
    { col: 3, row: 1, cells: windowAccentColumn(), blocking: false },
    { col: 4, row: 1, cells: windowAccentColumn(), blocking: false },
    { col: 12, row: 1, cells: windowAccentColumn(), blocking: false },
    { col: 13, row: 1, cells: windowAccentColumn(), blocking: false },
    { col: 5, row: 1, cells: alcoveFaceBlock(), blocking: false },
    { col: 10, row: 1, cells: alcoveFaceBlock(), blocking: false },
    { col: 7, row: 4, cells: altarBlock(), blocking: true },
    { col: 4, row: 7, cells: dragonMedallionBlock(), blocking: false },
    { col: 10, row: 7, cells: dragonMedallionBlock(), blocking: false },
    { col: 1, row: 3, cells: candelabraColumn(), blocking: true },
    { col: 15, row: 3, cells: candelabraColumn(), blocking: true },
    { col: 1, row: 9, cells: candelabraColumn(), blocking: true },
    { col: 15, row: 9, cells: candelabraColumn(), blocking: true },
    // Statues shrunk to half native tile-scale (scale: 0.5) so they read as
    // "tall statue" rather than "3x the player's height" - calibrated
    // against the player's real on-screen size (35x64px, see
    // playerSpriteArt.js's PLAYER_ART_FRAME_W/H * PLAYER_ART_SCALE): at
    // native scale the 4x5 block renders 160x200px; at 0.5 it's 80x100px,
    // about 1.5x the player's height, which reads as an imposing but not
    // absurd statue next to a person. See buildTmxWallInteriorZone's
    // `block.scale` support above.
    { col: 1, row: 12, cells: brideStatueBlock(), blocking: true, scale: 0.5 },
    { col: 12, row: 12, cells: dragonStatueBlock(), blocking: true, scale: 0.5 },
    // Only one vase per pew block (south/entrance end) - the reference asks
    // for vases at both ends, but the north end of each pew block is
    // already occupied by the second-tier window and the 4 monks with no
    // 3-tall gap left to fit one without overlapping them.
    { col: 5, row: 15, cells: plantNarrowBlock(0), blocking: true },
    { col: 10, row: 15, cells: plantNarrowBlock(2), blocking: true },
    { col: 5, row: 12, cells: benchRow(2), blocking: true },
    { col: 5, row: 13, cells: benchRow(2), blocking: true },
    { col: 5, row: 14, cells: benchRow(2), blocking: true },
    { col: 10, row: 12, cells: benchRow(2), blocking: true },
    { col: 10, row: 13, cells: benchRow(2), blocking: true },
    { col: 10, row: 14, cells: benchRow(2), blocking: true },
  ],
  sprites: [
    // targetHeight values calibrated against the player's real on-screen
    // height (~64px, see the statue comment above for the exact source
    // numbers) rather than picked to merely look OK in isolation: priest
    // close to full adult height (arms-out preaching pose unavailable in
    // this pack, see known-gaps note above), monks slightly shorter for
    // their bowed-head stance, parishioners shorter still since they're
    // seated (see pewSeats()).
    { col: 8, row: 6, ...priestIdleFrame(), targetHeight: 60, blocking: false },
    { col: 5, row: 9, ...monkPrayFrame(1), targetHeight: 52, blocking: false },
    { col: 6, row: 9, ...monkPrayFrame(2), targetHeight: 52, blocking: false },
    { col: 10, row: 9, ...monkPrayFrame(3), targetHeight: 52, blocking: false },
    { col: 11, row: 9, ...monkPrayFrame(4), targetHeight: 52, blocking: false },
    ...pewSeats(5, 12, 2, false, 0),
    ...pewSeats(5, 13, 2, false, 2),
    ...pewSeats(5, 14, 2, false, 4),
    ...pewSeats(10, 12, 2, true, 6),
    ...pewSeats(10, 13, 2, true, 8),
    ...pewSeats(10, 14, 2, true, 10),
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
