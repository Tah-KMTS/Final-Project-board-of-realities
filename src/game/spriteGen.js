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
export const FRAME_W = GRID_W * UNIT
export const FRAME_H = GRID_H * UNIT
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
  const imageData = ctx.getImageData(ox, 0, FRAME_W, FRAME_H)
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

export function ensurePlayerTexture(scene, key, palette) {
  // Each key's palette is stable for the lifetime of the scene (same NPC id
  // or player always maps to the same colors), and zones get rebuilt often
  // (every building enter/exit respawns the same ambient/named NPCs with
  // the same keys). Re-generating and swapping the canvas under a key that
  // live sprites still reference crashes Phaser's WebGL renderer ("Cannot
  // read properties of null (reading 'resolution')"), so this is a true
  // ensure - skip regeneration if the texture already exists instead of
  // destroying and recreating it every time.
  if (scene.textures.exists(key)) return scene.textures.get(key)

  const canvas = document.createElement('canvas')
  canvas.width = FRAME_W * FRAME_ORDER.length
  canvas.height = FRAME_H
  const ctx = canvas.getContext('2d')
  ctx.imageSmoothingEnabled = false

  FRAME_ORDER.forEach((frameName, i) => {
    const [facing, step] = frameName.split('_')
    drawFrame(ctx, i * FRAME_W, facing, Number(step), palette)
    outlineFrame(ctx, i * FRAME_W)
  })

  const texture = scene.textures.addCanvas(key, canvas)
  FRAME_ORDER.forEach((frameName, i) => {
    texture.add(frameName, 0, i * FRAME_W, 0, FRAME_W, FRAME_H)
  })
  return texture
}
