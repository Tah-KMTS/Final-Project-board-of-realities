// Frame indices into kenney_pico-8-city Tilemap/tilemap_packed.png.
// GRID: 8x8px tiles, 0 spacing/margin, 24 cols x 15 rows, 360 tiles total
// (confirmed against Tiled/sample-sheet.tsx: tilewidth=8 tileheight=8
// tilecount=360 columns=24 - trust this over the Tilesheet.txt-derived
// "364" figure some earlier scan implied, that was wrong). index = row*24+col.
//
// CARS ARE OUT OF SCOPE - owned by vehicleGen.js/OverworldScene.js (region
// cols 15-17, rows 11-12, idx 279-281/303-305). Not re-catalogued here.
//
// SURVEY: this is a top-down (not side-on) city pack, confirmed against the
// pack's own Sample.png - buildings render as flat rooftop rectangles seen
// from directly above, edged with a cream/white double-line border, not as
// upright wall facades like the other three packs. rows 0-2 (idx 0-71) are
// terrain (grass/water/sand/plaza fills, a roundabout) - not building
// material, skipped. rows 4-10 (idx 96-263ish), cols 0-23, are a dense
// sequence of hand-placed, non-repeating rooftop/building tiles: each
// "building" is a fixed number of unique tiles wide/tall that only reads
// correctly at its own exact size - there is no shared corner/edge/fill
// vocabulary reusable at arbitrary footprints the way modern-city's material
// plates are. Concretely: the column immediately to the right of a verified
// closed building (e.g. idx 172, 196, 220, 244 - the column right after the
// 4-wide purple building at cols 0-3) is NOT a continuation of the same
// wall material - it's a different decorative motif (a notch + window-strip
// pattern) that never closes into its own border on the left. Confirmed by
// assembling c4-7,r7-10 (view_pico-8-city_assemble_4-7-7-10.png) and seeing
// an unclosed edge where a nine-slice would show a border. Given that, this
// pack is catalogued as PREFABS (type: 'prefab', consumed via
// packRender.js's drawPrefabFacade), matching the "discrete pre-made
// building block" case packRender.js's own comments call out - not forced
// into a nine-slice shape it doesn't have.
//
// Each family below was rendered with scratchpad/tileview.cjs's assemble
// mode (borderless stitched crop) at its own claimed native size and
// visually confirmed: a continuous, unbroken cream border on all 4 sides,
// zero internal seams, zero stray tiles poking through. Per packRender.js's
// own rule for prefabs ("only closes cleanly at ONE native size"), that
// single verification is the right and sufficient bar here - these are not
// claimed to be nine-slices, so no 2x2/3x2/3x3/4x3 sweep applies.
//
//   warehouse.purple: cols 0-3, rows 4-6 (4 wide x 3 tall) - idx 96-99,
//     120-123, 144-147. Flat purple/mauve rooftop, cream double-line border,
//     a couple of dark speckle dots (rooftop vents/AC units). Verified via
//     view_pico-8-city_assemble_0-4-3-6.png - closed rectangle, no seams.
//   warehouse.grey: cols 10-13, rows 4-6 (4 wide x 3 tall) - idx 106-109,
//     130-133, 154-157. Same shape/border, grey rooftop fill instead of
//     purple - a genuine second color variant of the same building block,
//     not a near-duplicate (grey vs purple is a real material difference in
//     Sample.png, matching the warehouse-vs-office-tower color mix visible
//     there). Verified via view_pico-8-city_assemble_10-4-13-6.png.
//   manor.purple: cols 0-3, rows 7-10 (4 wide x 4 tall) - idx 168-171,
//     192-195, 216-219, 240-243. A detailed hand-drawn townhouse: symmetric
//     windows left/right, a centered portico/arch over a door at bottom-center,
//     jagged roofline edge (intentional shingle silhouette, not a seam).
//     Verified via view_pico-8-city_assemble_0-7-3-10.png.
//   manor.pink: cols 5-8, rows 7-10 (4 wide x 4 tall) - idx 173-176,
//     197-200, 221-224, 245-248. Identical composition to manor.purple,
//     pink rooftop instead of purple - second color variant. Verified via
//     view_pico-8-city_assemble_5-7-8-10.png.
//
// LEFT OUT (spot-checked, not assembled-and-confirmed, or confirmed NOT to
// close cleanly - flagged rather than guessed):
//   - The 1-column "sliver" buildings at col 4 (idx 100/124/148/172) and
//     col 9 (idx 105/129/153/177): each is a single 8px-wide decorative
//     strip between two real buildings in the source map, not a usable
//     building of its own (1 world tile wide reads as a fence post, not a
//     structure) - excluded.
//   - rows 0-2 plaza/ground fills (idx 14-23, 38-47, 62-71 grey speckle;
//     idx 4-11/28-35/33-36 roundabout rings) - these are ground textures,
//     not building material; out of scope for a "building facade" catalog.
//   - The pink/orange striped awning tiles at idx 260-262 and the green
//     tree at idx 263 - real, usable decoration, but single accent tiles
//     rather than a building family; not catalogued here (a future prop
//     pass could pull these in, same as rpgUrbanTiles.js's prop bank).
//   - idx 188 (green medical cross) and idx 212-215/236-239 (road stripe/
//     crosswalk markings) - clearly single-purpose sign/road props, not
//     building material - excluded.
//   - Every other color band visible in the rows 4-10 mosaic (additional
//     pink/purple wall-only fills at cols 5-8 and cols 14-23 that did NOT
//     resolve into a clean closed 4-wide block on inspection) - only
//     spot-checked, not run through assemble.cjs, so left out rather than
//     guessed at.
export const PICO8_CITY = {
  warehouse: {
    purple: {
      type: 'prefab',
      cols: 4,
      rows: 3,
      frames: [
        [96, 97, 98, 99],
        [120, 121, 122, 123],
        [144, 145, 146, 147],
      ],
    },
    grey: {
      type: 'prefab',
      cols: 4,
      rows: 3,
      frames: [
        [106, 107, 108, 109],
        [130, 131, 132, 133],
        [154, 155, 156, 157],
      ],
    },
  },

  manor: {
    purple: {
      type: 'prefab',
      cols: 4,
      rows: 4,
      frames: [
        [168, 169, 170, 171],
        [192, 193, 194, 195],
        [216, 217, 218, 219],
        [240, 241, 242, 243],
      ],
    },
    pink: {
      type: 'prefab',
      cols: 4,
      rows: 4,
      frames: [
        [173, 174, 175, 176],
        [197, 198, 199, 200],
        [221, 222, 223, 224],
        [245, 246, 247, 248],
      ],
    },
  },
}
