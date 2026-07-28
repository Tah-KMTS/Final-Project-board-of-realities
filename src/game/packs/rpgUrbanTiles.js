// Frame indices into kenney_rpg-urban-pack tilemap_packed.png (27 cols, index=row*27+col). All visually confirmed.
// Character roster and cars are OUT OF SCOPE here (owned by other systems) — this file is decoration only.
export const RPG_URBAN = {
  props: {
    // -- single-tile street furniture (complete art in one 16px cell) --
    signRed: 166, // red sign on pole w/ green base, complete (c4,r6)
    flagGreen: 167, // green flag on tall pole, complete (c5,r6)
    mailboxBlue: 168, // blue box lamp/mailbox on pole, complete (c6,r6)
    lampGreenGlow: 169, // green glowing lantern on pole, complete (c7,r6)
    lampSilver: 190, // grey street lamp, head+pole+base in one tile (c1,r7)
    bollardOrange: 189, // slim orange warning bollard, complete (c0,r7)
    bollardOrange2: 247, // plain orange bollard/post variant, complete (c4,r9)
    rockCluster: 245, // grey rubble/rock decoration, complete (c2,r9)
    barrierOrange: 221, // orange/white sawhorse barrier (c5,r8)
    barrierRed: 248, // red/white barrier w/ orange studs (c5,r9)
    marketStall: 222, // striped awning market stall, complete single tile (c6,r8)
    marketStall2: 249, // market stall color variant (c6,r9)
    crate: 223, // orange crate/box (c7,r8)
    crate2: 250, // orange crate/box variant (c7,r9)
    trashBinRed: 251, // red round bin (c8,r9)
    trashBinRedLid: 252, // red round bin, lid variant (c9,r9)
    trashBinBlue: 253, // blue-topped canister bin (c10,r9)
    trashBag: 254, // dark grey sack/bag (c11,r9)
    arcadeCabinet: 255, // arched kiosk/arcade cabinet, screen off (c12,r9)
    arcadeCabinetLit: 257, // same cabinet, screen glowing (teal line) (c14,r9)

    // -- fencing (single-tile, repeatable/tileable) --
    pipeFenceCorner: 162, // grey pipe fence, corner piece (c0,r6)
    pipeFenceCorner2: 163, // grey pipe fence, corner piece variant (c1,r6)
    pipeFenceElbow: 164, // grey pipe fence, elbow/L piece (c2,r6)
    pipeFenceT: 165, // grey pipe fence, T-junction piece (c3,r6)
    railFenceGrey: 380, // wrought-iron style grey railing (c2,r14)
    chainLinkFence: 355, // chain-link fence panel (c4,r13; variants 356,357 near-identical, 358 = post-end cap)
    woodFenceOrange: 382, // orange wood-plank fence panel (c4,r14; variants 383,384 near-identical)
    hedgeFence: 328, // green hedge/shrub fence panel (c4,r12; variants 329-332 near-identical)
  },

  // Multi-tile props: ALL listed indices must be placed together as one unit, in the given relative layout.
  // Placing only one piece reproduces the "headless lamppost" failure — do not do that.
  multiTile: {
    // (currently no confirmed multi-tile STREET-FURNITURE prop beyond the trees below;
    // the wire/garland cluster at 243-246 and the bent lamp-arms at 244/246 were inspected
    // but their join logic could not be confirmed — see report, left out of the deliverable.)
  },

  trees: {
    // Two color palettes each contain a matching 2-tile-wide "big tree" (canopy spans both
    // tiles, single trunk implied under the pair) plus standalone round-bush/sapling singles.
    // The third palette has two independent single-tile trees instead of a joined big tree.
    green: {
      bigTree: [259, 260], // MULTI-TILE 2x1: left=259 (c16,r9), right=260 (c17,r9) — place as a pair
      roundBush: 264, // single tile, teal round bush (c21,r9)
      sapling: 265, // single tile, small teal pine (c22,r9)
      forestClump: [261, 262, 263], // MULTI-TILE 3x1 (c18-20,r9): jagged connected canopy mass; likely meant as a wide background clump, not a single prop — use as a joined trio only
    },
    autumn: {
      bigTree: [286, 287], // MULTI-TILE 2x1: left=286 (c16,r10), right=287 (c17,r10) — place as a pair
      roundBush: 291, // single tile, orange round bush (c21,r10)
      sapling: 292, // single tile, small orange pine (c22,r10)
      forestClump: [288, 289, 290], // MULTI-TILE 3x1 (c18-20,r10), same caveat as green.forestClump
    },
    rust: {
      // Third palette: NOT a joined canopy pair — two independent single-tile trees.
      treeA: 313, // single tile, tall pointed rust/red conifer (c16,r11)
      treeB: 314, // single tile, shorter round rust/red tree (c17,r11)
      roundBush: 318, // single tile, rust round bush (c21,r11)
      roundBush2: 319, // single tile, rust round bush variant (c22,r11)
      forestClump: [316, 317], // MULTI-TILE 2x1 (c19-20,r11); col18/(315) is a blank spacer, not part of the clump
    },
  },

  // OPTIONAL: plaza/road surface fills, only the cleanly-identified flat (non-edge/non-corner) tiles.
  surfaces: {
    greyStonePlaza: 62, // flat grey stone fill (c8,r2)
    orangePlaza: 178, // flat orange brick fill (c16,r6)
  },
};
