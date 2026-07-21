// Shared drawing helpers so every world's tilemap reads as a textured,
// populated place (grass with blades, roads with lane lines, water with
// waves, buildings with windows/doors/roofs) instead of flat color squares.

function seededRand(seedX, seedY, salt = 0) {
  const s = Math.sin(seedX * 127.1 + seedY * 311.7 + salt * 74.3) * 43758.5453
  return s - Math.floor(s)
}

export function drawGrassTile(graphics, x, y, size) {
  graphics.fillStyle(0x3a7d34, 1)
  graphics.fillRect(x, y, size, size)
  graphics.fillStyle(0x2f6b2a, 1)
  for (let i = 0; i < 3; i++) {
    const bx = x + seededRand(x, y, i) * (size - 4)
    const by = y + seededRand(x, y, i + 10) * (size - 4)
    graphics.fillRect(bx, by, 2, 4)
  }
}

export function drawRoadTile(graphics, x, y, size, horizontal, dashPhaseIndex) {
  graphics.fillStyle(0x4a4a4a, 1)
  graphics.fillRect(x, y, size, size)
  graphics.fillStyle(0x6b6b6b, 1)
  if (horizontal) {
    graphics.fillRect(x, y + size / 2 - 1, size, 2)
    if (dashPhaseIndex % 2 === 0) {
      graphics.fillStyle(0xe0c94a, 1)
      graphics.fillRect(x + size / 2 - 4, y + size / 2 - 1, 8, 2)
    }
  } else {
    graphics.fillRect(x + size / 2 - 1, y, 2, size)
    if (dashPhaseIndex % 2 === 0) {
      graphics.fillStyle(0xe0c94a, 1)
      graphics.fillRect(x + size / 2 - 1, y + size / 2 - 4, 2, 8)
    }
  }
}

export function drawWaterTile(graphics, x, y, size, phase) {
  graphics.fillStyle(0x2f6fb5, 1)
  graphics.fillRect(x, y, size, size)
  graphics.fillStyle(0x5b9de0, 1)
  const waveY = y + size / 2 + Math.sin(phase + x * 0.05) * 3
  graphics.fillRect(x, waveY, size, 2)
}

export function drawSandTile(graphics, x, y, size) {
  graphics.fillStyle(0xc2a25c, 1)
  graphics.fillRect(x, y, size, size)
  graphics.fillStyle(0xb0904c, 1)
  for (let i = 0; i < 2; i++) {
    const bx = x + seededRand(x, y, i + 20) * (size - 2)
    const by = y + seededRand(x, y, i + 30) * (size - 2)
    graphics.fillRect(bx, by, 2, 2)
  }
}

export function drawTree(scene, cx, cy) {
  const trunk = scene.add.rectangle(cx, cy + 6, 4, 10, 0x5b3a1f)
  const canopy1 = scene.add.circle(cx, cy - 4, 10, 0x2f6b2a)
  const canopy2 = scene.add.circle(cx - 5, cy, 7, 0x35792f)
  const canopy3 = scene.add.circle(cx + 5, cy, 7, 0x35792f)
  return [trunk, canopy1, canopy2, canopy3]
}

const ROOF_COLORS = { default: 0x2a2a2a }

export function drawBuildingFacade(graphics, x, y, w, h, baseColor, options = {}) {
  const roofHeight = 10
  graphics.fillStyle(options.roofColor ?? ROOF_COLORS.default, 1)
  graphics.fillRect(x - 2, y - roofHeight, w + 4, roofHeight)

  graphics.fillStyle(baseColor, 1)
  graphics.fillRect(x, y, w, h)

  // window grid
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
      graphics.fillStyle(lit ? 0xffe066 : 0x2b3a52, 1)
      graphics.fillRect(wx, wy, winW, winH)
    }
  }

  // door
  const doorW = 16
  graphics.fillStyle(0x3a2a1a, 1)
  graphics.fillRect(x + w / 2 - doorW / 2, y + h - 20, doorW, 20)
  graphics.fillStyle(0xc99b3c, 1)
  graphics.fillRect(x + w / 2 - doorW / 2 + doorW - 4, y + h - 12, 2, 4)
}
