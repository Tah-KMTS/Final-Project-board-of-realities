// Salvaged NPC art. Source: public/assets/packs/npc/ (AI-generated reference
// sheets - see production/character-data-provenance.md's sibling discussion
// in chat for how these were made and why the raw sheets couldn't be used
// as-is: baked-in titles/grid-lines/labels and a solid white background).
//
// Every sheet under processed/ is SALVAGED, not raw: measured (real
// pixel-color scanning of its header bars, not guessed coordinates - see the
// crop script these were built with), cropped into its authored 7-section x
// 8-direction x [2,4,4,4,2,2,4]-frame grid, white-keyed to real alpha with a
// soft falloff at the threshold, trimmed to content, and reassembled
// bottom-aligned into a uniform grid so Phaser can slice each as a plain
// spritesheet (frame = row*22 + col).
//
// IMPORTANT - cell size is NOT the same across sheets. Each source image was
// independently generated and its section widths/row heights vary by a few
// percent sheet to sheet (confirmed by direct measurement: prince_thai's
// grid is 75x101, thai_warrior's is 79x94) - reusing one sheet's measured
// coordinates for another produces a subtly wrong crop. Measure every new
// sheet on its own terms; don't assume the "same template" claim in a
// filename means identical pixel geometry.
//
// This is a TRIAL wiring - only a few characters are opted in below,
// specifically so the human can see it running in the actual game before any
// decision to roll it out further.

// Row index per compass direction, as authored in every sheet so far
// (N, NE, E, SE, S, SW, W, NW, top to bottom) - this part IS consistent
// across sheets, unlike cell size.
const ROW = { up: 0, right: 2, down: 4, left: 6 }

// Column index per animation section (matches every sheet's own section
// headers and frame counts: IDLE 2, WALK 4, RUN 4, ATTACK 4, INTERACT 2,
// HURT 2, DEATH 4).
const COL = { idleA: 0, idleB: 1, walkA: 2, walkB: 4 }
const COLS_PER_ROW = 22

const SHEETS = {
  princeThai: {
    key: 'npcReal_princeThai',
    path: '/assets/packs/npc/processed/prince_thai.png',
    cellW: 75,
    cellH: 101,
    // 0.72 was an eyeballed first guess targeting the player's ~64px
    // displayed height; a real side-by-side screenshot showed it reading
    // noticeably SMALLER than the player, not comparable. Raised to 0.95
    // from that measurement.
    scale: 0.95,
  },
  thaiWarrior: {
    key: 'npcReal_thaiWarrior',
    path: '/assets/packs/npc/processed/thai_warrior.png',
    cellW: 79,
    cellH: 94,
    // Same target height as princeThai (comparable to the player's ~64px),
    // scaled from this sheet's own (smaller) native cell height rather than
    // reusing princeThai's scale factor - a shared scale across sheets with
    // different native cell sizes would make characters inconsistent sizes
    // next to each other. Not yet confirmed in a side-by-side screenshot
    // the way princeThai was - check before trusting this number further.
    scale: 1.0,
  },
}

// Which character id uses which sheet. Trial scope only - see file header.
const REAL_SPRITE_NPCS = {
  washington: 'princeThai',
  jefferson: 'thaiWarrior',
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
  return {
    textureKey: sheet.key,
    // Only 2 step values ever reach this (see actor.js: stepFrame stays 0
    // while idle, alternates 0/1 while moving), so map them to two DIFFERENT
    // walk-cycle columns rather than idle vs walk - that reads as a clearer
    // step-to-step toggle than idle-frame-0 vs walk-frame-0 would.
    frameName: (facing, step) => {
      const row = ROW[facing] ?? ROW.down
      const col = step === 0 ? COL.walkA : COL.walkB
      return row * COLS_PER_ROW + col
    },
    // Both left and right are real authored art (not mirrored), same as the
    // existing procedural NPC frames - see spriteGen.js's comment on why
    // flipX is false there.
    flipX: () => false,
    tint: null,
    scale: sheet.scale,
    frameW: sheet.cellW,
    frameH: sheet.cellH,
  }
}
