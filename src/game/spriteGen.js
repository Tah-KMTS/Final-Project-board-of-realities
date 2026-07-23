// Player/NPC sprite setup - loads the real "Cute Fantasy Free" character
// sheet (Player/Player.png, a clean 6-col x 10-row grid of 32x32 frames) as
// ONE shared spritesheet texture and exposes named frame regions for the
// walk cycle, instead of the old per-palette procedurally-drawn canvas
// sprite. This is a deliberate, user-confirmed exception to this project's
// usual "no external art assets" rule for sprites/tiles - see
// public/assets/cute_fantasy/Cute_Fantasy_Free/read_me.txt for the pack's
// license.
//
// The pack only ships one character design, so NPCs are differentiated the
// way the task calls for: characterPalettes.js's existing per-NPC
// skin/hair/outfit/hairStyle data is kept exactly as-is, but instead of
// driving a procedural redraw it's reduced to a single Phaser `.setTint()`
// color (see tintFromPalette) applied to the shared sprite.
//
// Row/col mapping below was determined by visually inspecting the sheet
// (not guessed): rows 0-2 are an idle bob (down/left/up), rows 3-5 are a
// 6-frame walk cycle (down/left/up), rows 6-8 are a dagger-swing attack,
// row 9 is a death/collapse. Only the walk rows are used here - columns 0
// and 3 are the two "opposite leg" contact poses, which makes a clean
// 2-frame walk cycle. Freezing on frame 0 while stationary intentionally
// matches how the old procedural spriteGen's 2-frame cycle worked too (it
// never had a separate neutral idle pose either). There is no right-facing
// row in the sheet - the "left" side-view row is reused mirrored
// (sprite.flipX) for right, handled in actor.js.

export const PLAYER_SHEET_KEY = 'cf_player_sheet'
export const PLAYER_SHEET_URL = '/assets/cute_fantasy/Cute_Fantasy_Free/Player/Player.png'

const FRAME_SIZE = 32
export const FRAME_W = FRAME_SIZE
export const FRAME_H = FRAME_SIZE

// Display scale applied to every player/NPC sprite so the 32x32 native
// frame reads at roughly the on-screen size the old chibi canvas sprite did
// (56x72 native, drawn unscaled) against this game's TILE_SIZE=40 grid.
export const PLAYER_DISPLAY_SCALE = 2

const WALK_ROWS = { down: 3, left: 4, up: 5 }
const STEP_COLS = [0, 3]

// Queues the sheet for loading - must be called from a scene's preload()
// so the image is guaranteed ready before create() runs (SpriteActor needs
// the texture to exist the instant it's constructed).
export function preloadPlayerSheet(scene) {
  if (!scene.textures.exists(PLAYER_SHEET_KEY)) {
    scene.load.image(PLAYER_SHEET_KEY, PLAYER_SHEET_URL)
  }
}

// Adds the named frame regions to the loaded sheet texture. Idempotent and
// cheap, so every SpriteActor just calls this itself rather than relying on
// some one-time scene setup step running first.
export function ensurePlayerFrames(scene) {
  const texture = scene.textures.get(PLAYER_SHEET_KEY)
  if (texture.has('down_0')) return texture
  for (const [dir, row] of Object.entries(WALK_ROWS)) {
    STEP_COLS.forEach((col, i) => {
      texture.add(`${dir}_${i}`, 0, col * FRAME_SIZE, row * FRAME_SIZE, FRAME_SIZE, FRAME_SIZE)
    })
  }
  return texture
}

function hexToInt(hex) {
  return parseInt(String(hex).replace('#', ''), 16)
}

// Derives a single tint color from a character palette. Outfit reads
// clearest since it's the largest solid-color area on the sprite (this also
// tints skin/hair since Phaser tint multiplies the whole texture - an
// accepted tradeoff of reusing one source character for every NPC).
export function tintFromPalette(palette) {
  return hexToInt(palette?.outfit ?? '#ffffff')
}
