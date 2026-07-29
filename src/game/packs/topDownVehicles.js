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
const PACK_DIR = '/assets/packs/TopDown%20Vehicles%20v1.17'

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
