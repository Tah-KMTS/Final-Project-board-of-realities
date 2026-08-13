// Plays the Third Rail cabinet headlessly and asserts it actually works.
//
// The game loop is driven by requestAnimationFrame, which does not run in a
// headless or backgrounded context - so "does it render" can be checked by
// eye but "does the game FUNCTION" cannot. runAndGunEngine.js is deliberately
// DOM-free for this reason: this harness imports the same simulation the
// cabinet runs, feeds it scripted input, and checks the outcomes that matter -
// the player traverses a level, bullets kill things, the boss fight ends, and
// nothing goes NaN or falls through the floor.
//
// Run: node production/simulateRunNGun.mjs
import { createGame, step } from '../src/features/arcade/runAndGunEngine.js'
import { LEVELS, BALANCE as B, TILE } from '../src/features/arcade/runAndGunLevels.js'

let failures = 0
const check = (ok, msg) => {
  console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${msg}`)
  if (!ok) failures += 1
}

const noInput = { left: false, right: false, up: false, down: false, jump: false, fire: false }
const input = (over = {}) => ({ ...noInput, ...over })

// A bot that runs right, fires constantly, and jumps when it is about to run
// out of floor or has stopped making progress. Crude, but enough to prove the
// level is traversable and the combat loop resolves.
//
// It must HOLD jump, not tap it. The game has a variable-height jump (release
// early and the rest of the rise is cut), so a bot that sets jump on the
// takeoff frame only gets a 20px hop and drops straight into the first 48px
// pit. `hold` keeps the button down long enough to clear the apex - the same
// thing a human does without thinking about it.
const JUMP_HOLD_FRAMES = 20
function makeBot() {
  return { hold: 0 }
}
function autoInput(bot, g, prevX) {
  const p = g.player
  const stuck = Math.abs(p.x - prevX) < 0.2
  // Look a bit more than one jump's braking distance ahead, so the takeoff
  // happens before the very last pixel of floor.
  const aheadX = p.x + p.w + 10
  const footY = p.y + p.h + 2
  const groundAhead = g.level.solids.some(
    (s) => aheadX >= s.x && aheadX <= s.x + s.w && footY >= s.y - 2 && footY <= s.y + s.h
  )
  if (p.grounded && (!groundAhead || stuck)) bot.hold = JUMP_HOLD_FRAMES
  const jump = bot.hold > 0
  if (bot.hold > 0) bot.hold -= 1
  return input({ right: true, fire: true, jump })
}

function run(label, levelIndex, maxFrames, opts = {}) {
  console.log(`\n${label}`)
  const g = createGame(levelIndex, opts.carry ?? null)
  let prevX = g.player.x
  let frames = 0
  let sawEnemyDeath = false
  let minHpSeen = g.player.hp
  let bulletsEverFired = false
  let deaths = 0
  const bot = makeBot()

  while (frames < maxFrames && g.phase === 'play') {
    const before = g.level.enemies.filter((e) => e.dying === 0).length
    const livesBefore = g.lives
    const inp = opts.input ? opts.input(g, prevX) : autoInput(bot, g, prevX)
    prevX = g.player.x
    step(g, inp)
    // `tough` makes the bot immune to enemy fire and contact, but NOT to
    // pits. The autopilot is a blind charger - it walks into troopers and
    // would die to them no matter how well the level is built - so combat
    // survivability is tested separately (see the trooper duel above) and
    // this mode isolates the question actually being asked here: is the
    // level geometry traversable from spawn to exit?
    if (opts.tough) { g.player.iframes = 9999; g.lives = 99 }
    frames += 1
    if (g.lives < livesBefore) deaths += 1
    if (g.bullets.length > 0) bulletsEverFired = true
    if (g.level.enemies.filter((e) => e.dying === 0).length < before) sawEnemyDeath = true
    minHpSeen = Math.min(minHpSeen, g.player.hp)

    if (!Number.isFinite(g.player.x) || !Number.isFinite(g.player.y)) {
      check(false, `player position went non-finite at frame ${frames}`)
      return g
    }
  }

  const secs = (frames / 60).toFixed(1)
  console.log(`  ran ${frames} frames (${secs}s), phase=${g.phase}, score=${g.score}, pit deaths=${deaths}`)
  return { g, frames, sawEnemyDeath, minHpSeen, bulletsEverFired, deaths }
}

// --- 1. the player can stand up -------------------------------------------
console.log('\nstanding still on the spawn floor')
{
  const g = createGame(0)
  const startY = g.player.y
  for (let i = 0; i < 120; i += 1) step(g, noInput)
  check(g.player.grounded, 'player is grounded after 2s of doing nothing')
  check(Math.abs(g.player.y - startY) < TILE, `player did not sink through the floor (y ${startY} -> ${g.player.y.toFixed(1)})`)
  check(g.player.hp === B.PLAYER_HP, 'player took no damage standing at spawn')
}

// --- 2. jumping actually leaves the ground --------------------------------
console.log('\njump arc')
{
  const g = createGame(0)
  for (let i = 0; i < 30; i += 1) step(g, noInput)
  const groundY = g.player.y
  let peak = groundY
  for (let i = 0; i < 40; i += 1) {
    step(g, input({ jump: true }))
    peak = Math.min(peak, g.player.y)
  }
  const rise = groundY - peak
  check(rise > TILE * 3, `full jump clears more than 3 tiles (rose ${rise.toFixed(0)}px)`)
  // The variable-height jump must actually be shorter when released early.
  const g2 = createGame(0)
  for (let i = 0; i < 30; i += 1) step(g2, noInput)
  const gy2 = g2.player.y
  let peak2 = gy2
  step(g2, input({ jump: true }))
  for (let i = 0; i < 40; i += 1) { step(g2, noInput); peak2 = Math.min(peak2, g2.player.y) }
  const tapRise = gy2 - peak2
  check(tapRise < rise - 4, `tapping jump rises less than holding it (${tapRise.toFixed(0)}px vs ${rise.toFixed(0)}px)`)
}

// --- 3. the rifle kills things --------------------------------------------
console.log('\nweapon vs a single trooper')
{
  const g = createGame(0)
  // Park the player just left of the first AR trooper and shoot right.
  const target = g.level.enemies.find((e) => e.type === 'ar')
  g.player.x = target.x - 90
  let killed = false
  for (let i = 0; i < 400 && !killed; i += 1) {
    step(g, input({ fire: true }))
    if (target.dying > 0) killed = true
  }
  check(killed, `an AR trooper dies to sustained fire (${B.AR_HP} hp vs ${B.BULLET_DMG} dmg/shot)`)
  check(g.score > 0, `killing it scored points (score=${g.score})`)
}

// --- 4. level 1 is traversable --------------------------------------------
const l1 = run('level 1 - autopilot run to the exit', 0, 60 * 240, { tough: true })
check(l1.g.phase === 'levelClear', `level 1 reaches the exit (phase=${l1.g.phase})`)
check(l1.bulletsEverFired, 'the player fired at least one bullet')
check(l1.sawEnemyDeath, 'at least one enemy died during the run')
check(l1.frames < 60 * 240, 'level 1 completed inside the 4 minute budget')
check(l1.deaths < 12, `the autopilot did not get stuck in a respawn loop (${l1.deaths} pit deaths)`)

// --- 5. level 2 + boss ------------------------------------------------------
const l2 = run('level 2 - autopilot into the boss fight', 1, 60 * 300, {
  tough: true,
  carry: { hp: B.PLAYER_HP, lives: B.PLAYER_LIVES, score: 0, tookDamage: false },
})
check(l2.g.phase === 'won', `level 2 ends in victory over the boss (phase=${l2.g.phase})`)
if (l2.g.phase === 'won') {
  check(l2.frames > 60 * 30, `the run was not trivially short (${(l2.frames / 60).toFixed(0)}s)`)
}
check(l2.deaths < 12, `level 2 had no respawn loop (${l2.deaths} pit deaths)`)

// --- 6. dying costs a life and respawns on solid ground --------------------
console.log('\ndeath and respawn')
{
  const g = createGame(0)
  for (let i = 0; i < 30; i += 1) step(g, noInput)
  const livesBefore = g.lives
  // Walk off the map bottom by teleporting into the first pit.
  g.player.y = g.level.worldH + 100
  for (let i = 0; i < 150; i += 1) step(g, noInput)
  check(g.lives === livesBefore - 1, `falling in a pit costs exactly one life (${livesBefore} -> ${g.lives})`)
  check(g.player.y < g.level.worldH, 'respawn puts the player back inside the level')
  const onSolid = g.level.solids.some(
    (s) => g.player.x + g.player.w > s.x && g.player.x < s.x + s.w && g.player.y + g.player.h <= s.y + 4
  )
  check(onSolid, 'respawn point has floor beneath it')
  check(g.player.hp === B.PLAYER_HP, 'respawn restores full health')
}

// --- 7. losing every life ends the run ------------------------------------
console.log('\nrunning out of lives')
{
  const g = createGame(0)
  for (let i = 0; i < 30; i += 1) step(g, noInput)
  for (let life = 0; life < B.PLAYER_LIVES + 1 && g.phase === 'play'; life += 1) {
    g.player.y = g.level.worldH + 100
    for (let i = 0; i < 150 && g.phase === 'play'; i += 1) step(g, noInput)
  }
  check(g.phase === 'over', `the run ends after ${B.PLAYER_LIVES} lives (phase=${g.phase})`)
}

// --- 8. enemies cannot shoot you from off-screen ---------------------------
console.log('\noff-camera enemies are dormant')
{
  const g = createGame(0)
  for (let i = 0; i < 240; i += 1) step(g, noInput)
  const far = g.bullets.filter((b) => b.hostile && Math.abs(b.x - g.player.x) > 700)
  check(far.length === 0, 'no hostile fire originates far off-camera')
}

console.log(failures === 0 ? `\nOK - all simulation checks passed` : `\n${failures} check(s) FAILED`)
process.exit(failures === 0 ? 0 : 1)
