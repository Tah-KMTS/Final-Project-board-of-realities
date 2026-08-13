// Data + tuning for "Third Rail" - the Pixel Palace Arcade's run-and-gun
// cabinet (see RunAndGunModal.jsx for the engine that consumes all of this).
//
// Split out of the modal for the same reason characterHomeBuildings.js is
// split out of OverworldScene.js: the engine is logic that rarely changes and
// the levels are a wall of coordinates that changes constantly, and reading
// either one is much easier without the other in the way.
//
// Art is the vacaroxa "Generic Run n Gun" pack the user supplied. Its sprite
// sheets are already uniform grids so they're referenced here directly; its
// two TILESETS are irregular atlases and are pre-cut by
// production/process_run_n_gun.py into .../runngun/processed/ (see that
// script's header for why).

const PACK = '/assets/packs/vacaroxa--generic-run-n-gun-pack--v.1.0'
const CUT = '/assets/packs/runngun/processed'

// The pack's own backgrounds are 496x272, so that's the native resolution
// here - matching it exactly means the backdrop art is never resampled, which
// on pixel art of this size is the difference between crisp and mushy. The
// canvas is then CSS-upscaled with image-rendering:pixelated.
export const VIEW_W = 496
export const VIEW_H = 272
export const TILE = 16

// --- sprite sheets ---------------------------------------------------------
// `cols` is the frame count per row; every one of these sheets is a single
// row, except the player's, which is a 8-wide grid read as one flat run of
// frame indices (row * 8 + col).
export const SHEETS = {
  // The UNSLICED player sheet is the one to use: despite the name,
  // SpriteSheet_player_sliced.png is the torso/legs-separated version meant
  // for runtime compositing, while this one is 56 complete full-body frames
  // on the same 45x45 grid. The only two frames worth taking from the sliced
  // sheet are its crouch and prone poses, which the unsliced sheet has no
  // equivalent of - hence playerPose below.
  player: { url: `${PACK}/Player/SpriteSheet_player.png`, fw: 45, fh: 45, cols: 8 },
  playerPose: { url: `${PACK}/Player/SpriteSheet_player_sliced.png`, fw: 45, fh: 45, cols: 8 },
  ar: { url: `${PACK}/Enemies/ARMob.png`, fw: 32, fh: 38, cols: 24 },
  sniper: { url: `${PACK}/Enemies/SniperMob.png`, fw: 44, fh: 44, cols: 14 },
  rpg: { url: `${PACK}/Enemies/RPGmob.png`, fw: 44, fh: 44, cols: 10 },
  boom: { url: `${PACK}/Enemies/Explosion_Particle.png`, fw: 32, fh: 32, cols: 9 },
}

// Plain (non-sheet) images: terrain tiles, props and parallax backdrops.
export const IMAGES = {
  sub_fill: `${CUT}/sub_fill.png`,
  sub_cap: `${CUT}/sub_cap.png`,
  out_fill: `${CUT}/out_fill.png`,
  out_cap: `${CUT}/out_cap.png`,
  crate: `${CUT}/crate.png`,
  cone: `${CUT}/cone.png`,
  road_sign: `${CUT}/road_sign.png`,
  street_lamp: `${CUT}/street_lamp.png`,
  bush: `${CUT}/bush.png`,
  barrel: `${CUT}/barrel.png`,
  pipe: `${CUT}/pipe.png`,
  vending: `${CUT}/vending.png`,
  screen: `${CUT}/screen.png`,
  poster: `${CUT}/poster.png`,
  door: `${CUT}/door.png`,
  station_sign: `${CUT}/station_sign.png`,
  subway_bg: `${PACK}/Assets_area_1/Background/subway_BG.png`,
  subway_wall: `${PACK}/Assets_area_1/Background/wall_subway.png`,
  clouds1: `${PACK}/Assets_area_2/backgrounds/nuvens_1.png`,
  clouds2: `${PACK}/Assets_area_2/backgrounds/nuvens_2.png`,
  clouds3: `${PACK}/Assets_area_2/backgrounds/nuvens_3.png`,
}

// --- player animation map --------------------------------------------------
// Frame indices into the unsliced player sheet (index = row * 8 + col),
// verified frame-by-frame against a labelled contact sheet rather than
// guessed from the layout.
export const PLAYER_ANIM = {
  idle: [0, 1, 2, 3],
  run: [8, 9, 10, 11, 12, 13, 14, 15],
  jump: [17],
  shoot: [18, 19],
  shootUp: [20, 21],
  runShoot: [24, 25, 26, 27, 28, 29, 30, 31],
  runShootUp: [32, 33, 34, 35, 36, 37, 38, 39],
  shootDown: [44, 45],
  death: [46, 47, 48, 49, 50],
}
// Frames 6 and 7 of the SLICED sheet - crouch and prone. See SHEETS.player.
export const POSE_CROUCH = 6
export const POSE_PRONE = 7

// --- enemy animation maps --------------------------------------------------
// Each sheet ends with its own projectile frame, which is why there's no
// separate bullet art anywhere in this file.
export const ENEMY_ANIM = {
  ar: { idle: [0, 1, 2], shoot: [3, 4], shootUp: [5, 6, 7], walk: [8, 9, 10, 11, 12, 13, 14, 15, 16, 17], death: [19, 20, 21, 22], bullet: 23 },
  sniper: { idle: [0], shoot: [1, 2], recover: [3, 4, 5, 6, 7, 8], death: [9, 10, 11, 12], bullet: 13 },
  rpg: { idle: [0], shoot: [1, 2, 3, 4], death: [5, 6, 7, 8], bullet: 9 },
}

// --- balance ---------------------------------------------------------------
// Units are per-frame at a fixed 60fps step (the engine runs a fixed
// timestep and never scales by real dt), matching how AirHockeyModal.jsx and
// TurboRacerModal.jsx express their own speeds.
export const BALANCE = {
  // Movement. JUMP_V/GRAVITY give a peak of ~77px = 4.8 tiles, enough to
  // clear the 3-tile platform steps below with margin but not enough to
  // skip over them, so vertical layout still matters.
  RUN_SPEED: 2.2,
  GRAVITY: 0.55,
  JUMP_V: -9.2,
  MAX_FALL: 12,
  // Releasing jump early cuts the remaining rise - a variable-height jump.
  // Cheap to implement and it's what makes precise dodges (hopping a sniper
  // round without sailing into the rocket above it) actually possible.
  JUMP_CUTOFF: 0.45,
  // Contra is one-hit-kill, which is far too punishing for a casual player
  // dropping into an arcade cabinet inside another game. A 3-hit bar plus
  // i-frames keeps the tension without the restart-the-level frustration.
  PLAYER_HP: 3,
  PLAYER_LIVES: 3,
  IFRAMES: 70,
  RESPAWN_IFRAMES: 120, // longer: you usually die BECAUSE you were somewhere bad
  KNOCKBACK: 2.4,
  // Weapon. 8-frame cooldown is ~7.5 shots/sec - fast enough to feel like a
  // rifle, slow enough that aiming still matters.
  FIRE_COOLDOWN: 8,
  BULLET_SPEED: 6.4,
  BULLET_DMG: 1,

  // Damage is differentiated so the three enemies mean different things: the
  // AR trooper is chip damage you can trade with, while a sniper round or a
  // rocket takes two thirds of a life. Uniform damage made all three read as
  // the same threat wearing different sprites.
  AR_HP: 2,
  AR_DMG: 1,
  AR_SPEED: 0.75,
  AR_RANGE: 210,
  AR_FIRE_EVERY: 90,
  AR_BULLET_SPEED: 3.1,

  SNIPER_HP: 2, // glass cannon: its threat is the telegraph, not durability
  SNIPER_DMG: 2,
  SNIPER_RANGE: 370,
  SNIPER_TELEGRAPH: 55, // wind-up before the shot - the whole point of this
  SNIPER_FIRE_EVERY: 150, // enemy is that it's dodgeable if you're watching
  SNIPER_BULLET_SPEED: 5.6,

  RPG_HP: 3,
  RPG_DMG: 2,
  RPG_RANGE: 260,
  RPG_FIRE_EVERY: 130,
  RPG_BULLET_SPEED: 3.0,
  RPG_ARC: -3.2, // initial upward kick; rockets fall under HALF gravity

  // BOSS_HP is derived from how long the fight should LAST, not from
  // BOSS_SCALE - scaling the sprite 3x and the health 3x with it would give
  // 9hp, about a second and a half of fire, which is a large trooper rather
  // than a boss. Player DPS ceiling is 7.5/sec (1 dmg / 8 frames); realistic
  // uptime while dodging salvos is roughly 45%, so ~3.4 effective dmg/sec.
  // 180 therefore lands a ~55 second fight.
  BOSS_HP: 180,
  BOSS_SCALE: 3,
  BOSS_SPEED: 0.35, // well under RUN_SPEED: the player can always out-position it
  BOSS_SALVO_GAP: 16,
  // Phases are gated on remaining health rather than a timer, so the fight
  // paces itself: good damage skips the gentle patterns quickly, while a
  // struggling player gets more practice against them before the hard one.
  // Escalation is rocket COUNT and SPREAD only - the sprite has exactly one
  // attack animation, and rocket speed never rises, so the fight never
  // breaks the fairness contract the regular RPG troopers taught.
  BOSS_PHASES: [
    { above: 0.66, rockets: 1, spread: 0, every: 140 },
    { above: 0.33, rockets: 3, spread: 0.8, every: 165 },
    { above: 0, rockets: 5, spread: 0.7, every: 190 },
  ],

  // Scoring. Kills are the bulk of it; the clear bonus exists so finishing
  // beats farming the last few enemies before the exit.
  SCORE_KILL: { ar: 100, sniper: 150, rpg: 200, boss: 2000 },
  SCORE_LEVEL_CLEAR: 500,
  SCORE_NO_DAMAGE_BONUS: 750,
}

// --- levels ----------------------------------------------------------------
// Coordinates are in TILE units. A solid is [col, row, widthTiles, heightTiles]
// and is both drawn (fill tiles + a cap row on top) and collided against as a
// single AABB - one body per rectangle rather than per tile, which keeps the
// collision pass trivial at these level sizes.
//
// Levels are exactly VIEW_H tall (17 tiles): the camera scrolls horizontally
// only, like the arcade games this is imitating. Anything below the last row
// is a pit, and falling into one costs a life.
const s = (c, r, w, h) => ({ c, r, w, h })
const p = (key, c, r) => ({ key, c, r })
const e = (type, c, r) => ({ type, c, r })

// Props are anchored by their BOTTOM edge on row r, i.e. at (r + 1) * TILE.
// Anything in this set hangs on a wall and is SUPPOSED to float clear of the
// floor; everything else is a physical object that must sit on a solid, and
// checkRunNGunLevels.mjs enforces exactly that. Without the distinction it is
// very easy to leave a vending machine hovering two feet in the air, which is
// how the first pass of these levels shipped.
export const WALL_PROPS = new Set(['station_sign', 'poster', 'screen', 'pipe'])

export const LEVELS = [
  {
    id: 'subway',
    name: 'Sector A - Central Line',
    fill: 'sub_fill',
    cap: 'sub_cap',
    // Two layers, both scrolling slower than the camera. wall_subway is the
    // taller, nearer one so it gets the faster factor.
    bg: [
      { key: 'subway_bg', factor: 0.25, y: 0 },
      { key: 'subway_wall', factor: 0.5, y: -40 },
    ],
    widthTiles: 210,
    heightTiles: 17,
    solids: [
      s(0, 14, 42, 3),
      // First pit - deliberately narrow (3 tiles) and early, as a safe
      // place to learn the jump arc before anything is shooting at you.
      s(45, 14, 30, 3),
      s(60, 10, 7, 1),
      s(78, 14, 26, 3),
      s(88, 10, 6, 1),
      s(95, 7, 5, 1),
      s(107, 14, 34, 3),
      s(116, 11, 8, 1),
      s(128, 8, 7, 1),
      s(144, 14, 24, 3),
      s(152, 10, 6, 1),
      s(171, 14, 39, 3),
      s(180, 11, 7, 1),
      s(191, 8, 6, 1),
    ],
    props: [
      p('station_sign', 6, 11), p('poster', 14, 11), p('barrel', 22, 13),
      p('vending', 30, 13), p('pipe', 37, 12), p('door', 50, 13),
      p('screen', 63, 11), p('barrel', 80, 13), p('poster', 84, 11),
      p('station_sign', 98, 11), p('barrel', 110, 13), p('door', 120, 13),
      p('vending', 135, 13), p('pipe', 147, 12), p('screen', 158, 11),
      p('poster', 175, 11), p('barrel', 185, 13), p('station_sign', 200, 11),
    ],
    enemies: [
      e('ar', 26, 13),
      e('ar', 52, 13),
      e('sniper', 64, 9),
      e('ar', 70, 13),
      e('ar', 84, 13),
      e('sniper', 90, 9),
      e('rpg', 100, 13),
      e('ar', 112, 13),
      e('ar', 120, 13),
      e('sniper', 130, 7),
      e('rpg', 136, 13),
      e('ar', 150, 13),
      e('ar', 160, 13),
      e('sniper', 182, 10),
      e('rpg', 176, 13),
      e('ar', 196, 13),
      e('ar', 202, 13),
    ],
  },
  {
    id: 'ruins',
    name: 'Sector B - Surface Ruins',
    fill: 'out_fill',
    cap: 'out_cap',
    // Same two-layer subway backdrop as Sector A (see that level's own `bg`
    // comment) rather than the pack's own 3-layer cloud skyline - the user's
    // explicit request, at the cost of the outdoor "surface" backdrop no
    // longer matching this sector's "Surface Ruins" name/out_fill-out_cap
    // ground tiles. clouds1/2/3 stay in IMAGES above even though nothing
    // references them now, in case that mismatch means this gets reverted.
    bg: [
      { key: 'subway_bg', factor: 0.25, y: 0 },
      { key: 'subway_wall', factor: 0.5, y: -40 },
    ],
    widthTiles: 200,
    heightTiles: 17,
    // Every pit here is exactly 3 tiles (48px). A running jump covers ~73px
    // (2 * |JUMP_V| / GRAVITY frames of airtime at RUN_SPEED), so 3 tiles
    // clears with real margin and 5 would be a coin-flip - worth keeping
    // uniform rather than letting one gap silently become a difficulty
    // spike that has nothing to do with the enemies.
    solids: [
      s(0, 14, 34, 3),
      s(24, 10, 8, 1),
      s(37, 14, 22, 3),
      s(44, 11, 6, 1),
      s(52, 8, 6, 1),
      s(62, 14, 28, 3),
      s(72, 10, 7, 1),
      s(83, 7, 6, 1),
      s(93, 14, 20, 3),
      s(101, 11, 7, 1),
      s(112, 8, 7, 1),
      s(116, 14, 26, 3),
      s(128, 10, 6, 1),
      s(137, 7, 7, 1),
      // Boss arena: one long unbroken floor. No pits and no platforms here
      // on purpose - the fight should be about reading the rocket arcs and
      // moving, not about also not falling in a hole.
      s(145, 14, 55, 3),
    ],
    props: [
      p('bush', 4, 13), p('street_lamp', 12, 13), p('crate', 20, 13),
      p('cone', 28, 13), p('road_sign', 33, 13), p('bush', 40, 13),
      p('crate', 48, 13), p('street_lamp', 56, 13), p('cone', 66, 13),
      p('bush', 74, 13), p('road_sign', 80, 13), p('crate', 88, 13),
      p('street_lamp', 98, 13), p('cone', 106, 13), p('bush', 116, 13),
      // col 147, not 142: 142-144 is a pit, and a street lamp planted in
      // mid-air over it is one of the first things the eye catches.
      p('crate', 124, 13), p('road_sign', 132, 13), p('street_lamp', 147, 13),
      p('bush', 152, 13), p('cone', 160, 13),
    ],
    enemies: [
      e('ar', 18, 13),
      e('sniper', 26, 9),
      e('ar', 30, 13),
      e('rpg', 42, 13),
      e('ar', 46, 10),
      e('sniper', 54, 7),
      e('ar', 68, 13),
      e('ar', 76, 13),
      e('rpg', 84, 13),
      e('sniper', 85, 6),
      e('ar', 98, 13),
      e('rpg', 104, 13),
      e('sniper', 114, 7),
      e('ar', 124, 13),
      e('ar', 130, 13),
      e('rpg', 139, 13),
      e('ar', 146, 13),
    ],
    // Placed deep enough into the arena that the camera has settled before
    // the fight starts, rather than the boss sliding into frame mid-jump.
    // Row 13 like every ground-standing enemy: spawn puts the body's BOTTOM
    // at (r + 1) * TILE, so 13 lands it on the arena floor at y=224 - the
    // boss is 3x scale and would otherwise hover well above it.
    boss: { c: 186, r: 13 },
  },
]
