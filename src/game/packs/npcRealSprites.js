// Salvaged NPC art. Source: public/assets/packs/npc/ (AI-generated reference
// sheets - see production/character-data-provenance.md's sibling discussion
// in chat for how these were made and why the raw sheets couldn't be used
// as-is: baked-in titles/grid-lines/labels and a solid white background).
//
// prince_thai.png is a SALVAGED, not raw, sheet: the raw "001 PRINCE (THAI)"
// sheet was measured (real pixel-color scanning of its header bars, not
// guessed coordinates - see the crop script this was built with), cropped
// into its authored 7-section x 8-direction x [2,4,4,4,2,2,4]-frame grid,
// white-keyed to real alpha with a soft falloff at the threshold, trimmed to
// content, and reassembled bottom-aligned into a uniform 75x101 grid so
// Phaser can slice it as a plain spritesheet (frame = row*22 + col).
//
// This is a TRIAL wiring - only a couple of characters are opted in below,
// specifically so the human can see it running in the actual game before any
// decision to roll it out further.
const SHEET_KEY = 'npcReal_princeThai'
const SHEET_PATH = '/assets/packs/npc/processed/prince_thai.png'
const CELL_W = 75
const CELL_H = 101
const COLS_PER_ROW = 22

// Row index per compass direction, as authored in the source sheet
// (N, NE, E, SE, S, SW, W, NW, top to bottom).
const ROW = { up: 0, right: 2, down: 4, left: 6 }

// Column index per animation section (matches the sheet's own section
// headers and frame counts: IDLE 2, WALK 4, RUN 4, ATTACK 4, INTERACT 2,
// HURT 2, DEATH 4 - see the crop script's COLS table for the source of
// these offsets).
const COL = { idleA: 0, idleB: 1, walkA: 2, walkB: 4 }

// Which character ids use this sheet. Trial scope only - see file header.
const REAL_SPRITE_NPCS = new Set(['washington', 'jefferson'])

export function hasRealSprite(characterId) {
  return REAL_SPRITE_NPCS.has(characterId)
}

export function preloadNpcRealSprites(scene) {
  if (scene.textures.exists(SHEET_KEY)) return
  scene.load.spritesheet(SHEET_KEY, SHEET_PATH, { frameWidth: CELL_W, frameHeight: CELL_H })
}

// Same shape spriteGen.js's getActorRenderInfo returns for every other mode,
// so actor.js's SpriteActor needs no changes at all - see that file's single
// dispatch point.
export function realSpriteRenderInfo() {
  return {
    textureKey: SHEET_KEY,
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
    // Cell is 75x101 native, padded ~4-8px around trimmed content. 0.72 was
    // an eyeballed first guess targeting the player's ~64px displayed
    // height; a real side-by-side screenshot showed it reading noticeably
    // SMALLER than the player, not comparable. Raised to 0.95 from that
    // measurement, not re-derived from scratch - re-check against a fresh
    // screenshot if more characters are added to REAL_SPRITE_NPCS.
    scale: 0.95,
    frameW: CELL_W,
    frameH: CELL_H,
  }
}
