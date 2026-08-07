import { useCallback, useEffect, useRef, useState } from 'react'
import { useGameStore } from '../../store/useGameStore'
import { clamp, computeFavorability } from './crimeDifficulty'
import { playGunshotSound, playGoodHitSound, playBadHitSound, playVictorySound, playDefeatSound } from '../../audio/sfx'

// Crime Alley's minigame (successor to LookoutWatchModal, then a click-a-lane
// version, then flat-2D mouse-aim, then a fake-3D corridor, then multi-target)
// - "The Range".
//
// MECHANIC: mouse-aimed shooting gallery. The crosshair follows the mouse but
// SWAYS around it - sway shrinks toward 0 only while the mouse holds still
// (steadyMs), so a precise shot means aim, hold, fire, not just click a label.
// Bullseye/Crew are "shoot" (bank Leverage - a dead-center Bullseye pays more
// than an outer-ring hit); Civilian is "no-shoot" (a shot landing in its circle,
// deliberate OR sway-induced, costs Suspicion - the role LookoutWatch's Hot
// window played). Letting shoot targets expire unshot costs nothing alone, but
// MISS_STREAK_LIMIT of them costs Suspicion, same "the mark wanders off while
// you hesitate" penalty. A wide miss just burns the reload cooldown. The
// resolve()->applyCrimeOutcome contract, stakes shape, and the "danger only
// exists while you commit" no-passive-creep rule are unchanged from every
// earlier version.
//
// PRESENTATION: fake-3D rail shooter. drawCorridor paints a static perspective
// hall (plain Canvas 2D trapezoids converging on a vanishing point - no 3D
// engine, no external assets). Targets live in CORRIDOR SPACE (depth 0=far,
// 1=near; lateral -1..1 across the hall at that depth) and are projected to
// screen every frame by projectFromCorridor, so depth drives both apparent size
// AND the real hit-circle radius - a far target is a genuinely smaller hitbox,
// making distance a difficulty axis rather than decoration. Several targets run
// at once, they move (see rollMotion/stepTarget), and a wave ramp reads live
// progress to widen concurrency + speed as the run advances, so a single job
// escalates instead of running at one flat intensity.
//
// THIS PASS: (1) the range viewport roughly doubled in area - every geometry
// constant below is expressed against RANGE_W/RANGE_H or scaled alongside them
// (target radii, sway, the gun), so the corridor and its difficulty read the
// same at the new size rather than becoming a bigger box with the same tiny
// targets; (2) PERFORMANCE-BASED PAYOUT - the flat `payout` from stakes is now
// a BASELINE that gets multiplied by how well the player actually shot (see
// scorePayoutMultiplier), so the same job pays differently run to run. That
// multiplier is applied BEFORE applyCrimeOutcome, deliberately: the store's own
// home-turf payout multiplier then composes on top of it, exactly as it would
// have with the old flat figure.
const TARGET_TYPES = [
  { id: 'bullseye', weight: 55, icon: '🎯', label: 'Bullseye', shoot: true, outerRadius: 36, innerRadius: 16 },
  { id: 'crew', weight: 25, icon: '🕴️', label: 'Crew', shoot: true, outerRadius: 44, innerRadius: null },
  { id: 'civilian', weight: 20, icon: '🚫', label: 'DO NOT SHOOT', shoot: false, outerRadius: 38, innerRadius: null },
]
const TOTAL_WEIGHT = TARGET_TYPES.reduce((sum, t) => sum + t.weight, 0)

const RANGE_W = 560
const RANGE_H = 300
const FIRE_COOLDOWN_MS = 260 // reload/recoil delay - the anti-spam-click knob

// Raised from 3 alongside concurrent targets: with up to 4 on screen, expiries
// naturally happen more often, so the old 3-strike threshold would have fired
// on ordinary play rather than on actual hesitation. A hit still resets it.
const MISS_STREAK_LIMIT = 4

// --- Performance-based payout ------------------------------------------------
// Two things the player actually controls, both judged: did the shots land at
// all (accuracy), and did they land WELL (center hits on Bullseyes). Weighted
// so accuracy matters more than precision - a steady shooter who rarely wastes
// a round out-earns a streaky one who occasionally nails a center. Baseline
// 0.6 means even sloppy-but-successful work still pays most of the sticker
// price; the ceiling rewards a clean run without ever doubling it, so the
// range can't out-earn the higher-tier rackets it's meant to sit below.
const PAYOUT_MULT_MIN = 0.6
const PAYOUT_MULT_MAX = 1.6
function scorePayoutMultiplier(accuracy, centerRate) {
  return clamp(PAYOUT_MULT_MIN, PAYOUT_MULT_MAX, 0.6 + accuracy * 0.6 + centerRate * 0.4)
}

// Corridor bounds. Targets are clamped/bounced inside these rather than the
// raw 0..1 / -1..1 extremes so nothing spawns exactly on the vanishing point
// or clips into a side wall.
const DEPTH_MIN = 0.14
const DEPTH_MAX = 0.96
const LATERAL_LIMIT = 0.85

// Corridor geometry, shared by drawCorridor's canvas draw and
// projectFromCorridor's target placement so the two stay consistent (a target
// at depth 1 lands exactly on the near plane the canvas paints). VP =
// vanishing point; NEAR_* is the closest visible plane (bottom of the box).
// All expressed against RANGE_W/RANGE_H so resizing the viewport rescales the
// whole hall rather than leaving a fixed-size corridor in a bigger frame.
const VP_X = RANGE_W / 2
const VP_Y = RANGE_H * 0.36
const VP_HALF_W = RANGE_W * 0.08 // corridor mouth AT the vanishing point (a little width reads better than a true point)
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

// Movement profile, rolled per target. `progress` (0..1 through the job) makes
// later targets likelier to move and likelier to pick a harder pattern - the
// wave ramp's difficulty half (waveParams below is its density half).
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

// Static perspective backdrop - drawn once when the range screen mounts (the
// geometry never changes mid-run, so this is not a per-frame cost). Plain
// trapezoid fills + lines converging on VP_X/VP_Y; no images, no 3D context.
function drawCorridor(ctx) {
  ctx.clearRect(0, 0, RANGE_W, RANGE_H)

  const glow = ctx.createRadialGradient(VP_X, VP_Y, 2, VP_X, VP_Y, RANGE_W * 0.55)
  glow.addColorStop(0, '#1b3440')
  glow.addColorStop(1, '#04070a')
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, RANGE_W, RANGE_H)

  ctx.fillStyle = '#0b1218'
  ctx.beginPath()
  ctx.moveTo(0, 0)
  ctx.lineTo(RANGE_W, 0)
  ctx.lineTo(VP_X + VP_HALF_W, VP_Y)
  ctx.lineTo(VP_X - VP_HALF_W, VP_Y)
  ctx.closePath()
  ctx.fill()

  ctx.fillStyle = '#12160f'
  ctx.beginPath()
  ctx.moveTo(0, RANGE_H)
  ctx.lineTo(RANGE_W, RANGE_H)
  ctx.lineTo(VP_X + VP_HALF_W, VP_Y)
  ctx.lineTo(VP_X - VP_HALF_W, VP_Y)
  ctx.closePath()
  ctx.fill()

  ctx.fillStyle = '#0d1420'
  ctx.beginPath()
  ctx.moveTo(0, 0)
  ctx.lineTo(0, RANGE_H)
  ctx.lineTo(VP_X - VP_HALF_W, VP_Y)
  ctx.closePath()
  ctx.fill()
  ctx.beginPath()
  ctx.moveTo(RANGE_W, 0)
  ctx.lineTo(RANGE_W, RANGE_H)
  ctx.lineTo(VP_X + VP_HALF_W, VP_Y)
  ctx.closePath()
  ctx.fill()

  // Floor lane dividers, converging on the vanishing point.
  ctx.strokeStyle = 'rgba(60, 220, 255, 0.22)'
  ctx.lineWidth = 1
  for (const l of [-1, -0.5, 0, 0.5, 1]) {
    ctx.beginPath()
    ctx.moveTo(VP_X + l * NEAR_HALF_W, NEAR_Y + 10)
    ctx.lineTo(VP_X, VP_Y)
    ctx.stroke()
  }

  // Floor + ceiling "panel rung" cross-lines at a few depths, endpoints
  // interpolated along the same converging edges the fills use so they land on
  // the trapezoids rather than floating.
  ctx.strokeStyle = 'rgba(255,255,255,0.07)'
  for (const t of [0.22, 0.42, 0.64, 0.85]) {
    const floorY = VP_Y + (RANGE_H - VP_Y) * t
    const leftX = VP_X - VP_HALF_W + (0 - (VP_X - VP_HALF_W)) * t
    const rightX = VP_X + VP_HALF_W + (RANGE_W - (VP_X + VP_HALF_W)) * t
    ctx.beginPath()
    ctx.moveTo(leftX, floorY)
    ctx.lineTo(rightX, floorY)
    ctx.stroke()

    const ceilY = VP_Y + (0 - VP_Y) * t
    ctx.beginPath()
    ctx.moveTo(leftX, ceilY)
    ctx.lineTo(rightX, ceilY)
    ctx.stroke()
  }

  // Hanging lamp glows.
  for (const lx of [VP_X - VP_HALF_W - 58, VP_X + VP_HALF_W + 58]) {
    const lamp = ctx.createRadialGradient(lx, 8, 1, lx, 8, 42)
    lamp.addColorStop(0, 'rgba(255,230,150,0.35)')
    lamp.addColorStop(1, 'rgba(255,230,150,0)')
    ctx.fillStyle = lamp
    ctx.fillRect(lx - 42, 0, 84, 56)
  }
}

// Wave ramp: how dense and how fast the range is right now. Reads live job
// progress so a single run escalates. Concurrency steps rather than scaling
// smoothly, so the player can feel each new tier arrive.
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

export default function ShootingRangeModal({
  onClose,
  embedded = false,
  title = 'The Back-Lot Range',
  markName = "Luciano's Crew",
  markDescription = '',
  buttonLabel = 'Take The Shot',
  stakes,
}) {
  const {
    target,
    suspicionCap = 100,
    payout,
    notorietyIncreaseOnFail,
    wantedIncreaseOnFail,
    reputationDeltaOnFail,
    assetSeizureOnFail,
    jailChanceOnFail,
    energyCost,
    baseSuccessChance,
    syndicateId = null,
    inHomeTurf = false,
  } = stakes

  const player = useGameStore((s) => s.player)
  const spendEnergy = useGameStore((s) => s.spendEnergy)
  const applyCrimeOutcome = useGameStore((s) => s.applyCrimeOutcome)
  const addReputation = useGameStore((s) => s.addReputation)
  const declineSyndicateJob = useGameStore((s) => s.declineSyndicateJob)

  const [screen, setScreen] = useState('intro') // 'intro' | 'range' | 'result'
  const [locked, setLocked] = useState(null)
  const [leverage, setLeverage] = useState(0)
  const [suspicion, setSuspicion] = useState(0)
  const [targets, setTargets] = useState([])
  const [crosshair, setCrosshair] = useState({ x: RANGE_W / 2, y: RANGE_H / 2 })
  const [steadiness, setSteadiness] = useState(0) // 0 = just moved, 1 = fully settled
  const [resultData, setResultData] = useState(null)
  const [marks, setMarks] = useState([]) // fading shot decals: { id, x, y, good }
  const [firedAt, setFiredAt] = useState(0) // drives muzzle flash + screen kick
  const [combo, setCombo] = useState(0)
  const [tally, setTally] = useState({ shots: 0, hits: 0, centers: 0 })

  const leverageRef = useRef(0)
  const suspicionRef = useRef(0)
  const targetsRef = useRef([])
  const nextSpawnAtRef = useRef(0)
  const missedStreakRef = useRef(0)
  const rawAimRef = useRef({ x: RANGE_W / 2, y: RANGE_H / 2 })
  const lastMoveAtRef = useRef(0)
  const lastFiredAtRef = useRef(0)
  const lastFrameAtRef = useRef(0)
  const swaySeedRef = useRef(0)
  const crosshairRef = useRef({ x: RANGE_W / 2, y: RANGE_H / 2 })
  const comboRef = useRef(0)
  // Shot ledger backing the payout multiplier. Refs, not state, so resolve()
  // reads the true final numbers rather than whatever React had committed at
  // the moment the winning shot landed.
  const shotsRef = useRef(0)
  const hitsRef = useRef(0)
  const centersRef = useRef(0)
  const rafRef = useRef(null)
  const resolvedRef = useRef(false)
  const lockedRef = useRef(null)
  const canvasRef = useRef(null)

  const resolve = useCallback(
    (success) => {
      if (resolvedRef.current) return
      resolvedRef.current = true
      if (rafRef.current) cancelAnimationFrame(rafRef.current)

      const shots = shotsRef.current
      const hits = hitsRef.current
      const centers = centersRef.current
      const accuracy = shots > 0 ? hits / shots : 0
      const centerRate = hits > 0 ? centers / hits : 0
      // Only a win is graded - a failed run pays nothing regardless, so
      // scaling its (nonexistent) payout would be noise.
      const multiplier = success ? scorePayoutMultiplier(accuracy, centerRate) : 1
      const gradedPayout = Math.round(payout * multiplier)

      const res = applyCrimeOutcome({
        success,
        payout: gradedPayout,
        notorietyIncreaseOnFail,
        wantedIncreaseOnFail,
        assetSeizureOnFail,
        jailChanceOnFail,
        syndicateId,
        inHomeTurf,
      })
      if (!success && reputationDeltaOnFail) addReputation(reputationDeltaOnFail)
      if (success) playVictorySound()
      else playDefeatSound()
      setResultData({ success, res, shots, hits, centers, accuracy, centerRate, multiplier, gradedPayout })
      setScreen('result')
    },
    [
      applyCrimeOutcome,
      addReputation,
      payout,
      notorietyIncreaseOnFail,
      wantedIncreaseOnFail,
      reputationDeltaOnFail,
      assetSeizureOnFail,
      jailChanceOnFail,
      syndicateId,
      inHomeTurf,
    ]
  )

  const spawnTarget = useCallback(
    (nowMs) => {
      const progress = target > 0 ? clamp(0, 1, leverageRef.current / target) : 0
      const type = rollTargetType()
      const t = {
        id: ++targetSeq,
        type,
        depth: DEPTH_MIN + Math.random() * (DEPTH_MAX - DEPTH_MIN),
        lateral: (Math.random() * 2 - 1) * LATERAL_LIMIT,
        motion: rollMotion(progress),
        bornAt: nowMs,
        lifetimeMs: lockedRef.current.targetLifetimeMs,
        handled: false,
        x: 0,
        y: 0,
        scale: 1,
        outerR: 0,
        innerR: null,
      }
      stepTarget(t, 0, 1, nowMs) // seed x/y/scale/radii before its first render
      targetsRef.current = [...targetsRef.current, t]
    },
    [target]
  )

  const handleMouseMove = useCallback((e) => {
    if (!lockedRef.current) return
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
    if (screen !== 'range' || resolvedRef.current || !lockedRef.current) return
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
      // top of its Suspicion cost.
      playGoodHitSound()
      hitsRef.current += 1
      if (hitZone === 'center') centersRef.current += 1
      const base =
        hitZone === 'center'
          ? lockedRef.current.leveragePerCenter
          : hit.type.id === 'crew'
            ? lockedRef.current.leveragePerCrew
            : lockedRef.current.leveragePerEdge
      comboRef.current += 1
      setCombo(comboRef.current)
      // Every 3rd consecutive hit pays a small bonus - rewards sustained
      // accuracy across a busy screen without letting a lucky spray out-earn
      // deliberate aim, since one miss (or one Civilian) resets it to 0.
      const bonus = comboRef.current % 3 === 0 ? lockedRef.current.comboBonus : 0
      leverageRef.current += base + bonus
      missedStreakRef.current = 0
      setLeverage(leverageRef.current)
      addMark(shot.x, shot.y, true)
      setTally({ shots: shotsRef.current, hits: hitsRef.current, centers: centersRef.current })
      if (leverageRef.current >= target) {
        resolve(true)
        return
      }
    } else {
      playBadHitSound()
      comboRef.current = 0
      setCombo(0)
      suspicionRef.current += lockedRef.current.suspicionPerCivilianHit
      setSuspicion(suspicionRef.current)
      addMark(shot.x, shot.y, false)
      setTally({ shots: shotsRef.current, hits: hitsRef.current, centers: centersRef.current })
      if (suspicionRef.current >= suspicionCap) {
        resolve(false)
        return
      }
    }
    setTargets([...targetsRef.current])
  }, [screen, target, suspicionCap, resolve])

  // Static corridor draw - once per range-screen mount (the canvas only exists
  // in that branch, so the ref is non-null exactly when this runs).
  useEffect(() => {
    if (screen !== 'range' || !canvasRef.current) return
    drawCorridor(canvasRef.current.getContext('2d'))
  }, [screen])

  // Single rAF loop owning the whole live screen: crosshair sway, per-target
  // movement, expiry, and spawning. Same "one loop" shape every earlier
  // version used, just with a target list instead of one slot.
  useEffect(() => {
    if (screen !== 'range') return
    lastFrameAtRef.current = performance.now()
    const tick = (now) => {
      if (!resolvedRef.current && lockedRef.current) {
        const dtSec = Math.min(0.05, (now - lastFrameAtRef.current) / 1000)
        lastFrameAtRef.current = now

        const steady = clamp(0, 1, (now - lastMoveAtRef.current) / lockedRef.current.steadyMs)
        setSteadiness(steady)
        const swayRadius = lockedRef.current.maxSwayPx * (1 - steady)
        const swayX = Math.sin(now * 0.006 + swaySeedRef.current) * swayRadius
        const swayY = Math.cos(now * 0.0047 + swaySeedRef.current * 1.3) * swayRadius
        crosshairRef.current = {
          x: clamp(0, RANGE_W, rawAimRef.current.x + swayX),
          y: clamp(0, RANGE_H, rawAimRef.current.y + swayY),
        }
        setCrosshair(crosshairRef.current)

        const progress = target > 0 ? clamp(0, 1, leverageRef.current / target) : 0
        const wave = waveParams(progress)

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
          missedStreakRef.current += expiredShooters
          if (missedStreakRef.current >= MISS_STREAK_LIMIT) {
            missedStreakRef.current = 0
            playBadHitSound()
            suspicionRef.current += lockedRef.current.suspicionPerMissedStreak
            setSuspicion(suspicionRef.current)
            if (suspicionRef.current >= suspicionCap) {
              resolve(false)
              return
            }
          }
        }

        if (targetsRef.current.length < wave.maxConcurrent && now >= nextSpawnAtRef.current) {
          spawnTarget(now)
          nextSpawnAtRef.current = now + lockedRef.current.spawnGapMs
        }

        setTargets([...targetsRef.current])
      }
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [screen, target, suspicionCap, resolve, spawnTarget])

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
    if (player.energy < energyCost) return
    if (!spendEnergy(energyCost)) return
    const favorability = computeFavorability(baseSuccessChance)
    const params = {
      favorability,
      targetLifetimeMs: 1700 + favorability * 2000,
      spawnGapMs: 620 - favorability * 260,
      // Scaled with the bigger viewport (was 46 - fav*28 at 380x200) so the
      // reticle wanders the same FRACTION of the hall, not the same pixels -
      // otherwise a larger screen would have silently made aiming easier.
      maxSwayPx: 66 - favorability * 40,
      steadyMs: 550 - favorability * 300,
      leveragePerCenter: Math.max(6, Math.round(target / 6)),
      leveragePerEdge: Math.max(3, Math.round(target / 10)),
      leveragePerCrew: Math.max(5, Math.round(target / 7)),
      comboBonus: Math.max(2, Math.round(target / 14)),
      suspicionPerCivilianHit: Math.max(10, Math.round(suspicionCap / 4)),
      suspicionPerMissedStreak: Math.max(8, Math.round(suspicionCap / 5)),
    }
    lockedRef.current = params
    setLocked(params)
    leverageRef.current = 0
    suspicionRef.current = 0
    missedStreakRef.current = 0
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
    setLeverage(0)
    setSuspicion(0)
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

  const walkAway = () => {
    resolvedRef.current = true
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    lockedRef.current = null
    targetsRef.current = []
    setLocked(null)
    setTargets([])
    setScreen('intro')
    if (syndicateId) declineSyndicateJob(syndicateId)
  }

  const leveragePct = target > 0 ? clamp(0, 100, (leverage / target) * 100) : 0
  const suspicionPct = suspicionCap > 0 ? clamp(0, 100, (suspicion / suspicionCap) * 100) : 0
  const swayRingRadius = locked ? 8 + locked.maxSwayPx * (1 - steadiness) * 0.5 : 8
  const recentlyFired = firedAt > 0 && performance.now() - firedAt < 90
  const waveTier = waveParams(target > 0 ? clamp(0, 1, leverage / target) : 0).maxConcurrent
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

      <h2 className="mb-2 text-xl font-bold text-red-400">{title}</h2>

      {screen === 'intro' && (
        <div className="flex flex-col gap-3">
          <div className="border-2 border-red-500/60 bg-[#0f1020] p-3">
            <p className="text-sm font-bold text-red-300">{markName}</p>
            {markDescription && <p className="mt-1 text-xs text-gray-400">{markDescription}</p>}
          </div>
          <p className="text-xs text-gray-400">
            Move the mouse to aim - the reticle sways until you hold still. Click (or Space) to fire. Several targets
            run the hall at once and they move; deeper ones are smaller and harder to land. Bullseye/Crew are shoot
            targets, the Civilian target (🚫) isn't, and a wild shot that drifts into it counts the same as a
            deliberate one. 3 hits in a row pays a bonus - one miss resets it.
          </p>
          <div className="border-2 border-yellow-600/50 bg-[#0f1020] p-2 text-xs text-gray-400">
            <span className="font-bold uppercase tracking-widest text-yellow-400">Luciano pays by results.</span>{' '}
            The figure below is the baseline - your accuracy and your center hits set what actually lands in your
            pocket, from {Math.round(PAYOUT_MULT_MIN * 100)}% to {Math.round(PAYOUT_MULT_MAX * 100)}% of it.
          </div>
          <div className="grid grid-cols-2 gap-y-1 text-xs">
            <span className="uppercase tracking-widest text-gray-500">Energy Cost</span>
            <span className="text-right text-yellow-300">{energyCost}</span>
            <span className="uppercase tracking-widest text-gray-500">Baseline Payout</span>
            <span className="text-right text-green-400">${payout.toLocaleString()}</span>
          </div>
          <button
            onClick={begin}
            disabled={player.energy < energyCost}
            className="w-full border-2 border-red-400 py-1.5 text-sm font-bold uppercase tracking-widest text-red-300 hover:bg-red-400 hover:text-black disabled:opacity-30"
          >
            Begin
          </button>
        </div>
      )}

      {screen === 'range' && locked && (
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
              <canvas ref={canvasRef} width={RANGE_W} height={RANGE_H} className="pointer-events-none absolute inset-0" />

              {drawOrder.map((t) => {
                const lifeFrac = clamp(0, 1, 1 - (performance.now() - t.bornAt) / t.lifetimeMs)
                return (
                  <div
                    key={t.id}
                    className="pointer-events-none absolute"
                    style={{ left: t.x, top: t.y, transform: 'translate(-50%, -50%)' }}
                  >
                    {/* ground-contact shadow - sells the depth cue */}
                    <div
                      className="absolute rounded-full bg-black/40"
                      style={{
                        width: t.outerR * 1.6,
                        height: t.outerR * 0.5,
                        left: -t.outerR * 0.8,
                        top: t.outerR * 0.55,
                      }}
                    />
                    {t.type.id === 'bullseye' ? (
                      <>
                        <div
                          className="absolute rounded-full border-2 border-cyan-300/80"
                          style={{ width: t.outerR * 2, height: t.outerR * 2, left: -t.outerR, top: -t.outerR }}
                        />
                        <div
                          className="absolute rounded-full border-2 border-cyan-300 bg-cyan-400/20"
                          style={{ width: t.innerR * 2, height: t.innerR * 2, left: -t.innerR, top: -t.innerR }}
                        />
                      </>
                    ) : (
                      <div
                        className={`absolute rounded-full border-2 ${
                          t.type.shoot ? 'border-cyan-300 bg-cyan-400/10' : 'animate-pulse border-red-500 bg-red-500/20'
                        }`}
                        style={{ width: t.outerR * 2, height: t.outerR * 2, left: -t.outerR, top: -t.outerR }}
                      />
                    )}
                    <span
                      className="absolute"
                      style={{ left: -11 * t.scale - 3, top: -13 * t.scale - 3, fontSize: 18 * t.scale + 5 }}
                    >
                      {t.type.icon}
                    </span>
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

              {/* crosshair - a ring that widens with sway, plus a fixed center dot */}
              <div
                className="pointer-events-none absolute rounded-full border-2 border-yellow-300/90"
                style={{
                  width: swayRingRadius * 2,
                  height: swayRingRadius * 2,
                  left: crosshair.x - swayRingRadius,
                  top: crosshair.y - swayRingRadius,
                }}
              />
              <div
                className="pointer-events-none absolute h-1.5 w-1.5 rounded-full bg-yellow-300"
                style={{ left: crosshair.x - 3, top: crosshair.y - 3 }}
              />

              <div className="pointer-events-none absolute left-2 top-2 flex gap-1.5">
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

              {/* foreground gun-in-hand - decorative, sells the first-person
                  read. Tilts slightly opposite the aim offset (a held weapon
                  leaning with your point of view) and flashes at the barrel on
                  every trigger pull, hit or miss. */}
              <div
                className="pointer-events-none absolute bottom-0 right-0"
                style={{
                  transform: `translate(${(crosshair.x - RANGE_W / 2) * 0.05}px, ${(crosshair.y - RANGE_H / 2) * 0.035}px)`,
                }}
              >
                <svg width="134" height="104" viewBox="0 0 92 72">
                  <path d="M18 72 L18 44 L46 36 L62 44 L62 72 Z" fill="#26211b" />
                  <path d="M42 42 L92 26 L92 38 L60 48 L42 48 Z" fill="#17140f" />
                  <rect x="84" y="20" width="8" height="10" fill="#0a0906" />
                  {recentlyFired && <circle cx="90" cy="24" r="7" fill="#ffcf4d" opacity="0.9" />}
                </svg>
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
            <div className="mb-0.5 flex items-center justify-between text-xs uppercase tracking-widest text-cyan-300">
              <span>Leverage</span>
              <span>
                {Math.floor(leverage)} / {target}
              </span>
            </div>
            <div className="h-5 w-full border-2 border-cyan-500 bg-[#0a0a16]">
              <div className="h-full bg-cyan-500 transition-[width] duration-75" style={{ width: `${leveragePct}%` }} />
            </div>
          </div>

          <div>
            <div className="mb-0.5 flex items-center justify-between text-xs uppercase tracking-widest text-red-400">
              <span>Suspicion</span>
              <span>
                {Math.floor(suspicion)} / {suspicionCap}
              </span>
            </div>
            <div className="h-5 w-full border-2 border-red-500 bg-[#0a0a16]">
              <div
                className={`h-full bg-red-600 transition-[width] duration-75 ${suspicionPct > 75 ? 'animate-pulse' : ''}`}
                style={{ width: `${suspicionPct}%` }}
              />
            </div>
          </div>

          <p className="text-center text-xs text-gray-500">{buttonLabel} - click or Space to fire</p>

          <button onClick={walkAway} className="w-full border-2 border-gray-500 py-1.5 text-xs text-gray-300 hover:bg-gray-700">
            Walk Away
          </button>
        </div>
      )}

      {screen === 'result' && resultData && (
        <div className="flex flex-col gap-2 border-2 border-red-500 bg-[#0f1020] p-3 text-sm">
          <p className="text-center text-lg font-bold text-red-300">
            {resultData.success ? "Luciano's Boys Nod" : 'You Flinched'}
          </p>

          {/* Scorecard - shown either way, so a failed run still tells the
              player how they were actually shooting before it went wrong. */}
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

          {resultData.success ? (
            <>
              <div className="flex items-center justify-center gap-2 text-xs text-gray-400">
                <span>${payout.toLocaleString()}</span>
                <span className="text-gray-600">×</span>
                <span className={resultData.multiplier >= 1 ? 'font-bold text-green-400' : 'font-bold text-orange-400'}>
                  {resultData.multiplier.toFixed(2)}
                </span>
                <span className="text-gray-600">=</span>
                <span className="text-gray-300">${resultData.gradedPayout.toLocaleString()}</span>
              </div>
              <p className="text-center text-base font-bold text-green-400">+${resultData.res.payout.toLocaleString()}</p>
              {resultData.res.payout !== resultData.gradedPayout && (
                <p className="text-center text-[10px] uppercase tracking-widest text-gray-500">
                  incl. home-turf standing bonus
                </p>
              )}
            </>
          ) : (
            <>
              <p className="text-center text-base font-bold text-red-400">{resultData.res.message}</p>
              <p className="text-center text-xs text-gray-400">
                Notoriety +{notorietyIncreaseOnFail} &middot; Wanted +{wantedIncreaseOnFail}
                {!!reputationDeltaOnFail && ` · Reputation ${reputationDeltaOnFail > 0 ? '+' : ''}${reputationDeltaOnFail}`}
                {resultData.res.fine > 0 && ` · Seized $${resultData.res.fine.toLocaleString()}`}
                {resultData.res.jailed && ' · Arrested'}
              </p>
            </>
          )}
          <div className="mt-1 flex gap-2">
            <button
              onClick={() => setScreen('intro')}
              className="flex-1 border-2 border-red-400 py-1.5 text-sm font-bold text-red-300 hover:bg-red-400 hover:text-black"
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
      <div className="glass-panel relative w-[640px] max-w-[95vw] max-h-[92vh] overflow-y-auto border-4 border-red-500 bg-[#1c1d3a] p-6 font-mono text-white">
        {body}
      </div>
    </div>
  )
}
