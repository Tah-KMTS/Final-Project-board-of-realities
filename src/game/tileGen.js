// Shared drawing helpers so every world's tilemap reads as a textured,
// populated place (grass with blades, roads with lane lines, water with
// waves, buildings with windows/doors/roofs) instead of flat color squares
// or external art assets. Shading follows the same upper-left light source
// used for character sprites (spriteGen.js), so the whole game reads as one
// consistently-lit scene instead of flat, toy-like color fills. 100% Phaser
// Graphics/canvas drawing - no images are loaded.

function seededRand(seedX, seedY, salt = 0) {
  const s = Math.sin(seedX * 127.1 + seedY * 311.7 + salt * 74.3) * 43758.5453
  return s - Math.floor(s)
}

function shadeHex(color, amount) {
  const r = Math.max(0, Math.min(255, ((color >> 16) & 0xff) + amount))
  const g = Math.max(0, Math.min(255, ((color >> 8) & 0xff) + amount))
  const b = Math.max(0, Math.min(255, (color & 0xff) + amount))
  return (r << 16) | (g << 8) | b
}

// ---------------------------------------------------------------------------
// Per-cell tile fills. Each one draws directly into a shared Graphics object
// at the given pixel rect - see buildTerrainLayer() below for the dispatcher
// that loops every map cell and calls the right one.
// ---------------------------------------------------------------------------

export function drawGrassTile(graphics, x, y, size) {
  graphics.fillStyle(0x35722f, 1)
  graphics.fillRect(x, y, size, size)
  // subtle AO band along the bottom/right edge (upper-left light source)
  graphics.fillStyle(0x2c5f27, 0.5)
  graphics.fillRect(x, y + size - 5, size, 5)
  graphics.fillRect(x + size - 5, y, 5, size)
  // Blade count scales with tile size so a bigger tile stays as densely
  // detailed as a smaller one instead of the same handful of blades just
  // being stretched across more area.
  const bladeCount = Math.max(3, Math.round(size / 9))
  graphics.fillStyle(0x274f22, 1)
  for (let i = 0; i < bladeCount; i++) {
    const bx = x + seededRand(x, y, i) * (size - 4)
    const by = y + seededRand(x, y, i + 10) * (size - 4)
    graphics.fillRect(bx, by, 2, 4)
  }
  // lighter blades catching the light, also scaled with size
  const litBladeCount = Math.max(1, Math.round(size / 22))
  graphics.fillStyle(0x4a8f42, 1)
  for (let i = 0; i < litBladeCount; i++) {
    if (seededRand(x, y, 99 + i) <= 0.55) continue
    graphics.fillRect(x + seededRand(x, y, 5 + i) * (size - 3), y + seededRand(x, y, 6 + i) * (size - 3), 2, 3)
  }
}

// Tokyo's "luxury financial district" ground reskin - no grass, a dark
// marble-with-gold-seam floor instead.
export function drawSlateMarbleTile(graphics, x, y, size) {
  graphics.fillStyle(0x0a101f, 1)
  graphics.fillRect(x, y, size, size)
  graphics.fillStyle(0x131d36, 1)
  graphics.fillRect(x + 1, y + 1, size - 2, size - 2)
  graphics.fillStyle(0xf59e0b, 0.4)
  graphics.fillRect(x, y, size, 1)
  graphics.fillRect(x, y, 1, size)
}

// Kyoto's JRPG-cobblestone ground reskin.
export function drawCobblestoneTile(graphics, x, y, size) {
  graphics.fillStyle(0x2c2621, 1)
  graphics.fillRect(x, y, size, size)
  graphics.fillStyle(0x423831, 1)
  graphics.fillRect(x + 2, y + 2, size - 4, size - 4)
  graphics.fillStyle(0x854d0e, 0.5)
  graphics.fillRect(x + 4, y + 4, size - 8, 2)
}

export function drawRoadTile(graphics, x, y, size, horizontal, dashPhaseIndex) {
  graphics.fillStyle(0x3d3d3d, 1)
  graphics.fillRect(x, y, size, size)
  // asphalt speckle for texture instead of a flat fill - count scales with
  // tile size so bigger tiles don't read as sparser
  const darkSpeckleCount = Math.max(4, Math.round(size / 10))
  const lightSpeckleCount = Math.max(3, Math.round(size / 13))
  graphics.fillStyle(0x333333, 1)
  for (let i = 0; i < darkSpeckleCount; i++) {
    const sx = x + seededRand(x, y, i + 60) * (size - 2)
    const sy = y + seededRand(x, y, i + 70) * (size - 2)
    graphics.fillRect(sx, sy, 2, 2)
  }
  graphics.fillStyle(0x505050, 1)
  for (let i = 0; i < lightSpeckleCount; i++) {
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

// Impassable border/mountain tile, used at every map edge (and Kyoto's
// mountain rows, Sapporo's non-peak border). No pack precedent - a simple
// dark stone fill matching the old asset-era fallback color.
export function drawWallTile(graphics, x, y, size) {
  graphics.fillStyle(0x5b4636, 1)
  graphics.fillRect(x, y, size, size)
  graphics.fillStyle(0x4a3929, 1)
  graphics.fillRect(x, y + size - 6, size, 6)
  graphics.fillStyle(0x6f5a45, 1)
  graphics.fillRect(x, y, size, 4)
}

// Wooden river-crossing tile (Kyoto's Kamo River bridge, Sapporo's Ishikari
// River bridge). No pack precedent - new procedural tile invented for the
// Four Towns work, kept flat-fill + shade/highlight passes, same style as
// every other tile here.
export function drawBridgeTile(graphics, x, y, size) {
  graphics.fillStyle(0x6a4a2a, 1)
  graphics.fillRect(x, y, size, size)
  graphics.fillStyle(0x5a3d22, 1)
  const plankGap = Math.max(6, Math.round(size / 4))
  for (let px = plankGap; px < size; px += plankGap) {
    graphics.fillRect(x + px, y, 2, size)
  }
  graphics.fillStyle(0x7d5a35, 0.6)
  graphics.fillRect(x, y, size, 3)
}

// Snow-capped mountain peak tile (Sapporo's northern border rows). No pack
// precedent - new procedural tile invented for the Four Towns work.
export function drawSnowTile(graphics, x, y, size) {
  graphics.fillStyle(0xe8f0f7, 1)
  graphics.fillRect(x, y, size, size)
  graphics.fillStyle(0xd3e2ee, 1)
  graphics.fillRect(x, y + size - 5, size, 5)
  graphics.fillRect(x + size - 5, y, 5, size)
  graphics.fillStyle(0xffffff, 0.9)
  const sparkleCount = Math.max(2, Math.round(size / 16))
  for (let i = 0; i < sparkleCount; i++) {
    const sx = x + seededRand(x, y, i + 200) * (size - 3)
    const sy = y + seededRand(x, y, i + 210) * (size - 3)
    graphics.fillRect(sx, sy, 2, 2)
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

// ---------------------------------------------------------------------------
// Terrain layer dispatcher. `tileTypeAt(row, col)` returns a tile-type
// string ('grass' | 'path' | 'water' | 'wall' | 'slate' | 'cobblestone' |
// 'bridge' | 'snow') or null/undefined to skip the cell entirely. Road
// orientation (needed for lane-marking direction) isn't passed explicitly -
// it's inferred from whether the left/right or top/bottom neighbor is also
// a path/bridge cell, so every scene's existing tileTypeAt callback (which
// already only returns a bare type string) needed no restructuring.
// ---------------------------------------------------------------------------

function isPathLike(type) {
  return type === 'path' || type === 'bridge'
}

export function buildTerrainLayer(scene, cols, rows, tileSize, tileTypeAt) {
  const graphics = scene.add.graphics()
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const type = tileTypeAt(r, c)
      if (!type) continue
      const x = c * tileSize
      const y = r * tileSize
      switch (type) {
        case 'grass':
          drawGrassTile(graphics, x, y, tileSize)
          break
        case 'slate':
          drawSlateMarbleTile(graphics, x, y, tileSize)
          break
        case 'cobblestone':
          drawCobblestoneTile(graphics, x, y, tileSize)
          break
        case 'path':
        case 'bridge': {
          const left = c > 0 ? tileTypeAt(r, c - 1) : null
          const right = c < cols - 1 ? tileTypeAt(r, c + 1) : null
          const horizontal = isPathLike(left) || isPathLike(right)
          if (type === 'bridge') drawBridgeTile(graphics, x, y, tileSize)
          else drawRoadTile(graphics, x, y, tileSize, horizontal, c)
          break
        }
        case 'water':
          drawWaterTile(graphics, x, y, tileSize, 0)
          break
        case 'wall':
          drawWallTile(graphics, x, y, tileSize)
          break
        case 'snow':
          drawSnowTile(graphics, x, y, tileSize)
          break
        default:
          break
      }
    }
  }
  return graphics
}

// ---------------------------------------------------------------------------
// Decoration (trees / flowers / rocks / campfires)
// ---------------------------------------------------------------------------

const FLOWER_COLORS = [0xd68fc4, 0xd9c23f, 0xe07a8c, 0xe8e8e8]

function setAllDepth(objs, depth) {
  for (const o of objs) o.setDepth(depth)
  return objs
}

export function placeTree(scene, cx, cy) {
  const shadow = scene.add.ellipse(cx, cy + 11, 16, 5, 0x000000, 0.25)
  const trunk = scene.add.rectangle(cx, cy + 6, 4, 10, 0x4a2f18)
  const trunkLit = scene.add.rectangle(cx - 1, cy + 6, 1.5, 10, 0x5b3a1f)
  const canopy1 = scene.add.circle(cx, cy - 4, 10, 0x244f20)
  const canopy2 = scene.add.circle(cx - 5, cy, 7, 0x2a5c25)
  const canopy3 = scene.add.circle(cx + 5, cy, 7, 0x2a5c25)
  const canopyLit = scene.add.circle(cx - 4, cy - 8, 5, 0x3d7a35)
  return setAllDepth([shadow, trunk, trunkLit, canopy1, canopy2, canopy3, canopyLit], cy)
}

export function placeFlower(scene, cx, cy) {
  const color = FLOWER_COLORS[Math.floor(seededRand(cx, cy, 40) * FLOWER_COLORS.length)]
  const petals = [
    scene.add.circle(cx - 2, cy, 1.6, color),
    scene.add.circle(cx + 2, cy, 1.6, color),
    scene.add.circle(cx, cy - 2, 1.6, color),
    scene.add.circle(cx, cy + 2, 1.6, color),
  ]
  const center = scene.add.circle(cx, cy, 1.4, 0xd9a730)
  return setAllDepth([...petals, center], cy)
}

export function placeRock(scene, cx, cy) {
  const shadow = scene.add.ellipse(cx, cy + 3, 14, 5, 0x000000, 0.25)
  const base = scene.add.circle(cx, cy, 7, 0x6f6f6f)
  const shade = scene.add.circle(cx + 2, cy + 2, 5, 0x5a5a5a)
  const highlight = scene.add.circle(cx - 2, cy - 2, 3, 0x8f8f8f)
  return setAllDepth([shadow, base, shade, highlight], cy)
}

// Simplified campfire (used only by Sapporo's alpine district) - a couple of
// stacked logs plus a two-tone flame. Not animated (no frame-cycling), a
// deliberate simplification vs. a true flicker-animated sprite.
export function placeCampfire(scene, cx, cy) {
  const shadow = scene.add.ellipse(cx, cy + 6, 18, 6, 0x000000, 0.3)
  const logs = scene.add.rectangle(cx, cy + 3, 14, 4, 0x4a2f18)
  const logsLit = scene.add.rectangle(cx - 3, cy + 3, 5, 4, 0x5b3a1f)
  const flameOuter = scene.add.circle(cx, cy - 2, 6, 0xff6a00, 0.9)
  const flameInner = scene.add.circle(cx, cy - 4, 3, 0xffd23f, 0.95)
  return setAllDepth([shadow, logs, logsLit, flameOuter, flameInner], cy)
}

// ---------------------------------------------------------------------------
// Buildings & Structures
// ---------------------------------------------------------------------------

const ROOF_COLORS = { default: 0x1e1e1e }

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

// Per-building-call adapter: creates its own Graphics object, draws the
// facade onto it, depth-sorts it against the player/NPCs by its ground (y+h)
// position, and returns it wrapped in an array so every call site's existing
// `zoneObjects.push(...placeBuildingFacade(...))` pattern keeps working
// unchanged. `buildingId` is accepted but unused - it only mattered for
// asset-key selection when this drew from an external tileset.
export function placeBuildingFacade(scene, x, y, w, h, tintColor, buildingId = '') {
  void buildingId
  const graphics = scene.add.graphics()
  drawBuildingFacade(graphics, x, y, w, h, tintColor ?? 0xffffff)
  graphics.setDepth(y + h)
  return [graphics]
}

// ---------------------------------------------------------------------------
// Interior Room Renderer
// ---------------------------------------------------------------------------

// Draws a generic interior room (checkerboard floor + a desk/counter facade
// + its label) into `scene`, using an INTERIOR_TEMPLATES-shaped
// `{ floorA, floorB, deskColor, deskLabel }` entry (all plain color hex
// values / strings - no tileset indices needed). Shared by BaseTownScene's
// generic buildingInterior zone and Sapporo's own template set.
export function drawInteriorRoom(scene, zoneObjects, template = {}) {
  const INTERIOR_COLS = 12
  const INTERIOR_ROWS = 9
  const TILE_SIZE = 40
  const d = { c0: 5, r0: 2, c1: 6, r1: 3 }

  const floorA = template.floorA ?? 0x201c28
  const floorB = template.floorB ?? 0x1b1822

  const floorGraphics = scene.add.graphics()
  zoneObjects.push(floorGraphics)
  for (let row = 0; row < INTERIOR_ROWS; row++) {
    for (let col = 0; col < INTERIOR_COLS; col++) {
      const isBorder = row === 0 || col === 0 || row === INTERIOR_ROWS - 1 || col === INTERIOR_COLS - 1
      const x = col * TILE_SIZE
      const y = row * TILE_SIZE
      floorGraphics.fillStyle(isBorder ? 0x1a1a2e : (row + col) % 2 === 0 ? floorA : floorB, 1)
      floorGraphics.fillRect(x, y, TILE_SIZE, TILE_SIZE)
    }
  }

  const dx = d.c0 * TILE_SIZE
  const dy = d.r0 * TILE_SIZE
  const dw = (d.c1 - d.c0 + 1) * TILE_SIZE
  const dh = (d.r1 - d.r0 + 1) * TILE_SIZE
  const deskLabel = template.deskLabel || 'Counter'
  const deskColor = template.deskColor ?? 0x555555
  zoneObjects.push(...placeBuildingFacade(scene, dx, dy, dw, dh, deskColor, 'desk'))
  const label = scene.add
    .text(dx + dw / 2, dy - 12, deskLabel, { fontFamily: 'monospace', fontSize: '10px', color: '#ffffff' })
    .setOrigin(0.5, 1)
    .setDepth(dy + dh + 10)
  zoneObjects.push(label)
  return { dx, dy, dw, dh }
}
