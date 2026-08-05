// The player's real-art walk sheet. Source: public/assets/packs/player/raw/
// (four hand-supplied direction stills - gitignored, see .gitignore); the
// committed sheet under processed/ is built from them by
// production/salvagePlayerSprite.mjs, which documents every transform it
// applies and why.
//
// Layout is identical to npcRealSprites.js's - a 2-column x 4-row grid,
// columns being the two walk steps and rows being down / up / left / right,
// so frame index is row*2 + step. Deliberately the same contract rather than
// a second one: actor.js and spriteGen.js's getActorRenderInfo already speak
// it, so wiring the player in needs no new plumbing.
//
// Two ways this differs from the NPC sheets:
//
// - It has REAL left and right art (the source authored both profiles), so
//   flipX is never needed. The hand-authored art this replaces
//   (playerSpriteArt.js) only drew a right profile and mirrored it at
//   runtime.
// - Both step columns are the same pose, offset 1px vertically - a walk bob.
//   The source is one still per direction with no second walk pose anywhere
//   in it, and inventing limb movement is the exact mistake npcRealSprites.js
//   warns about for the police sheet. See note 5 in the salvage script.
//
// playerSpriteArt.js is intentionally still wired up as the fallback: if this
// sheet fails to load, getActorRenderInfo falls back to it rather than
// leaving the player invisible.

const FACING_ROW = { down: 0, up: 1, left: 2, right: 3 }
const STEPS_PER_ROW = 2

// Cell size is whatever the salvage script measured - it prints these two
// numbers on every run. The art is normalised to a 64px standing pose (what
// every other actor in this game is), so scale stays 1.0 and nothing is
// resampled at runtime.
export const PLAYER_REAL_SPRITE = {
  key: 'playerReal',
  path: '/assets/packs/player/processed/player.png',
  cellW: 29,
  cellH: 65,
}

export function preloadPlayerRealSprite(scene) {
  if (scene.textures.exists(PLAYER_REAL_SPRITE.key)) return
  scene.load.spritesheet(PLAYER_REAL_SPRITE.key, PLAYER_REAL_SPRITE.path, {
    frameWidth: PLAYER_REAL_SPRITE.cellW,
    frameHeight: PLAYER_REAL_SPRITE.cellH,
  })
}

// Same shape getActorRenderInfo returns for every other mode, so actor.js
// needs no changes - see spriteGen.js's single dispatch point.
export function playerRealSpriteRenderInfo() {
  return {
    textureKey: PLAYER_REAL_SPRITE.key,
    // Only 2 step values ever reach this - see actor.js: stepFrame stays 0
    // while idle and alternates 0/1 while moving.
    frameName: (facing, step) => {
      const row = FACING_ROW[facing] ?? FACING_ROW.down
      return row * STEPS_PER_ROW + (step === 1 ? 1 : 0)
    },
    // Real art for both profiles - never mirrored.
    flipX: () => false,
    tint: null,
    scale: 1,
    frameW: PLAYER_REAL_SPRITE.cellW,
    frameH: PLAYER_REAL_SPRITE.cellH,
  }
}
