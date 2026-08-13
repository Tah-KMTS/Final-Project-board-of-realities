// Redline Rally - the race simulation behind the Game Center's rally cabinet
// (RedlineRallyModal.jsx draws it; this file never touches the DOM so
// production/simulateRedlineRally.mjs can run whole races headlessly, same
// split as runAndGunEngine.js / RunAndGunModal.jsx).
//
// The track is a CENTRELINE, not a tile grid. The pack's road corners are
// quarter-annuli on a 555px box while its straights are 512px, so they never
// shared a uniform grid - but the plain road fill (Tile_05) is perfectly
// seamless, so the road is instead stroked as a thick textured line along an
// arbitrary curve. That one decision buys almost everything below for free:
//
//   * surface test   - |lateral offset from the centreline| vs half-width
//   * lap progress   - arc length `s` along the centreline
//   * live placings  - sort by (lap, s); no trigger volumes needed
//   * the AI's line  - the centreline IS the racing line
//
// Everything is integrated at a fixed 60Hz from step(); the renderer is free
// to interpolate but never drives the simulation.

// Extension is explicit (unlike most imports in this codebase, where Vite
// resolves it) so that plain Node can load this module - which is what lets
// production/checkRedlineTracks.mjs and simulateRedlineRally.mjs run the real
// simulation headlessly, same arrangement as runAndGunEngine.js.
import { BALANCE as B, TRACKS } from './redlineRallyTracks.js'

export const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v)
const TAU = Math.PI * 2

// Shortest signed angle from a to b, in (-PI, PI].
function angleDelta(a, b) {
  let d = (b - a) % TAU
  if (d > Math.PI) d -= TAU
  if (d < -Math.PI) d += TAU
  return d
}

// ---------------------------------------------------------------------------
// Centreline
// ---------------------------------------------------------------------------

// Closed Catmull-Rom through the track's control points, resampled to uniform
// spacing. Catmull-Rom (rather than Bezier) because it passes THROUGH its
// control points, so a track is authored by dropping points where the road
// should actually go instead of solving for handles. Uniform spacing is what
// makes every lookup below cheap: index <-> arc length is just a multiply.
export function buildCenterline(points, spacing = B.CENTRELINE_SPACING) {
  const n = points.length
  const at = (i) => points[((i % n) + n) % n]

  // 1. dense sample
  const dense = []
  const PER_SEG = 24
  for (let i = 0; i < n; i++) {
    const p0 = at(i - 1), p1 = at(i), p2 = at(i + 1), p3 = at(i + 2)
    for (let k = 0; k < PER_SEG; k++) {
      const t = k / PER_SEG
      const t2 = t * t
      const t3 = t2 * t
      dense.push({
        x: 0.5 * ((2 * p1.x) + (-p0.x + p2.x) * t +
          (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 +
          (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
        y: 0.5 * ((2 * p1.y) + (-p0.y + p2.y) * t +
          (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 +
          (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3),
      })
    }
  }

  // 2. cumulative arc length around the closed loop
  const cum = [0]
  for (let i = 1; i <= dense.length; i++) {
    const a = dense[i - 1], b = dense[i % dense.length]
    cum.push(cum[i - 1] + Math.hypot(b.x - a.x, b.y - a.y))
  }
  const total = cum[dense.length]

  // 3. resample at uniform spacing
  const count = Math.max(8, Math.round(total / spacing))
  const ds = total / count
  const xs = new Float64Array(count)
  const ys = new Float64Array(count)
  let cursor = 0
  for (let i = 0; i < count; i++) {
    const target = i * ds
    while (cursor < dense.length - 1 && cum[cursor + 1] < target) cursor++
    const segLen = cum[cursor + 1] - cum[cursor] || 1
    const t = (target - cum[cursor]) / segLen
    const a = dense[cursor], b = dense[(cursor + 1) % dense.length]
    xs[i] = a.x + (b.x - a.x) * t
    ys[i] = a.y + (b.y - a.y) * t
  }

  // 4. tangents and curvature, both wrapped around the loop
  const tang = new Float64Array(count)
  for (let i = 0; i < count; i++) {
    const a = (i - 1 + count) % count, b = (i + 1) % count
    tang[i] = Math.atan2(ys[b] - ys[a], xs[b] - xs[a])
  }
  // |heading change| per unit length - the AI brakes on this, and
  // checkRedlineTracks.mjs asserts no corner is tighter than the cars can take.
  const curv = new Float64Array(count)
  for (let i = 0; i < count; i++) {
    const b = (i + 1) % count
    curv[i] = Math.abs(angleDelta(tang[i], tang[b])) / ds
  }

  return { xs, ys, tang, curv, count, ds, total }
}

// Nearest point on the centreline. `hint` is the caller's last index: a car
// moves a fraction of the loop per frame, so searching a window around where
// it was is both far cheaper than a full scan AND more correct - on a track
// that runs back alongside itself, a global nearest-point search can snap a
// car onto the wrong straight and teleport its lap progress.
export function nearestOnCenterline(cl, x, y, hint = -1) {
  const { xs, ys, count, ds } = cl
  let lo = 0, hi = count
  if (hint >= 0) {
    const w = B.TRACK_SEARCH_WINDOW
    lo = hint - w
    hi = hint + w
  }
  let bestI = 0, bestD = Infinity
  for (let k = lo; k < hi; k++) {
    const i = ((k % count) + count) % count
    const d = (xs[i] - x) ** 2 + (ys[i] - y) ** 2
    if (d < bestD) { bestD = d; bestI = i }
  }
  // Signed lateral offset: positive = left of travel direction.
  const t = cl.tang[bestI]
  const dx = x - xs[bestI], dy = y - ys[bestI]
  const lateral = -Math.sin(t) * dx + Math.cos(t) * dy
  // Refine s along the tangent so progress is smooth between samples.
  const along = Math.cos(t) * dx + Math.sin(t) * dy
  return {
    idx: bestI,
    s: (bestI * ds + along + cl.total) % cl.total,
    lateral,
    dist: Math.sqrt(bestD),
  }
}

// ---------------------------------------------------------------------------
// Race setup
// ---------------------------------------------------------------------------

const SILENT = {
  engine: () => {}, boost: () => {}, hit: () => {}, pickup: () => {},
  spin: () => {}, lap: () => {}, finish: () => {}, countdown: () => {},
}

// Hazards, pickups and decor are authored as { at, lat } - a fraction around
// the lap plus a lateral offset - rather than as world coordinates. This is
// where that becomes real geometry. Anything with |lat| <= halfWidth is on
// the road BY CONSTRUCTION, so a barrel cannot drift into the scenery when a
// corner is reshaped, and checkRedlineTracks.mjs only has to check intent
// (is this meant to be on the road?) rather than re-deriving coordinates.
export function resolvePlacements(cl, list) {
  return list.map((p) => {
    const idx = Math.floor((p.at % 1) * cl.count) % cl.count
    const t = cl.tang[idx]
    const lat = p.lat ?? 0
    return {
      ...p,
      x: cl.xs[idx] - Math.sin(t) * lat,
      y: cl.ys[idx] + Math.cos(t) * lat,
      angle: t,
    }
  })
}

function makeCar(i, cl, track, aiTier) {
  // Grid: staggered back from the start line, alternating sides, so nobody
  // starts overlapping and pole has a real (small) advantage.
  const back = i * B.GRID_STAGGER
  const s = (cl.total - back) % cl.total
  const idx = Math.floor(s / cl.ds) % cl.count
  const side = (i % 2 === 0 ? 1 : -1) * B.GRID_OFFSET
  const t = cl.tang[idx]
  return {
    id: i,
    isPlayer: i === 0,
    aiTier,
    carArt: track.carArt[i % track.carArt.length],
    x: cl.xs[idx] - Math.sin(t) * side,
    y: cl.ys[idx] + Math.cos(t) * side,
    heading: t,
    vx: 0,
    vy: 0,
    hp: B.MAX_HP,
    nitro: B.NITRO_START,
    boosting: false,
    // progress
    s,
    idx,
    lap: 0,
    sector: 0,
    sectorsHit: new Set([0]),
    lateral: side,
    offRoad: false,
    // transient states
    spin: 0,
    oilCool: 0,
    air: 0,
    boostTimer: 0,
    hitCooldown: 0,
    // results
    finished: false,
    finishFrame: 0,
    place: 0,
    lapTimes: [],
    lastLapFrame: 0,
  }
}

export function createRace(trackIndex, sfx = SILENT) {
  const track = TRACKS[clamp(trackIndex, 0, TRACKS.length - 1)]
  const cl = buildCenterline(track.points)

  const cars = [
    makeCar(0, cl, track, null),
    ...B.AI_TIERS.map((tier, i) => makeCar(i + 1, cl, track, tier)),
  ]

  return {
    track,
    cl,
    cars,
    player: cars[0],
    sfx,
    frame: 0,
    // 'countdown' -> 'racing' -> 'finished'
    phase: 'countdown',
    countdown: B.COUNTDOWN_FRAMES,
    phaseTimer: 0,
    laps: track.laps,
    // Live copies of the track's consumables, resolved to world space, so a
    // retry always starts from a clean set.
    pickups: resolvePlacements(cl, track.pickups).map((p) => ({ ...p, taken: 0 })),
    hazards: resolvePlacements(cl, track.hazards),
    // Static scenery - never mutated, resolved once here so the renderer
    // doesn't have to know about the { at, lat } authoring format at all.
    decor: resolvePlacements(cl, track.decor),
    finishOrder: [],
    shake: 0,
  }
}

// ---------------------------------------------------------------------------
// Per-car update
// ---------------------------------------------------------------------------

// What the AI wants to do this frame. Two jobs: aim at a point further up the
// road (further ahead the faster it is going, so it takes corners on a line
// rather than sawing at the apex), and pick a speed from how hard the road
// bends between here and there.
function aiInput(race, car) {
  const { cl } = race
  const tier = car.aiTier
  const speed = Math.hypot(car.vx, car.vy)

  const look = B.AI_LOOKAHEAD_BASE + speed * B.AI_LOOKAHEAD_SPEED * tier.lookahead
  const aheadIdx = (car.idx + Math.round(look / cl.ds)) % cl.count

  // Worst curvature between here and the lookahead point sets target speed.
  let worst = 0
  for (let k = 0; k <= Math.round(look / cl.ds); k += 2) {
    const c = cl.curv[(car.idx + k) % cl.count]
    if (c > worst) worst = c
  }
  const cornerLimit = Math.sqrt(B.CORNER_GRIP / Math.max(worst, 1e-5))
  const topSpeed = B.TOP_SPEED * tier.speed
  const target = Math.min(topSpeed, cornerLimit)

  // Aim slightly off the centreline so the four of them do not drive in a
  // single file down the exact same pixels.
  const t = cl.tang[aheadIdx]
  const lane = tier.lane * race.track.halfWidth * B.AI_LANE_SPREAD
  const tx = cl.xs[aheadIdx] - Math.sin(t) * lane
  const ty = cl.ys[aheadIdx] + Math.cos(t) * lane

  let want = Math.atan2(ty - car.y, tx - car.x)
  // Continuous steering noise, so nobody drives a perfect line.
  car.aiWobble = (car.aiWobble ?? 0) * 0.94 +
    (Math.random() - 0.5) * tier.mistake * B.AI_WOBBLE
  want += car.aiWobble

  // Discrete fumbles on top of the wobble. Without these the tiers finish in
  // their exact speed order every single race (measured: 2.00 / 3.00 / 4.00
  // mean place over five runs, zero variance), which reads as a scripted
  // result rather than a race. A fumble runs the car wide and off the
  // throttle for a beat, so the field genuinely trades places - and it does
  // it through visible driving, not a hidden speed handicap.
  if (car.fumble > 0) car.fumble -= 1
  else if (Math.random() < tier.mistake * B.AI_FUMBLE_CHANCE) {
    car.fumble = B.AI_FUMBLE_FRAMES
    car.fumbleDir = Math.random() < 0.5 ? -1 : 1
  }
  const fumbling = car.fumble > 0
  if (fumbling) want += car.fumbleDir * B.AI_FUMBLE_STEER

  const steer = clamp(angleDelta(car.heading, want) / B.AI_STEER_GAIN, -1, 1)
  const throttle = !fumbling && speed < target ? 1 : 0
  const brake = speed > target * B.AI_BRAKE_MARGIN ? 1 : 0
  // Spend nitro on the straights, where it is worth the most.
  const boost = car.nitro > B.NITRO_AI_KEEP && worst < B.AI_BOOST_CURV && speed > target * 0.9

  return { steer, throttle, brake, boost }
}

function stepCar(race, car, input) {
  const { cl } = race
  const track = race.track

  if (car.finished) return

  // --- spin-out (oil) ---
  // Steering and brakes are gone, but the THROTTLE still answers. That is
  // not a mercy, it is what stops the hazard being a soft-lock: the first
  // version cut the throttle too, so a car that entered a slick slowly
  // decelerated to a dead stop on top of it and re-triggered the spin the
  // instant the timer expired - observed looping 185 times and never
  // finishing the lap. Keeping the throttle (plus GRIP_SPIN below, and the
  // speed floor and cooldown on the trigger itself) means momentum always
  // carries the car back out.
  if (car.spin > 0) {
    car.spin -= 1
    car.heading += B.SPIN_RATE * (car.spinDir || 1)
    input = { steer: 0, throttle: input.throttle, brake: 0, boost: false }
  }
  if (car.oilCool > 0) car.oilCool -= 1

  const speed = Math.hypot(car.vx, car.vy)

  // --- nitro ---
  car.boosting = false
  if (input.boost && car.nitro > 0 && car.spin <= 0) {
    car.nitro = Math.max(0, car.nitro - B.NITRO_DRAIN)
    car.boosting = true
  }
  if (car.boostTimer > 0) { car.boostTimer -= 1; car.boosting = true }

  // --- surface ---
  // Airborne (jump pad) ignores the surface entirely: that is the point of
  // the pad, it lets you cut a corner over the grass without the penalty.
  const airborne = car.air > 0
  if (airborne) car.air -= 1
  const onRoad = airborne || Math.abs(car.lateral) <= track.halfWidth
  car.offRoad = !onRoad && !airborne

  // Spinning means no grip at all - the body rotates while the velocity
  // vector keeps pointing where it was, which is what a slide looks like and
  // what carries the car off the slick.
  const grip = car.spin > 0
    ? B.GRIP_SPIN
    : (onRoad ? B.GRIP_ROAD : B.GRIP_OFF) * (track.surfaceGrip ?? 1)
  const topSpeed = B.TOP_SPEED *
    (car.aiTier ? car.aiTier.speed : 1) *
    (onRoad ? 1 : B.OFFROAD_SPEED) *
    (car.boosting ? B.NITRO_SPEED : 1) *
    // Wrecked (0 HP) limps rather than retires - see WRECK_SPEED's comment.
    (car.hp <= 0 ? B.WRECK_SPEED : 1)

  // --- steering: rate falls off at low speed so a stopped car cannot pirouette
  const steerAuthority = Math.min(1, speed / (B.TOP_SPEED * B.STEER_FULL_AT))
  car.heading += input.steer * B.STEER_RATE * steerAuthority

  // --- longitudinal forces ---
  let accel = 0
  if (input.throttle) accel += B.ACCEL * (car.boosting ? B.NITRO_ACCEL : 1)
  if (input.brake) accel -= B.BRAKE
  let newSpeed = speed + accel - speed * B.DRAG
  if (newSpeed > topSpeed) newSpeed = topSpeed
  if (newSpeed < 0) newSpeed = 0

  // --- grip: blend the velocity vector toward where the car is pointing.
  // A low blend factor is what makes the car slide wide out of a fast corner
  // instead of tracking as if on rails.
  const fx = Math.cos(car.heading), fy = Math.sin(car.heading)
  let vx = car.vx, vy = car.vy
  if (speed > 1e-4) { vx = car.vx / speed; vy = car.vy / speed }
  else { vx = fx; vy = fy }
  const bx = vx + (fx - vx) * grip
  const by = vy + (fy - vy) * grip
  const bl = Math.hypot(bx, by) || 1
  car.vx = (bx / bl) * newSpeed
  car.vy = (by / bl) * newSpeed

  car.x += car.vx
  car.y += car.vy

  // --- track progress ---
  const near = nearestOnCenterline(cl, car.x, car.y, car.idx)
  const prevS = car.s
  car.idx = near.idx
  car.lateral = near.lateral
  car.s = near.s

  // Sector gates: a lap only counts if every quarter of the track was
  // visited, so cutting across the infield cannot bank a lap.
  car.sector = Math.floor((car.s / cl.total) * B.SECTORS) % B.SECTORS
  car.sectorsHit.add(car.sector)

  // Wrap detection: a jump from the last quarter to the first is a lap, the
  // reverse is a car crossing backwards over the line.
  const wrappedForward = prevS > cl.total * 0.75 && car.s < cl.total * 0.25
  const wrappedBack = prevS < cl.total * 0.25 && car.s > cl.total * 0.75
  if (wrappedForward) {
    if (car.sectorsHit.size >= B.SECTORS) {
      car.lap += 1
      car.lapTimes.push(race.frame - car.lastLapFrame)
      car.lastLapFrame = race.frame
      car.sectorsHit = new Set([0])
      if (car.isPlayer) race.sfx.lap()
      if (car.lap >= race.laps) {
        car.finished = true
        car.finishFrame = race.frame
        race.finishOrder.push(car)
        car.place = race.finishOrder.length
        if (car.isPlayer) race.sfx.finish()
      }
    } else {
      // Cut the course - no lap credit, and the sector set is kept so the
      // driver has to actually go round properly.
      car.sectorsHit.add(car.sector)
    }
  } else if (wrappedBack) {
    car.lap = Math.max(0, car.lap - 1)
  }

  // --- hazards ---
  if (car.hitCooldown > 0) car.hitCooldown -= 1
  for (const h of race.hazards) {
    const d = Math.hypot(car.x - h.x, car.y - h.y)
    if (d > h.r) continue
    if (h.kind === 'jump') {
      if (car.air <= 0) {
        car.air = B.JUMP_FRAMES
        car.boostTimer = Math.max(car.boostTimer, B.JUMP_BOOST_FRAMES)
        race.sfx.boost()
      }
    } else if (h.kind === 'oil') {
      // Two guards, both there to keep the slick from becoming a soft-lock:
      // a car crawling below OIL_MIN_SPEED is not sliding and simply is not
      // affected, and OIL_COOLDOWN gives any car that does spin a clear run
      // of frames to drive back out before it can be caught again.
      const sp = Math.hypot(car.vx, car.vy)
      if (car.spin <= 0 && !airborne && car.oilCool <= 0 && sp > B.OIL_MIN_SPEED) {
        car.spin = B.OIL_SPIN_FRAMES
        car.oilCool = B.OIL_COOLDOWN
        car.spinDir = Math.random() < 0.5 ? -1 : 1
        race.sfx.spin()
      }
    } else if (h.kind === 'barrel' && car.hitCooldown <= 0 && !airborne) {
      car.hitCooldown = B.HIT_COOLDOWN
      car.hp = Math.max(0, car.hp - B.BARREL_DAMAGE)
      car.vx *= B.BARREL_SPEED_KEEP
      car.vy *= B.BARREL_SPEED_KEEP
      // Shove the car clear along the contact normal. Without this a car can
      // come to rest inside the barrel's radius and chip its own HP away
      // every HIT_COOLDOWN frames - the same class of trap the oil had.
      const dx0 = car.x - h.x
      const dy0 = car.y - h.y
      const away = Math.hypot(dx0, dy0)
      // Dead centre has no contact normal to push along (and normalising it
      // yields 0, leaving the car exactly where it was). Back it out along
      // its own heading instead, which is the way it came in.
      const nx = away < 1e-3 ? -Math.cos(car.heading) : dx0 / away
      const ny = away < 1e-3 ? -Math.sin(car.heading) : dy0 / away
      car.x = h.x + nx * (h.r + 2)
      car.y = h.y + ny * (h.r + 2)
      race.sfx.hit()
      if (car.isPlayer) race.shake = B.SHAKE_FRAMES
    }
  }

  // --- pickups ---
  for (const p of race.pickups) {
    if (p.taken > 0) { p.taken -= 1; continue }
    if (Math.hypot(car.x - p.x, car.y - p.y) > B.PICKUP_RADIUS) continue
    p.taken = B.PICKUP_RESPAWN
    if (p.kind === 'nitro') car.nitro = Math.min(B.NITRO_MAX, car.nitro + B.NITRO_PICKUP)
    else car.hp = Math.min(B.MAX_HP, car.hp + B.HP_PICKUP)
    if (car.isPlayer) race.sfx.pickup()
  }
}

// Cars shove each other apart rather than passing through. Deliberately soft -
// this is a race, not a demolition derby, and a hard collision response makes
// the AI unpassable in traffic.
function separateCars(race) {
  const cars = race.cars
  for (let i = 0; i < cars.length; i++) {
    for (let j = i + 1; j < cars.length; j++) {
      const a = cars[i], b = cars[j]
      if (a.finished || b.finished) continue
      const dx = b.x - a.x, dy = b.y - a.y
      const d = Math.hypot(dx, dy)
      if (d >= B.CAR_RADIUS * 2 || d < 1e-4) continue
      const push = (B.CAR_RADIUS * 2 - d) * 0.5 * B.CAR_PUSH
      const nx = dx / d, ny = dy / d
      a.x -= nx * push; a.y -= ny * push
      b.x += nx * push; b.y += ny * push
      const bump = B.CAR_BUMP
      a.vx -= nx * bump; a.vy -= ny * bump
      b.vx += nx * bump; b.vy += ny * bump
    }
  }
}

// ---------------------------------------------------------------------------
// Main step
// ---------------------------------------------------------------------------

export function step(race, input) {
  race.frame += 1
  if (race.shake > 0) race.shake -= 1

  if (race.phase === 'countdown') {
    race.countdown -= 1
    if (race.countdown % B.COUNTDOWN_TICK === 0 && race.countdown > 0) race.sfx.countdown()
    if (race.countdown <= 0) {
      race.phase = 'racing'
      race.sfx.countdown()
    }
    return race
  }

  if (race.phase === 'finished') {
    race.phaseTimer += 1
    return race
  }

  for (const car of race.cars) {
    stepCar(race, car, car.isPlayer ? input : aiInput(race, car))
  }
  separateCars(race)

  // The race ends when the PLAYER is done - once they cross the line the
  // remaining AI places are settled immediately rather than making the
  // player watch the back markers finish.
  if (race.player.finished) {
    for (const car of race.cars) {
      if (car.finished) continue
      car.finished = true
      car.finishFrame = race.frame
      race.finishOrder.push(car)
      car.place = race.finishOrder.length
    }
    race.phase = 'finished'
    race.phaseTimer = 0
  }

  return race
}

// ---------------------------------------------------------------------------
// Read-only helpers for the renderer / harness
// ---------------------------------------------------------------------------

// Live standings: finishers first in the order they crossed, everyone else by
// distance covered.
export function standings(race) {
  return race.cars.slice().sort((a, b) => {
    if (a.place && b.place) return a.place - b.place
    if (a.place) return -1
    if (b.place) return 1
    return (b.lap * race.cl.total + b.s) - (a.lap * race.cl.total + a.s)
  })
}

export function playerPlace(race) {
  return standings(race).indexOf(race.player) + 1
}

// Which of the 5 damage frames to draw - the pack's car sprites are a
// pristine-to-wrecked ramp (see production/process_racing.py), so HP is shown
// on the car itself, not only on the bar.
export function carDamageFrame(car, frames = 5) {
  const lost = 1 - car.hp / B.MAX_HP
  return clamp(Math.floor(lost * frames), 0, frames - 1)
}
