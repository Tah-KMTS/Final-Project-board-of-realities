// Frame indices into SERENE_VILLAGE_REVAMPED/Serene_Village_16x16.png.
// GRID: 16x16px tiles, 0 spacing/margin, 19 cols x 45 rows (304x720px total -
// manager-confirmed file dimensions). index = row*19+col. Do NOT use the
// 32x32 or 48x48 variants living next to this file in the pack - they are
// re-exports of the same art at a different native size and would need their
// own frame math.
//
// SURVEY: this is a top-down JRPG cottage/village pack. Rows 23-44 (roughly)
// hold a long, repeating strip of hand-placed COTTAGE prefabs: each cottage
// is exactly 3 tiles wide x 4 tiles tall (peaked-roof row, gable+window row,
// wall+door row, porch/base row) and is repeated many times across the strip
// in a handful of roof colors (red-with-chimney, plain green, plain blue -
// at least; a couple of additional repeats/colors exist further along the
// same rows and are not catalogued, see LEFT OUT below). Confirmed NOT a
// nine-slice: the peaked roof is one integrated triangular graphic sized
// exactly for 3 columns (no separate reusable l/m/r roof-slope pieces the
// way tinyTownTiles.js's cottages have), and the column immediately outside
// a verified cottage does not continue its wall/roof material - e.g. the
// red-with-chimney cottage's left neighbor (col 9, rows 25-28) is a
// completely different flat-topped gambrel-barn material with no window/
// door, not a continuation of the cottage's own wall - confirmed via
// scratchpad/tileview.cjs region renders. Given that, this pack is
// catalogued as PREFABS (type: 'prefab', consumed via packRender.js's
// drawPrefabFacade), same treatment as pico8CityTiles.js's manor/warehouse
// families - not forced into a nine-slice shape it doesn't have.
//
// Each family below was rendered with scratchpad/tileview.cjs's assemble
// mode (borderless stitched crop) at its exact claimed 3x4 native size and
// visually confirmed: continuous roof/gable/wall/porch, a single centered
// door, zero internal seams. Per packRender.js's own prefab rule ("only
// closes cleanly at ONE native size"), that is the right and sufficient bar
// here - no other footprint is claimed to work.
//
// `door: { col, row }` records the 0-based (col, row) of the door tile
// WITHIN the prefab's own 3x4 grid (col 1 = middle column, row 2 = the
// wall+door row) - used by tileGen.js's buildingDoorAnimSpec/packRender.js's
// prefabTileWorldPos to position the animated door overlay sprite exactly on
// top of this baked-in static door frame (see OverworldScene.js).
//
//   cottage.red: cols 10-12, rows 25-28 - idx 485-487 (roof, with a chimney
//     stack overlapping the top-right of the roof graphic), 504-506 (gable +
//     window), 523-525 (wall + door, door at col 11 = idx 524), 542-544
//     (porch/base). Verified via view_serene-village_assemble_10-25-12-28.png
//     - clean red-shingled roof, gabled window, wood-plank wall, brown door
//     with a small yellow doorknob, cream porch step, no seams.
//   cottage.green: cols 11-13, rows 29-32 - idx 562-564, 581-583, 600-602
//     (door at col 12 = idx 601), 619-621. Identical composition to
//     cottage.red minus the chimney, green roof instead of red - a genuine
//     color variant, not a near-duplicate. Verified via
//     view_serene-village_assemble_11-29-13-32.png.
//   cottage.blue: cols 11-13, rows 37-40 - idx 714-716, 733-735, 752-754
//     (door at col 12 = idx 753), 771-773. Same composition again, blue
//     roof. Verified via view_serene-village_assemble_11-37-13-40.png.
//
// LEFT OUT (spot-checked in the wide region renders, not individually
// assembled-and-confirmed, or explicitly out of scope for this pass):
//   - Additional repeats of the same red/green/blue cottages further along
//     rows 25-40 (each color appears 2-3 times across the full 19-column
//     width, e.g. a second red-with-chimney copy at cols 13-15) - these read
//     identically to the catalogued instance of their color, so only one
//     representative index set per color is recorded here, same as
//     pico8CityTiles.js's approach.
//   - A "plain" red roof WITHOUT the chimney (cols 1-4ish, rows 25-28 area)
//     and a wider green terrace-style block further down (~rows 33-36,
//     idx 627-702) - spot-checked in the wide region render, not run through
//     assemble.cjs, left out rather than guessed at.
//   - The flat-topped gambrel-roof "barn" material at cols 6-9 (rows 25-28) -
//     no window, no door, reads as a shed/barn rather than a home; out of
//     scope for a building-facade catalog (would be a good future decor/prop
//     pick, same as pico8CityTiles.js flags its own leftover accent tiles).
//   - Rows 0-22 (fences, standalone door/window props, flower/mushroom/rock
//     decoration, terrain tiles already covered by tileGen.js's
//     TERRAIN_TILE_INDEX) - not building material.
//   - Animated stuff/campfire_16x16.png and water_waves_16x16.png (4-frame
//     strips, same format as the door) - explicitly lower priority per task
//     scope, not pulled in this pass.
export const SERENE_VILLAGE_HOMES = {
  cottage: {
    red: {
      type: 'prefab',
      cols: 3,
      rows: 4,
      frames: [
        [485, 486, 487],
        [504, 505, 506],
        [523, 524, 525],
        [542, 543, 544],
      ],
      door: { col: 1, row: 2 },
    },
    green: {
      type: 'prefab',
      cols: 3,
      rows: 4,
      frames: [
        [562, 563, 564],
        [581, 582, 583],
        [600, 601, 602],
        [619, 620, 621],
      ],
      door: { col: 1, row: 2 },
    },
    blue: {
      type: 'prefab',
      cols: 3,
      rows: 4,
      frames: [
        [714, 715, 716],
        [733, 734, 735],
        [752, 753, 754],
        [771, 772, 773],
      ],
      door: { col: 1, row: 2 },
    },
  },
}
