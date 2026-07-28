// Frame indices into kenney_tiny-town tilemap_packed.png (12 cols, index=row*12+col). All visually confirmed.
// NOTE on roofs: this pack does NOT have a 3-piece (left-slope/peak/right-slope) roof kit.
// Each roof index below is ONE self-contained peaked-roof-cap tile (full gable art in a single
// 16px cell). Verified via composed crop: placing the SAME tile twice side by side produces a
// seamless continuous twin-gable ridge with no visual gap (checked at 2-wide and 3-tall). Do not
// invent separate l/peak/r indices — they don't exist in this sheet.
// NOTE on walls: NOT a true nine-slice. Only two wall registers exist per material — a plain
// "upper" wall tile and a "ground" wall tile with a baseboard trim strip at the bottom that lines
// up with the door tiles. Cosmetic-variety duplicates (near-identical speckle pattern, no
// structural difference) are noted inline; pick any one, they tile fine together.
export const TINY_TOWN = {
  stoneCottage: {
    roof: 63, // grey/blue peaked roof cap, self-contained tile (c3,r5). Repeat per column for wider roofs.
    wall: {
      upper: 48, // plain grey stone wall, upper register (c0,r4). Variants 49,50 = cosmetic-only duplicates.
      ground: 76, // grey stone wall w/ baseboard trim, ground register (c4,r6). Variants 77,79 = cosmetic-only.
    },
    window: 51, // grey wall w/ shuttered window, upper register (c3,r4)
    door: 89, // wood door w/ knob, stone frame, ground register (c5,r7). Variants 90,91 = same door, trim cosmetics.
    archway: 78, // OPEN walkthrough archway, ground register (c6,r6) — interior is transparent, not a closed door.
  },
  brickCottage: {
    roof: 67, // orange/brick peaked roof cap, self-contained tile (c7,r5)
    wall: {
      upper: 52, // plain brick wall, upper register (c4,r4). Variants 53,54 = cosmetic-only.
      ground: 73, // brick wall w/ baseboard trim, ground register (c1,r6). Variants 72,75 = cosmetic-only.
    },
    window: 55, // brick wall w/ shuttered window, upper register (c7,r4)
    door: 86, // wood door w/ knob, brick frame, ground register (c2,r7). Variants 85,87 = same door, trim cosmetics.
    archway: 74, // OPEN walkthrough archway, ground register (c2,r6) — interior transparent.
  },

  // Bonus: separate large stone gate kit (not a cottage part), 2x2, verified seamless via composed crop.
  // Place all 4 together: tl,tr on top row, bl,br on bottom row. Opening is transparent/walkable.
  stoneArchGate: { tl: 111, tr: 112, bl: 123, br: 124 }, // (c3,r9)(c4,r9)(c3,r10)(c4,r10)

  trees: {
    green: [5, 16, 20, 7, 6], // 5=full round tree(c5,r0), 16=trunked tree(c4,r1), 20=tree(c8,r1), 7=single tree(c7,r0), 6=double bush(c6,r0)
    autumn: [3, 9, 10, 21, 23], // 3=orange tree(c3,r0), 9,10=orange trees(c9,r0)(c10,r0), 21,23=thin orange trees(c9,r1)(c11,r1)
  },

  props: {
    sign: 83, // wood sign board on post (c11,r6)
    chest: 107, // round treasure chest, lid ajar (c11,r8)
    barrel: 130, // barrel, closed, top-down view (c10,r10)
    barrelFull: 131, // barrel w/ blue liquid visible, top-down (c11,r10)
    coins: 93, // single gold coin/nugget, diagonal shine (c9,r7)
    potion: 104, // flask w/ blue liquid in holder (c8,r8) — could also read as a small lantern
    key: 117, // silver key (c9,r9)
    beehive: 94, // golden beehive/urn (c10,r7)
    target: 95, // red/white archery target (c11,r7)
    coinPurse: 106, // tan coin purse w/ gem window (c10,r8)
    lockedGate: 103, // metal-bound cellar door/gate (c7,r8)
    tools: {
      pitchfork: 116, // (c8,r9)
      pickaxe: 115, // (c7,r9)
      shovel: 128, // (c8,r10)
      axe: 129, // (c9,r10)
      bow: 118, // (c10,r9)
      arrow: 119, // (c11,r9)
      bomb: 105, // (c9,r8)
    },
  },

  // This is a connector/pipe-style kit (post + straight + T/cross junctions at 44-47, 56-59,
  // 68-71, 80-83), not simple "fence-h + fence-post" pieces. Only a matched end-post + straight
  // pair tiles cleanly — verified via composed crop (post-beam-beam-post reads as one clean rail).
  fence: {
    h: 81, // straight horizontal beam, no post (c9,r6)
    postLeft: 80, // post w/ arm extending right — use as the LEFT end of a run (c8,r6)
    postRight: 82, // post w/ arm extending left — use as the RIGHT end of a run (c10,r6)
    // 57 (c9,r4) = decorative post topped with a small padlock/mailbox box — not a gate.
  },

  // Unidentified / low-confidence — flagged rather than guessed:
  // idx 92 (c8,r7): small brown triangular mound/roof-corner shape, cropped at tile edge — unclear what it depicts.
  // idx 125 (c5,r10): small brown-framed dark square (keyhole/lock icon?) — separate from the stoneArchGate next to it, unconfirmed use.
}
