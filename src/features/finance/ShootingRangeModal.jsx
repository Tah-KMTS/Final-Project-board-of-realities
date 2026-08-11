import { useCallback, useEffect, useRef, useState } from 'react'
import { clamp } from './crimeDifficulty'
import { playGunshotSound, playGoodHitSound, playBadHitSound, playVictorySound } from '../../audio/sfx'
import { useGameStore } from '../../store/useGameStore'

// GunStoreModal.jsx's "Test-Fire Range" tab (src/features/world/GunStoreModal.jsx)
// - moved here from Crime Alley (districtBuildings.js's crimeAlley entry now
// uses LookoutWatchModal instead; see that file's header comment). A gun
// store test range has no reason to carry crime stakes, so this is no
// longer a `type: 'leverage'`/applyCrimeOutcome job at all: no notoriety/
// wanted/jail consequences on a bad run - a score-attack arcade session
// against a localStorage-backed personal best (BEST_SCORE_STORAGE_KEY
// below) that still costs energy to start and pays cash out by final score
// (RANGE_ENERGY_COST/SCORE_TO_CASH below), same as any other energy-gated
// hustle. Civilian hits still dock points (that's the actual skill test -
// shoot/no-shoot discrimination, not a legal penalty) and the run still
// ends when the clock runs out; there's just no jail/notoriety riding on it.
//
// MECHANIC: mouse-aimed shooting gallery, timed. The crosshair follows the
// mouse but SWAYS around it - sway shrinks toward 0 only while the mouse
// holds still (STEADY_MS), so a precise shot means aim, hold, fire, not
// just click a label. Bullseye/Crew are "shoot" (bank Score - a dead-center
// Bullseye pays more than an outer-ring hit); Civilian is "no-shoot" (a shot
// landing in its circle, deliberate OR sway-induced, docks Score instead).
// TIME_LIMIT_MS is the only clock - it just runs out and shows the final
// tally, no win/lose branch.
//
// PRESENTATION: fake-3D rail shooter. RANGE_BG_URL is a static painted
// backdrop (public/assets/packs/shooting-range/range_bg.png). VP_X/VP_Y/
// VP_HALF_W/NEAR_Y/NEAR_HALF_W below are hand-tuned to that image's own
// floor lines/doorway rather than derived from a formula, so a target at
// depth 1 still lands on the image's near lane markings instead of an
// arbitrary shape. Targets live in CORRIDOR SPACE (depth 0=far, 1=near;
// lateral -1..1 across the hall at that depth) and are projected to screen
// every frame by projectFromCorridor, so depth drives both apparent size
// AND the real hit-circle radius - a far target is a genuinely smaller
// hitbox, making distance a difficulty axis rather than decoration. Several
// targets run at once, they move (see rollMotion/stepTarget), and a wave
// ramp reads live time-elapsed progress to widen concurrency + speed as the
// session advances.
//
// spriteAspect = width/height of the source PNG (each is a tall standing
// board/figure, not a square icon, so width has to be derived from height
// per-render rather than assumed). anchorX/anchorY are WHERE IN THE SPRITE
// (0..1 of its own box) the actual hit-test center lives - the paper
// target's rings, or the civilian's torso - not the sprite's bounding-box
// center, since both images carry a stand/legs below that point.
const TARGET_TYPES = [
  {
    id: 'bullseye',
    weight: 55,
    label: 'Bullseye',
    shoot: true,
    outerRadius: 36,
    innerRadius: 16,
    spriteUrl: '/assets/packs/shooting-range/target_bullseye.png',
    spriteAspect: 353 / 666,
    anchorX: 0.47,
    anchorY: 0.3,
  },
  {
    id: 'crew',
    weight: 25,
    label: 'Crew',
    shoot: true,
    outerRadius: 44,
    innerRadius: null,
    spriteUrl: '/assets/packs/shooting-range/target_crew.png',
    spriteAspect: 268 / 597,
    anchorX: 0.5,
    anchorY: 0.28,
  },
  {
    id: 'civilian',
    weight: 20,
    label: 'DO NOT SHOOT',
    shoot: false,
    outerRadius: 38,
    innerRadius: null,
    spriteUrl: '/assets/packs/shooting-range/target_civilian.png',
    spriteAspect: 267 / 664,
    anchorX: 0.5,
    anchorY: 0.42,
  },
]
const TOTAL_WEIGHT = TARGET_TYPES.reduce((sum, t) => sum + t.weight, 0)

// Displayed sprite height at depth-scale 1 (the near plane) - width is
// derived per target from its own spriteAspect. Independent of outerRadius
// (the invisible hit-test circle): a standing board/figure and a hit-circle
// tuned for gameplay feel don't have to be the same number, the way a
// hitbox in most games doesn't pixel-match its sprite either.
const TARGET_SPRITE_BASE_H = 130

const RANGE_W = 560
const RANGE_H = 300
const FIRE_COOLDOWN_MS = 260 // reload/recoil delay - the anti-spam-click knob

// Painted range backdrop (2704x1568) - rendered with object-fit:cover into
// the RANGE_W x RANGE_H viewport, object-position:center. Cover's scale is
// width-constrained here (560/2704 > 300/1568), so it crops a sliver off the
// top and bottom only - the full lane width survives.
const RANGE_BG_URL = '/assets/packs/shooting-range/range_bg.png'

// Player back-view sprite, fixed at the shooter's own position (not tied to
// the mouse - the crosshair alone carries aim). Height chosen to read as a
// solid foreground presence without blocking much of the hall.
const PLAYER_SPRITE_URL = '/assets/packs/shooting-range/player_shooter.png'
const PLAYER_SPRITE_ASPECT = 212 / 489
const PLAYER_SPRITE_H = 150

// Fixed difficulty/timing - there's no more per-job favorability to scale
// these off (no stakes object anymore), so they're just picked at a
// reasonable mid-tier fixed value instead of derived from one.
const TIME_LIMIT_MS = 30000
const TARGET_LIFETIME_MS = 2600
const SPAWN_GAP_MS = 480
const MAX_SWAY_PX = 46
const STEADY_MS = 420
const SCORE_PER_CENTER = 10
const SCORE_PER_EDGE = 5
const SCORE_PER_CREW = 8
const COMBO_BONUS = 3
const SCORE_PENALTY_PER_CIVILIAN = 6

const BEST_SCORE_STORAGE_KEY = 'capitalSyndicate.gunRangeBestScore'

// Entry fee/payout: 15 energy to step up to the line (a shade under
// JOB_ENERGY_COST's 20, since a run is only 30s but skill-gated rather than
// a guaranteed payday), $2 cash per final Score point on the result screen.
// A solid run (~200-300 pts) nets $400-600, comparable to an Analyst shift
// for less energy - a hot streak with combo bonuses can beat that, which is
// the point: this is the skill-based earner, not the reliable one.
const RANGE_ENERGY_COST = 15
const SCORE_TO_CASH = 2

// Crosshair color: red while the aim is still drifting, green once it's
// settled - this is what replaced the old sway ring as the "how steady am
// I" read, so it has to actually communicate that.
function laserColor(steadiness) {
  const t = clamp(0, 1, steadiness)
  const r = Math.round(255 + (92 - 255) * t)
  const g = Math.round(90 + (255 - 90) * t)
  const b = Math.round(69 + (122 - 69) * t)
  return `rgb(${r}, ${g}, ${b})`
}

// Corridor bounds. Targets are clamped/bounced inside these rather than the
// raw 0..1 / -1..1 extremes so nothing spawns exactly on the vanishing point
// or clips into a side wall.
const DEPTH_MIN = 0.14
const DEPTH_MAX = 0.96
const LATERAL_LIMIT = 0.85

// Corridor geometry, matched to RANGE_BG_URL's own painted floor lines/back
// doorway (not derived from a formula the way an earlier Canvas-drawn hall's
// were) so projectFromCorridor's target placement actually lands on that
// artwork - a target at depth 1 sits on the image's near lane markings,
// depth 0 sits at the doorway. VP = vanishing point (the doorway, roughly
// centered but a touch right of it in this piece); NEAR_* is the closest
// visible plane (bottom of the box, at the shooter's own feet).
const VP_X = RANGE_W * 0.53
const VP_Y = RANGE_H * 0.29
const VP_HALF_W = RANGE_W * 0.14 // the doorway's own width at the vanishing point
const NEAR_Y = RANGE_H - 14
const NEAR_HALF_W = RANGE_W * 0.46

let targetSeq = 0
let markSeq = 0

function rollTargetType() {
  let roll = Math.random() * TOTAL_WEIGHT
  for (const t of TARGET_TYPES) {
    if (roll < t.weight) return t
    roll -= t.weight
  }
  return TARGET_TYPES[0]
}

// Corridor space -> screen space. The single source of truth for where a
// target actually is; called per frame per target since targets move.
function projectFromCorridor(depth, lateral) {
  const halfW = VP_HALF_W + (NEAR_HALF_W - VP_HALF_W) * depth
  return {
    x: VP_X + lateral * halfW,
    y: VP_Y + (NEAR_Y - VP_Y) * depth,
    scale: 0.32 + 0.85 * depth,
  }
}

// Movement profile, rolled per target. `progress` (0..1 through the session)
// makes later targets likelier to move and likelier to pick a harder
// pattern - the wave ramp's difficulty half (waveParams below is its
// density half).
//   static  - stands still (always some, so the range never becomes pure chaos
//             with nothing safe to line up on)
//   strafe  - slides across the hall, bouncing off both walls
//   bob     - pops up and down on its rail, screen-space vertical only
//   charge  - runs at you / retreats down the hall, changing size as it goes;
//             the hardest read, so it's rarest and only shows up late
function rollMotion(progress) {
  if (Math.random() > 0.25 + progress * 0.5) return { kind: 'static', vLat: 0, vDepth: 0, bobAmp: 0, bobPhase: 0 }
  const r = Math.random()
  const dir = Math.random() < 0.5 ? -1 : 1
  if (r < 0.45) {
    return { kind: 'strafe', vLat: dir * (0.18 + Math.random() * 0.22), vDepth: 0, bobAmp: 0, bobPhase: 0 }
  }
  if (r < 0.75) {
    return {
      kind: 'bob',
      vLat: 0,
      vDepth: 0,
      bobAmp: (9 + Math.random() * 12) * (RANGE_H / 300),
      bobPhase: Math.random() * Math.PI * 2,
    }
  }
  return { kind: 'charge', vLat: 0, vDepth: dir * (0.1 + Math.random() * 0.16), bobAmp: 0, bobPhase: 0 }
}

// Advances one target's corridor-space position by dt seconds and re-projects
// it. Mutates in place (these objects are owned by targetsRef and never shared
// with anything that memoizes on identity). Bouncing rather than despawning at
// the bounds keeps a mover on screen for its full lifetime, so its timer stays
// the thing that removes it - one removal path, not two.
function stepTarget(t, dtSec, speedMul, nowMs) {
  if (t.motion.vLat) {
    t.lateral += t.motion.vLat * speedMul * dtSec
    if (t.lateral > LATERAL_LIMIT || t.lateral < -LATERAL_LIMIT) {
      t.lateral = clamp(-LATERAL_LIMIT, LATERAL_LIMIT, t.lateral)
      t.motion.vLat *= -1
    }
  }
  if (t.motion.vDepth) {
    t.depth += t.motion.vDepth * speedMul * dtSec
    if (t.depth > DEPTH_MAX || t.depth < DEPTH_MIN) {
      t.depth = clamp(DEPTH_MIN, DEPTH_MAX, t.depth)
      t.motion.vDepth *= -1
    }
  }
  const p = projectFromCorridor(t.depth, t.lateral)
  t.x = p.x
  t.y = p.y + (t.motion.bobAmp ? Math.sin(nowMs * 0.005 + t.motion.bobPhase) * t.motion.bobAmp : 0)
  t.scale = p.scale
  t.outerR = t.type.outerRadius * p.scale
  t.innerR = t.type.innerRadius != null ? t.type.innerRadius * p.scale : null
}

// Wave ramp: how dense and how fast the range is right now. Reads live
// elapsed-time progress so a single session escalates. Concurrency steps
// rather than scaling smoothly, so the player can feel each new tier arrive.
function waveParams(progress) {
  return {
    maxConcurrent: progress > 0.75 ? 4 : progress > 0.4 ? 3 : 2,
    speedMul: 1 + progress * 1.2,
  }
}

// 'center' (Bullseye inner ring only) / 'edge' (inside outerR) / 'miss'.
// Reads the target's own scaled radii, not the raw catalog values.
function resolveShot(t, distPx) {
  if (t.innerR != null && distPx <= t.innerR) return 'center'
  if (distPx <= t.outerR) return 'edge'
  return 'miss'
}

export default function ShootingRangeModal({ onClose, embedded = false }) {
  const energy = useGameStore((s) => s.player.energy)
  const spendEnergy = useGameStore((s) => s.spendEnergy)
  const addCash = useGameStore((s) => s.addCash)

  const [screen, setScreen] = useState('intro') // 'intro' | 'range' | 'result'
  const [energyError, setEnergyError] = useState(false)
  const [score, setScore] = useState(0)
  const [timeLeftMs, setTimeLeftMs] = useState(TIME_LIMIT_MS)
  const [targets, setTargets] = useState([])
  const [crosshair, setCrosshair] = useState({ x: RANGE_W / 2, y: RANGE_H / 2 })
  const [steadiness, setSteadiness] = useState(0) // 0 = just moved, 1 = fully settled
  const [resultData, setResultData] = useState(null)
  const [marks, setMarks] = useState([]) // fading shot decals: { id, x, y, good }
  const [firedAt, setFiredAt] = useState(0) // drives muzzle flash + screen kick
  const [combo, setCombo] = useState(0)
  const [tally, setTally] = useState({ shots: 0, hits: 0, centers: 0 })
  const [bestScore, setBestScore] = useState(() => Number(localStorage.getItem(BEST_SCORE_STORAGE_KEY)) || 0)

  const scoreRef = useRef(0)
  const timeLeftMsRef = useRef(TIME_LIMIT_MS)
  const bestScoreRef = useRef(bestScore)
  const targetsRef = useRef([])
  const nextSpawnAtRef = useRef(0)
  const rawAimRef = useRef({ x: RANGE_W / 2, y: RANGE_H / 2 })
  const lastMoveAtRef = useRef(0)
  const lastFiredAtRef = useRef(0)
  const lastFrameAtRef = useRef(0)
  const swaySeedRef = useRef(0)
  const crosshairRef = useRef({ x: RANGE_W / 2, y: RANGE_H / 2 })
  const comboRef = useRef(0)
  // Shot ledger for the end-of-run scorecard. Refs, not state, so resolve()
  // reads the true final numbers rather than whatever React had committed at
  // the moment the last shot landed.
  const shotsRef = useRef(0)
  const hitsRef = useRef(0)
  const centersRef = useRef(0)
  const rafRef = useRef(null)
  const resolvedRef = useRef(false)

  const resolve = useCallback(() => {
    if (resolvedRef.current) return
    resolvedRef.current = true
    if (rafRef.current) cancelAnimationFrame(rafRef.current)

    const shots = shotsRef.current
    const hits = hitsRef.current
    const centers = centersRef.current
    const accuracy = shots > 0 ? hits / shots : 0
    const finalScore = Math.floor(scoreRef.current)
    const isNewBest = finalScore > bestScoreRef.current
    if (isNewBest) {
      bestScoreRef.current = finalScore
      setBestScore(finalScore)
      localStorage.setItem(BEST_SCORE_STORAGE_KEY, String(finalScore))
      playVictorySound()
    }
    const payout = finalScore * SCORE_TO_CASH
    if (payout > 0) addCash(payout)
    setResultData({ finalScore, shots, hits, centers, accuracy, isNewBest, payout })
    setScreen('result')
  }, [addCash])

  const spawnTarget = useCallback((nowMs) => {
    // Progress reads the clock, not the score - the range gets harder as
    // time runs low regardless of how far along the player's Score is, so
    // stalling doesn't also stall the difficulty ramp.
    const progress = clamp(0, 1, 1 - timeLeftMsRef.current / TIME_LIMIT_MS)
    const type = rollTargetType()
    const t = {
      id: ++targetSeq,
      type,
      depth: DEPTH_MIN + Math.random() * (DEPTH_MAX - DEPTH_MIN),
      lateral: (Math.random() * 2 - 1) * LATERAL_LIMIT,
      motion: rollMotion(progress),
      bornAt: nowMs,
      lifetimeMs: TARGET_LIFETIME_MS,
      handled: false,
      x: 0,
      y: 0,
      scale: 1,
      outerR: 0,
      innerR: null,
    }
    stepTarget(t, 0, 1, nowMs) // seed x/y/scale/radii before its first render
    targetsRef.current = [...targetsRef.current, t]
  }, [])

  const handleMouseMove = useCallback((e) => {
    if (resolvedRef.current) return
    const rect = e.currentTarget.getBoundingClientRect()
    // Scale client px -> range px: the viewport may be laid out smaller than
    // its intrinsic RANGE_W/RANGE_H on a narrow screen, and aiming has to stay
    // aligned with what's actually drawn if it ever is.
    rawAimRef.current = {
      x: clamp(0, RANGE_W, ((e.clientX - rect.left) / rect.width) * RANGE_W),
      y: clamp(0, RANGE_H, ((e.clientY - rect.top) / rect.height) * RANGE_H),
    }
    lastMoveAtRef.current = performance.now()
  }, [])

  const addMark = (x, y, good) => {
    const id = ++markSeq
    setMarks((prev) => [...prev.slice(-5), { id, x, y, good }])
    setTimeout(() => setMarks((prev) => prev.filter((m) => m.id !== id)), 420)
  }

  const handleFire = useCallback(() => {
    if (screen !== 'range' || resolvedRef.current) return
    const now = performance.now()
    if (now - lastFiredAtRef.current < FIRE_COOLDOWN_MS) return
    lastFiredAtRef.current = now
    setFiredAt(now)
    playGunshotSound()
    shotsRef.current += 1

    const shot = crosshairRef.current

    // Nearest-center wins when circles overlap: a Civilian drifting across a
    // Bullseye is a real hazard the player has to read, and "whichever center
    // the shot actually landed closest to" is the only reading of that which
    // is fair in both directions.
    let hit = null
    let hitDist = Infinity
    let hitZone = 'miss'
    for (const t of targetsRef.current) {
      if (t.handled) continue
      const dx = shot.x - t.x
      const dy = shot.y - t.y
      const dist = Math.sqrt(dx * dx + dy * dy)
      const zone = resolveShot(t, dist)
      if (zone !== 'miss' && dist < hitDist) {
        hit = t
        hitDist = dist
        hitZone = zone
      }
    }

    if (!hit) {
      comboRef.current = 0
      setCombo(0)
      setTally({ shots: shotsRef.current, hits: hitsRef.current, centers: centersRef.current })
      addMark(shot.x, shot.y, null)
      return
    }

    hit.handled = true
    targetsRef.current = targetsRef.current.filter((t) => t !== hit)

    if (hit.type.shoot) {
      // Only shoot-targets count as "hits" for accuracy - drilling a Civilian
      // is the opposite of good shooting, so it stays a miss on the ledger on
      // top of docking Score.
      playGoodHitSound()
      hitsRef.current += 1
      if (hitZone === 'center') centersRef.current += 1
      const base = hitZone === 'center' ? SCORE_PER_CENTER : hit.type.id === 'crew' ? SCORE_PER_CREW : SCORE_PER_EDGE
      comboRef.current += 1
      setCombo(comboRef.current)
      // Every 3rd consecutive hit pays a small bonus - rewards sustained
      // accuracy across a busy screen without letting a lucky spray out-earn
      // deliberate aim, since one miss (or one Civilian) resets it to 0.
      const bonus = comboRef.current % 3 === 0 ? COMBO_BONUS : 0
      scoreRef.current += base + bonus
      setScore(scoreRef.current)
      addMark(shot.x, shot.y, true)
      setTally({ shots: shotsRef.current, hits: hitsRef.current, centers: centersRef.current })
    } else {
      // A Civilian hit just docks the Score this run has banked, floored at
      // 0 so one bad shot can't push it negative - that's the actual
      // shoot/no-shoot skill test here, not a legal consequence (there is
      // none anymore - see this file's header comment).
      playBadHitSound()
      comboRef.current = 0
      setCombo(0)
      scoreRef.current = Math.max(0, scoreRef.current - SCORE_PENALTY_PER_CIVILIAN)
      setScore(scoreRef.current)
      addMark(shot.x, shot.y, false)
      setTally({ shots: shotsRef.current, hits: hitsRef.current, centers: centersRef.current })
    }
    setTargets([...targetsRef.current])
  }, [screen])

  // Single rAF loop owning the whole live screen: crosshair sway, per-target
  // movement, expiry, and spawning.
  useEffect(() => {
    if (screen !== 'range') return
    lastFrameAtRef.current = performance.now()
    const tick = (now) => {
      if (!resolvedRef.current) {
        const dtSec = Math.min(0.05, (now - lastFrameAtRef.current) / 1000)
        lastFrameAtRef.current = now

        const steady = clamp(0, 1, (now - lastMoveAtRef.current) / STEADY_MS)
        setSteadiness(steady)
        const swayRadius = MAX_SWAY_PX * (1 - steady)
        // Slowed to roughly half the old angular speed (0.006/0.0047 ->
        // 0.003/0.0024) - at the old speed the crosshair completed a full
        // wobble in ~1s, which read as a fast, erratic shake rather than a
        // held-breath drift. Same amplitude (MAX_SWAY_PX), same two-axis
        // sin/cos shape (still traces a slowly rotating ellipse, not a
        // simple circle), just a calmer, more predictable path to track.
        const swayX = Math.sin(now * 0.003 + swaySeedRef.current) * swayRadius
        const swayY = Math.cos(now * 0.0024 + swaySeedRef.current * 1.3) * swayRadius
        crosshairRef.current = {
          x: clamp(0, RANGE_W, rawAimRef.current.x + swayX),
          y: clamp(0, RANGE_H, rawAimRef.current.y + swayY),
        }
        setCrosshair(crosshairRef.current)

        // The clock is the only thing that ends a session now - it just
        // runs out and resolve() shows the final tally, no win/lose branch.
        timeLeftMsRef.current = Math.max(0, timeLeftMsRef.current - dtSec * 1000)
        setTimeLeftMs(timeLeftMsRef.current)
        if (timeLeftMsRef.current <= 0) {
          resolve()
          return
        }

        const progress = clamp(0, 1, 1 - timeLeftMsRef.current / TIME_LIMIT_MS)
        const wave = waveParams(progress)

        // Letting a shoot-target expire unshot still breaks the combo (you
        // hesitated), same as a miss.
        let expiredShooters = 0
        const alive = []
        for (const t of targetsRef.current) {
          if (now - t.bornAt >= t.lifetimeMs) {
            if (t.type.shoot) expiredShooters += 1
            continue
          }
          stepTarget(t, dtSec, wave.speedMul, now)
          alive.push(t)
        }
        targetsRef.current = alive

        if (expiredShooters > 0) {
          comboRef.current = 0
          setCombo(0)
        }

        if (targetsRef.current.length < wave.maxConcurrent && now >= nextSpawnAtRef.current) {
          spawnTarget(now)
          nextSpawnAtRef.current = now + SPAWN_GAP_MS
        }

        setTargets([...targetsRef.current])
      }
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [screen, resolve, spawnTarget])

  useEffect(() => {
    if (screen !== 'range') return
    const onKeyDown = (e) => {
      if (e.code === 'Space') {
        e.preventDefault()
        handleFire()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [screen, handleFire])

  const begin = () => {
    if (!spendEnergy(RANGE_ENERGY_COST)) {
      setEnergyError(true)
      return
    }
    setEnergyError(false)
    scoreRef.current = 0
    timeLeftMsRef.current = TIME_LIMIT_MS
    comboRef.current = 0
    shotsRef.current = 0
    hitsRef.current = 0
    centersRef.current = 0
    resolvedRef.current = false
    targetsRef.current = []
    nextSpawnAtRef.current = 0
    rawAimRef.current = { x: RANGE_W / 2, y: RANGE_H / 2 }
    crosshairRef.current = { x: RANGE_W / 2, y: RANGE_H / 2 }
    lastMoveAtRef.current = performance.now()
    lastFiredAtRef.current = 0
    swaySeedRef.current = Math.random() * Math.PI * 2
    setScore(0)
    setTimeLeftMs(TIME_LIMIT_MS)
    setTargets([])
    setCombo(0)
    setTally({ shots: 0, hits: 0, centers: 0 })
    setCrosshair(crosshairRef.current)
    setSteadiness(0)
    setResultData(null)
    setMarks([])
    setFiredAt(0)
    setScreen('range')
  }

  const stopEarly = () => {
    resolvedRef.current = true
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    targetsRef.current = []
    setTargets([])
    setScreen('intro')
  }

  const timeLeftPct = clamp(0, 100, (timeLeftMs / TIME_LIMIT_MS) * 100)
  const timeLeftSec = Math.ceil(timeLeftMs / 1000)
  const recentlyFired = firedAt > 0 && performance.now() - firedAt < 90
  const waveTier = waveParams(clamp(0, 1, 1 - timeLeftMs / TIME_LIMIT_MS)).maxConcurrent
  const liveAccuracy = tally.shots > 0 ? Math.round((tally.hits / tally.shots) * 100) : 100
  // Far targets render first so nearer ones overlap them, the way depth reads.
  const drawOrder = [...targets].sort((a, b) => a.depth - b.depth)

  const body = (
    <>
      {!embedded && (
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute right-3 top-3 border border-gray-500 px-2 py-0.5 text-xs text-gray-400 hover:bg-gray-600 hover:text-white"
        >
          X
        </button>
      )}

      <h2 className="mb-2 text-xl font-bold text-yellow-400">Test-Fire Range</h2>

      {screen === 'intro' && (
        <div className="flex flex-col gap-3">
          <div className="border-2 border-yellow-600/50 bg-[#0f1020] p-3">
            <p className="text-sm font-bold text-yellow-300">Put your money where your aim is.</p>
            <p className="mt-1 text-xs text-gray-400">
              {RANGE_ENERGY_COST} energy a run, paid out at ${SCORE_TO_CASH}/point on your final Score - shoot well, get paid.
            </p>
          </div>
          <p className="text-xs text-gray-400">
            Move the mouse to aim - the crosshair sways until you hold still, turning green once it's settled. Click
            (or Space) to fire. Several targets run the lane at once and they move; deeper ones are smaller and
            harder to land. Bullseye/Crew are shoot targets and bank Score; the marked-out civilian target isn't - a
            wild shot that drifts into it docks Score the same as a deliberate hit. 3 hits in a row pays a bonus, one
            miss resets it. You've got {Math.round(TIME_LIMIT_MS / 1000)} seconds - see how high you can run it.
          </p>
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-500">Energy: <span className={energy < RANGE_ENERGY_COST ? 'text-red-400' : 'text-gray-300'}>{energy}</span></span>
            {bestScore > 0 && (
              <span className="text-cyan-300">Personal Best: <span className="font-bold">{bestScore}</span></span>
            )}
          </div>
          {energyError && (
            <div className="border-2 border-red-500/60 bg-red-950/40 p-2 text-center text-xs text-red-300">
              Not enough energy - need {RANGE_ENERGY_COST}, have {energy}.
            </div>
          )}
          <button
            onClick={begin}
            disabled={energy < RANGE_ENERGY_COST}
            className="w-full border-2 border-yellow-400 py-1.5 text-sm font-bold uppercase tracking-widest text-yellow-300 hover:bg-yellow-400 hover:text-black disabled:cursor-not-allowed disabled:border-gray-600 disabled:text-gray-500 disabled:hover:bg-transparent"
          >
            Step Up To The Line ({RANGE_ENERGY_COST} Energy)
          </button>
        </div>
      )}

      {screen === 'range' && (
        <div className="flex flex-col gap-3">
          <div
            onMouseMove={handleMouseMove}
            onMouseDown={handleFire}
            style={{
              width: RANGE_W,
              height: RANGE_H,
              cursor: 'none',
              transform: recentlyFired ? 'translateY(2px)' : 'translateY(0)',
            }}
            className="relative mx-auto select-none overflow-hidden border-4 border-cyan-800 bg-[#0a0f16] transition-transform duration-75"
          >
            <div className="absolute inset-0">
              <img
                src={RANGE_BG_URL}
                alt=""
                className="pointer-events-none absolute inset-0 h-full w-full object-cover object-center"
                style={{ imageRendering: 'pixelated' }}
              />

              {drawOrder.map((t) => {
                const lifeFrac = clamp(0, 1, 1 - (performance.now() - t.bornAt) / t.lifetimeMs)
                // Sprite box for this target: height scales with depth same
                // as the old hit-circle did (t.scale), width follows the
                // art's own aspect ratio. anchorX/Y is where in that box the
                // real hit-test point (resolveShot's t.x/t.y) actually is -
                // the rings, or the civilian's torso - so left/top offset by
                // that fraction rather than the box's plain center.
                const spriteH = TARGET_SPRITE_BASE_H * t.scale
                const spriteW = spriteH * t.type.spriteAspect
                return (
                  <div
                    key={t.id}
                    className="pointer-events-none absolute"
                    style={{ left: t.x, top: t.y, transform: 'translate(-50%, -50%)' }}
                  >
                    {/* ground-contact shadow at the sprite's own base (feet /
                        tripod legs), not the old hit-circle's center - sells
                        the depth cue the same way, just relocated. */}
                    <div
                      className="absolute rounded-full bg-black/40"
                      style={{
                        width: spriteW * 0.75,
                        height: t.outerR * 0.42,
                        left: -spriteW * 0.375,
                        top: spriteH * (1 - t.type.anchorY) - t.outerR * 0.25,
                      }}
                    />
                    <img
                      src={t.type.spriteUrl}
                      alt=""
                      className="absolute"
                      style={{
                        width: spriteW,
                        height: spriteH,
                        // This wrapper div only sets left/top (not right/
                        // bottom), so with nothing but absolutely-positioned
                        // children it collapses to a 0-width containing
                        // block - Tailwind Preflight's `img { max-width:
                        // 100% }` then resolves against THAT 0, clamping the
                        // image to invisible regardless of the width above.
                        // maxWidth/maxHeight: none overrides that.
                        maxWidth: 'none',
                        maxHeight: 'none',
                        left: -spriteW * t.type.anchorX,
                        top: -spriteH * t.type.anchorY,
                        imageRendering: 'pixelated',
                        filter: t.type.shoot ? undefined : 'saturate(1.15)',
                      }}
                    />
                    {/* per-target life bar - with several on screen at once a
                        single shared timer bar would say nothing useful */}
                    <div
                      className="absolute bg-black/50"
                      style={{ width: t.outerR * 1.6, height: 3, left: -t.outerR * 0.8, top: t.outerR + 5 }}
                    >
                      <div
                        className={`h-full ${t.type.shoot ? 'bg-cyan-400' : 'bg-red-400'}`}
                        style={{ width: `${lifeFrac * 100}%` }}
                      />
                    </div>
                  </div>
                )
              })}

              {marks.map((m) => (
                <div
                  key={m.id}
                  className={`pointer-events-none absolute h-5 w-5 rounded-full border-2 ${
                    m.good == null ? 'border-gray-400/70' : m.good ? 'border-green-400' : 'border-red-400'
                  }`}
                  style={{ left: m.x - 10, top: m.y - 10 }}
                />
              ))}

              {/* Player, back view, fixed at the firing line - not tied to
                  the mouse (the crosshair alone carries aim). Nearest the
                  camera, so it renders after targets/marks to occlude them
                  rather than the other way around. */}
              <img
                src={PLAYER_SPRITE_URL}
                alt=""
                className="pointer-events-none absolute bottom-0 left-6"
                style={{
                  height: PLAYER_SPRITE_H,
                  width: PLAYER_SPRITE_H * PLAYER_SPRITE_ASPECT,
                  imageRendering: 'pixelated',
                }}
              />

              <div className="pointer-events-none absolute left-2 top-2 flex gap-1.5">
                <span className="border border-yellow-400/70 bg-black/55 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-widest text-yellow-300">
                  {Math.floor(score)} pts
                </span>
                <span className="border border-cyan-500/50 bg-black/55 px-1.5 py-0.5 text-[10px] uppercase tracking-widest text-cyan-300/90">
                  {liveAccuracy}% acc
                </span>
                {combo >= 3 && (
                  <span className="border border-yellow-400/70 bg-black/55 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-widest text-yellow-300">
                    {combo} streak
                  </span>
                )}
              </div>
              <div className="pointer-events-none absolute right-2 top-2 border border-cyan-500/50 bg-black/55 px-1.5 py-0.5 text-[10px] uppercase tracking-widest text-cyan-300/90">
                {waveTier} up
              </div>

              {/* Crosshair cursor - this IS the mouse now (cursor:none on the
                  range div above hides the OS pointer entirely). A plain
                  plus-sign centered exactly on crosshair.x/y - the real fire
                  point - colored red->green by how settled the aim currently
                  is, same read the old laser dot gave, just as the whole mark
                  rather than a separate dot. */}
              <div
                className="pointer-events-none absolute"
                style={{
                  left: crosshair.x,
                  top: crosshair.y,
                  transform: `translate(-50%, -50%) scale(${recentlyFired ? 0.85 : 1})`,
                  transition: 'transform 75ms',
                }}
              >
                <div
                  className="absolute rounded-sm"
                  style={{
                    left: -1.5,
                    top: -10,
                    width: 3,
                    height: 20,
                    background: laserColor(steadiness),
                    boxShadow: `0 0 ${3 + steadiness * 3}px ${laserColor(steadiness)}`,
                  }}
                />
                <div
                  className="absolute rounded-sm"
                  style={{
                    left: -10,
                    top: -1.5,
                    width: 20,
                    height: 3,
                    background: laserColor(steadiness),
                    boxShadow: `0 0 ${3 + steadiness * 3}px ${laserColor(steadiness)}`,
                  }}
                />
              </div>
            </div>
          </div>

          <div>
            <div className="mb-0.5 flex items-center justify-between text-[10px] uppercase tracking-widest text-yellow-300/80">
              <span>Aim Steady</span>
            </div>
            <div className="h-1.5 w-full bg-[#0a0a16]">
              <div className="h-full bg-yellow-400/80 transition-[width] duration-75" style={{ width: `${steadiness * 100}%` }} />
            </div>
          </div>

          <div>
            <div className="mb-0.5 flex items-center justify-between text-xs uppercase tracking-widest text-red-400">
              <span>Time Left</span>
              <span>{timeLeftSec}s</span>
            </div>
            <div className="h-5 w-full border-2 border-red-500 bg-[#0a0a16]">
              <div
                className={`h-full bg-red-600 transition-[width] duration-75 ${timeLeftPct < 25 ? 'animate-pulse' : ''}`}
                style={{ width: `${timeLeftPct}%` }}
              />
            </div>
          </div>

          <p className="text-center text-xs text-gray-500">Click or Space to fire</p>

          <button onClick={stopEarly} className="w-full border-2 border-gray-500 py-1.5 text-xs text-gray-300 hover:bg-gray-700">
            Stop
          </button>
        </div>
      )}

      {screen === 'result' && resultData && (
        <div className="flex flex-col gap-2 border-2 border-yellow-500 bg-[#0f1020] p-3 text-sm">
          <p className="text-center text-lg font-bold text-yellow-300">
            {resultData.isNewBest ? 'New Personal Best!' : "Time's Up"}
          </p>
          <p className="text-center text-3xl font-bold text-yellow-300">
            {resultData.finalScore} <span className="text-sm font-normal text-gray-400">pts</span>
          </p>
          <p className="text-center text-base font-bold text-emerald-400">+${resultData.payout}</p>

          {/* Scorecard - so every session tells the player how they actually
              shot, not just the final number. */}
          <div className="grid grid-cols-3 gap-1 border border-gray-700 bg-black/30 p-2 text-center text-[11px]">
            <div>
              <div className="uppercase tracking-widest text-gray-500">Shots</div>
              <div className="font-bold text-gray-200">
                {resultData.hits}/{resultData.shots}
              </div>
            </div>
            <div>
              <div className="uppercase tracking-widest text-gray-500">Accuracy</div>
              <div className="font-bold text-cyan-300">{Math.round(resultData.accuracy * 100)}%</div>
            </div>
            <div>
              <div className="uppercase tracking-widest text-gray-500">Center</div>
              <div className="font-bold text-yellow-300">{resultData.centers}</div>
            </div>
          </div>

          <p className="text-center text-xs text-gray-500">Personal Best: {bestScore}</p>

          <div className="mt-1 flex gap-2">
            <button
              onClick={() => setScreen('intro')}
              className="flex-1 border-2 border-yellow-400 py-1.5 text-sm font-bold text-yellow-300 hover:bg-yellow-400 hover:text-black"
            >
              Try Again
            </button>
            <button onClick={onClose} className="flex-1 border-2 border-gray-600 py-1.5 text-sm text-gray-400 hover:bg-gray-700">
              Leave
            </button>
          </div>
        </div>
      )}
    </>
  )

  if (embedded) return body

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="glass-panel relative w-[640px] max-w-[95vw] max-h-[92vh] overflow-y-auto border-4 border-yellow-500 bg-[#1c1d3a] p-6 font-mono text-white">
        {body}
      </div>
    </div>
  )
}
