// Races Redline Rally headlessly and asserts the simulation actually works.
//
// The cabinet is driven by requestAnimationFrame, which does not run headless,
// so "does it render" can be checked by eye but "does it RACE" cannot.
// redlineRallyEngine.js is DOM-free for exactly this reason: this harness runs
// the same simulation the cabinet runs and checks the things that would
// silently ruin it - a car that never finishes, an AI that drives into the
// scenery and stops, lap counting that can be cheated by reversing over the
// line, positions that do not reflect who is actually ahead.
//
// The "player" here is a scripted bot using the same racing-line logic the AI
// uses, so a human is not required to prove a track is completable.
//
// Run: node production/simulateRedlineRally.mjs
import {
  createRace, step, nearestOnCenterline, carDamageFrame,
} from '../src/features/arcade/redlineRallyEngine.js'
import { TRACKS, BALANCE as B } from '../src/features/arcade/redlineRallyTracks.js'

let failures = 0
const check = (ok, msg) => {
  console.log(`    ${ok ? 'ok  ' : 'FAIL'}  ${msg}`)
  if (!ok) failures += 1
}

const IDLE = { steer: 0, throttle: 0, brake: 0, boost: false }
const clampOne = (v) => (v < -1 ? -1 : v > 1 ? 1 : v)
const TAU = Math.PI * 2
function angleDelta(a, b) {
  let d = (b - a) % TAU
  if (d > Math.PI) d -= TAU
  if (d < -Math.PI) d += TAU
  return d
}

// A competent scripted driver: aim up the road, lift for corners, boost on
// the straights. Deliberately NOT perfect - it uses the plain centreline with
// no lane offset, so if it can get round, a human can.
function botInput(race, car) {
  const cl = race.cl
  const speed = Math.hypot(car.vx, car.vy)
  const look = B.AI_LOOKAHEAD_BASE + speed * B.AI_LOOKAHEAD_SPEED
  const steps = Math.round(look / cl.ds)
  const ahead = (car.idx + steps) % cl.count
  let worst = 0
  for (let k = 0; k <= steps; k += 2) {
    const c = cl.curv[(car.idx + k) % cl.count]
    if (c > worst) worst = c
  }
  const target = Math.min(B.TOP_SPEED, Math.sqrt(B.CORNER_GRIP / Math.max(worst, 1e-5)))
  const want = Math.atan2(cl.ys[ahead] - car.y, cl.xs[ahead] - car.x)
  return {
    steer: Math.max(-1, Math.min(1, angleDelta(car.heading, want) / B.AI_STEER_GAIN)),
    throttle: speed < target ? 1 : 0,
    brake: speed > target * 1.04 ? 1 : 0,
    boost: car.nitro > 20 && worst < B.AI_BOOST_CURV,
  }
}

// Run a whole race to completion (or give up). Returns the finished race.
function runRace(trackIndex, { drive = botInput, maxFrames = 60 * 400 } = {}) {
  const race = createRace(trackIndex)
  let frames = 0
  while (race.phase !== 'finished' && frames < maxFrames) {
    step(race, race.phase === 'racing' ? drive(race, race.player) : IDLE)
    frames += 1
  }
  race.framesTaken = frames
  return race
}

console.log('\n=== full races, every track ===')
for (let i = 0; i < TRACKS.length; i++) {
  const track = TRACKS[i]
  console.log(`\n  ${track.name}`)
  const race = runRace(i)

  check(race.phase === 'finished', `race reached the finish (${race.framesTaken} frames)`)
  check(race.player.lap >= track.laps, `bot completed all ${track.laps} laps (got ${race.player.lap})`)

  const finite = race.cars.every((c) => Number.isFinite(c.x) && Number.isFinite(c.y)
    && Number.isFinite(c.vx) && Number.isFinite(c.vy))
  check(finite, 'no car went NaN')

  check(race.cars.every((c) => c.place >= 1 && c.place <= 4),
    'every car was assigned a finishing place')
  const places = race.cars.map((c) => c.place).sort()
  check(places.join() === '1,2,3,4', `places are a clean 1-4 permutation (${places.join()})`)

  const secs = (race.framesTaken / 60).toFixed(0)
  const lapAvg = race.player.lapTimes.length
    ? (race.player.lapTimes.reduce((a, b) => a + b, 0) / race.player.lapTimes.length / 60).toFixed(1)
    : 'n/a'
  console.log(`      bot finished P${race.player.place} in ${secs}s, avg lap ${lapAvg}s,`
    + ` hp ${race.player.hp}, nitro ${Math.round(race.player.nitro)}`)

  // Every car should have covered real ground - an AI stuck against scenery
  // would sit at lap 0 while the race timed out around it.
  const stuck = race.cars.filter((c) => c.lap < 1)
  check(stuck.length === 0,
    `no car was stuck below one lap${stuck.length ? ` (${stuck.map((c) => c.id)})` : ''}`)

  // Bot laps should be within a sane band of the geometric estimate.
  const lapSecs = race.player.lapTimes.map((f) => f / 60)
  check(lapSecs.every((s) => s > 8 && s < 90),
    `every bot lap is a plausible time (${lapSecs.map((s) => s.toFixed(1)).join(', ')})`)
}

console.log('\n=== AI tiers finish in their intended order ===')
{
  // Averaged over several races, the faster tier should beat the slower.
  // Single races are noisy by design (that is the mistake model working), so
  // this asserts the trend, not a per-race ordering.
  const totals = [0, 0, 0]
  const RUNS = 5
  for (let r = 0; r < RUNS; r++) {
    const race = runRace(0)
    for (const car of race.cars) {
      if (car.aiTier) totals[B.AI_TIERS.indexOf(car.aiTier)] += car.place
    }
  }
  const avg = totals.map((t) => (t / RUNS).toFixed(2))
  console.log(`    mean finishing place over ${RUNS} races: `
    + B.AI_TIERS.map((t, i) => `${t.name} ${avg[i]}`).join(',  '))
  check(Number(avg[0]) <= Number(avg[2]),
    `fastest tier (${B.AI_TIERS[0].name}) outperforms slowest (${B.AI_TIERS[2].name})`)
}

console.log('\n=== the race is both winnable and losable ===')
{
  // Comparing finish TIMES is meaningless here: once the player crosses, the
  // engine settles the remaining places in the same frame, so every car
  // shares a finish frame by construction. What actually matters is whether
  // the outcome depends on how well you drive - so run the same track with a
  // clean driver and with a sloppy one and check the results diverge.
  const RUNS = 7

  const sloppy = (race, car) => {
    const base = botInput(race, car)
    return {
      ...base,
      steer: clampOne(base.steer + (Math.random() - 0.5) * 0.9),
      throttle: Math.random() < 0.82 ? base.throttle : 0, // lifts at the wrong moments
      boost: false, // never uses nitro
    }
  }

  let cleanWins = 0
  let sloppyWins = 0
  const cleanPlaces = []
  const sloppyPlaces = []
  for (let r = 0; r < RUNS; r++) {
    const a = runRace(0)
    if (a.player.place === 1) cleanWins += 1
    cleanPlaces.push(a.player.place)
    const b = runRace(0, { drive: sloppy })
    if (b.player.place === 1) sloppyWins += 1
    sloppyPlaces.push(b.player.place)
  }
  console.log(`    clean driver  places: ${cleanPlaces.join(',')}  (${cleanWins}/${RUNS} wins)`)
  console.log(`    sloppy driver places: ${sloppyPlaces.join(',')}  (${sloppyWins}/${RUNS} wins)`)
  check(cleanWins > sloppyWins,
    `driving well beats driving badly (${cleanWins} vs ${sloppyWins} wins)`)
  check(sloppyWins < RUNS,
    'a bad driver does not win every race - the AI is a real opponent')
}

console.log('\n=== lap counting cannot be cheated ===')
{
  // Drive backwards from the grid. The car crosses the start line the wrong
  // way, which must NOT bank a lap.
  const race = createRace(0)
  while (race.phase === 'countdown') step(race, IDLE)
  for (let i = 0; i < 60 * 12; i++) {
    // full reverse: point the car backwards down the road and drive
    const cl = race.cl
    const back = (race.player.idx - 12 + cl.count) % cl.count
    const want = Math.atan2(cl.ys[back] - race.player.y, cl.xs[back] - race.player.x)
    step(race, {
      steer: Math.max(-1, Math.min(1, angleDelta(race.player.heading, want) / B.AI_STEER_GAIN)),
      throttle: 1, brake: 0, boost: false,
    })
  }
  check(race.player.lap <= 0,
    `driving backwards over the line banks no lap (lap = ${race.player.lap})`)
}

console.log('\n=== sector gates block a course cut ===')
{
  // Teleport the player almost all the way round without visiting the middle
  // sectors, then across the line. The sector set should refuse the lap.
  const race = createRace(0)
  while (race.phase === 'countdown') step(race, IDLE)
  const cl = race.cl
  const nearEnd = Math.floor(cl.count * 0.93)
  race.player.x = cl.xs[nearEnd]
  race.player.y = cl.ys[nearEnd]
  race.player.heading = cl.tang[nearEnd]
  // Re-seat progress without letting it credit the skipped sectors.
  const seat = nearestOnCenterline(cl, race.player.x, race.player.y, -1)
  race.player.idx = seat.idx
  race.player.s = seat.s
  race.player.sectorsHit = new Set([3])
  for (let i = 0; i < 60 * 8; i++) step(race, botInput(race, race.player))
  check(race.player.lap === 0,
    `crossing the line having skipped sectors banks no lap (lap = ${race.player.lap})`)
}

console.log('\n=== hazards and pickups do what they claim ===')
{
  const race = createRace(0)
  while (race.phase === 'countdown') step(race, IDLE)
  const p = race.player

  // oil -> spin. The car must be MOVING: oil deliberately ignores anything
  // crawling below OIL_MIN_SPEED, which is what stops a stopped car
  // re-spinning on the spot forever.
  const oil = race.hazards.find((h) => h.kind === 'oil')
  p.x = oil.x; p.y = oil.y
  p.vx = Math.cos(p.heading) * B.TOP_SPEED
  p.vy = Math.sin(p.heading) * B.TOP_SPEED
  step(race, IDLE)
  check(p.spin > 0, 'driving onto oil at speed starts a spin')

  // barrel -> damage + speed loss
  const race2 = createRace(0)
  while (race2.phase === 'countdown') step(race2, IDLE)
  const q = race2.player
  const barrel = race2.hazards.find((h) => h.kind === 'barrel')
  const hpBefore = q.hp
  q.x = barrel.x; q.y = barrel.y
  q.vx = B.TOP_SPEED; q.vy = 0
  step(race2, IDLE)
  check(q.hp === hpBefore - B.BARREL_DAMAGE,
    `hitting a barrel costs exactly ${B.BARREL_DAMAGE} hp (${hpBefore} -> ${q.hp})`)
  check(Math.hypot(q.vx, q.vy) < B.TOP_SPEED * 0.8, 'hitting a barrel scrubs speed')

  // nitro pickup -> refills
  const race3 = createRace(0)
  while (race3.phase === 'countdown') step(race3, IDLE)
  const r = race3.player
  r.nitro = 0
  const nitro = race3.pickups.find((pk) => pk.kind === 'nitro')
  r.x = nitro.x; r.y = nitro.y
  step(race3, IDLE)
  check(r.nitro >= B.NITRO_PICKUP - 1, `nitro pickup refills (0 -> ${Math.round(r.nitro)})`)

  // jump pad -> airborne, and airborne ignores the surface
  const race4 = createRace(0)
  while (race4.phase === 'countdown') step(race4, IDLE)
  const j = race4.player
  const pad = race4.hazards.find((h) => h.kind === 'jump')
  j.x = pad.x; j.y = pad.y
  step(race4, IDLE)
  check(j.air > 0, 'jump pad puts the car in the air')
}

console.log('\n=== hazards cannot soft-lock a car (regressions) ===')
{
  // Oil used to be a trap: the spin cut the throttle, so a car that entered
  // a slick slowly stopped dead on top of it and re-span forever - 185 spins
  // and zero laps completed. Park a stationary car right on a slick and
  // confirm it drives away.
  const race = createRace(0)
  while (race.phase === 'countdown') step(race, IDLE)
  const p = race.player
  const oil = race.hazards.find((h) => h.kind === 'oil')
  p.x = oil.x; p.y = oil.y; p.vx = 0; p.vy = 0
  let spins = 0
  let prev = p.spin
  for (let i = 0; i < 60 * 10; i++) {
    step(race, botInput(race, p))
    if (p.spin > prev) spins += 1
    prev = p.spin
  }
  const away = Math.hypot(p.x - oil.x, p.y - oil.y)
  check(spins <= 2, `a car dumped on a slick spins at most twice (got ${spins})`)
  check(away > oil.r, `it drives clear of the slick (${Math.round(away)}px > r${oil.r})`)

  // Barrels had the same shape of bug: rest inside the radius and chip HP
  // every HIT_COOLDOWN frames. The contact normal now pushes the car clear.
  //
  // The rivals are removed for this one: left in, they race past and shove
  // the parked test car back onto the barrel, which is legitimate racing but
  // makes the check flaky (~2 runs in 3) and is not what is being tested.
  const race2 = createRace(0)
  while (race2.phase === 'countdown') step(race2, IDLE)
  const q = race2.player
  race2.cars = [q]
  const barrel = race2.hazards.find((h) => h.kind === 'barrel')
  q.x = barrel.x; q.y = barrel.y; q.vx = 0; q.vy = 0
  step(race2, IDLE)
  const gap = Math.hypot(q.x - barrel.x, q.y - barrel.y)
  check(gap > barrel.r, `hitting a barrel pushes the car clear of it (${Math.round(gap)}px > r${barrel.r})`)
  const hpAfterOne = q.hp
  for (let i = 0; i < 60 * 5; i++) step(race2, IDLE)
  check(q.hp === hpAfterOne,
    `an undisturbed car is not chip-damaged by the barrel it just hit (${hpAfterOne} -> ${q.hp})`)
}

console.log('\n=== wrecked cars limp, they do not vanish ===')
{
  const race = createRace(0)
  while (race.phase === 'countdown') step(race, IDLE)
  const p = race.player
  p.hp = 0
  for (let i = 0; i < 240; i++) step(race, botInput(race, p))
  const speed = Math.hypot(p.vx, p.vy)
  check(!p.finished && Number.isFinite(p.x), 'a 0-hp car keeps racing')
  check(speed <= B.TOP_SPEED * B.WRECK_SPEED + 0.35,
    `0-hp car is speed-capped to ~${(B.TOP_SPEED * B.WRECK_SPEED).toFixed(2)} (got ${speed.toFixed(2)})`)
  check(carDamageFrame(p) === 4, 'a 0-hp car draws the most wrecked sprite frame')
}

console.log('\n=== payout follows its stated derivation ===')
{
  // The rule is payout(position) = (4 - position) * ENTRY_FEE - your stake
  // back per rival beaten. Asserted against the table so the two cannot
  // drift apart, since the comment in redlineRallyTracks.js claims it.
  const derived = B.PLACE_PAYOUT.map((_, i) => (B.PLACE_PAYOUT.length - 1 - i) * B.ENTRY_FEE)
  check(derived.join() === B.PLACE_PAYOUT.join(),
    `table [${B.PLACE_PAYOUT}] matches (4 - place) * ${B.ENTRY_FEE} = [${derived}]`)

  const net = B.PLACE_PAYOUT.map((p) => p - B.ENTRY_FEE)
  console.log(`    net by place: ${net.map((n, i) => `P${i + 1} ${n >= 0 ? '+' : ''}${n}`).join(', ')}`)
  check(net[3] < 0, 'finishing last loses the entry fee')
  check(net[0] > 0 && net[1] > 0 && net[2] >= 0, 'no podium finish nets a loss')
  // Self-capping: unlike Third Rail's unbounded score, position is bounded,
  // so the ceiling needs no clamp. Guard that the ceiling stays modest.
  check(Math.max(...B.PLACE_PAYOUT) <= B.ENTRY_FEE * 3,
    `best payout ${Math.max(...B.PLACE_PAYOUT)} is bounded at 3x the fee`)
}

console.log(failures ? `\n${failures} check(s) FAILED\n` : '\nall race checks passed\n')
process.exit(failures ? 1 : 0)
