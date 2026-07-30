// TopDown Vehicles v1.17 (public/assets/packs/) - real per-heading vehicle art.
//
// Why this replaces rotating a single sprite: VehicleActor used to pick a
// heading with atan2 and call sprite.setRotation(). Rotating one drawing of a
// car only looks right if that drawing is a TRUE overhead view; every pack
// tried so far is drawn at a slight downward angle, so a rotated sprite reads
// as a car lying on its side - the "cars look like they're flying" complaint.
// This pack ships a separately drawn sprite for each of 8 compass headings, so
// heading becomes a TEXTURE CHOICE and rotation stays at zero.
//
// Frame ordering is NOT guessed. The pack has explicitly named folders -
// MOVE/NORTH, MOVE/SOUTHEAST, and so on - and each holds a 400x300 sheet that
// is a 4x3 grid of 100x100 frames (a 12-frame drive cycle at 12fps per the
// pack's readme). Verified by viewing MOVE/NORTH's sheet directly: every frame
// in it points north. Using these folders means there is no frame-index
// convention to get wrong, which is the trap the packed 8-direction sheet
// would have posed.
//
// House rule: only frame 0 of each heading is used right now - a static car
// per direction. The other 11 frames are a driving animation that nothing
// currently asks for; wiring it later needs no new files.
// Points at a TRIMMED copy of TopDown Vehicles v1.17, not the raw pack. The
// original is 26,776 PNGs (every type, every colour, every animation frame,
// plus SEPARATED/ duplicates of all of it) - far too much to commit. The
// trimmed folder holds only what this file actually references: the 8
// MOVE/<DIRECTION>/*-sheet.png files for each type/colour in VEHICLE_ART.
// 88 files, ~4.3MB, so a fresh clone runs without the raw pack present.
// Regenerate it by copying those same paths out of the original if a new
// vehicle type or colour is added below.
const PACK_DIR = '/assets/packs/topdown-vehicles'

// The car BODY inside the 100x100 frame, not the frame itself. Measured, not
// guessed: a north-facing sedan's opaque pixels span 38x65, an east-facing one
// 83x40 (alpha-scanned from the real PNGs). The frame is mostly padding, so
// scaling by frame width made cars render at 38 * (40/100) = 15px instead of
// the intended 40 - reported as "car size is too small".
// 38 is the body's NARROW axis, which is consistent across headings; scaling
// off the long axis instead would make cars change size as they turned.
export const VEHICLE_BODY_W = 38

export const VEHICLE_FRAME_W = 100
export const VEHICLE_FRAME_H = 100

// Order matters: index = heading octant, starting at north and going clockwise.
const HEADINGS = ['NORTH', 'NORTHEAST', 'EAST', 'SOUTHEAST', 'SOUTH', 'SOUTHWEST', 'WEST', 'NORTHWEST']

// Our vehicle tierIds -> a folder in the pack. `colour` is omitted for the
// three types the pack ships without colour variants (POLICE, TAXI,
// AMBULANCE), which changes both the folder path and the file prefix.
const VEHICLE_ART = {
  rent_sedan: { type: 'SEDAN TOPDOWN', file: 'SEDAN', colour: 'Blue' },
  buy_tesla: { type: 'SUPERCAR TOPDOWN', file: 'SUPERCAR', colour: 'Red' },
  atmo_police: { type: 'POLICE TOPDOWN', file: 'POLICE' },
  atmo_taxi: { type: 'TAXI TOPDOWN', file: 'TAXI' },
  atmo_ambulance: { type: 'AMBULANCE TOPDOWN', file: 'AMBULANCE' },
  atmo_van: { type: 'VAN TOP DOWN', file: 'VAN', colour: 'White' },
  atmo_suv: { type: 'SUV TOPDOWN', file: 'SUV', colour: 'Black' },
  atmo_sedan_blue: { type: 'SEDAN TOPDOWN', file: 'SEDAN', colour: 'Blue' },
}

// NPC-owned cars pick from these for variety.
export const NPC_VEHICLE_TIERS = ['npc_sedan_red', 'npc_suv_green', 'npc_supercar_yellow', 'npc_van_brown']
VEHICLE_ART.npc_sedan_red = { type: 'SEDAN TOPDOWN', file: 'SEDAN', colour: 'Red' }
VEHICLE_ART.npc_suv_green = { type: 'SUV TOPDOWN', file: 'SUV', colour: 'Green' }
VEHICLE_ART.npc_supercar_yellow = { type: 'SUPERCAR TOPDOWN', file: 'SUPERCAR', colour: 'Yellow' }
VEHICLE_ART.npc_van_brown = { type: 'VAN TOP DOWN', file: 'VAN', colour: 'Brown' }

export const topDownKey = (tierId, heading) => `tdv_${tierId}_${heading}`

function sheetPath(art, heading) {
  const enc = (s) => s.replace(/ /g, '%20')
  const prefix = art.colour ? `${art.colour}_${art.file}` : art.file
  const dir = art.colour ? `${enc(art.type)}/${art.colour}` : enc(art.type)
  return `${PACK_DIR}/${dir}/MOVE/${heading}/${prefix}_CLEAN_${heading}_000-sheet.png`
}

export function preloadTopDownVehicles(scene) {
  for (const [tierId, art] of Object.entries(VEHICLE_ART)) {
    for (const heading of HEADINGS) {
      const key = topDownKey(tierId, heading)
      if (scene.textures.exists(key)) continue
      scene.load.spritesheet(key, sheetPath(art, heading), {
        frameWidth: VEHICLE_FRAME_W,
        frameHeight: VEHICLE_FRAME_H,
      })
    }
  }
}

export function hasTopDownArt(scene, tierId) {
  return Boolean(VEHICLE_ART[tierId]) && scene.textures.exists(topDownKey(tierId, 'NORTH'))
}

// Nearest of the 8 compass headings for a movement vector. Screen space, so
// +y is south. atan2(dx, -dy) puts 0 at north and increases clockwise, which
// matches the HEADINGS order above.
export function headingFor(dx, dy) {
  const angle = Math.atan2(dx, -dy)
  const octant = Math.round(angle / (Math.PI / 4))
  return HEADINGS[((octant % 8) + 8) % 8]
}

// ---------------------------------------------------------------------------
// Per-vehicle performance. `speed` is the same multiplier the vehicle tiers
// already used (higher = faster top speed); `accel` is how quickly it gets
// there, in throttle units per second, where 1 full unit spans standstill to
// top speed. So accel 2 reaches top speed in half a second, accel 0.6 takes
// well over a second.
//
// Before this, every vehicle jumped to its top speed on the frame you got in,
// so a supercar and a van felt identical apart from the final number. Giving
// heavy vehicles a slow ramp is what makes them read as heavy.
const VEHICLE_PERFORMANCE = {
  buy_tesla: { speed: 3.2, accel: 2.0 },
  npc_supercar_yellow: { speed: 3.2, accel: 2.0 },
  atmo_police: { speed: 2.8, accel: 1.4 },
  atmo_ambulance: { speed: 2.4, accel: 0.8 },
  rent_sedan: { speed: 2.2, accel: 1.1 },
  atmo_sedan_blue: { speed: 2.2, accel: 1.1 },
  npc_sedan_red: { speed: 2.2, accel: 1.1 },
  atmo_taxi: { speed: 2.1, accel: 1.1 },
  atmo_suv: { speed: 1.9, accel: 0.7 },
  npc_suv_green: { speed: 1.9, accel: 0.7 },
  atmo_van: { speed: 1.7, accel: 0.6 },
  npc_van_brown: { speed: 1.7, accel: 0.6 },
}

// Speed every vehicle starts from when you pull away, as a fraction of its own
// top speed. Not zero - the tile-stepping mover would stall outright.
export const VEHICLE_LAUNCH_FRACTION = 0.45

export function vehiclePerformance(tierId, fallbackSpeed = 1.8) {
  return VEHICLE_PERFORMANCE[tierId] ?? { speed: fallbackSpeed, accel: 1.0 }
}
