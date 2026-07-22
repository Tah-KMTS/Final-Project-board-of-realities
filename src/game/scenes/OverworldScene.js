import Phaser from 'phaser'
import { useGameStore } from '../../store/useGameStore'
import { resolvePalette } from '../characterPalettes'
import { generateAmbientNpcs } from '../../utils/npcGenerator'
import { FINANCE_NPCS } from '../../features/finance/financeNpcs'
import { YUGIOH_NPCS } from '../../features/yugioh/yugiohNpcs'
import { SpriteActor } from '../actor'
import { TileMover, combineDirection } from '../tileMover'
import {
  drawGrassTile,
  drawRoadTile,
  drawWaterTile,
  drawTree,
  drawFlower,
  drawRock,
  drawBuildingFacade,
  addScreenVignette,
} from '../tileGen'

// ---------------------------------------------------------------------------
// OverworldScene composes Hunter's Rift, Financial Anarchy and King of Games
// (Domino City's map stays a separate star-topology scene per the GDD - see
// DominoWorldScene - and is entered through a gate, like walking into a
// building) into ONE continuous walkable Phaser tile grid, Pokemon-style.
//
// Each region keeps its original 26x20 local layout untouched; this scene
// just places that same local grid at a col/row offset in a shared master
// grid and punches a narrow "gate" opening through the region's own border
// wall wherever a connecting route corridor touches it. isBlockedTile()
// figures out which region (or corridor) a global tile falls in and
// delegates to that region's original blocked-tile rule, translated to
// local coordinates.
// ---------------------------------------------------------------------------

const TILE_SIZE = 40
const REGION_COLS = 26
const REGION_ROWS = 20

const HUNTER_COL_OFF = 0
const HUNTER_ROW_OFF = 0
const FINANCE_COL_OFF = 32
const FINANCE_ROW_OFF = 0
const YUGIOH_COL_OFF = 0
const YUGIOH_ROW_OFF = 26

// The route corridors: a vertical band and a horizontal band of the master
// grid, always walkable. Where they run alongside a region they form the
// "route" connecting it to its neighbor; where they cross, they form a hub
// (that's also where the Domino City gate lives).
const CORRIDOR_COL_MIN = 26
const CORRIDOR_COL_MAX = 31
const CORRIDOR_ROW_MIN = 20
const CORRIDOR_ROW_MAX = 25

const TOTAL_COLS = 58
const TOTAL_ROWS = 46

// Gate openings (inclusive local row/col ranges) punched through each
// region's border wall where a corridor touches it.
const HUNTER_GATE_EAST_ROWS = [8, 11] // col === REGION_COLS - 1
const HUNTER_GATE_SOUTH_COLS = [12, 15] // row === REGION_ROWS - 1
const FINANCE_GATE_WEST_ROWS = [8, 11] // col === 0
const YUGIOH_GATE_NORTH_COLS = [12, 15] // row === 0

const DOMINO_GATE_TILE = { col: 28, row: 22 } // sits inside the corridor hub

const REGION_DISPLAY = {
  hunter: "The Hunter's Rift",
  finance: 'Capital Syndicate',
  yugioh: 'King of Games',
}

// ---------------- Hunter's Rift content (unchanged from HunterWorldScene) ----------------
const HUNTER_BUILDINGS = [
  { id: 'hq', label: 'Hunter Association HQ', color: 0x2a4f9e, tiles: { c0: 1, r0: 1, c1: 4, r1: 3 } },
  { id: 'supermarket', label: 'Supermarket', color: 0xb59b1f, tiles: { c0: 20, r0: 1, c1: 23, r1: 3 } },
  { id: 'burgerJoint', label: 'Burger Joint', color: 0xb5601f, tiles: { c0: 20, r0: 15, c1: 23, r1: 17 } },
  { id: 'dorms', label: 'Hunter Guild Dorms', color: 0x5f5f8f, tiles: { c0: 1, r0: 15, c1: 4, r1: 17 }, decorative: true },
]
const HUNTER_RIFTS = [
  { id: 'riftA', difficulty: 3, tileX: 7, tileY: 12 },
  { id: 'riftB', difficulty: 7, tileX: 18, tileY: 7 },
]
const HUNTER_MARRIAGE_SPOT = { tileX: 13, tileY: 5 }
const HUNTER_RIVER_COL = 12
const HUNTER_BRIDGE_ROWS = [9, 10]
const HUNTER_NPC_SPAWN_POOL = [
  { tileX: 3, tileY: 5, note: 'gardening outside HQ' },
  { tileX: 21, tileY: 10, note: 'loitering behind the burger joint' },
  { tileX: 9, tileY: 16, note: 'sitting on a bench' },
  { tileX: 15, tileY: 3, note: 'standing in the middle of the road' },
  { tileX: 6, tileY: 3, note: 'crouched by the HQ steps' },
  { tileX: 22, tileY: 6, note: 'hiding near the supermarket' },
]

function hunterTileType(r, c) {
  const isBorder = r === 0 || c === 0 || r === REGION_ROWS - 1 || c === REGION_COLS - 1
  const gateEast = c === REGION_COLS - 1 && r >= HUNTER_GATE_EAST_ROWS[0] && r <= HUNTER_GATE_EAST_ROWS[1]
  const gateSouth = r === REGION_ROWS - 1 && c >= HUNTER_GATE_SOUTH_COLS[0] && c <= HUNTER_GATE_SOUTH_COLS[1]
  if (isBorder) return gateEast || gateSouth ? 'path' : 'wall'
  if (c === HUNTER_RIVER_COL) return HUNTER_BRIDGE_ROWS.includes(r) ? 'path' : 'water'
  if (r === 7) return 'path'
  if (c === 13) return 'path'
  return 'grass'
}

function pickTwoDistinctSpawns() {
  const pool = [...HUNTER_NPC_SPAWN_POOL]
  const first = pool.splice(Math.floor(Math.random() * pool.length), 1)[0]
  const second = pool.splice(Math.floor(Math.random() * pool.length), 1)[0]
  return [first, second]
}

// ---------------- Capital Syndicate: 4-district Financial region ----------------
// Still the same 26x20 local grid, same tile-offset/zone-rectangle pattern as
// before - just more buildings in it, grouped into 4 Tokyo-inspired
// districts by row band. Row bands 1-3 and 15-17 are the original two
// building rows (untouched, same ids, so every existing modal wiring in
// WorldScreen.jsx keeps working unchanged); rows 8-10, 13-14, and 18 were
// previously-empty grass and now hold the new buildings. Streets (row 7/12,
// col 6/19) and the col-13 spawn column (see createPlayer) are kept clear
// by every band below - verified column-by-column, not just eyeballed.
const FINANCE_BUILDINGS = [
  // --- Financial District (Stock & Commodity Exchange, tycoon HQs, Crypto HQ, VC Hub) ---
  { id: 'stockExchange', label: 'Stock Exchange', district: 'Financial District', color: 0x1f5f3a, tiles: { c0: 1, r0: 1, c1: 4, r1: 3 } },
  { id: 'buffettHQ', label: 'Buffett Tower', district: 'Financial District', color: 0x555555, tiles: { c0: 8, r0: 1, c1: 10, r1: 3 }, npcId: 'buffett' },
  { id: 'vanderbiltHQ', label: 'Vanderbilt Rail Co.', district: 'Financial District', color: 0x6b4a2a, tiles: { c0: 14, r0: 1, c1: 16, r1: 3 }, npcId: 'vanderbilt' },
  { id: 'muskHQ', label: 'Musk Industries', district: 'Financial District', color: 0x2a2a2a, tiles: { c0: 20, r0: 1, c1: 22, r1: 3 }, npcId: 'musk' },
  { id: 'howardMarksHQ', label: 'Oaktree Cycle Capital', district: 'Financial District', color: 0x2a4f4a, tiles: { c0: 1, r0: 8, c1: 4, r1: 10 }, npcId: 'howardmarks' },
  { id: 'vcHub', label: 'Venture Capital Hub', district: 'Financial District', color: 0x2a3a6b, tiles: { c0: 7, r0: 8, c1: 9, r1: 10 } },
  { id: 'corporateOffice', label: 'Corporate Holdings', district: 'Financial District', color: 0x4a3a5f, tiles: { c0: 11, r0: 15, c1: 14, r1: 17 } },
  { id: 'cryptoExchange', label: 'Crypto HQ', district: 'Financial District', color: 0x8a5a1f, tiles: { c0: 20, r0: 15, c1: 23, r1: 17 } },

  // --- Commercial District (Banks, Real Estate, Casino, Arcade, Hotel) ---
  { id: 'bank', label: 'Bank & Realty Office', district: 'Commercial District', color: 0x1f3a5f, tiles: { c0: 1, r0: 15, c1: 4, r1: 17 } },
  { id: 'realEstateAgency', label: 'Real Estate Agency', district: 'Commercial District', color: 0x3a5f4a, tiles: { c0: 7, r0: 15, c1: 10, r1: 17 } },
  { id: 'hotel', label: 'Capital Suites Hotel', district: 'Commercial District', color: 0x8a6a2a, tiles: { c0: 15, r0: 15, c1: 18, r1: 17 } },
  { id: 'casino', label: 'Neon Dragon Casino', district: 'Commercial District', color: 0x8a1f6a, tiles: { c0: 15, r0: 8, c1: 17, r1: 10 } },
  { id: 'arcade', label: 'Pixel Palace Arcade', district: 'Commercial District', color: 0x1f6a8a, tiles: { c0: 20, r0: 8, c1: 22, r1: 10 } },

  // --- Underground District (Crime Alley, Black Market, Call Center Ops) ---
  { id: 'crimeAlley', label: 'Crime Alley', district: 'Underground District', color: 0x6a1f1f, tiles: { c0: 1, r0: 13, c1: 4, r1: 14 } },
  { id: 'blackMarket', label: 'Black Market', district: 'Underground District', color: 0x4a1f6a, tiles: { c0: 7, r0: 13, c1: 9, r1: 14 } },
  { id: 'callCenterOps', label: 'Call Center Ops', district: 'Underground District', color: 0x6a5a1f, tiles: { c0: 15, r0: 13, c1: 17, r1: 14 } },

  // --- Government & Cultural District (Parliament, Park, Temple) ---
  { id: 'parliament', label: 'Parliament Hall', district: 'Government & Cultural District', color: 0x3a3a6a, tiles: { c0: 1, r0: 18, c1: 4, r1: 18 } },
  { id: 'park', label: 'Serenity Park', district: 'Government & Cultural District', color: 0x2a5f2a, tiles: { c0: 10, r0: 18, c1: 13, r1: 18 } },
  { id: 'temple', label: 'Whispering Temple', district: 'Government & Cultural District', color: 0x5a5a4a, tiles: { c0: 20, r0: 18, c1: 23, r1: 18 } },
]
const FINANCE_H_STREETS = [7, 12]
const FINANCE_V_STREETS = [6, 19]

function financeTileType(r, c) {
  const isBorder = r === 0 || c === 0 || r === REGION_ROWS - 1 || c === REGION_COLS - 1
  const gateWest = c === 0 && r >= FINANCE_GATE_WEST_ROWS[0] && r <= FINANCE_GATE_WEST_ROWS[1]
  if (isBorder) return gateWest ? 'path' : 'wall'
  if (FINANCE_H_STREETS.includes(r) || FINANCE_V_STREETS.includes(c)) return 'path'
  return 'grass'
}

// ---------------- King of Games content (unchanged from YugiohWorldScene) ----------------
const YUGIOH_BUILDINGS = [
  { id: 'kameGameShop', label: 'Kame Game Shop', color: 0x6b3a1f, tiles: { c0: 1, r0: 1, c1: 4, r1: 3 }, npcId: 'yugi' },
  { id: 'kaibaCorpTower', label: 'KaibaCorp Tower', color: 0x2a3a5f, tiles: { c0: 20, r0: 1, c1: 23, r1: 3 }, npcId: 'kaiba' },
  { id: 'cardShop', label: "Duke Devlin's Card Shop", color: 0x4a3a5f, tiles: { c0: 1, r0: 15, c1: 4, r1: 17 }, npcId: 'duke' },
]
const YUGIOH_FIXED_NPCS = [
  { npcId: 'joey', tileX: 8, tileY: 5, kidnappable: true },
  { npcId: 'tristan', tileX: 17, tileY: 5, kidnappable: true },
  { npcId: 'solomon', tileX: 3, tileY: 6, kidnappable: true },
  { npcId: 'tea', tileX: 13, tileY: 4 },
  { npcId: 'tah', tileX: 13, tileY: 14 },
]
const YUGIOH_PLAZA = { c0: 10, r0: 6, c1: 16, r1: 12 }

function yugiohTileType(r, c) {
  const isBorder = r === 0 || c === 0 || r === REGION_ROWS - 1 || c === REGION_COLS - 1
  const gateNorth = r === 0 && c >= YUGIOH_GATE_NORTH_COLS[0] && c <= YUGIOH_GATE_NORTH_COLS[1]
  if (isBorder) return gateNorth ? 'path' : 'wall'
  if (c >= YUGIOH_PLAZA.c0 && c <= YUGIOH_PLAZA.c1 && r >= YUGIOH_PLAZA.r0 && r <= YUGIOH_PLAZA.r1) return 'path'
  if (r === 9) return 'path'
  if (c === 13) return 'path'
  return 'grass'
}

// ---------------- shared small helpers ----------------
function buildLayout(tileTypeFn) {
  const layout = []
  for (let r = 0; r < REGION_ROWS; r++) {
    const row = []
    for (let c = 0; c < REGION_COLS; c++) row.push(tileTypeFn(r, c))
    layout.push(row)
  }
  return layout
}

function drawTileAt(graphics, tile, x, y, size, horizontal, dashIndex) {
  if (tile === 'grass') drawGrassTile(graphics, x, y, size)
  else if (tile === 'path') drawRoadTile(graphics, x, y, size, horizontal, dashIndex)
  else if (tile === 'water') drawWaterTile(graphics, x, y, size, 0)
  else if (tile === 'wall') {
    graphics.fillStyle(0x5b4636, 1)
    graphics.fillRect(x, y, size, size)
  } else {
    // 'void': tiles outside every region and route corridor (e.g. the dead
    // SE quadrant of the master grid, where no region was placed). Still
    // impassable per isBlockedTile - this only affects how it looks - so it
    // reads as ordinary terrain stretching to the map's edge instead of a
    // jarring flat-black gap.
    drawGrassTile(graphics, x, y, size)
  }
}

function scatterTreesForRegion(scene, layout, buildings, colOff, rowOff, count) {
  const forbidden = new Set()
  for (const b of buildings) {
    for (let r = b.tiles.r0 - 1; r <= b.tiles.r1 + 1; r++) {
      for (let c = b.tiles.c0 - 1; c <= b.tiles.c1 + 1; c++) forbidden.add(`${r},${c}`)
    }
  }
  for (let i = 0; i < count; i++) {
    const r = 1 + Math.floor(Math.random() * (REGION_ROWS - 2))
    const c = 1 + Math.floor(Math.random() * (REGION_COLS - 2))
    if (layout[r][c] !== 'grass' || forbidden.has(`${r},${c}`)) continue
    const cx = (c + colOff) * TILE_SIZE + TILE_SIZE / 2
    const cy = (r + rowOff) * TILE_SIZE + TILE_SIZE / 2
    const roll = Math.random()
    if (roll < 0.45) drawTree(scene, cx, cy)
    else if (roll < 0.85) drawFlower(scene, cx, cy)
    else drawRock(scene, cx, cy)
  }
}

function drawBuildingsForRegion(scene, graphics, buildings, colOff, rowOff) {
  for (const b of buildings) {
    const x = (b.tiles.c0 + colOff) * TILE_SIZE
    const y = (b.tiles.r0 + rowOff) * TILE_SIZE
    const w = (b.tiles.c1 - b.tiles.c0 + 1) * TILE_SIZE
    const h = (b.tiles.r1 - b.tiles.r0 + 1) * TILE_SIZE
    drawBuildingFacade(graphics, x, y, w, h, b.color)
    scene.add
      .text(x + w / 2, y - 12, b.label, { fontFamily: 'monospace', fontSize: '10px', color: '#ffffff' })
      .setOrigin(0.5, 1)
  }
}

function wanderActor(actor, delta, speed = 20) {
  actor.wanderTimer -= delta
  if (actor.wanderTimer <= 0) {
    actor.wanderTimer = 1500 + Math.random() * 2500
    const dirs = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }]
    actor.wanderDir = dirs[Math.floor(Math.random() * dirs.length)]
  }
  const nx = actor.x + actor.wanderDir.x * speed * (delta / 1000)
  const ny = actor.y + actor.wanderDir.y * speed * (delta / 1000)
  actor.sprite.setPosition(nx, ny)
  actor.setMoving(actor.wanderDir.x !== 0 || actor.wanderDir.y !== 0)
  if (actor.wanderDir.x > 0) actor.setFacing('right')
  else if (actor.wanderDir.x < 0) actor.setFacing('left')
  else if (actor.wanderDir.y > 0) actor.setFacing('down')
  else if (actor.wanderDir.y < 0) actor.setFacing('up')
  actor.update(delta)
}

export default class OverworldScene extends Phaser.Scene {
  constructor() {
    super('OverworldScene')
    this.bridge = null
    this.nearbyZone = null
    this.interactionLocked = false
    this.lastKnownRegion = null
  }

  create() {
    useGameStore.getState().initFinanceMarket()

    this.hunterLayout = buildLayout(hunterTileType)
    this.financeLayout = buildLayout(financeTileType)
    this.yugiohLayout = buildLayout(yugiohTileType)

    this.drawWorldTerrain()
    this.drawPlazaFountain()
    this.drawDominoGateMarker()

    scatterTreesForRegion(this, this.hunterLayout, HUNTER_BUILDINGS, HUNTER_COL_OFF, HUNTER_ROW_OFF, 40)
    scatterTreesForRegion(this, this.financeLayout, FINANCE_BUILDINGS, FINANCE_COL_OFF, FINANCE_ROW_OFF, 32)
    scatterTreesForRegion(this, this.yugiohLayout, YUGIOH_BUILDINGS, YUGIOH_COL_OFF, YUGIOH_ROW_OFF, 32)

    const buildingGraphics = this.add.graphics()
    drawBuildingsForRegion(this, buildingGraphics, HUNTER_BUILDINGS, HUNTER_COL_OFF, HUNTER_ROW_OFF)
    drawBuildingsForRegion(this, buildingGraphics, FINANCE_BUILDINGS, FINANCE_COL_OFF, FINANCE_ROW_OFF)
    drawBuildingsForRegion(this, buildingGraphics, YUGIOH_BUILDINGS, YUGIOH_COL_OFF, YUGIOH_ROW_OFF)

    this.drawRiftPortals()
    this.drawMarriageNpc()
    this.drawHiddenHunterNpcs()
    this.drawFinanceNamedNpcs()
    this.drawYugiohFixedNpcs()
    this.drawCynn()

    this.spawnHunterAmbientNpcs()
    this.spawnFinanceAmbientNpcs()
    this.spawnYugiohAmbientNpcs()

    this.createPlayer()

    this.promptText = this.add
      .text(320, 460, '', { fontFamily: 'monospace', fontSize: '14px', color: '#ffe066' })
      .setScrollFactor(0)
      .setOrigin(0.5)
      .setDepth(2000)
    this.regionLabel = this.add
      .text(10, 10, '', { fontFamily: 'monospace', fontSize: '13px', color: '#c9a8ff' })
      .setScrollFactor(0)
      .setDepth(2000)

    this.cursors = this.input.keyboard.createCursorKeys()
    this.wasd = this.input.keyboard.addKeys('W,A,S,D,E,R')

    this.cameras.main.setBounds(0, 0, TOTAL_COLS * TILE_SIZE, TOTAL_ROWS * TILE_SIZE)
    this.cameras.main.startFollow(this.playerActor.sprite, true)
    addScreenVignette(this)

    this.buildZones()

    this.bridge?.on('npcKilled', ({ npcId }) => {
      this.financeNamedNpcActors[npcId]?.destroy()
    })
    this.bridge?.on('ambientNpcKilled', ({ npcId }) => {
      this.removeFinanceAmbientNpc(npcId)
    })

    this.marketTimer = this.time.addEvent({
      delay: 4000,
      loop: true,
      callback: () => useGameStore.getState().tickFinanceMarket(),
    })
    this.criminalEncounterTimer = this.time.addEvent({
      delay: 20000,
      loop: true,
      callback: () => this.maybeSpawnCriminal(),
    })
    this.policeTimer = this.time.addEvent({
      delay: 9000,
      loop: true,
      callback: () => this.maybeSpawnPolice(),
    })
  }

  // ---------------- region classification / collision ----------------

  regionOfGlobal(col, row) {
    if (col >= HUNTER_COL_OFF && col < HUNTER_COL_OFF + REGION_COLS && row >= HUNTER_ROW_OFF && row < HUNTER_ROW_OFF + REGION_ROWS) {
      return 'hunter'
    }
    if (col >= FINANCE_COL_OFF && col < FINANCE_COL_OFF + REGION_COLS && row >= FINANCE_ROW_OFF && row < FINANCE_ROW_OFF + REGION_ROWS) {
      return 'finance'
    }
    if (col >= YUGIOH_COL_OFF && col < YUGIOH_COL_OFF + REGION_COLS && row >= YUGIOH_ROW_OFF && row < YUGIOH_ROW_OFF + REGION_ROWS) {
      return 'yugioh'
    }
    if ((col >= CORRIDOR_COL_MIN && col <= CORRIDOR_COL_MAX) || (row >= CORRIDOR_ROW_MIN && row <= CORRIDOR_ROW_MAX)) {
      return 'corridor'
    }
    return 'void'
  }

  isBlockedTile(col, row) {
    if (col < 0 || col >= TOTAL_COLS || row < 0 || row >= TOTAL_ROWS) return true
    const region = this.regionOfGlobal(col, row)

    // Focus mode: Hunter's Rift and King of Games are sealed off - only
    // Financial Anarchy is reachable. Revert by restoring the per-region
    // logic these two used to have (still intact in git history).
    if (region === 'hunter') return true
    if (region === 'yugioh') return true
    if (region === 'finance') {
      const lc = col - FINANCE_COL_OFF
      const lr = row - FINANCE_ROW_OFF
      if (this.financeLayout[lr][lc] === 'wall') return true
      for (const b of FINANCE_BUILDINGS) {
        if (lc >= b.tiles.c0 && lc <= b.tiles.c1 && lr >= b.tiles.r0 && lr <= b.tiles.r1) return true
      }
      return false
    }
    if (region === 'corridor') return false
    return true // void
  }

  // ---------------- drawing ----------------

  drawWorldTerrain() {
    const graphics = this.add.graphics()
    for (let row = 0; row < TOTAL_ROWS; row++) {
      for (let col = 0; col < TOTAL_COLS; col++) {
        const region = this.regionOfGlobal(col, row)
        const x = col * TILE_SIZE
        const y = row * TILE_SIZE
        if (region === 'hunter') {
          const lc = col - HUNTER_COL_OFF
          const lr = row - HUNTER_ROW_OFF
          drawTileAt(graphics, this.hunterLayout[lr][lc], x, y, TILE_SIZE, lr === 7, lc)
        } else if (region === 'finance') {
          const lc = col - FINANCE_COL_OFF
          const lr = row - FINANCE_ROW_OFF
          drawTileAt(graphics, this.financeLayout[lr][lc], x, y, TILE_SIZE, FINANCE_H_STREETS.includes(lr), lc)
        } else if (region === 'yugioh') {
          const lc = col - YUGIOH_COL_OFF
          const lr = row - YUGIOH_ROW_OFF
          drawTileAt(graphics, this.yugiohLayout[lr][lc], x, y, TILE_SIZE, lr === 9, lc)
        } else if (region === 'corridor') {
          drawTileAt(graphics, 'grass', x, y, TILE_SIZE, false, col)
        } else {
          drawTileAt(graphics, 'void', x, y, TILE_SIZE, false, col)
        }
      }
    }
  }

  drawPlazaFountain() {
    const cx = (13 + YUGIOH_COL_OFF) * TILE_SIZE + TILE_SIZE / 2
    const cy = (9 + YUGIOH_ROW_OFF) * TILE_SIZE + TILE_SIZE / 2
    this.add.circle(cx, cy, 30, 0x5b4636)
    this.add.circle(cx, cy, 25, 0x2f6fb5)
    const ripple = this.add.circle(cx, cy, 14, 0x5b9de0, 0.7)
    this.tweens.add({ targets: ripple, scale: 1.3, alpha: 0.2, duration: 1400, yoyo: true, repeat: -1 })
    this.add
      .text(cx, cy - 46, 'Domino Plaza', { fontFamily: 'monospace', fontSize: '10px', color: '#ffffff' })
      .setOrigin(0.5, 1)
  }

  drawDominoGateMarker() {
    const cx = DOMINO_GATE_TILE.col * TILE_SIZE + TILE_SIZE / 2
    const cy = DOMINO_GATE_TILE.row * TILE_SIZE + TILE_SIZE / 2
    const glow = this.add.circle(cx, cy, 22, 0x2fd6c9, 0.25)
    const portal = this.add.circle(cx, cy, 14, 0x5cffe0, 0.9)
    this.tweens.add({ targets: [portal, glow], scale: 1.2, duration: 700, yoyo: true, repeat: -1 })
    this.add
      .text(cx, cy - 30, 'Domino City Gate', { fontFamily: 'monospace', fontSize: '10px', color: '#ffffff' })
      .setOrigin(0.5, 1)
  }

  drawRiftPortals() {
    for (const rift of HUNTER_RIFTS) {
      const cx = (rift.tileX + HUNTER_COL_OFF) * TILE_SIZE + TILE_SIZE / 2
      const cy = (rift.tileY + HUNTER_ROW_OFF) * TILE_SIZE + TILE_SIZE / 2
      const glow = this.add.circle(cx, cy, 18, 0x7a2fd6, 0.25)
      const portal = this.add.circle(cx, cy, 12, 0x9a5cff, 0.9)
      this.tweens.add({ targets: [portal, glow], scale: 1.2, duration: 700, yoyo: true, repeat: -1 })
    }
  }

  drawMarriageNpc() {
    const cx = (HUNTER_MARRIAGE_SPOT.tileX + HUNTER_COL_OFF) * TILE_SIZE + TILE_SIZE / 2
    const cy = (HUNTER_MARRIAGE_SPOT.tileY + HUNTER_ROW_OFF) * TILE_SIZE + TILE_SIZE / 2
    new SpriteActor(this, cx, cy, 'npc_marriage', {
      skin: '#f1c27d', hair: '#8b0000', outfit: '#7a2fd6', hairStyle: 'Long',
    })
  }

  drawHiddenHunterNpcs() {
    const [poomSpot, tanSpot] = pickTwoDistinctSpawns()
    this.poomSpawn = { col: poomSpot.tileX + HUNTER_COL_OFF, row: poomSpot.tileY + HUNTER_ROW_OFF }
    this.tanSpawn = { col: tanSpot.tileX + HUNTER_COL_OFF, row: tanSpot.tileY + HUNTER_ROW_OFF }

    new SpriteActor(
      this,
      this.poomSpawn.col * TILE_SIZE + TILE_SIZE / 2,
      this.poomSpawn.row * TILE_SIZE + TILE_SIZE / 2,
      'npc_poom',
      { skin: '#c68642', hair: '#1a1a1a', outfit: '#333333', hairStyle: 'Buzzcut' }
    )
    new SpriteActor(
      this,
      this.tanSpawn.col * TILE_SIZE + TILE_SIZE / 2,
      this.tanSpawn.row * TILE_SIZE + TILE_SIZE / 2,
      'npc_tan',
      { skin: '#e0ac69', hair: '#003f7f', outfit: '#2f9e44', hairStyle: 'Spiky' }
    )
  }

  drawFinanceNamedNpcs() {
    this.financeNamedNpcActors = {}
    for (const b of FINANCE_BUILDINGS) {
      if (!b.npcId) continue
      const npc = FINANCE_NPCS.find((n) => n.id === b.npcId)
      const cx = (b.tiles.c0 + FINANCE_COL_OFF) * TILE_SIZE + ((b.tiles.c1 - b.tiles.c0 + 1) * TILE_SIZE) / 2
      const cy = (b.tiles.r1 + 1 + FINANCE_ROW_OFF) * TILE_SIZE + TILE_SIZE / 2
      const actor = new SpriteActor(this, cx, cy, `npc_${npc.id}`, npc.palette)
      this.financeNamedNpcActors[npc.id] = actor
    }
  }

  drawYugiohFixedNpcs() {
    this.yugiohFixedNpcActors = {}
    for (const spot of YUGIOH_FIXED_NPCS) {
      const npc = YUGIOH_NPCS[spot.npcId]
      const cx = (spot.tileX + YUGIOH_COL_OFF) * TILE_SIZE + TILE_SIZE / 2
      const cy = (spot.tileY + YUGIOH_ROW_OFF) * TILE_SIZE + TILE_SIZE / 2
      const actor = new SpriteActor(this, cx, cy, `npc_${spot.npcId}`, npc.palette)
      this.yugiohFixedNpcActors[spot.npcId] = actor
    }
  }

  drawCynn() {
    const npc = YUGIOH_NPCS.cynn
    const startC = 20 + YUGIOH_COL_OFF
    const startR = 10 + YUGIOH_ROW_OFF
    this.cynnActor = new SpriteActor(this, startC * TILE_SIZE + TILE_SIZE / 2, startR * TILE_SIZE + TILE_SIZE / 2, 'npc_cynn', npc.palette)
    this.cynnActor.wanderTimer = 0
    this.cynnActor.wanderDir = { x: 0, y: 0 }
  }

  spawnHunterAmbientNpcs() {
    const npcs = generateAmbientNpcs('hunter_ambient', 5)
    this.hunterAmbientActors = npcs.map((npc, i) => {
      let r, c
      do {
        r = 1 + Math.floor(Math.random() * (REGION_ROWS - 2))
        c = 1 + Math.floor(Math.random() * (REGION_COLS - 2))
      } while (this.hunterLayout[r][c] !== 'grass' && this.hunterLayout[r][c] !== 'path')

      const actor = new SpriteActor(
        this,
        (c + HUNTER_COL_OFF) * TILE_SIZE + TILE_SIZE / 2,
        (r + HUNTER_ROW_OFF) * TILE_SIZE + TILE_SIZE / 2,
        `npc_ambient_${i}`,
        npc.palette
      )
      actor.wanderTimer = 0
      actor.wanderDir = { x: 0, y: 0 }
      return actor
    })
  }

  spawnFinanceAmbientNpcs() {
    const npcs = generateAmbientNpcs('finance_ambient', 8)
    this.financeAmbientActors = npcs.map((npc, i) => {
      let r, c
      do {
        r = 1 + Math.floor(Math.random() * (REGION_ROWS - 2))
        c = 1 + Math.floor(Math.random() * (REGION_COLS - 2))
      } while (this.financeLayout[r][c] !== 'grass' && this.financeLayout[r][c] !== 'path')

      const actor = new SpriteActor(
        this,
        (c + FINANCE_COL_OFF) * TILE_SIZE + TILE_SIZE / 2,
        (r + FINANCE_ROW_OFF) * TILE_SIZE + TILE_SIZE / 2,
        `npc_fin_ambient_${i}`,
        npc.palette
      )
      actor.npcId = npc.id
      actor.npcName = npc.name
      actor.wanderTimer = 0
      actor.wanderDir = { x: 0, y: 0 }
      actor.dead = false
      return actor
    })
  }

  spawnYugiohAmbientNpcs() {
    const npcs = generateAmbientNpcs('yugioh_ambient', 6)
    this.yugiohAmbientActors = npcs.map((npc, i) => {
      let r, c
      do {
        r = 1 + Math.floor(Math.random() * (REGION_ROWS - 2))
        c = 1 + Math.floor(Math.random() * (REGION_COLS - 2))
      } while (this.yugiohLayout[r][c] !== 'grass' && this.yugiohLayout[r][c] !== 'path')

      const actor = new SpriteActor(
        this,
        (c + YUGIOH_COL_OFF) * TILE_SIZE + TILE_SIZE / 2,
        (r + YUGIOH_ROW_OFF) * TILE_SIZE + TILE_SIZE / 2,
        `npc_ygo_ambient_${i}`,
        npc.palette
      )
      actor.npcId = npc.id
      actor.npcName = npc.name
      actor.wanderTimer = 0
      actor.wanderDir = { x: 0, y: 0 }
      return actor
    })
  }

  // ---------------- player / zones ----------------

  createPlayer() {
    let startCol
    let startRow
    if (this.spawnOverride === 'dominoGate') {
      // Re-entering the overworld from Domino City: drop the player right
      // next to the gate they walked in through, not at their originally-
      // assigned region's default spawn. A couple tiles south of the gate
      // sits in the corridor (always walkable) and just outside the gate's
      // own interact zone, so it doesn't instantly re-trigger entry.
      startCol = DOMINO_GATE_TILE.col
      startRow = DOMINO_GATE_TILE.row + 2
    } else {
      // Focus mode: Hunter's Rift and King of Games are sealed off, so the
      // default (and only) spawn is Financial Anarchy regardless of
      // currentBlockId - reverting just means restoring the blockId branches.
      startCol = 13 + FINANCE_COL_OFF
      startRow = 9 + FINANCE_ROW_OFF
    }

    const player = useGameStore.getState().player
    const palette = resolvePalette(player)
    this.playerActor = new SpriteActor(
      this,
      startCol * TILE_SIZE + TILE_SIZE / 2,
      startRow * TILE_SIZE + TILE_SIZE / 2,
      'player_texture_overworld',
      palette
    )
    this.tileMover = new TileMover({
      actor: this.playerActor,
      tileSize: TILE_SIZE,
      isBlocked: (c, r) => this.isBlockedTile(c, r),
      startCol,
      startRow,
    })
  }

  buildZones() {
    const pad = TILE_SIZE / 2

    const hunterBuildingZones = HUNTER_BUILDINGS.filter((b) => !b.decorative).map((b) => ({
      type: 'building',
      id: b.id,
      label: b.label,
      rect: new Phaser.Geom.Rectangle(
        (b.tiles.c0 + HUNTER_COL_OFF) * TILE_SIZE - pad,
        (b.tiles.r0 + HUNTER_ROW_OFF) * TILE_SIZE - pad,
        (b.tiles.c1 - b.tiles.c0 + 1) * TILE_SIZE + TILE_SIZE,
        (b.tiles.r1 - b.tiles.r0 + 1) * TILE_SIZE + TILE_SIZE
      ),
    }))
    const hunterRiftZones = HUNTER_RIFTS.map((rift) => ({
      type: 'rift',
      id: rift.id,
      label: `Dimensional Rift (Difficulty ${rift.difficulty})`,
      difficulty: rift.difficulty,
      rect: new Phaser.Geom.Rectangle(
        (rift.tileX + HUNTER_COL_OFF) * TILE_SIZE - 8,
        (rift.tileY + HUNTER_ROW_OFF) * TILE_SIZE - 8,
        TILE_SIZE + 16,
        TILE_SIZE + 16
      ),
    }))
    const marriageZone = {
      type: 'marriage',
      id: 'marriageCandidate',
      label: 'Talk',
      rect: new Phaser.Geom.Rectangle(
        (HUNTER_MARRIAGE_SPOT.tileX + HUNTER_COL_OFF) * TILE_SIZE - 8,
        (HUNTER_MARRIAGE_SPOT.tileY + HUNTER_ROW_OFF) * TILE_SIZE - 8,
        TILE_SIZE + 16,
        TILE_SIZE + 16
      ),
    }
    const poomZone = {
      type: 'poom',
      id: 'poom',
      label: 'Talk to Poom',
      rect: new Phaser.Geom.Rectangle(this.poomSpawn.col * TILE_SIZE - 8, this.poomSpawn.row * TILE_SIZE - 8, TILE_SIZE + 16, TILE_SIZE + 16),
    }
    const tanZone = {
      type: 'tan',
      id: 'tan',
      label: 'Talk to Tan',
      rect: new Phaser.Geom.Rectangle(this.tanSpawn.col * TILE_SIZE - 8, this.tanSpawn.row * TILE_SIZE - 8, TILE_SIZE + 16, TILE_SIZE + 16),
    }

    const financeBuildingZones = FINANCE_BUILDINGS.map((b) => ({
      type: 'building',
      id: b.id,
      label: b.label,
      npcId: b.npcId,
      rect: new Phaser.Geom.Rectangle(
        (b.tiles.c0 + FINANCE_COL_OFF) * TILE_SIZE - pad,
        (b.tiles.r0 + FINANCE_ROW_OFF) * TILE_SIZE - pad,
        (b.tiles.c1 - b.tiles.c0 + 1) * TILE_SIZE + TILE_SIZE,
        (b.tiles.r1 - b.tiles.r0 + 1) * TILE_SIZE + TILE_SIZE
      ),
    }))

    const yugiohBuildingZones = YUGIOH_BUILDINGS.map((b) => ({
      type: 'building',
      id: b.id,
      label: b.label,
      npcId: b.npcId,
      rect: new Phaser.Geom.Rectangle(
        (b.tiles.c0 + YUGIOH_COL_OFF) * TILE_SIZE - pad,
        (b.tiles.r0 + YUGIOH_ROW_OFF) * TILE_SIZE - pad,
        (b.tiles.c1 - b.tiles.c0 + 1) * TILE_SIZE + TILE_SIZE,
        (b.tiles.r1 - b.tiles.r0 + 1) * TILE_SIZE + TILE_SIZE
      ),
    }))
    const yugiohFixedNpcZones = YUGIOH_FIXED_NPCS.map((spot) => ({
      type: 'namedNpc',
      npcId: spot.npcId,
      kidnappable: spot.kidnappable,
      label: `Talk to ${YUGIOH_NPCS[spot.npcId].name}`,
      rect: new Phaser.Geom.Rectangle(
        (spot.tileX + YUGIOH_COL_OFF) * TILE_SIZE - 10,
        (spot.tileY + YUGIOH_ROW_OFF) * TILE_SIZE - 10,
        TILE_SIZE + 20,
        TILE_SIZE + 20
      ),
    }))

    const dominoGateZone = {
      type: 'dominoGate',
      id: 'dominoGate',
      label: 'Enter Domino City',
      rect: new Phaser.Geom.Rectangle(
        DOMINO_GATE_TILE.col * TILE_SIZE - 16,
        DOMINO_GATE_TILE.row * TILE_SIZE - 16,
        TILE_SIZE + 32,
        TILE_SIZE + 32
      ),
    }

    // Focus mode: only Financial Anarchy is reachable right now. Hunter's
    // Rift, King of Games, and the Domino City gate are sealed off - their
    // zone-building code above is left intact, untouched, so this is easy
    // to reverse - just add the other zone arrays back to this list:
    // ...hunterBuildingZones, ...hunterRiftZones, marriageZone, poomZone,
    // tanZone, ...yugiohBuildingZones, ...yugiohFixedNpcZones, dominoGateZone
    this.zones = [
      ...financeBuildingZones,
    ]
  }

  // ---------------- region-gated encounters ----------------

  maybeSpawnCriminal() {
    if (!this.bridge) return
    if (this.regionOfGlobal(this.tileMover.col, this.tileMover.row) !== 'hunter') return
    const state = useGameStore.getState()
    if (!state.player.alive) return
    if (Math.random() > 0.35) return
    this.pauseForModal()
    this.bridge.emit('criminalEncounter', {})
  }

  maybeSpawnPolice() {
    if (!this.bridge) return
    const region = this.regionOfGlobal(this.tileMover.col, this.tileMover.row)
    if (region !== 'hunter' && region !== 'finance' && region !== 'yugioh') return
    const state = useGameStore.getState()
    if (!state.player.alive) return
    if (state.wantedLevel <= 0) return
    if (Math.random() > 0.4) return
    this.pauseForModal()
    if (region === 'hunter') this.bridge.emit('policeEncounter', { wantedLevel: state.wantedLevel })
    else this.bridge.emit('financePoliceEncounter', { wantedLevel: state.wantedLevel })
  }

  pauseForModal() {
    this.tileMover.locked = true
    this.playerActor.setMoving(false)
    this.interactionLocked = true
  }

  resumeFromModal() {
    this.interactionLocked = false
  }

  removeFinanceAmbientNpc(npcId) {
    const actor = this.financeAmbientActors.find((a) => a.npcId === npcId)
    if (actor) {
      actor.dead = true
      actor.sprite.setVisible(false)
    }
  }

  findNearbyFinanceAmbientNpc() {
    const px = this.playerActor.x
    const py = this.playerActor.y
    return this.financeAmbientActors.find((a) => !a.dead && Phaser.Math.Distance.Between(px, py, a.x, a.y) < 26)
  }

  findNearbyYugiohAmbientNpc() {
    const px = this.playerActor.x
    const py = this.playerActor.y
    return this.yugiohAmbientActors.find((a) => Phaser.Math.Distance.Between(px, py, a.x, a.y) < 26)
  }

  isNearCynn() {
    return Phaser.Math.Distance.Between(this.playerActor.x, this.playerActor.y, this.cynnActor.x, this.cynnActor.y) < 28
  }

  updateAllAmbientNpcs(delta) {
    for (const actor of this.hunterAmbientActors) wanderActor(actor, delta)
    for (const actor of this.financeAmbientActors) {
      if (!actor.dead) wanderActor(actor, delta)
    }
    for (const actor of this.yugiohAmbientActors) wanderActor(actor, delta)
    wanderActor(this.cynnActor, delta, 26)
  }

  updateRegionTracking() {
    const region = this.regionOfGlobal(this.tileMover.col, this.tileMover.row)
    if (region === 'corridor' || region === 'void') {
      if (this.lastKnownRegion) this.regionLabel.setText(`En route — ${REGION_DISPLAY[this.lastKnownRegion]}`)
      return
    }
    this.regionLabel.setText(REGION_DISPLAY[region] || '')
    if (region !== this.lastKnownRegion) {
      this.lastKnownRegion = region
      this.bridge?.emit('regionChanged', { region })
    }
  }

  updateNearbyZone() {
    const px = this.playerActor.x
    const py = this.playerActor.y
    const staticZone = this.zones.find((z) => Phaser.Geom.Rectangle.Contains(z.rect, px, py))
    const financeAmbient = !staticZone ? this.findNearbyFinanceAmbientNpc() : null
    const yugiohAmbient = !staticZone && !financeAmbient ? this.findNearbyYugiohAmbientNpc() : null
    const nearCynn = !staticZone && !financeAmbient && !yugiohAmbient && this.isNearCynn()

    if (staticZone) {
      this.nearbyZone = staticZone
      this.promptText.setText(staticZone.type === 'building' ? `Press E to enter ${staticZone.label}` : `Press E: ${staticZone.label}`)
    } else if (financeAmbient) {
      this.nearbyZone = { type: 'financeAmbientNpc', npcRef: financeAmbient }
      this.promptText.setText(`Press E to approach ${financeAmbient.npcName}`)
    } else if (yugiohAmbient) {
      this.nearbyZone = { type: 'yugiohAmbientChallenge', npcRef: yugiohAmbient }
      this.promptText.setText(`Press E to challenge ${yugiohAmbient.npcName}`)
    } else if (nearCynn) {
      this.nearbyZone = { type: 'cynn' }
      this.promptText.setText('Press E to approach Cynn')
    } else {
      this.nearbyZone = null
      const region = this.regionOfGlobal(this.tileMover.col, this.tileMover.row)
      this.promptText.setText(
        region === 'hunter' ? 'R: Rob a bystander (raises Wanted Level)' : 'Walk up to a building, gate, or person, then press E'
      )
    }
  }

  triggerInteraction(zone) {
    if (!this.bridge || this.interactionLocked) return
    if (zone.type === 'dominoGate') {
      this.bridge.emit('enterDomino')
      return
    }
    this.pauseForModal()
    if (zone.type === 'financeAmbientNpc') {
      this.bridge.emit('interact', { type: 'ambientNpc', npcId: zone.npcRef.npcId, npcName: zone.npcRef.npcName })
    } else if (zone.type === 'yugiohAmbientChallenge') {
      this.bridge.emit('interact', { type: 'ambientChallenge', npcName: zone.npcRef.npcName })
    } else if (zone.type === 'cynn') {
      this.bridge.emit('interact', { type: 'cynn' })
    } else {
      this.bridge.emit('interact', {
        type: zone.type,
        id: zone.id,
        difficulty: zone.difficulty,
        npcId: zone.npcId,
        kidnappable: zone.kidnappable,
      })
    }
  }

  commitCrime() {
    if (!this.bridge || this.interactionLocked) return
    if (this.regionOfGlobal(this.tileMover.col, this.tileMover.row) !== 'hunter') return
    const store = useGameStore.getState()
    store.addCash(50)
    store.addWantedLevel(1)
    this.promptText.setText('You robbed a bystander. +$50, Wanted Level up!')
  }

  update(time, delta) {
    if (!this.playerActor || !this.tileMover) return

    this.tileMover.locked = this.interactionLocked

    let horiz = null
    if (this.cursors.left.isDown || this.wasd.A.isDown) horiz = 'left'
    else if (this.cursors.right.isDown || this.wasd.D.isDown) horiz = 'right'
    let vert = null
    if (this.cursors.up.isDown || this.wasd.W.isDown) vert = 'up'
    else if (this.cursors.down.isDown || this.wasd.S.isDown) vert = 'down'
    const inputDir = combineDirection(horiz, vert)

    this.tileMover.update(delta, this.interactionLocked ? null : inputDir)
    this.updateAllAmbientNpcs(delta)
    this.updateRegionTracking()

    if (this.interactionLocked) return

    this.updateNearbyZone()

    if (Phaser.Input.Keyboard.JustDown(this.wasd.E) && this.nearbyZone) {
      this.triggerInteraction(this.nearbyZone)
    }
    if (Phaser.Input.Keyboard.JustDown(this.wasd.R)) {
      this.commitCrime()
    }
  }
}
