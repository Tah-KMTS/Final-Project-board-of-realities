import Phaser from 'phaser'
import { useGameStore } from '../../store/useGameStore'
import { resolvePalette } from '../characterPalettes'
import { SpriteActor } from '../actor'
import { preloadPlayerSheet } from '../spriteGen'
import { TileMover, combineDirection } from '../tileMover'
import {
  preloadTerrainAssets,
  buildTerrainLayer,
  TERRAIN_TILE_INDEX,
  placeTree,
  placeFlower,
  placeBuildingFacade,
  addScreenVignette,
} from '../tileGen'
import { getActiveNpcsAt } from '../../features/domino/npcRoster'

const TILE_SIZE = 40

// Six zones per the GDD's Module 1 master map. `streets` is the hub;
// everything else connects only back to it (star topology, not a single
// continuous walkable map like the other 3 worlds - Domino City's layout
// is genuinely different, so it gets its own zone-switching scene instead
// of reusing WorldScene's one-big-map pattern).
const ZONES = {
  playersRoom: { cols: 12, rows: 9, indoor: true, spawn: { col: 6, row: 7 } },
  streets: { cols: 20, rows: 14, indoor: false, spawn: { col: 10, row: 12 } },
  kameShop: { cols: 12, rows: 9, indoor: true, spawn: { col: 6, row: 7 } },
  domiPark: { cols: 14, rows: 10, indoor: false, spawn: { col: 7, row: 8 } },
  townSquare: { cols: 14, rows: 10, indoor: false, spawn: { col: 7, row: 8 } },
  kcTower: { cols: 12, rows: 9, indoor: true, spawn: { col: 6, row: 7 } },
}

export default class DominoWorldScene extends Phaser.Scene {
  constructor() {
    super('DominoWorldScene')
    this.bridge = null
    this.nearbyZone = null
    this.interactionLocked = false
    this.zoneObjects = []
    this.npcActors = []
    this.currentZoneId = 'playersRoom'
  }

  preload() {
    preloadPlayerSheet(this)
    preloadTerrainAssets(this)
  }

  create() {
    this.cursors = this.input.keyboard.createCursorKeys()
    this.wasd = this.input.keyboard.addKeys('W,A,S,D,E')

    this.promptText = this.add
      .text(320, 460, '', { fontFamily: 'monospace', fontSize: '14px', color: '#ffe066' })
      .setScrollFactor(0)
      .setOrigin(0.5)
      .setDepth(2000)
    this.zoneLabel = this.add
      .text(10, 10, '', { fontFamily: 'monospace', fontSize: '14px', color: '#c9a8ff' })
      .setScrollFactor(0)
      .setDepth(2000)

    const startZone = useGameStore.getState().world4.currentZone || 'playersRoom'
    this.createPlayer(startZone)
    addScreenVignette(this)
    this.loadZone(startZone, false)
  }

  isBlockedTile(col, row) {
    const zone = ZONES[this.currentZoneId]
    if (col < 0 || col >= zone.cols || row < 0 || row >= zone.rows) return true
    if (this.layout[row][col] === 'wall') return true
    for (const b of this.buildings) {
      if (col >= b.c0 && col <= b.c1 && row >= b.r0 && row <= b.r1) return true
    }
    return false
  }

  createPlayer(zoneId) {
    const player = useGameStore.getState().player
    const palette = resolvePalette(player)
    const spawn = ZONES[zoneId].spawn
    const { x, y } = { x: spawn.col * TILE_SIZE + TILE_SIZE / 2, y: spawn.row * TILE_SIZE + TILE_SIZE / 2 }
    this.playerActor = new SpriteActor(this, x, y, 'player_texture_domino', palette)
    // createPlayer() runs before loadZone(), so the zone's floor/building
    // Graphics objects are added to the display list AFTER the player and
    // (at the same default depth 0) would render on top of it, hiding it
    // completely. Explicit depth keeps the player visible above terrain
    // regardless of add-order across zone switches.
    this.playerActor.sprite.setDepth(this.playerActor.y)
    this.playerActor.shadow.setDepth(this.playerActor.y - 1)
    this.tileMover = new TileMover({
      actor: this.playerActor,
      tileSize: TILE_SIZE,
      isBlocked: (c, r) => this.isBlockedTile(c, r),
      startCol: spawn.col,
      startRow: spawn.row,
    })
  }

  clearZoneObjects() {
    for (const obj of this.zoneObjects) obj.destroy()
    this.zoneObjects = []
    for (const actor of this.npcActors) actor.destroy()
    this.npcActors = []
  }

  loadZone(zoneId, teleportPlayer = true) {
    this.clearZoneObjects()
    this.currentZoneId = zoneId
    useGameStore.getState().setDominoZone(zoneId)
    const zone = ZONES[zoneId]
    this.zoneLabel.setText(this.zoneDisplayName(zoneId))

    this.layout = this.buildLayout(zoneId)
    this.buildings = []
    this.zones = []

    if (zoneId === 'playersRoom') this.buildPlayersRoom()
    else if (zoneId === 'streets') this.buildStreets()
    else if (zoneId === 'kameShop') this.buildKameShop()
    else if (zoneId === 'domiPark') this.buildDomiPark()
    else if (zoneId === 'townSquare') this.buildTownSquare()
    else if (zoneId === 'kcTower') this.buildKcTower()

    this.spawnScheduledNpcs(zoneId)

    if (teleportPlayer) this.tileMover.teleport(zone.spawn.col, zone.spawn.row)
    this.cameras.main.setBounds(0, 0, zone.cols * TILE_SIZE, zone.rows * TILE_SIZE)
    this.cameras.main.startFollow(this.playerActor.sprite, true)
  }

  zoneDisplayName(zoneId) {
    if (zoneId === '__overworld__') return 'the Overworld'
    return {
      playersRoom: "Your Room", streets: 'The Streets', kameShop: 'Kame Game Shop',
      domiPark: 'Domino Park', townSquare: 'Town Square', kcTower: 'KC Tower',
    }[zoneId]
  }

  buildLayout(zoneId) {
    const { cols, rows, indoor } = ZONES[zoneId]
    const layout = []
    for (let r = 0; r < rows; r++) {
      const row = []
      for (let c = 0; c < cols; c++) {
        const border = r === 0 || c === 0 || r === rows - 1 || c === cols - 1
        row.push(border ? 'wall' : indoor ? 'floor' : 'grass')
      }
      layout.push(row)
    }
    return layout
  }

  // Outdoor zones ('grass'/'path' cells) get the real Cute Fantasy terrain
  // layer; indoor zones keep their procedural checkerboard floor (no pack
  // asset for that), and border 'wall' cells stay a flat Graphics fill in
  // both cases (same reasoning as OverworldScene's fallback pass).
  drawGround(zoneId) {
    const { cols, rows, indoor } = ZONES[zoneId]
    if (!indoor) {
      const terrainLayer = buildTerrainLayer(this, cols, rows, TILE_SIZE, (r, c) => {
        const t = this.layout[r][c]
        if (t === 'grass') return TERRAIN_TILE_INDEX.grass
        if (t === 'path') return TERRAIN_TILE_INDEX.path
        return null
      })
      this.zoneObjects.push(terrainLayer)
    }
    const graphics = this.add.graphics()
    this.zoneObjects.push(graphics)
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = c * TILE_SIZE
        const y = r * TILE_SIZE
        if (this.layout[r][c] === 'wall') {
          graphics.fillStyle(0x1a1a2e, 1)
          graphics.fillRect(x, y, TILE_SIZE, TILE_SIZE)
        } else if (indoor) {
          graphics.fillStyle((r + c) % 2 === 0 ? 0x2a2b45 : 0x252638, 1)
          graphics.fillRect(x, y, TILE_SIZE, TILE_SIZE)
        }
      }
    }
  }

  addInteractable(id, label, c0, r0, c1, r1, type = 'domino') {
    this.buildings.push({ c0, r0, c1, r1 })
    const x = c0 * TILE_SIZE
    const y = r0 * TILE_SIZE
    const w = (c1 - c0 + 1) * TILE_SIZE
    const h = (r1 - r0 + 1) * TILE_SIZE
    this.zoneObjects.push(...placeBuildingFacade(this, x, y, w, h, 0x3a2f5f))
    const text = this.add.text(x + w / 2, y - 12, label, { fontFamily: 'monospace', fontSize: '10px', color: '#ffffff' }).setOrigin(0.5, 1)
    text.setDepth(y + h + 1)
    this.zoneObjects.push(text)
    this.zones.push({
      type, id, label: `Press E: ${label}`,
      rect: new Phaser.Geom.Rectangle(x - 8, y - 8, w + 16, h + 16),
    })
  }

  addExitZone(id, targetZoneId, c0, r0, c1, r1) {
    this.zones.push({
      type: 'exit', id, targetZoneId, label: `Press E: Go to ${this.zoneDisplayName(targetZoneId)}`,
      rect: new Phaser.Geom.Rectangle(c0 * TILE_SIZE, r0 * TILE_SIZE, (c1 - c0 + 1) * TILE_SIZE, (r1 - r0 + 1) * TILE_SIZE),
    })
  }

  buildPlayersRoom() {
    this.drawGround('playersRoom')
    this.addInteractable('bed', 'Bed', 2, 2, 3, 3, 'domino')
    this.addInteractable('pc', 'PC', 8, 2, 9, 3, 'domino')
    this.addInteractable('savePoint', 'Save Point', 5, 5, 6, 5, 'domino')
    this.addExitZone('toStreets', 'streets', 5, 7, 7, 8)
  }

  buildStreets() {
    // Mark the road cells as 'path' in the layout before drawGround()
    // builds the terrain layer, so the crossing street renders as real
    // path tiles instead of grass.
    for (let c = 1; c < 19; c++) this.layout[6][c] = 'path'
    for (let r = 1; r < 13; r++) this.layout[r][10] = 'path'
    this.drawGround('streets')

    this.addExitZone('toPlayersRoom', 'playersRoom', 9, 1, 11, 2)
    this.addExitZone('toKameShop', 'kameShop', 1, 8, 3, 9)
    this.addExitZone('toDomiPark', 'domiPark', 16, 1, 18, 2)
    this.addExitZone('toTownSquare', 'townSquare', 1, 1, 3, 2)
    this.addExitZone('toKcTower', 'kcTower', 16, 8, 18, 9)
    // The gate back out to the shared overworld (Hunter's Rift / Financial
    // Anarchy / King of Games) - Domino City itself stays a separate
    // star-topology scene, entered/exited like a big building.
    this.addExitZone('toOverworld', '__overworld__', 9, 11, 11, 12)
  }

  buildKameShop() {
    this.drawGround('kameShop')
    this.addInteractable('shopCounter', 'Shop Counter', 5, 2, 6, 3, 'domino')
    this.addExitZone('toStreets', 'streets', 5, 7, 7, 8)
  }

  buildDomiPark() {
    this.drawGround('domiPark')
    for (let i = 0; i < 10; i++) {
      const r = 1 + Math.floor(Math.random() * 8)
      const c = 1 + Math.floor(Math.random() * 12)
      if (this.layout[r]?.[c] !== 'grass') continue
      const cx = c * TILE_SIZE + TILE_SIZE / 2
      const cy = r * TILE_SIZE + TILE_SIZE / 2
      const objs = Math.random() < 0.5 ? placeTree(this, cx, cy) : placeFlower(this, cx, cy)
      this.zoneObjects.push(...objs)
    }
    const fountain = this.add.circle(7 * TILE_SIZE, 4 * TILE_SIZE, 30, 0x2f6fb5)
    this.zoneObjects.push(fountain)
    this.addExitZone('toStreets', 'streets', 6, 8, 8, 9)
  }

  buildTownSquare() {
    this.drawGround('townSquare')
    this.addInteractable('eventBoard', 'Event Board', 5, 2, 6, 3, 'domino')
    this.addExitZone('toStreets', 'streets', 6, 8, 8, 9)
  }

  buildKcTower() {
    this.drawGround('kcTower')
    this.addInteractable('securityGate', 'Security Gate', 5, 2, 6, 2, 'domino')
    this.addInteractable('elevator', 'Elevator', 5, 5, 6, 6, 'domino')
    this.addExitZone('toStreets', 'streets', 5, 7, 7, 8)
  }

  spawnScheduledNpcs(zoneId) {
    const { day, timeBlock } = useGameStore.getState().world4.calendar
    const npcs = getActiveNpcsAt(zoneId, day, timeBlock)
    const spots = [
      { col: 3, row: 4 }, { col: Math.floor(ZONES[zoneId].cols / 2), row: 4 },
      { col: ZONES[zoneId].cols - 4, row: Math.floor(ZONES[zoneId].rows / 2) },
    ]
    npcs.slice(0, spots.length).forEach((npc, i) => {
      const spot = spots[i]
      const actor = new SpriteActor(this, spot.col * TILE_SIZE + TILE_SIZE / 2, spot.row * TILE_SIZE + TILE_SIZE / 2, `npc_domino_${npc.NPC_ID}`, npc.palette)
      actor.sprite.setDepth(actor.y)
      actor.shadow.setDepth(actor.y - 1)
      this.npcActors.push(actor)
      this.zones.push({
        type: 'dominoNpc', id: npc.NPC_ID, npc, label: `Talk to ${npc.Name}`,
        rect: new Phaser.Geom.Rectangle(spot.col * TILE_SIZE - 8, spot.row * TILE_SIZE - 8, TILE_SIZE + 16, TILE_SIZE + 16),
      })
    })
  }

  pauseForModal() {
    this.tileMover.locked = true
    this.playerActor.setMoving(false)
    this.interactionLocked = true
  }

  resumeFromModal() {
    this.interactionLocked = false
  }

  updateNearbyZone() {
    const px = this.playerActor.x
    const py = this.playerActor.y
    const zone = this.zones.find((z) => Phaser.Geom.Rectangle.Contains(z.rect, px, py))
    this.nearbyZone = zone || null
    this.promptText.setText(zone ? zone.label : '')
  }

  triggerInteraction(zone) {
    if (!this.bridge) return
    if (zone.type === 'exit') {
      if (zone.targetZoneId === '__overworld__') {
        this.bridge.emit('exitDomino')
        return
      }
      this.loadZone(zone.targetZoneId)
      return
    }
    this.pauseForModal()
    this.bridge.emit('interact', { type: zone.type, id: zone.id, zoneId: this.currentZoneId, npc: zone.npc })
  }

  update(time, delta) {
    if (!this.playerActor || !this.tileMover) return
    this.tileMover.locked = this.interactionLocked
    this.playerActor.sprite.setDepth(this.playerActor.y)
    this.playerActor.shadow.setDepth(this.playerActor.y - 1)

    let horiz = null
    if (this.cursors.left.isDown || this.wasd.A.isDown) horiz = 'left'
    else if (this.cursors.right.isDown || this.wasd.D.isDown) horiz = 'right'
    let vert = null
    if (this.cursors.up.isDown || this.wasd.W.isDown) vert = 'up'
    else if (this.cursors.down.isDown || this.wasd.S.isDown) vert = 'down'
    const inputDir = combineDirection(horiz, vert)

    this.tileMover.update(delta, this.interactionLocked ? null : inputDir)
    for (const actor of this.npcActors) {
      actor.update(delta)
      actor.sprite.setDepth(actor.y)
      actor.shadow.setDepth(actor.y - 1)
    }

    if (this.interactionLocked) return
    this.updateNearbyZone()

    if (Phaser.Input.Keyboard.JustDown(this.wasd.E) && this.nearbyZone) {
      this.triggerInteraction(this.nearbyZone)
    }
  }
}
