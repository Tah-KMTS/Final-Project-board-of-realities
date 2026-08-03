// Salvaged NPC art. Source: public/assets/packs/npc/ (AI-generated reference
// sheets - see production/character-data-provenance.md's sibling discussion
// in chat for how these were made and why the raw sheets couldn't be used
// as-is: baked-in titles/grid-lines/labels and a solid white background).
//
// Two source formats have been salvaged so far, and they need different
// frame-lookup logic (see `format` on each SHEETS entry below):
//
// - 'directional' (princeThai, thaiWarrior, maleNpc, femaleNpc): an
//   RPG-Maker-style 7-section x 8-direction x [2,4,4,4,2,2,4]-frame grid with
//   real N/E/S/W rows, salvaged from header-bar/label pixel-scanning. Frame
//   index is row*colsPerRow + col, same as before.
// - 'flat' (graham, musk, jobs, ford, luciano): the "Benjamin Graham" style
//   sheet - all front-facing, no colored header bars at all. Salvaged by
//   connected-component blob detection instead (no clean gutters to scan for
//   in this format), grouped into rows by y-clustering and columns by x
//   order within each row. Row 0 is a front-facing idle pose; some sheets
//   (graham/musk/ford/luciano, not jobs - its row clustering came out
//   irregular and no row was confirmed as a clean side view) have a genuine
//   right-facing side/run pose further down (sideRow), used for left/right
//   movement with flipX for the mirrored direction. There is no back view in
//   this format, so 'up' reuses the same idle frame as 'down'.
//
// IMPORTANT - cell size is NOT the same across sheets, in either format. Each
// source image was independently generated and its geometry varies sheet to
// sheet (confirmed by direct measurement: prince_thai's grid is 75x101,
// thai_warrior's is 79x94) - reusing one sheet's measured coordinates for
// another produces a subtly wrong crop. Measure every new sheet on its own
// terms; don't assume the "same template" claim in a filename means
// identical pixel geometry.

// Row index per compass direction, for 'directional' sheets only (N, NE, E,
// SE, S, SW, W, NW, top to bottom) - consistent across those sheets.
const ROW = { up: 0, right: 2, down: 4, left: 6 }

// Column index per animation section for 'directional' sheets (matches every
// such sheet's own section headers/frame counts: IDLE 2, WALK 4, RUN 4,
// ATTACK 4, INTERACT 2, HURT 2, DEATH 4).
const COL = { idleA: 0, idleB: 1, walkA: 2, walkB: 4 }

const SHEETS = {
  princeThai: {
    format: 'directional',
    key: 'npcReal_princeThai',
    path: '/assets/packs/npc/processed/prince_thai.png',
    cellW: 75,
    cellH: 101,
    colsPerRow: 22,
    // 0.72 was an eyeballed first guess targeting the player's ~64px
    // displayed height; a real side-by-side screenshot showed it reading
    // noticeably SMALLER than the player, not comparable. Raised to 0.95
    // from that measurement.
    scale: 0.95,
  },
  thaiWarrior: {
    format: 'directional',
    key: 'npcReal_thaiWarrior',
    path: '/assets/packs/npc/processed/thai_warrior.png',
    cellW: 79,
    cellH: 94,
    colsPerRow: 22,
    scale: 1.0,
  },
  maleNpc: {
    format: 'directional',
    key: 'npcReal_maleNpc',
    path: '/assets/packs/npc/processed/male_npc.png',
    cellW: 100,
    cellH: 112,
    colsPerRow: 22,
    scale: 0.9,
  },
  femaleNpc: {
    format: 'directional',
    key: 'npcReal_femaleNpc',
    path: '/assets/packs/npc/processed/female_npc.png',
    cellW: 99,
    cellH: 112,
    colsPerRow: 21,
    scale: 0.9,
  },
  graham: {
    format: 'flat',
    key: 'npcReal_graham',
    path: '/assets/packs/npc/processed/graham.png',
    cellW: 111,
    cellH: 133,
    colsPerRow: 17,
    idleRow: 0,
    sideRow: 2,
    sideCols: [9, 11],
    scale: 0.75,
  },
  musk: {
    format: 'flat',
    key: 'npcReal_musk',
    path: '/assets/packs/npc/processed/musk.png',
    cellW: 112,
    cellH: 135,
    colsPerRow: 17,
    idleRow: 0,
    sideRow: 2,
    sideCols: [9, 11],
    scale: 0.74,
  },
  ford: {
    format: 'flat',
    key: 'npcReal_ford',
    path: '/assets/packs/npc/processed/ford.png',
    cellW: 174,
    cellH: 131,
    colsPerRow: 17,
    idleRow: 0,
    sideRow: 2,
    sideCols: [9, 11],
    scale: 0.76,
  },
  luciano: {
    format: 'flat',
    key: 'npcReal_luciano',
    path: '/assets/packs/npc/processed/luciano.png',
    cellW: 174,
    cellH: 131,
    colsPerRow: 17,
    idleRow: 0,
    sideRow: 2,
    sideCols: [9, 11],
    scale: 0.76,
  },
  jobs: {
    format: 'flat',
    key: 'npcReal_jobs',
    path: '/assets/packs/npc/processed/jobs.png',
    cellW: 157,
    cellH: 291,
    colsPerRow: 18,
    idleRow: 0,
    // No side/run row could be confirmed for this sheet - its row
    // clustering came out irregular (9/9/9/18/16/4/5/18 per row, vs the
    // clean 17x7 every other flat sheet produced), unlike graham/musk/ford/
    // luciano where row 2 is a clear right-facing run cycle. Left/right just
    // reuse the front idle pose here rather than risk a wrong side frame.
    sideRow: null,
    sideCols: [0, 1],
    scale: 0.34,
  },
}

// Which character id uses which sheet. Named ids are the real roster ids;
// fin_ambient_N ids are non-named ambient NPCs (npc_fin_ambient_${i} keys
// from OverworldScene.js's spawnFinanceAmbientNpcs - after getActorRenderInfo
// strips the npc_ prefix, that's what characterId is for them). There's no
// gender field on ambient NPCs (see npcGenerator.js - palette is seeded from
// the id, no gender attribute exists at all), so the male/female assignment
// below (0,1 -> male; 2,3 -> female) is an arbitrary but deterministic split
// across the 6 ambient slots, not derived from any in-game gender data.
const REAL_SPRITE_NPCS = {
  washington: 'princeThai',
  jefferson: 'thaiWarrior',
  graham: 'graham',
  musk: 'musk',
  jobs: 'jobs',
  ford: 'ford',
  luciano: 'luciano',
  fin_ambient_0: 'maleNpc',
  fin_ambient_1: 'maleNpc',
  fin_ambient_2: 'femaleNpc',
  fin_ambient_3: 'femaleNpc',
}

export function hasRealSprite(characterId) {
  return characterId in REAL_SPRITE_NPCS
}

// The texture key a character's sheet will load under, so callers can check
// scene.textures.exists(...) without needing to know the sheet-selection
// logic themselves (there are now multiple sheets, not one).
export function realSpriteTextureKey(characterId) {
  const sheet = SHEETS[REAL_SPRITE_NPCS[characterId]]
  return sheet ? sheet.key : null
}

export function preloadNpcRealSprites(scene) {
  for (const sheet of Object.values(SHEETS)) {
    if (scene.textures.exists(sheet.key)) continue
    scene.load.spritesheet(sheet.key, sheet.path, { frameWidth: sheet.cellW, frameHeight: sheet.cellH })
  }
}

// Same shape spriteGen.js's getActorRenderInfo returns for every other mode,
// so actor.js's SpriteActor needs no changes at all - see that file's single
// dispatch point.
export function realSpriteRenderInfo(characterId) {
  const sheet = SHEETS[REAL_SPRITE_NPCS[characterId]]
  const isFlat = sheet.format === 'flat'

  return {
    textureKey: sheet.key,
    // Only 2 step values ever reach this (see actor.js: stepFrame stays 0
    // while idle, alternates 0/1 while moving), so map them to two DIFFERENT
    // walk-cycle columns rather than idle vs walk - that reads as a clearer
    // step-to-step toggle than idle-frame-0 vs walk-frame-0 would.
    frameName: (facing, step) => {
      if (!isFlat) {
        const row = ROW[facing] ?? ROW.down
        const col = step === 0 ? COL.walkA : COL.walkB
        return row * sheet.colsPerRow + col
      }
      // Flat format: no up/down distinction (no back view authored) and no
      // side row on every sheet (see jobs above) - fall back to the front
      // idle row whenever a side row isn't available for this facing.
      const useSide = (facing === 'left' || facing === 'right') && sheet.sideRow !== null
      const row = useSide ? sheet.sideRow : sheet.idleRow
      const col = useSide ? sheet.sideCols[step] : step
      return row * sheet.colsPerRow + col
    },
    // Flat-format side row is authored facing right; mirror it for left.
    // Directional sheets are fully authored both ways already, same as the
    // existing procedural NPC frames - see spriteGen.js's comment on why
    // flipX is false there.
    flipX: isFlat
      ? (facing) => facing === 'left' && sheet.sideRow !== null
      : () => false,
    tint: null,
    scale: sheet.scale,
    frameW: sheet.cellW,
    frameH: sheet.cellH,
  }
}
