import Phaser from 'phaser'
import { useGameStore } from '../../store/useGameStore'
import { resolvePalette } from '../characterPalettes'
import { SpriteActor } from '../actor'
import { SmoothMover, combineDirection } from '../smoothMover'
import { drawInteriorRoom } from '../tileGen'

export { drawInteriorRoom }

export const TILE_SIZE = 40

export const INTERIOR_COLS = 12
export const INTERIOR_ROWS = 9
export const INTERIOR_SPAWN = { col: 6, row: 5 }
export const INTERIOR_DESK = { c0: 5, r0: 2, c1: 6, r1: 3 }
export const INTERIOR_EXIT = { c0: 5, r0: 7, c1: 7, r1: 8 }

export const INTERIOR_TEMPLATES = {
  cryptoHQ:     { floorA: 0x1a1030, floorB: 0x241640, deskColor: 0x8a5a1f, deskLabel: 'Trading Terminal' },
  tycoonOffice: { floorA: 0x2a2420, floorB: 0x241f1c, deskColor: 0x555555, deskLabel: 'Executive Desk' },
  officeA:      { floorA: 0x1e2430, floorB: 0x1a1f29, deskColor: 0x1f3a5f, deskLabel: 'Front Desk' },
  officeB:      { floorA: 0x241e30, floorB: 0x1f1a29, deskColor: 0x4a3a5f, deskLabel: 'Reception Desk' },
  amenity:      { floorA: 0x201c28, floorB: 0x1b1822, deskColor: 0x5a4a2a, deskLabel: 'Counter' },
  exchange:     { floorA: 0x2a2b45, floorB: 0x252638, deskColor: 0x1f5f3a, deskLabel: 'Trading Floor' },
  casinoFloor:  { floorA: 0x2a1030, floorB: 0x230d28, deskColor: 0x8a1f6a, deskLabel: 'Casino Floor' },
  government:   { floorA: 0x1e2430, floorB: 0x1a1f29, deskColor: 0x5a5a5a, deskLabel: 'Revenue Counter' },
  temple:       { floorA: 0x2a2218, floorB: 0x252010, deskColor: 0xd4a017, deskLabel: 'Altar' },
  merchant:     { floorA: 0x201c28, floorB: 0x1b1822, deskColor: 0x5a4a2a, deskLabel: 'Counter' },
  entertainment:{ floorA: 0x1a0828, floorB: 0x240d30, deskColor: 0x8a1f6a, deskLabel: 'Stage / Counter' },
  underground:  { floorA: 0x121018, floorB: 0x0e0c14, deskColor: 0x6a1f1f, deskLabel: 'Ops Desk' },
  transport:    { floorA: 0x1e2028, floorB: 0x181a22, deskColor: 0x4a6fa5, deskLabel: 'Ticket Counter' },
}

export function wanderActor(actor, delta, speed = 20) {
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
  actor.sprite.setDepth(actor.y)
  actor.shadow.setDepth(actor.y - 1)
}


export function interiorExitZone(cityLabel) {
  return {
    type: 'exit',
    id: 'toOverworld',
    label: `Exit to ${cityLabel}`,
    rect: new Phaser.Geom.Rectangle(
      INTERIOR_EXIT.c0 * TILE_SIZE,
      INTERIOR_EXIT.r0 * TILE_SIZE,
      (INTERIOR_EXIT.c1 - INTERIOR_EXIT.c0 + 1) * TILE_SIZE,
      (INTERIOR_EXIT.r1 - INTERIOR_EXIT.r0 + 1) * TILE_SIZE
    ),
  }
}

export default class BaseTownScene extends Phaser.Scene {
  constructor(sceneKey, config) {
    super(sceneKey)
    this.townConfig = config
    this.bridge = null
    this.nearbyZone = null
    this.interactionLocked = false
    this.zoneObjects = []
    this.currentZoneId = 'overworld'
    this.currentInteriorBuildingId = null
    this.overworldReturnSpawn = config.defaultSpawn || { col: 10, row: 10 }
    this.namedNpcActors = {}
    this.ambientActors = []
  }

  create() {
    useGameStore.getState().initFinanceMarket()

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

    this.createPlayer()
    this.loadZone('overworld', false)

    this.bridge?.emit('regionChanged', { region: this.townConfig.cityId })

    this.bridge?.on('npcKilled', ({ npcId }) => {
      this.namedNpcActors[npcId]?.destroy()
    })
    this.bridge?.on('ambientNpcKilled', ({ npcId }) => {
      this.removeAmbientNpc(npcId)
    })

    this.marketTimer = this.time.addEvent({
      delay: 4000,
      loop: true,
      callback: () => useGameStore.getState().tickFinanceMarket(),
    })
  }

  // --- Abstract / Override points ---
  
  buildOverworldZone() {
    throw new Error('Subclass must implement buildOverworldZone')
  }

  isBlockedOverworldTile(col, row) {
    throw new Error('Subclass must implement isBlockedOverworldTile')
  }

  isBlockedTile(col, row) {
    if (this.currentZoneId === 'buildingInterior') {
      if (col < 0 || col >= INTERIOR_COLS || row < 0 || row >= INTERIOR_ROWS) return true
      const isBorder = row === 0 || col === 0 || row === INTERIOR_ROWS - 1 || col === INTERIOR_COLS - 1
      if (isBorder) return true
      const d = INTERIOR_DESK
      if (col >= d.c0 && col <= d.c1 && row >= d.r0 && row <= d.r1) return true
      return false
    }
    return this.isBlockedOverworldTile(col, row)
  }

  getBuildings() {
    return this.townConfig.buildings || []
  }

  // --- Zone loading ---

  loadZone(zoneId, teleportPlayer = true) {
    this.clearZoneObjects()
    this.currentZoneId = zoneId

    if (zoneId === 'overworld') {
      this.buildOverworldZone()
    } else {
      this.buildGenericInteriorZone(this.currentInteriorBuildingId)
    }

    const cols = zoneId === 'overworld' ? this.townConfig.mapCols : INTERIOR_COLS
    const rows = zoneId === 'overworld' ? this.townConfig.mapRows : INTERIOR_ROWS
    
    this.cameras.main.setBounds(0, 0, cols * TILE_SIZE, rows * TILE_SIZE)
    // Arcade Physics world bounds default to the 800x500 canvas size, not
    // the map size - without this, the player's collideWorldBounds body
    // gets clamped back inside that small box the moment they walk past it
    // (fighting SmoothMover's manual position updates every frame), which
    // reads as "walk, teleport back, get stuck/glitch".
    this.physics.world.setBounds(0, 0, cols * TILE_SIZE, rows * TILE_SIZE)

    if (teleportPlayer) {
      const spawn = zoneId === 'overworld' ? this.overworldReturnSpawn : INTERIOR_SPAWN
      this.tileMover.teleport(spawn.col, spawn.row)
    }
    this.cameras.main.startFollow(this.playerActor.sprite, true)
  }

  clearZoneObjects() {
    for (const obj of this.zoneObjects) obj.destroy()
    this.zoneObjects = []
    for (const id in this.namedNpcActors) this.namedNpcActors[id]?.destroy()
    for (const actor of this.ambientActors) actor.destroy()
    this.namedNpcActors = {}
    this.ambientActors = []
  }

  // --- Building interiors ---

  buildGenericInteriorZone(buildingId) {
    const buildings = this.getBuildings()
    const building = buildings.find((b) => b.id === buildingId)
    
    const templateMap = this.townConfig.interiorTemplateMap || {}
    const templateKey = templateMap[buildingId] || 'amenity'
    const template = INTERIOR_TEMPLATES[templateKey] || INTERIOR_TEMPLATES.amenity

    drawInteriorRoom(this, this.zoneObjects, template)

    this.regionLabel.setText(building ? building.label : 'Interior')

    this.zones = [
      {
        type: 'interiorDesk',
        id: building ? building.id : buildingId,
        npcId: building?.npcId,
        label: template.deskLabel,
        rect: new Phaser.Geom.Rectangle(
          INTERIOR_DESK.c0 * TILE_SIZE - TILE_SIZE / 2,
          INTERIOR_DESK.r0 * TILE_SIZE - TILE_SIZE / 2,
          (INTERIOR_DESK.c1 - INTERIOR_DESK.c0 + 1) * TILE_SIZE + TILE_SIZE,
          (INTERIOR_DESK.r1 - INTERIOR_DESK.r0 + 1) * TILE_SIZE + TILE_SIZE
        ),
      },
      interiorExitZone(this.townConfig.cityLabel || 'City'),
    ]
  }

  // --- Player ---

  createPlayer() {
    const player = useGameStore.getState().player
    const palette = resolvePalette(player)
    this.playerActor = new SpriteActor(
      this,
      this.overworldReturnSpawn.col * TILE_SIZE + TILE_SIZE / 2,
      this.overworldReturnSpawn.row * TILE_SIZE + TILE_SIZE / 2,
      'player_texture',
      palette
    )
    // SmoothMover drop-in replacement!
    this.tileMover = new SmoothMover({
      actor: this.playerActor,
      tileSize: TILE_SIZE,
      isBlocked: (c, r) => this.isBlockedTile(c, r),
      startCol: this.overworldReturnSpawn.col,
      startRow: this.overworldReturnSpawn.row,
      speed: 200,
    })
  }

  buildOverworldZones() {
    const pad = TILE_SIZE / 2
    const buildings = this.getBuildings()
    this.zones = buildings.map((b) => ({
      type: 'building',
      id: b.id,
      label: b.label,
      npcId: b.npcId,
      rect: new Phaser.Geom.Rectangle(
        b.tiles.c0 * TILE_SIZE - pad,
        b.tiles.r0 * TILE_SIZE - pad,
        (b.tiles.c1 - b.tiles.c0 + 1) * TILE_SIZE + TILE_SIZE,
        (b.tiles.r1 - b.tiles.r0 + 1) * TILE_SIZE + TILE_SIZE
      ),
    }))
  }

  // --- Interaction / Encounters ---

  pauseForModal() {
    this.tileMover.locked = true
    this.playerActor.setMoving(false)
    this.interactionLocked = true
  }

  resumeFromModal() {
    this.interactionLocked = false
  }

  removeAmbientNpc(npcId) {
    const actor = this.ambientActors.find((a) => a.npcId === npcId)
    if (actor) {
      actor.dead = true
      actor.sprite.setVisible(false)
    }
  }

  findNearbyAmbientNpc() {
    const px = this.playerActor.x
    const py = this.playerActor.y
    return this.ambientActors.find((a) => !a.dead && Phaser.Math.Distance.Between(px, py, a.x, a.y) < 26)
  }

  updateAllAmbientNpcs(delta) {
    for (const actor of this.ambientActors) {
      if (!actor.dead) wanderActor(actor, delta)
    }
  }

  updateNearbyZone() {
    const px = this.playerActor.x
    const py = this.playerActor.y
    const staticZone = this.zones.find((z) => Phaser.Geom.Rectangle.Contains(z.rect, px, py))
    const ambient = !staticZone ? this.findNearbyAmbientNpc() : null

    if (staticZone) {
      this.nearbyZone = staticZone
      const verb = staticZone.type === 'building' ? 'enter' : null
      this.promptText.setText(verb ? `Press E to ${verb} ${staticZone.label}` : `Press E: ${staticZone.label}`)
    } else if (ambient) {
      this.nearbyZone = { type: 'financeAmbientNpc', npcRef: ambient }
      this.promptText.setText(`Press E to approach ${ambient.npcName}`)
    } else {
      this.nearbyZone = null
      this.promptText.setText(
        this.currentZoneId === 'overworld'
          ? 'Walk up to a building or person, then press E'
          : 'Walk up to the desk, then press E'
      )
    }
  }

  triggerInteraction(zone) {
    if (!this.bridge || this.interactionLocked) return
    
    if (zone.type === 'exit') {
      this.loadZone('overworld')
      return
    }
    
    if (zone.type === 'building') {
      // Inter-city travel (trainStation -> TownTravelUI) is disabled while
      // only Tokyo is a live map - Kyoto/Osaka/Sapporo are kept as dormant
      // scenes/data rather than deleted, so this can be re-enabled later by
      // restoring the special case removed here. The train station building
      // itself stays on the map and just opens a normal generic interior.
      const buildings = this.getBuildings()
      const building = buildings.find((b) => b.id === zone.id)
      this.overworldReturnSpawn = {
        col: Math.round((building.tiles.c0 + building.tiles.c1) / 2),
        row: building.tiles.r1 + 1,
      }
      this.currentInteriorBuildingId = zone.id
      this.loadZone('buildingInterior')
      return
    }
    
    this.pauseForModal()
    if (zone.type === 'interiorDesk') {
      this.bridge.emit('interact', { type: 'building', id: zone.id, npcId: zone.npcId })
    } else if (zone.type === 'financeAmbientNpc') {
      this.bridge.emit('interact', { type: 'ambientNpc', npcId: zone.npcRef.npcId, npcName: zone.npcRef.npcName })
    }
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
    this.updateAllAmbientNpcs(delta)

    if (this.interactionLocked) return

    this.updateNearbyZone()

    if (Phaser.Input.Keyboard.JustDown(this.wasd.E) && this.nearbyZone) {
      this.triggerInteraction(this.nearbyZone)
    }
  }
}
