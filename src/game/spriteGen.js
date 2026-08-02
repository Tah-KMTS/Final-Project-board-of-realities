import { PLAYER_ART_FRAME_W, PLAYER_ART_FRAME_H, PLAYER_ART_SCALE, drawPlayerArtFrame } from './playerSpriteArt'
import { hasRealSprite, realSpriteRenderInfo } from './packs/npcRealSprites'

const USE_PROCEDURAL_GRAPHICS = true;
// Every texture key the player actually uses across scenes (each scene
// keeps its own key even though the art is identical — see createPlayer()
// in BaseTownScene/OverworldScene/DominoWorldScene). NPCs keep the generic
// palette-driven humanoid from drawFrame(); the player always renders the
// hand-authored turnaround from playerSpriteArt.js instead.
const PLAYER_TEXTURE_KEYS = new Set(['player_texture', 'player_texture_overworld', 'player_texture_domino'])
﻿// Player/NPC sprite setup - loads the real "Cute Fantasy Free" character
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
  if (USE_PROCEDURAL_GRAPHICS) return // Procedural mode: sprites drawn on canvas, no external sheet
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
// --- PROCEDURAL FUNCTIONS --- 
// Procedural pixel-art humanoid sprite generator. Composites a 4-direction,
// 2-frame walk-cycle spritesheet onto a canvas texture from a color palette
// (skin/hair/outfit), so the in-game sprite matches character creation 1:1
// instead of using a flat colored rectangle or an external art asset.
// Proportions read as a stylized JRPG overworld sprite (think
// Eastward/Octopath) rather than baby-chibi - a single upper-left light
// source drives two-tone shading on every part instead of flat color fills,
// and there's no "cute" iconography (blush, sparkle-highlight eyes) since
// the game's tone (permadeath, crime, corp warfare) doesn't match a kids'
// -app look. 100% Phaser Canvas/Graphics drawing - no external image files.
const UNIT = 4 // size of one "pixel" in real canvas pixels (chunky GBA look)
const GRID_W = 12
const GRID_H = 16
export const PROCEDURAL_FRAME_W = GRID_W * UNIT
export const PROCEDURAL_FRAME_H = GRID_H * UNIT
export const FRAME_ORDER = ['down_0', 'down_1', 'left_0', 'left_1', 'right_0', 'right_1', 'up_0', 'up_1']
function shade(hex, amount) {
  const n = parseInt(hex.replace('#', ''), 16)
  let r = (n >> 16) & 0xff
  let g = (n >> 8) & 0xff
  let b = n & 0xff
  r = Math.max(0, Math.min(255, r + amount))
  g = Math.max(0, Math.min(255, g + amount))
  b = Math.max(0, Math.min(255, b + amount))
  return `rgb(${r},${g},${b})`
}
function px(ctx, gx, gy, gw, gh, color, ox = 0) {
  ctx.fillStyle = color
  ctx.fillRect(ox + gx * UNIT, gy * UNIT, gw * UNIT, gh * UNIT)
}
// Draws a rect in the lit base tone, then re-paints its right-hand slice in
// a darker shadow tone - a single consistent upper-left light source across
// the whole sprite instead of flat single-color blocks.
function pxShaded(ctx, gx, gy, gw, gh, color, ox = 0, shadowFraction = 0.4) {
  px(ctx, gx, gy, gw, gh, color, ox)
  const shadowW = Math.max(1, Math.round(gw * shadowFraction))
  px(ctx, gx + gw - shadowW, gy, shadowW, gh, shade(color, -35), ox)
}
function drawHair(ctx, style, color, facing, ox) {
  const dark = shade(color, -35)
  if (facing === 'up') {
    px(ctx, 2, 0, 8, 4, color, ox)
    px(ctx, 6, 0, 4, 4, dark, ox)
    px(ctx, 1, 3, 10, 2, dark, ox)
    if (style === 'Long') px(ctx, 2, 5, 8, 3, color, ox)
    if (style === 'Ponytail') px(ctx, 5, 5, 2, 4, color, ox)
    return
  }
  switch (style) {
    case 'Spiky':
      px(ctx, 3, 0, 1, 1, color, ox)
      px(ctx, 5, 0, 1, 1, color, ox)
      px(ctx, 7, 0, 1, 1, dark, ox)
      px(ctx, 2, 1, 8, 2, color, ox)
      px(ctx, 7, 1, 3, 2, dark, ox)
      break
    case 'Long':
      px(ctx, 2, 0, 8, 2, color, ox)
      px(ctx, 7, 0, 3, 2, dark, ox)
      px(ctx, 1, 2, 2, 5, color, ox)
      px(ctx, 9, 2, 2, 5, dark, ox)
      break
    case 'Buzzcut':
      px(ctx, 3, 0, 6, 1, dark, ox)
      break
    case 'Ponytail':
      px(ctx, 2, 0, 8, 2, color, ox)
      px(ctx, 7, 0, 3, 2, dark, ox)
      px(ctx, facing === 'left' ? 9 : 1, 2, 1, 4, color, ox)
      break
    case 'Short':
    default:
      px(ctx, 2, 0, 8, 2, color, ox)
      px(ctx, 7, 0, 3, 2, dark, ox)
      px(ctx, 1, 2, 1, 1, color, ox)
      px(ctx, 10, 2, 1, 1, dark, ox)
      break
  }
}
function drawFrame(ctx, ox, facing, step, palette) {
  const { skin, hair, outfit, hairStyle } = palette
  const pantsColor = '#2b2b2b'
  const pantsShadow = shade(pantsColor, -25)
  const shoeColor = '#141414'
  const skinShadow = shade(skin, -30)
  const sleeveShadow = shade(outfit, -35)
  // --- Proportions: head rows 0-5, neck row 6, torso rows 7-11, legs
  // rows 12-15. Less extreme than a baby-chibi ratio, still stylized.
  // Shoulders/arms/legs flare out to the full 10-wide silhouette instead
  // of thin 1-unit slivers - a solid clothed body instead of a stick
  // figure with a torso glued on. ---
  // legs (walk cycle: alternate which leg is forward) - 3-wide each so
  // the pant block reads as a limb, matching the torso's width directly
  const forwardOffset = step === 1 ? 1 : 0
  px(ctx, 3, 12 + forwardOffset, 3, 3 - forwardOffset, pantsColor, ox)
  px(ctx, 6, 12 + (1 - forwardOffset), 3, 3 - (1 - forwardOffset), pantsShadow, ox)
  px(ctx, 3, 15, 3, 1, shoeColor, ox)
  px(ctx, 6, 15, 3, 1, shade(shoeColor, -10), ox)
  // torso - two-tone shaded, with a collar seam so it reads as clothing
  pxShaded(ctx, 3, 8, 6, 4, outfit, ox, 0.4)
  pxShaded(ctx, 1, 7, 10, 1, outfit, ox, 0.4)
  px(ctx, 5, 7, 2, 1, shade(outfit, -45), ox) // collar notch
  // arms - sleeve (upper) + hand (lower), running the full torso height
  // so they read as limbs, not thin slivers; the same lit/shadow split
  // used everywhere else on the body continues down each arm
  px(ctx, 1, 8, 2, 2, outfit, ox) // left sleeve (lit side)
  px(ctx, 1, 10, 2, 2, skin, ox) // left hand
  px(ctx, 9, 8, 2, 2, sleeveShadow, ox) // right sleeve (shadow side)
  px(ctx, 9, 10, 2, 2, skinShadow, ox) // right hand
  // neck
  px(ctx, 5, 6, 2, 1, skinShadow, ox)
  // head - smaller/less baby-round than a full chibi head, two-tone shaded
  px(ctx, 4, 0, 4, 1, skin, ox)
  px(ctx, 3, 1, 6, 1, skin, ox)
  pxShaded(ctx, 2, 2, 8, 3, skin, ox, 0.35)
  px(ctx, 3, 5, 6, 1, skinShadow, ox)
  // face features - sharper/neutral rather than round "cute" dot-eyes
  if (facing === 'down') {
    px(ctx, 4, 3, 1, 1, '#2a2a2a', ox)
    px(ctx, 7, 3, 1, 1, '#2a2a2a', ox)
    px(ctx, 4, 2, 1, 1, shade(hair, -10), ox) // brow hint
    px(ctx, 7, 2, 1, 1, shade(hair, -10), ox)
  } else if (facing === 'left') {
    px(ctx, 3, 3, 1, 1, '#2a2a2a', ox)
    px(ctx, 3, 2, 1, 1, shade(hair, -10), ox)
  } else if (facing === 'right') {
    px(ctx, 8, 3, 1, 1, '#2a2a2a', ox)
    px(ctx, 8, 2, 1, 1, shade(hair, -10), ox)
  }
  drawHair(ctx, hairStyle, hair, facing, ox)
}
// Retro sprites read as "sprites" instead of "colored blobs" mainly because
// of the 1px dark silhouette outline - adds it as a post-process pass
// (transparent pixels touching an opaque one get painted outline color)
// rather than outlining each body-part rect individually, which would leave
// visible seams between adjoining parts of the same color.
function outlineFrame(ctx, ox) {
  const imageData = ctx.getImageData(ox, 0, PROCEDURAL_FRAME_W, PROCEDURAL_FRAME_H)
  const { data, width, height } = imageData
  const source = new Uint8ClampedArray(data)
  const idx = (x, y) => (y * width + x) * 4
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = idx(x, y)
      if (source[i + 3] !== 0) continue
      const neighbors = [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]]
      const touchesOpaque = neighbors.some(([nx, ny]) => {
        if (nx < 0 || nx >= width || ny < 0 || ny >= height) return false
        return source[idx(nx, ny) + 3] !== 0
      })
      if (touchesOpaque) {
        data[i] = 12
        data[i + 1] = 12
        data[i + 2] = 18
        data[i + 3] = 255
      }
    }
  }
  ctx.putImageData(imageData, ox, 0)
}
export function procedural_ensurePlayerTexture(scene, key, palette) {
  // Each key's palette is stable for the lifetime of the scene (same NPC id
  // or player always maps to the same colors), and zones get rebuilt often
  // (every building enter/exit respawns the same ambient/named NPCs with
  // the same keys). Re-generating and swapping the canvas under a key that
  // live sprites still reference crashes Phaser's WebGL renderer ("Cannot
  // read properties of null (reading 'resolution')"), so this is a true
  // ensure - skip regeneration if the texture already exists instead of
  // destroying and recreating it every time.
  if (scene.textures.exists(key)) return scene.textures.get(key)
  const isPlayerArt = PLAYER_TEXTURE_KEYS.has(key)
  const frameW = isPlayerArt ? PLAYER_ART_FRAME_W : PROCEDURAL_FRAME_W
  const frameH = isPlayerArt ? PLAYER_ART_FRAME_H : PROCEDURAL_FRAME_H
  const canvas = document.createElement('canvas')
  canvas.width = frameW * FRAME_ORDER.length
  canvas.height = frameH
  const ctx = canvas.getContext('2d')
  ctx.imageSmoothingEnabled = false
  FRAME_ORDER.forEach((frameName, i) => {
    const [facing, step] = frameName.split('_')
    if (isPlayerArt) {
      drawPlayerArtFrame(ctx, i * frameW, facing, Number(step))
    } else {
      drawFrame(ctx, i * frameW, facing, Number(step), palette)
      outlineFrame(ctx, i * frameW)
    }
  })
  const texture = scene.textures.addCanvas(key, canvas)
  FRAME_ORDER.forEach((frameName, i) => {
    texture.add(frameName, 0, i * frameW, 0, frameW, frameH)
  })
  return texture
}

// --- UNIFIED ACTOR ENTRY POINT ---
// Single seam SpriteActor (actor.js) calls through, so it never needs to
// know which rendering mode is active - mirrors the pattern tileGen.js
// uses for buildTerrainLayer/placeTree/etc. Procedural mode generates one
// texture per actor (keyed by `key`, real facing rows including "right" -
// no mirroring, no tint since color is baked into the canvas). Sheet mode
// shares one texture for every actor and differentiates via tint + the
// left-mirrored-to-right trick (see the file header comment).
export function getActorRenderInfo(scene, key, palette) {
  // Trial real-art override, checked before either rendering mode. `key` for
  // named roamers is "npc_<characterId>" (see OverworldScene.js's
  // `new SpriteActor(this, x, y, 'npc_' + character.id, ...)` call site) -
  // strip the prefix and check the opt-in list in npcRealSprites.js.
  const characterId = key.startsWith('npc_') ? key.slice(4) : null
  if (characterId && hasRealSprite(characterId) && scene.textures.exists('npcReal_princeThai')) {
    return realSpriteRenderInfo()
  }
  if (USE_PROCEDURAL_GRAPHICS) {
    procedural_ensurePlayerTexture(scene, key, palette)
    const isPlayerArt = PLAYER_TEXTURE_KEYS.has(key)
    return {
      textureKey: key,
      frameName: (facing, step) => `${facing}_${step}`,
      // Player art only authors a 'right' profile (playerSpriteArt.js draws
      // it into the 'left_*' frames unmirrored too); flip it here instead.
      // Generic NPC frames already have real art for both sides, so they
      // never flip.
      flipX: (facing) => isPlayerArt && facing === 'left',
      tint: null,
      scale: isPlayerArt ? PLAYER_ART_SCALE : 1,
      frameW: isPlayerArt ? PLAYER_ART_FRAME_W : PROCEDURAL_FRAME_W,
      frameH: isPlayerArt ? PLAYER_ART_FRAME_H : PROCEDURAL_FRAME_H,
    }
  }
  ensurePlayerFrames(scene)
  return {
    textureKey: PLAYER_SHEET_KEY,
    frameName: (facing, step) => `${facing === 'right' ? 'left' : facing}_${step}`,
    flipX: (facing) => facing === 'right',
    tint: tintFromPalette(palette),
    scale: PLAYER_DISPLAY_SCALE,
    frameW: FRAME_W,
    frameH: FRAME_H,
  }
}
