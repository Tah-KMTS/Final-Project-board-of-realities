// Frame indices into kenney_roguelike-modern-city tilemap_packed.png (37 cols, index=row*37+col).
// Every index below visually confirmed via the tileview tool AND by rendering assembled
// 2x2/3x2/3x3/4x3 test buildings with scratchpad/assemble.cjs (checked border continuity by eye).
// Cars are OUT OF SCOPE (owned by another agent).
//
// STRUCTURE NOTE: rows 0-3 (cols 0-36) are a bank of flat-color material "plates" — 8-col
// blocks per material, each block holding a top-left corner-accent tile (light seam on top
// AND left edge only — no bottom/right accent exists in this pack), a couple of top-edge
// tiles, one left-edge tile, and several near-identical plain fill tiles. In Sample.png these
// same flat plates are literally what a building rooftop/upper-facade looks like from this
// game's near-top-down angle, so they double as both pavement AND a real nine-slice for a
// multi-story facade body — confirmed by rendering full rectangles: continuous light border
// on north+west, flat/plain south+east (that asymmetry is a deliberate light-direction shading
// in the source art, not a mistake — reused verbatim here).
//
// Ground-floor windows/doors are NOT baked into the material plates; this pack instead has a
// separate bank of standalone wood-framed glass props (rows 15-20, cols 25-30, e.g. idx
// 580-622) meant to be dropped on top of any wall fill. There is no per-material (brick vs
// concrete) door/window art, so the same prop bank is reused across families below, picking
// a plain glass pane for "door" and a multi-pane grid for "window" so the two read differently
// at a glance despite sharing a frame color.
//
// MODERN_CITY_NOTES — other regions surveyed (cars skipped per scope):
//   rows 0-3, cols 0-7   = red brick material plates (used below)
//   rows 0-3, cols 8-18  = grey concrete material plates (used below); cols 16-18 look like a
//                          slightly lighter grey variant of the same concrete, NOT confirmed as
//                          a distinct material
//   rows 0-3, cols 19-23 = grey concrete, continues the cols 8-18 block
//   rows 0-3, cols 24-31 = tan/stucco material plates — same corner/edge/fill layout as brick
//                          and concrete (tl=idx24, t=idx26, l=idx27, m=idx28 by inspection) but
//                          NOT run through assemble.cjs — flag as unverified, not included below
//   rows 0-3, cols 32-36 = green park/hedge plates (ground only, not a facade material)
//   row 4 (idx 148-166)  = ground-overlay decoration: pipe/drain crossings stamped into brick,
//                          concrete, and tan pavement, plus a tan rubble/roof-gable prop at
//                          164-166 (unverified as a usable roof piece, not included)
//   rows 5-9, col 12-15 (idx 197-200, 234-237, 271-274, 308-311, 345-348) = teal storefront
//                          glass band and light curtain-wall/mullion glass variants — this is
//                          the closest thing to a "blue-glass curtain-wall" texture in the pack;
//                          used as concreteGlass.window (idx 234) below, but NOT verified as its
//                          own nine-slicing wall family (no distinct corner/edge tiles found for
//                          it specifically) — do not build a standalone blueGlass wall family
//                          from this without re-deriving corners
//   rows 15-20, cols 25-30 (idx 580-622) = standalone wood-framed window/door glass props
//                          (arched window, multi-pane grid, plain glass pane, venetian blinds,
//                          a "black cat in window" novelty) — universal, not tied to one material
//   rows 12-14, cols 19-30 (idx ~504-511, ~541-548) = green/orange awning stripe bands (shop
//                          awnings, matches the awning+door storefront in Sample.png) —
//                          identified but not wired into a family here (optional roof-alt)
//   rows 21-27            = road lane markings/crosswalks, parking-lot stencils (P, bike,
//                          disabled), grass/dirt patches, garage-style shutter doors, and the
//                          car roster (out of scope) — no additional facade material found here
//
// Two solid families below (redBrick, concreteGlass). A tan/stucco family looked structurally
// identical (same 8-col plate layout) but its corner/edge indices were only spot-checked, not
// assembled — left out rather than guessed, per instructions.

// Both families are TRUE NINE-SLICE (type: 'nineSlice'), not fixed-size prefabs: each was
// rendered with scratchpad/assemble.cjs at ALL FOUR required footprints — 2x2, 3x2, 3x3, 4x3
// — with roof+wall+window+door together, and every render showed a continuous, unbroken light
// border tracing the whole outline with zero internal seams (no stray tile "poking through" at
// any internal column/row boundary, at any of the four sizes). That rules out the prefab
// failure mode explicitly: a true prefab would only close cleanly at ONE native size and would
// show broken/duplicated borders at the others, which did not happen here. Files saved as
// assemble_modern-city_redbrick-withroof.png / assemble_modern-city_concrete-withroof.png in
// the scratchpad for reference. No prefab-shaped family was needed for this pack.
export const MODERN_CITY = {
  redBrick: {
    type: 'nineSlice',
    // roof: reuses the plate's own light-edged top row as a parapet/cornice band drawn one
    // row above the wall body — confirmed clean in a 2x2..4x3 assembly with roof enabled.
    roof: { l: 0, m: 2, r: 2 }, // idx0=(c0,r0) corner accent, idx2=(c2,r0) top-edge accent
    wall: {
      tl: 0, // (c0,r0) top-left corner: light seam on top edge + left edge
      t: 2, // (c2,r0) top edge only, clean
      tr: 2, // (c2,r0) top edge only, clean (idx1 was rejected — it bakes in an off-center
             // vertical highlight that creates a fake repeating seam when tiled; confirmed
             // via assemble.cjs 3x2/3x3/4x3 renders)
      l: 3, // (c3,r0) left edge only, clean vertical light seam
      m: 4, // (c4,r0) plain fill, no seams (has a tiny consistent mortar-dot near its corner,
            // which is part of the base texture and repeats identically tile-to-tile)
      r: 4, // no distinct right-edge accent exists in this plate; reuses plain fill (matches
            // the pack's own light-only-on-north/west convention)
      bl: 3, // reuses left-edge tile down the left column; no distinct bottom-left exists
      b: 4, // reuses plain fill; no distinct bottom-edge exists
      br: 4, // reuses plain fill; no distinct bottom-right exists
    },
    window: 617, // (c25,r16) wood-framed 4-pane glass grid — universal prop, not brick-specific
    door: 580, // (c25,r15) wood-framed single pane, frame closed on ALL FOUR sides so it reads
               // as a doorway set into the wall. Was 620, rejected on rendered evidence: 620's
               // frame is open top/bottom, so at 40px it reads as a pale hole punched in the
               // facade rather than a door.
  },

  concreteGlass: {
    type: 'nineSlice',
    roof: { l: 8, m: 10, r: 10 }, // idx8=(c8,r0) corner accent, idx10=(c10,r0) top-edge accent
    wall: {
      tl: 8, // (c8,r0) top-left corner: light seam on top+left, same convention as redBrick
      t: 10, // (c10,r0) top edge only, clean (idx9 skipped — same off-center-highlight problem
             // as redBrick's idx1, would create a fake seam on repeat)
      tr: 10,
      l: 11, // (c11,r0) left edge only, clean
      m: 12, // (c12,r0) plain fill, clean
      r: 12,
      bl: 11,
      b: 12,
      br: 12,
    },
    // House rule: both families share the universal wood-framed prop bank. The curtain-wall
    // glass (idx 234) was the closer MATERIAL match on paper, but rendered at 40px against the
    // flat concrete plate it has almost no contrast and reads as a pale vertical smear rather
    // than a window - confirmed on a real rendered frame. The framed prop reads as an actual
    // opening, which matters more here than exact material tone.
    window: 617, // (c25,r16) wood-framed 4-pane glass grid
    door: 580, // (c25,r15) wood-framed single pane, frame closed on all four sides
  },
}
