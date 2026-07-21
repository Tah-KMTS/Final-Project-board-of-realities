// Procedural pixel-art humanoid sprite generator. Composites a 4-direction,
// 2-frame walk-cycle spritesheet onto a canvas texture from a color palette
// (skin/hair/outfit), so the in-game sprite matches character creation 1:1
// instead of using a flat colored rectangle.

const UNIT = 3 // size of one "pixel" in real canvas pixels (chunky GBA look)
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

function drawHair(ctx, style, color, facing, ox) {
  const dark = shade(color, -30)
  if (facing === 'up') {
    // back of head - hair covers almost the whole head/shoulders
    px(ctx, 2, 0, 8, 4, color, ox)
    px(ctx, 1, 3, 10, 2, dark, ox)
    if (style === 'Long') px(ctx, 3, 5, 6, 4, color, ox)
    if (style === 'Ponytail') px(ctx, 5, 5, 2, 5, color, ox)
    return
  }

  switch (style) {
    case 'Spiky':
      px(ctx, 3, 0, 1, 1, color, ox)
      px(ctx, 5, 0, 1, 1, color, ox)
      px(ctx, 7, 0, 1, 1, color, ox)
      px(ctx, 2, 1, 8, 2, color, ox)
      break
    case 'Long':
      px(ctx, 2, 0, 8, 2, color, ox)
      px(ctx, 2, 2, 2, 6, color, ox)
      px(ctx, 8, 2, 2, 6, color, ox)
      break
    case 'Buzzcut':
      px(ctx, 3, 0, 6, 1, dark, ox)
      break
    case 'Ponytail':
      px(ctx, 2, 0, 8, 2, color, ox)
      px(ctx, facing === 'left' ? 9 : 2, 2, 1, 4, color, ox)
      break
    case 'Short':
    default:
      px(ctx, 2, 0, 8, 2, color, ox)
      px(ctx, 2, 2, 1, 1, color, ox)
      px(ctx, 9, 2, 1, 1, color, ox)
      break
  }
}

function drawFrame(ctx, ox, facing, step, palette) {
  const { skin, hair, outfit, hairStyle } = palette
  const pantsColor = '#2b2b2b'
  const shoeColor = '#1a1a1a'
  const skinShadow = shade(skin, -25)

  // legs (walk cycle: alternate which leg is forward)
  const forwardOffset = step === 1 ? 1 : 0
  px(ctx, 4, 12 + forwardOffset, 2, 3 - forwardOffset, pantsColor, ox)
  px(ctx, 6, 12 + (1 - forwardOffset), 2, 3 - (1 - forwardOffset), pantsColor, ox)
  px(ctx, 4, 15, 2, 1, shoeColor, ox)
  px(ctx, 6, 15, 2, 1, shoeColor, ox)

  // torso
  px(ctx, 3, 7, 6, 5, outfit, ox)
  px(ctx, 2, 7, 1, 4, outfit, ox)
  px(ctx, 9, 7, 1, 4, outfit, ox)
  // hands
  px(ctx, 2, 10, 1, 1, skin, ox)
  px(ctx, 9, 10, 1, 1, skin, ox)

  // head
  px(ctx, 4, 1, 4, 1, skin, ox)
  px(ctx, 3, 2, 6, 4, skin, ox)
  px(ctx, 4, 6, 4, 1, skinShadow, ox)

  // face features
  if (facing === 'down') {
    px(ctx, 4, 3, 1, 1, '#1a1a1a', ox)
    px(ctx, 7, 3, 1, 1, '#1a1a1a', ox)
  } else if (facing === 'left') {
    px(ctx, 3, 3, 1, 1, '#1a1a1a', ox)
  } else if (facing === 'right') {
    px(ctx, 8, 3, 1, 1, '#1a1a1a', ox)
  }

  drawHair(ctx, hairStyle, hair, facing, ox)
}

export function ensurePlayerTexture(scene, key, palette) {
  if (scene.textures.exists(key)) scene.textures.remove(key)

  const canvas = document.createElement('canvas')
  canvas.width = FRAME_W * FRAME_ORDER.length
  canvas.height = FRAME_H
  const ctx = canvas.getContext('2d')
  ctx.imageSmoothingEnabled = false

  FRAME_ORDER.forEach((frameName, i) => {
    const [facing, step] = frameName.split('_')
    drawFrame(ctx, i * FRAME_W, facing, Number(step), palette)
  })

  const texture = scene.textures.addCanvas(key, canvas)
  FRAME_ORDER.forEach((frameName, i) => {
    texture.add(frameName, 0, i * FRAME_W, 0, FRAME_W, FRAME_H)
  })
  return texture
}
