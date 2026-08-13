// Track data and tuning for Redline Rally (redlineRallyEngine.js runs it,
// RedlineRallyModal.jsx draws it). Art comes from the `racing` pack via
// production/process_racing.py - see that script for why the road is a
// seamless fill stroked along a curve rather than the pack's corner tiles.

export const VIEW_W = 512
export const VIEW_H = 384

const P = '/assets/packs/racing/processed'

// Every image the cabinet loads. The modal preloads this whole map before it
// will start a race, so a half-loaded track can never be drawn.
export const IMAGES = {
  road_tarmac: `${P}/road_tarmac.png`,
  road_dirt: `${P}/road_dirt.png`,
  kerb_tarmac: `${P}/kerb_tarmac.png`,
  kerb_dirt: `${P}/kerb_dirt.png`,
  ground_grass: `${P}/ground_grass.png`,
  ground_soil: `${P}/ground_soil.png`,
  car_1: `${P}/car_1.png`,
  car_2: `${P}/car_2.png`,
  car_3: `${P}/car_3.png`,
  car_4: `${P}/car_4.png`,
  barrel: `${P}/barrel.png`,
  oil: `${P}/oil.png`,
  jump_pad: `${P}/jump_pad.png`,
  pickup_hp: `${P}/pickup_hp.png`,
  pickup_nitro: `${P}/pickup_nitro.png`,
  tree: `${P}/tree.png`,
  bush: `${P}/bush.png`,
  rock: `${P}/rock.png`,
  building: `${P}/building.png`,
  pavilion: `${P}/pavilion.png`,
  start_banner: `${P}/start_banner.png`,
  finish_banner: `${P}/finish_banner.png`,
  racing_lights: `${P}/racing_lights.png`,
  fx_nitro: `${P}/fx_nitro.png`,
  fx_smoke: `${P}/fx_smoke.png`,
  fx_tire: `${P}/fx_tire.png`,
  ui_window: `${P}/ui_window.png`,
  ui_star_gold: `${P}/ui_star_gold.png`,
  ui_star_silver: `${P}/ui_star_silver.png`,
  ui_star_bg: `${P}/ui_star_bg.png`,
}

// Sprite sheet geometry, straight out of process_racing.py's printed report.
// Car heights differ because each body was trimmed to its own union bbox and
// then scaled to a common 64px width.
export const SHEETS = {
  car_1: { fw: 64, fh: 136, frames: 5 },
  car_2: { fw: 64, fh: 140, frames: 5 },
  car_3: { fw: 64, fh: 130, frames: 5 },
  car_4: { fw: 64, fh: 136, frames: 5 },
  fx_nitro: { fw: 22, fh: 72, frames: 10 },
  fx_smoke: { fw: 54, fh: 46, frames: 6 },
}

// How big a car is DRAWN, in world units. The pack renders its cars far
// larger relative to its road tiles than real proportions (a source car is
// 565px wide against a 512px road), so the two are scaled independently
// rather than from one shared factor.
export const CAR_DRAW_W = 30

// ---------------------------------------------------------------------------
// BALANCE
// ---------------------------------------------------------------------------
// Units are world pixels and 60Hz frames throughout. Anything with a
// derivation is shown with it - this file follows RussianRoulette.jsx's rule
// that a payout curve is computed, not hand-picked.
export const BALANCE = {
  // --- centreline sampling ---
  CENTRELINE_SPACING: 10, // world px between samples; ~740 samples on a 7.4k track
  // Nearest-point search half-window, in samples. A car covers at most
  // TOP_SPEED*NITRO_SPEED ~ 8.2px/frame = under 1 sample, so 48 is enormous
  // headroom; it exists to survive a hard shunt, not ordinary driving.
  TRACK_SEARCH_WINDOW: 48,
  SECTORS: 4, // quarters that must all be visited before a lap counts

  // --- car physics ---
  // 6.2px/frame = 372px/s, so a car crosses the 512-wide viewport in ~1.4s.
  // Fast enough to feel like a racer, slow enough to read the road ahead.
  TOP_SPEED: 6.2,
  // Equilibrium speed is ACCEL/DRAG = 0.11/0.018 = 6.11, just under
  // TOP_SPEED, so the clamp only ever trims the last sliver and acceleration
  // tapers naturally instead of hitting a wall. Time constant 1/DRAG = 56
  // frames, i.e. ~0.9s to 63% and ~2.8s to nearly flat out.
  ACCEL: 0.11,
  DRAG: 0.018,
  BRAKE: 0.22, // 2x ACCEL - shedding speed for a corner is quicker than gaining it
  STEER_RATE: 0.052, // rad/frame; a 90-degree corner takes ~30 frames at full lock
  // Steering authority ramps in over the first 18% of top speed so a
  // stationary car cannot spin on the spot.
  STEER_FULL_AT: 0.18,
  // Fraction of the velocity vector redirected to the car's heading each
  // frame. Below 1 the car understeers out of fast corners, which is what
  // makes lifting off before an apex worth doing.
  GRIP_ROAD: 0.14,
  GRIP_OFF: 0.07, // grass barely bites - a spin off-track really costs you
  OFFROAD_SPEED: 0.55,
  // Speed a car can hold through curvature k is sqrt(CORNER_GRIP / k).
  // At 0.11 a 250px-radius corner takes sqrt(0.11*250) = 5.2px/frame, i.e.
  // 84% of top speed - fast corners stay flat, hairpins demand braking.
  CORNER_GRIP: 0.11,

  // --- nitro ---
  // The decision: 100 units is 1.9s of boost, but a spin costs ~0.7s plus
  // the re-acceleration. So nitro is either time gained on a straight or
  // insurance against a mistake, and you cannot have both.
  NITRO_MAX: 100,
  NITRO_START: 40,
  NITRO_DRAIN: 0.9, // 100/0.9 = 111 frames = 1.85s of continuous boost
  NITRO_SPEED: 1.32,
  NITRO_ACCEL: 1.7,
  NITRO_PICKUP: 34, // 3 pickups refill from empty
  NITRO_AI_KEEP: 12, // AI holds this back rather than running bone dry

  // --- damage ---
  MAX_HP: 100,
  BARREL_DAMAGE: 20, // 5 barrels from pristine to wrecked
  BARREL_SPEED_KEEP: 0.35,
  HIT_COOLDOWN: 30, // i-frames, so one barrel cannot chain-hit
  HP_PICKUP: 30,
  // At 0 HP the car is not removed - it limps. Being knocked out of an
  // arcade race with no way back would end the session early, which is the
  // opposite of what a coin-op wants; a 62% speed cap punishes hard while
  // leaving a comeback on the table if you can reach an HP pickup.
  WRECK_SPEED: 0.62,

  // --- hazards ---
  OIL_SPIN_FRAMES: 42, // 0.7s
  SPIN_RATE: 0.16, // 42*0.16 = 6.7rad, just over one full rotation
  // While spinning the car has no grip at all, so the velocity vector holds
  // its direction while the body rotates - a slide, and the thing that
  // carries the car back off the slick under its own momentum.
  GRIP_SPIN: 0.01,
  // A car crawling slower than this is not sliding, so oil does nothing to
  // it. Without this floor a car that stops ON a slick re-triggers the spin
  // forever; simulateRedlineRally.mjs caught exactly that (185 spins, zero
  // laps) and now regression-tests it.
  OIL_MIN_SPEED: 1.2,
  OIL_COOLDOWN: 90, // 1.5s of immunity - ample time to drive clear of an r=40 slick
  JUMP_FRAMES: 34, // airborne: ignores the surface, so a pad can cut a corner
  JUMP_BOOST_FRAMES: 26,
  PICKUP_RADIUS: 26,
  PICKUP_RESPAWN: 420, // 7s, so a pickup is not farmable by circling it

  // --- car-vs-car ---
  CAR_RADIUS: 17,
  CAR_PUSH: 0.9,
  CAR_BUMP: 0.22, // deliberately soft; a hard response makes traffic a wall

  // --- AI ---
  // Three tiers, all capped at or below the player's top speed - the race is
  // meant to be won on clean lines and nitro timing, so there is NO
  // rubber-banding anywhere in this file. Tiers lose time through steering
  // error and cornering caution, which reads as driving; a speed handicap
  // that scales with the player's position reads as the game letting you win.
  AI_TIERS: [
    { name: 'Vega', speed: 1.00, lookahead: 1.00, mistake: 0.35, lane: -0.34 },
    { name: 'Koda', speed: 0.965, lookahead: 0.90, mistake: 0.70, lane: 0.00 },
    { name: 'Brisk', speed: 0.930, lookahead: 0.80, mistake: 1.10, lane: 0.34 },
  ],
  AI_LOOKAHEAD_BASE: 90,
  AI_LOOKAHEAD_SPEED: 26,
  AI_STEER_GAIN: 0.5, // rad of heading error that saturates the AI's steering
  AI_BRAKE_MARGIN: 1.04,
  AI_BOOST_CURV: 0.0016, // straight enough to be worth burning nitro on
  AI_LANE_SPREAD: 0.55, // as a fraction of half-width
  AI_WOBBLE: 0.06,
  // Discrete mistakes. Per frame, scaled by the tier's mistake factor - at
  // 0.0016 the sloppiest tier (1.1) fumbles roughly once every 9s of racing,
  // the cleanest (0.35) about once every 30s. That is enough for the order to
  // genuinely change between races without anyone driving like a liability.
  AI_FUMBLE_CHANCE: 0.0016,
  AI_FUMBLE_FRAMES: 26,
  AI_FUMBLE_STEER: 0.34, // rad off-line - runs wide, does not spin

  // --- start grid ---
  GRID_STAGGER: 46, // world px between rows
  GRID_OFFSET: 26, // lateral, alternating sides

  // --- presentation ---
  COUNTDOWN_FRAMES: 180, // 3s: "3 / 2 / 1 / GO"
  COUNTDOWN_TICK: 45,
  SHAKE_FRAMES: 12,

  // --- economy ---
  // ENTRY_FEE reuses SortieCabinetModal.jsx's 50 rather than inventing a
  // number: that is the arcade wing's only currently-working paid-entry
  // precedent, and matching it keeps the Game Center's cabinets priced
  // consistently. No energy cost - every casino game charges 5 energy and no
  // arcade cabinet charges any, and this is a Game Center machine.
  ENTRY_FEE: 50,
  // Payout is DERIVED, not tabulated: (4 - position) * ENTRY_FEE, i.e. your
  // stake back for each rival you beat. 1st beats 3 -> 150, 2nd -> 100,
  // 3rd -> 50, 4th -> 0. Two properties fall out of that shape for free:
  // it is self-capping (position is bounded, so no MAX_PAYOUT clamp is
  // needed the way Third Rail needs one for an unbounded score), and no
  // podium finish ever nets a loss.
  //
  // This is deliberately a SKILL price, not a house edge. The casino games
  // (RussianRoulette.jsx, Slots.jsx) hold a fixed ~10% edge against every
  // player no matter what they do, because nothing they do matters there.
  // Finishing position here is entirely a skill outcome - line, hazard
  // avoidance, nitro timing - so the payout tracks it: last place loses the
  // fee outright, a mid-pack driver hovers near break-even, a good one
  // profits. A flat expected value regardless of position would say skill
  // doesn't pay, which would make the whole tiered-AI design pointless.
  PLACE_PAYOUT: [150, 100, 50, 0],
}

// ---------------------------------------------------------------------------
// Tracks
// ---------------------------------------------------------------------------
// Control points are absolute world coordinates; the engine runs a closed
// Catmull-Rom through them, so the road passes exactly through each point.
//
// Hazards, pickups and decor are NOT authored in world coordinates - they are
// placed as { at, lat }, a fraction around the lap plus a lateral offset from
// the centreline. That keeps a barrel on the road by construction instead of
// by hand-checking coordinates, and it means a corner can be reshaped without
// re-placing everything on it. resolvePlacements() in the engine converts
// them once at race start.

const TARMAC_CAR_ART = ['car_1', 'car_3', 'car_4', 'car_2']

export const TRACKS = [
  {
    id: 'harbour',
    name: 'Harbour Loop',
    blurb: 'Wide, fast, forgiving. Long straights either side - a good place to learn what the boost does.',
    surface: 'tarmac',
    ground: 'ground_grass',
    laps: 3,
    halfWidth: 74,
    surfaceGrip: 1,
    difficulty: 1,
    carArt: TARMAC_CAR_ART,
    // A big flowing oval, ~7.4k long: about 26s a lap, so a 3-lap race is
    // just over a minute plus the countdown.
    points: [
      { x: 520, y: 390 }, { x: 1560, y: 286 }, { x: 2600, y: 390 },
      { x: 3185, y: 910 }, { x: 3120, y: 1560 }, { x: 2600, y: 2015 },
      { x: 1690, y: 2145 }, { x: 910, y: 2015 }, { x: 455, y: 1560 },
      { x: 390, y: 975 },
    ],
    hazards: [
      { at: 0.14, lat: 34, kind: 'barrel', r: 24 },
      { at: 0.30, lat: -40, kind: 'oil', r: 40 },
      { at: 0.46, lat: 0, kind: 'jump', r: 42 },
      { at: 0.62, lat: 40, kind: 'barrel', r: 24 },
      { at: 0.79, lat: -30, kind: 'oil', r: 40 },
    ],
    pickups: [
      { at: 0.08, lat: 0, kind: 'nitro' },
      { at: 0.25, lat: 34, kind: 'nitro' },
      { at: 0.40, lat: -34, kind: 'hp' },
      { at: 0.55, lat: 0, kind: 'nitro' },
      { at: 0.70, lat: 30, kind: 'hp' },
      { at: 0.88, lat: 0, kind: 'nitro' },
    ],
    decor: [
      { at: 0.05, lat: 150, kind: 'tree' }, { at: 0.12, lat: -165, kind: 'tree' },
      { at: 0.20, lat: 140, kind: 'bush' }, { at: 0.27, lat: -150, kind: 'rock' },
      { at: 0.35, lat: 190, kind: 'building' }, { at: 0.44, lat: -140, kind: 'tree' },
      { at: 0.52, lat: 160, kind: 'bush' }, { at: 0.60, lat: -175, kind: 'tree' },
      { at: 0.68, lat: 145, kind: 'rock' }, { at: 0.75, lat: -190, kind: 'pavilion' },
      { at: 0.84, lat: 155, kind: 'tree' }, { at: 0.93, lat: -145, kind: 'bush' },
    ],
  },
  {
    id: 'dustbowl',
    name: 'Dust Bowl',
    blurb: 'Loose dirt and a hairpin that punishes anyone still on the throttle. Grip is down across the board.',
    surface: 'dirt',
    ground: 'ground_soil',
    laps: 3,
    halfWidth: 78, // wider than tarmac to stay driveable at the lower grip
    // Dirt bites less. Applied on top of GRIP_ROAD, so the whole track
    // slides rather than only the off-track sections.
    surfaceGrip: 0.82,
    difficulty: 2,
    carArt: ['car_3', 'car_1', 'car_2', 'car_4'],
    // The right-hand section used to zigzag out-in-out across four closely
    // spaced points, which Catmull-Rom turned into a 74px-radius hairpin -
    // narrower than the road itself, so the inner kerb folded through the
    // outer one. Reshaped into one long flowing S; checkRedlineTracks.mjs
    // enforces radius > halfWidth * 1.6 so it cannot come back.
    points: [
      { x: 480, y: 520 }, { x: 1250, y: 330 }, { x: 2080, y: 430 },
      { x: 2680, y: 820 }, { x: 2600, y: 1350 }, { x: 2980, y: 1760 },
      { x: 2760, y: 2230 }, { x: 2010, y: 2360 }, { x: 1240, y: 2180 },
      { x: 700, y: 1830 }, { x: 400, y: 1200 },
    ],
    hazards: [
      { at: 0.10, lat: -36, kind: 'barrel', r: 24 },
      { at: 0.22, lat: 0, kind: 'jump', r: 42 },
      { at: 0.34, lat: 38, kind: 'oil', r: 40 },
      { at: 0.48, lat: -42, kind: 'barrel', r: 24 },
      { at: 0.58, lat: 36, kind: 'barrel', r: 24 },
      { at: 0.72, lat: 0, kind: 'oil', r: 40 },
      { at: 0.86, lat: -34, kind: 'jump', r: 42 },
    ],
    pickups: [
      { at: 0.05, lat: 0, kind: 'nitro' },
      { at: 0.18, lat: 36, kind: 'hp' },
      { at: 0.29, lat: -36, kind: 'nitro' },
      { at: 0.43, lat: 0, kind: 'nitro' },
      { at: 0.54, lat: 34, kind: 'hp' },
      { at: 0.66, lat: -30, kind: 'nitro' },
      { at: 0.80, lat: 0, kind: 'hp' },
      { at: 0.92, lat: 32, kind: 'nitro' },
    ],
    decor: [
      { at: 0.04, lat: 155, kind: 'rock' }, { at: 0.11, lat: -160, kind: 'rock' },
      { at: 0.19, lat: 145, kind: 'bush' }, { at: 0.26, lat: -175, kind: 'tree' },
      { at: 0.33, lat: 165, kind: 'rock' }, { at: 0.41, lat: -145, kind: 'bush' },
      { at: 0.50, lat: 185, kind: 'building' }, { at: 0.57, lat: -155, kind: 'rock' },
      { at: 0.64, lat: 150, kind: 'bush' }, { at: 0.71, lat: -180, kind: 'pavilion' },
      { at: 0.78, lat: 160, kind: 'rock' }, { at: 0.85, lat: -150, kind: 'tree' },
      { at: 0.94, lat: 170, kind: 'rock' },
    ],
  },
  {
    id: 'gauntlet',
    name: 'The Gauntlet',
    blurb: 'Back-to-back chicanes on a narrow ribbon of tarmac. Every hazard is placed exactly where you want the racing line.',
    surface: 'tarmac',
    ground: 'ground_grass',
    laps: 3,
    halfWidth: 62, // narrowest of the three - overtaking has to be planned
    surfaceGrip: 1,
    difficulty: 3,
    carArt: ['car_4', 'car_2', 'car_1', 'car_3'],
    // This track is technical through the NUMBER of direction changes, not
    // through corner tightness - at half-width 62 a genuine hairpin pinches
    // the road shut (the first draft hit a 62px radius). Fourteen points keep
    // the chicanes coming without any single corner going below the
    // radius > halfWidth * 1.6 floor the validator enforces.
    points: [
      { x: 520, y: 720 }, { x: 900, y: 420 }, { x: 1450, y: 560 },
      { x: 2000, y: 400 }, { x: 2560, y: 620 }, { x: 2940, y: 1080 },
      // cp6-cp8 are the far-side S. Their amplitude is damped from the first
      // draft (which swung 2700 -> 2920 -> 2400 and pinched to a 71px radius);
      // the shallower swing keeps the direction changes without the pinch.
      { x: 2780, y: 1520 }, { x: 2880, y: 1980 }, { x: 2480, y: 2230 },
      { x: 1780, y: 1980 }, { x: 1240, y: 2200 }, { x: 760, y: 1980 },
      { x: 480, y: 1520 }, { x: 400, y: 1080 },
    ],
    hazards: [
      { at: 0.08, lat: 30, kind: 'barrel', r: 24 },
      { at: 0.17, lat: -30, kind: 'barrel', r: 24 },
      { at: 0.26, lat: 28, kind: 'oil', r: 40 },
      { at: 0.37, lat: 0, kind: 'jump', r: 42 },
      { at: 0.45, lat: -32, kind: 'barrel', r: 24 },
      { at: 0.54, lat: 30, kind: 'oil', r: 40 },
      { at: 0.63, lat: -28, kind: 'barrel', r: 24 },
      { at: 0.74, lat: 0, kind: 'oil', r: 40 },
      { at: 0.83, lat: 30, kind: 'barrel', r: 24 },
      { at: 0.92, lat: -30, kind: 'jump', r: 42 },
    ],
    pickups: [
      { at: 0.04, lat: 0, kind: 'nitro' },
      { at: 0.13, lat: -26, kind: 'hp' },
      { at: 0.22, lat: 26, kind: 'nitro' },
      { at: 0.32, lat: 0, kind: 'hp' },
      { at: 0.41, lat: 26, kind: 'nitro' },
      { at: 0.50, lat: -26, kind: 'hp' },
      { at: 0.59, lat: 0, kind: 'nitro' },
      { at: 0.69, lat: 26, kind: 'hp' },
      { at: 0.79, lat: -26, kind: 'nitro' },
      { at: 0.88, lat: 0, kind: 'hp' },
    ],
    decor: [
      { at: 0.06, lat: 135, kind: 'tree' }, { at: 0.14, lat: -140, kind: 'bush' },
      { at: 0.23, lat: 150, kind: 'tree' }, { at: 0.31, lat: -155, kind: 'building' },
      { at: 0.39, lat: 140, kind: 'rock' }, { at: 0.47, lat: -135, kind: 'tree' },
      { at: 0.56, lat: 145, kind: 'bush' }, { at: 0.65, lat: -160, kind: 'pavilion' },
      { at: 0.73, lat: 138, kind: 'tree' }, { at: 0.81, lat: -142, kind: 'rock' },
      { at: 0.90, lat: 150, kind: 'bush' }, { at: 0.96, lat: -138, kind: 'tree' },
    ],
  },
]
