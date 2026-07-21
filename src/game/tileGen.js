// Shared drawing helpers so every world's tilemap reads as a textured,
// populated place (grass with blades, roads with lane lines, water with
// waves, buildings with windows/doors/roofs) instead of flat color squares.
// Shading follows the same upper-left light source used for character
// sprites (spriteGen.js), so the whole game reads as one consistently-lit
// scene instead of flat, toy-like color fills.

function seededRand(seedX, seedY, salt = 0) {
  const s = Math.sin(seedX * 127.1 + seedY * 311.7 + salt * 74.3) * 43758.5453
  return s - Math.floor(s)
}

export function drawGrassTile(graphics, x, y, size) {
  graphics.fillStyle(0x35722f, 1)
  graphics.fillRect(x, y, size, size)
  // subtle AO band along the bottom/right edge (upper-left light source)
  graphics.fillStyle(0x2c5f27, 0.5)
  graphics.fillRect(x, y + size - 5, size, 5)
  graphics.fillRect(x + size - 5, y, 5, size)
  graphics.fillStyle(0x274f22, 1)
  for (let i = 0; i < 3; i++) {
    const bx = x + seededRand(x, y, i) * (size - 4)
    const by = y + seededRand(x, y, i + 10) * (size - 4)
    graphics.fillRect(bx, by, 2, 4)
  }
  // occasional lighter blade catching the light
  if (seededRand(x, y, 99) > 0.6) {
    graphics.fillStyle(0x4a8f42, 1)
    graphics.fillRect(x + seededRand(x, y, 5) * (size - 3), y + seededRand(x, y, 6) * (size - 3), 2, 3)
  }
}

export function drawRoadTile(graphics, x, y, size, horizontal, dashPhaseIndex) {
  graphics.fillStyle(0x3d3d3d, 1)
  graphics.fillRect(x, y, size, size)
  // asphalt speckle for texture instead of a flat fill
  graphics.fillStyle(0x333333, 1)
  for (let i = 0; i < 4; i++) {
    const sx = x + seededRand(x, y, i + 60) * (size - 2)
    const sy = y + seededRand(x, y, i + 70) * (size - 2)
    graphics.fillRect(sx, sy, 2, 2)
  }
  graphics.fillStyle(0x505050, 1)
  for (let i = 0; i < 3; i++) {
    const sx = x + seededRand(x, y, i + 80) * (size - 2)
    const sy = y + seededRand(x, y, i + 90) * (size - 2)
    graphics.fillRect(sx, sy, 2, 2)
  }
  graphics.fillStyle(0x5a5a5a, 1)
  if (horizontal) {
    graphics.fillRect(x, y + size / 2 - 1, size, 2)
    if (dashPhaseIndex % 2 === 0) {
      graphics.fillStyle(0xd4b83f, 1)
      graphics.fillRect(x + size / 2 - 4, y + size / 2 - 1, 8, 2)
    }
  } else {
    graphics.fillRect(x + size / 2 - 1, y, 2, size)
    if (dashPhaseIndex % 2 === 0) {
      graphics.fillStyle(0xd4b83f, 1)
      graphics.fillRect(x + size / 2 - 1, y + size / 2 - 4, 2, 8)
    }
  }
}

export function drawWaterTile(graphics, x, y, size, phase) {
  graphics.fillStyle(0x27587f, 1)
  graphics.fillRect(x, y, size, size)
  graphics.fillStyle(0x35729e, 1)
  const waveY = y + size / 2 + Math.sin(phase + x * 0.05) * 3
  graphics.fillRect(x, waveY, size, 2)
  graphics.fillStyle(0x4a8bc2, 0.6)
  graphics.fillRect(x, waveY - 6, size, 1)
}

export function drawSandTile(graphics, x, y, size) {
  graphics.fillStyle(0xb08f4f, 1)
  graphics.fillRect(x, y, size, size)
  graphics.fillStyle(0x9c7c40, 1)
  for (let i = 0; i < 2; i++) {
    const bx = x + seededRand(x, y, i + 20) * (size - 2)
    const by = y + seededRand(x, y, i + 30) * (size - 2)
    graphics.fillRect(bx, by, 2, 2)
  }
}

// A screen-space radial vignette (dark, transparent-centered canvas texture
// pinned to the camera) - a cheap, standard trick that makes flat 2D scenes
// read as lit/cinematic instead of a uniformly-bright "toy" look.
export function addScreenVignette(scene, width = 640, height = 480) {
  const key = 'screen_vignette'
  if (!scene.textures.exists(key)) {
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    const cx = width / 2
    const cy = height / 2
    const radius = Math.hypot(cx, cy)
    const gradient = ctx.createRadialGradient(cx, cy, radius * 0.55, cx, cy, radius)
    gradient.addColorStop(0, 'rgba(0,0,0,0)')
    gradient.addColorStop(1, 'rgba(0,0,0,0.55)')
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, width, height)
    scene.textures.addCanvas(key, canvas)
  }
  return scene.add
    .image(width / 2, height / 2, key)
    .setScrollFactor(0)
    .setDepth(1000)
}

export function drawTree(scene, cx, cy) {
  const shadow = scene.add.ellipse(cx, cy + 11, 16, 5, 0x000000, 0.25)
  const trunk = scene.add.rectangle(cx, cy + 6, 4, 10, 0x4a2f18)
  const trunkLit = scene.add.rectangle(cx - 1, cy + 6, 1.5, 10, 0x5b3a1f)
  const canopy1 = scene.add.circle(cx, cy - 4, 10, 0x244f20)
  const canopy2 = scene.add.circle(cx - 5, cy, 7, 0x2a5c25)
  const canopy3 = scene.add.circle(cx + 5, cy, 7, 0x2a5c25)
  const canopyLit = scene.add.circle(cx - 4, cy - 8, 5, 0x3d7a35)
  return [shadow, trunk, trunkLit, canopy1, canopy2, canopy3, canopyLit]
}

const FLOWER_COLORS = [0xd68fc4, 0xd9c23f, 0xe07a8c, 0xe8e8e8]

export function drawFlower(scene, cx, cy) {
  const color = FLOWER_COLORS[Math.floor(seededRand(cx, cy, 40) * FLOWER_COLORS.length)]
  const petals = [
    scene.add.circle(cx - 2, cy, 1.6, color),
    scene.add.circle(cx + 2, cy, 1.6, color),
    scene.add.circle(cx, cy - 2, 1.6, color),
    scene.add.circle(cx, cy + 2, 1.6, color),
  ]
  const center = scene.add.circle(cx, cy, 1.4, 0xd9a730)
  return [...petals, center]
}

export function drawRock(scene, cx, cy) {
  const shadow = scene.add.ellipse(cx, cy + 3, 14, 5, 0x000000, 0.25)
  const base = scene.add.circle(cx, cy, 7, 0x6f6f6f)
  const shade = scene.add.circle(cx + 2, cy + 2, 5, 0x5a5a5a)
  const highlight = scene.add.circle(cx - 2, cy - 2, 3, 0x8f8f8f)
  return [shadow, base, shade, highlight]
}

const ROOF_COLORS = { default: 0x1e1e1e }

function shadeHex(color, amount) {
  const r = Math.max(0, Math.min(255, ((color >> 16) & 0xff) + amount))
  const g = Math.max(0, Math.min(255, ((color >> 8) & 0xff) + amount))
  const b = Math.max(0, Math.min(255, (color & 0xff) + amount))
  return (r << 16) | (g << 8) | b
}

export function drawBuildingFacade(graphics, x, y, w, h, baseColor, options = {}) {
  const roofHeight = 10

  // ground shadow so the building reads as sitting on the ground, not
  // pasted on top of it
  graphics.fillStyle(0x000000, 0.25)
  graphics.fillRect(x + 4, y + h, w, 5)

  graphics.fillStyle(options.roofColor ?? ROOF_COLORS.default, 1)
  graphics.fillRect(x - 2, y - roofHeight, w + 4, roofHeight)
  graphics.fillStyle(shadeHex(options.roofColor ?? ROOF_COLORS.default, 30), 1)
  graphics.fillRect(x - 2, y - roofHeight, w + 4, 2)

  graphics.fillStyle(baseColor, 1)
  graphics.fillRect(x, y, w, h)
  // right-edge AO strip, consistent upper-left light source
  graphics.fillStyle(shadeHex(baseColor, -30), 1)
  graphics.fillRect(x + w - 10, y, 10, h)
  // left-edge highlight catching the light
  graphics.fillStyle(shadeHex(baseColor, 18), 1)
  graphics.fillRect(x, y, 5, h)

  // window grid, each with a frame so it reads as glass in a wall rather
  // than a flat colored square
  const winW = 10
  const winH = 12
  const gapX = 8
  const gapY = 10
  const cols = Math.max(1, Math.floor((w - gapX) / (winW + gapX)))
  const rows = Math.max(1, Math.floor((h - gapY - 18) / (winH + gapY)))
  const startX = x + (w - cols * winW - (cols - 1) * gapX) / 2
  const startY = y + 12

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const wx = startX + c * (winW + gapX)
      const wy = startY + r * (winH + gapY)
      const lit = seededRand(x + wx, y + wy, 5) > 0.4
      graphics.fillStyle(0x14141c, 1)
      graphics.fillRect(wx - 1, wy - 1, winW + 2, winH + 2)
      graphics.fillStyle(lit ? 0xf2c14e : 0x232f45, 1)
      graphics.fillRect(wx, wy, winW, winH)
      if (lit) {
        graphics.fillStyle(0xfbe08a, 1)
        graphics.fillRect(wx, wy, winW, 3)
      }
    }
  }

  // door with frame and a subtle shadow inside the doorway
  const doorW = 16
  graphics.fillStyle(0x14141c, 1)
  graphics.fillRect(x + w / 2 - doorW / 2 - 1, y + h - 21, doorW + 2, 21)
  graphics.fillStyle(0x2c1d10, 1)
  graphics.fillRect(x + w / 2 - doorW / 2, y + h - 20, doorW, 20)
  graphics.fillStyle(0xc99b3c, 1)
  graphics.fillRect(x + w / 2 - doorW / 2 + doorW - 4, y + h - 12, 2, 4)
}
