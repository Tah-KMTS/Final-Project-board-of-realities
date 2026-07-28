import { TITAN_ROUTINES } from '../features/agents/agentMovementEngine'
import { getDisposition } from '../features/agents/characterDispositions'

// Kenney Pixel Vehicle Pack (CC0) atlas - additive vehicle art, independent of
// USE_PROCEDURAL_GRAPHICS (tileGen.js/spriteGen.js's terrain+player switch).
// The vehicle feature has no procedural fallback, so this loader always runs
// regardless of that flag.
export const VEHICLE_ATLAS_KEY = 'kenney_vehicles'
const ATLAS_DIR = '/assets/packs/kenney_pixel-vehicle-pack/Spritesheet'
export const VEHICLE_ATLAS_PNG_URL = `${ATLAS_DIR}/spritesheet_cars.png`
export const VEHICLE_ATLAS_XML_URL = `${ATLAS_DIR}/spritesheet_cars.xml`

// House rule: EVERY frame in spritesheet_cars.xml is a flat SIDE-VIEW icon
// (confirmed by cropping e.g. sedan.png at its declared x/y/w/h=29x13 -
// wider than tall, windshield + door line + two wheels along the bottom,
// like a simple side-elevation icon, not a top-down sprite at all). Rotating
// a side-view icon to face up/down/diagonal (VehicleActor.setFacing/
// faceVector) is exactly what produced the reported "cars look like they're
// flying" bug - there is no rotation-math fix for that, the source art is
// the wrong shape. This atlas is kept ONLY for the bike tier and the
// hand-scattered atmosphere props (ambulance/police - see
// OverworldScene.js's spawnWorldVehicles) that don't have a true top-down
// equivalent available; every sprite that actually rotates during normal
// play (the two purchasable/rentable CAR tiers below, and every roaming
// NPC's car) has been moved to PICO8_ATLAS_KEY instead - see below.
//
// Call from a scene's preload() - always queues both atlases (never gated on
// USE_PROCEDURAL_GRAPHICS; see file header).
export function preloadVehicleAssets(scene) {
  if (!scene.textures.exists(VEHICLE_ATLAS_KEY)) {
    scene.load.atlasXML(VEHICLE_ATLAS_KEY, VEHICLE_ATLAS_PNG_URL, VEHICLE_ATLAS_XML_URL)
  }
  if (!scene.textures.exists(PICO8_ATLAS_KEY)) {
    // Plain image, not a spritesheet: the true top-down cars in this pack
    // are 1 tile wide x 2 tiles tall (8x16 source px - see ensurePico8CarFrames),
    // taller than Phaser's fixed-grid spritesheet loader can frame on its
    // own, so the sheet is loaded whole and the car frames are carved out
    // with Texture.add() once it's ready (call ensurePico8CarFrames from
    // create(), after preload's queued loads have actually landed).
    scene.load.image(PICO8_ATLAS_KEY, PICO8_ATLAS_PNG_URL)
  }
}

// Kenney Pico-8 City (CC0). Real 8px-grid tile sheet (packed, 0 spacing -
// confirmed via scratchpad/tileview.cjs's labeled contact-sheet render).
// Region cols 15-17, rows 11-12 (idx 279/303, 280/304, 281/305) is a set of
// THREE color variants of a car drawn as two stacked 8x8 tiles: the top tile
// shows a windshield + roof with the car's nose at the top edge, the bottom
// tile shows the rear window + wheel wells - i.e. genuinely top-down,
// natively facing up/north, symmetric left-right, wheels visible at all
// four corners. Visually confirmed at 10x zoom (assemble mode) before
// wiring this in - this is the pack the "flying cars" bug needed, not
// kenney_roguelike-modern-city (its own small car-icon cluster at idx
// ~808-813/845-850 was independently re-checked here and is ALSO a
// side/3-quarter illustrated car with a visible windshield+mirror bump, not
// top-down - ruled out).
export const PICO8_ATLAS_KEY = 'kenney_pico8_city'
const PICO8_DIR = '/assets/packs/kenney_pico-8-city/Tilemap'
export const PICO8_ATLAS_PNG_URL = `${PICO8_DIR}/tilemap_packed.png`
const PICO8_TILE = 8

// col/row of the TOP tile of each 1x2 car; the bottom tile is always
// directly below (row+1) in this pack's layout.
const PICO8_CAR_TOP = {
  car_red: { col: 15, row: 11 },
  car_green: { col: 16, row: 11 },
  car_pink: { col: 17, row: 11 },
}

// Registers the 3 car names above as real Phaser texture frames (a plain
// 8x16 crop spanning the tile above + the tile below) on the already-loaded
// PICO8_ATLAS_KEY image. Idempotent (checks Texture.has first) so calling
// this from every scene create() is safe. Must run after the image finishes
// loading - call from create(), not preload().
export function ensurePico8CarFrames(scene) {
  const texture = scene.textures.get(PICO8_ATLAS_KEY)
  for (const [name, { col, row }] of Object.entries(PICO8_CAR_TOP)) {
    if (texture.has(name)) continue
    texture.add(name, 0, col * PICO8_TILE, row * PICO8_TILE, PICO8_TILE, PICO8_TILE * 2)
  }
}

// Rentable/purchasable transit_hub options (interactiveLocations.js) -> which
// atlas frame represents that tier. No per-tier `scale` here anymore -
// VehicleActor derives it from each frame's own native width against one
// shared UNIFORM_VEHICLE_WIDTH target, which is what actually fixed the
// "some vehicles are too small" report (hand-picked scales per tier is
// exactly how that inconsistency happened in the first place).
// rent_bike stays on the old illustrated atlas: bikes are small enough on
// screen that the side-view/rotation mismatch is far less noticeable than on
// a car, and the pico-8 pack has no bike sprite to replace it with (not
// re-litigated further - see file header for why cars specifically moved).
export const TIER_SPRITES = {
  rent_bike: { spriteName: 'cycle.png', atlasKey: VEHICLE_ATLAS_KEY },
  rent_sedan: { spriteName: 'car_pink', atlasKey: PICO8_ATLAS_KEY },
  buy_tesla: { spriteName: 'car_red', atlasKey: PICO8_ATLAS_KEY },
}

function hashId(id) {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0
  return h
}

// True top-down pico-8 car frames (see ensurePico8CarFrames) - only 3 color
// variants exist in the pack, down from the old atlas's 5-name pool, but
// every one of them actually reads as a car instead of "flying" while a
// roaming titan/socialite drives between buildings.
const NPC_CAR_POOL = ['car_red', 'car_green', 'car_pink']

// House rule: gating car ownership to every one of the 88 characters would
// just be visual noise (most crime-syndicate/government figures have no
// reason to be seen driving). Ownership is restricted to titans (have a
// TITAN_ROUTINES entry - the wealthy business-mogul roster) OR characters
// whose deterministic disposition tier (characterDispositions.js) is
// 'socialite' - the go-out/be-seen personality type. Sprite choice is
// id-hashed into a small confirmed-in-atlas pool so the same character
// always drives the same car without every qualifying character cloning one
// sprite.
// Deterministic top-down pico8 frame for anything that isn't the 2
// purchasable hub tiers or an NPC (see npcVehicleFor below) but still
// rotates during normal play - the atmosphere/street vehicles spawned by
// OverworldScene.spawnWorldVehicles (police cruiser, ambulance, taxi, van,
// suv, parked sedan). These used to stay on the old illustrated
// VEHICLE_ATLAS_KEY under the assumption that a parked/atmosphere car
// "doesn't rotate during normal play" - false, since every one of them is
// stealable and driveable (spawnWorldVehicles marks them `owned` once
// stolen/bought), which is exactly the rotation case this file's header
// already diagnosed as broken for side-view art. Only 3 top-down colors
// exist in the pico-8 pack (see NPC_CAR_POOL) - not enough for 6 visually
// distinct vehicle types, so flavor (Police Cruiser vs Ambulance vs Taxi...)
// is carried by the `name` field instead of a unique sprite per type, same
// tradeoff NPC_CAR_POOL already makes for the 88-character roster.
export function pico8CarFrameFor(seed) {
  return NPC_CAR_POOL[hashId(seed) % NPC_CAR_POOL.length]
}

export function npcVehicleFor(character) {
  if (!character?.id) return null
  const isTitan = Boolean(TITAN_ROUTINES[character.id.toLowerCase()])
  const isSocialite = getDisposition(character.id)?.tier === 'socialite'
  if (!isTitan && !isSocialite) return null
  const spriteName = NPC_CAR_POOL[hashId(character.id) % NPC_CAR_POOL.length]
  // No scale override here (see VehicleActor's UNIFORM_VEHICLE_WIDTH house
  // rule) - this used to hardcode 5, which is what the pico-8 frame's own
  // native-width auto-scale already resolves to, but `scale` is now a
  // MULTIPLIER on top of that auto-scale, not an absolute value, so passing
  // 5 here would have compounded into a 200px-wide car.
  return { spriteName, atlasKey: PICO8_ATLAS_KEY }
}

// Canonical shared car-theft tool - shape matches useGameStore's inventory
// items (id/name/description/sellValue, see InventoryModal.jsx), so the
// equipment method that wires this into the store/shop can addItem(THEFT_ITEM)
// directly.
export const THEFT_ITEM = {
  id: 'slim_jim',
  name: 'Slim Jim Lockpick',
  type: 'tool',
  description: 'A thin steel strip slid past a car window seal to yank the lock rod - pops a car door without a key.',
  sellValue: 15,
}
