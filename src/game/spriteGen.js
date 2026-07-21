// Procedural pixel-art humanoid sprite generator. Composites a 4-direction,
// 2-frame walk-cycle spritesheet onto a canvas texture from a color palette
// (skin/hair/outfit), so the in-game sprite matches character creation 1:1
// instead of using a flat colored rectangle. Proportions are chibi/SD style
// (oversized head, short body) to match the cute GBA-Pokemon overworld look.

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
    // back of head - hair covers almost the whole (now much bigger) head
    px(ctx, 2, 0, 8, 5, color, ox)
    px(ctx, 1, 4, 10, 2, dark, ox)
    if (style === 'Long') px(ctx, 2, 6, 8, 3, color, ox)
    if (style === 'Ponytail') px(ctx, 5, 6, 2, 4, color, ox)
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
      px(ctx, 1, 2, 2, 6, color, ox)
      px(ctx, 9, 2, 2, 6, color, ox)
      break
    case 'Buzzcut':
      px(ctx, 3, 0, 6, 1, dark, ox)
      break
    case 'Ponytail':
      px(ctx, 2, 0, 8, 2, color, ox)
      px(ctx, facing === 'left' ? 9 : 1, 2, 1, 5, color, ox)
      break
    case 'Short':
    default:
      px(ctx, 2, 0, 8, 2, color, ox)
      px(ctx, 1, 2, 1, 1, color, ox)
      px(ctx, 10, 2, 1, 1, color, ox)
      break
  }
}

function drawFrame(ctx, ox, facing, step, palette) {
  const { skin, hair, outfit, hairStyle } = palette
  const pantsColor = '#2b2b2b'
  const shoeColor = '#1a1a1a'
  const skinShadow = shade(skin, -20)
  const blush = 'rgba(255,140,140,0.55)'

  // --- Chibi proportions: big rounded head (rows 0-8), short torso
  // (rows 9-11), stubby legs (rows 12-15). ---

  // legs (walk cycle: alternate which leg is forward)
  const forwardOffset = step === 1 ? 1 : 0
  px(ctx, 4, 12 + forwardOffset, 2, 3 - forwardOffset, pantsColor, ox)
  px(ctx, 6, 12 + (1 - forwardOffset), 2, 3 - (1 - forwardOffset), pantsColor, ox)
  px(ctx, 4, 15, 2, 1, shoeColor, ox)
  px(ctx, 6, 15, 2, 1, shoeColor, ox)

  // torso - short and a little rounded at the shoulders
  px(ctx, 3, 10, 6, 2, outfit, ox)
  px(ctx, 2, 9, 8, 1, outfit, ox)
  // arms
  px(ctx, 2, 10, 1, 1, skin, ox)
  px(ctx, 9, 10, 1, 1, skin, ox)

  // head - big and round, dominates the sprite (chibi/SD look)
  px(ctx, 4, 0, 4, 1, skin, ox)
  px(ctx, 3, 1, 6, 1, skin, ox)
  px(ctx, 2, 2, 8, 5, skin, ox)
  px(ctx, 3, 7, 6, 1, skin, ox)
  px(ctx, 4, 8, 4, 1, skinShadow, ox)

  // face features
  if (facing === 'down') {
    // big round eyes with a white highlight dot, plus rosy cheeks
    px(ctx, 4, 4, 1, 2, '#1a1a1a', ox)
    px(ctx, 7, 4, 1, 2, '#1a1a1a', ox)
    px(ctx, 4, 4, 1, 1, '#ffffff', ox)
    px(ctx, 7, 4, 1, 1, '#ffffff', ox)
    px(ctx, 3, 6, 1, 1, blush, ox)
    px(ctx, 8, 6, 1, 1, blush, ox)
  } else if (facing === 'left') {
    px(ctx, 3, 4, 1, 2, '#1a1a1a', ox)
    px(ctx, 3, 4, 1, 1, '#ffffff', ox)
    px(ctx, 3, 6, 1, 1, blush, ox)
  } else if (facing === 'right') {
    px(ctx, 8, 4, 1, 2, '#1a1a1a', ox)
    px(ctx, 8, 4, 1, 1, '#ffffff', ox)
    px(ctx, 8, 6, 1, 1, blush, ox)
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
  if (scene.textures.exists(key)) scene.textures.remove(key)

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
