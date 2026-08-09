import { useCallback, useEffect, useRef, useState } from 'react'
import { clamp } from './crimeDifficulty'
import { useGameStore } from '../../store/useGameStore'
import { playAlarmSound, playSmashSound, playPurchaseSound, playVictorySound, playDefeatSound } from '../../audio/sfx'

// Crime Alley's minigame - a stealth heist. Replaces the old LookoutWatchModal
// "Lean On Him" reaction game (see districtBuildings.js's crimeAlley entry
// and DistrictBuildingModal.jsx's MINIGAME_COMPONENTS map). Plain React + a
// single rAF loop over CSS/divs, same shape as every other minigame in this
// family (ShootingRangeModal.jsx is the closest reference for the rAF/ref
// pattern; LookoutWatchModal.jsx is the closest reference for the
// applyCrimeOutcome contract this file still owes on a bust) - Phaser is
// reserved for the persistent overworld map only, never a job minigame.
//
// SCOPE NOTE (side-view, single lane): the source art (public/assets/packs/
// crime-alley/*) is a genuine side-on alley - player and guards only ever
// move along one horizontal line (there's no jump/duck-to-a-different-lane
// input, just A/D walk + S crouch-in-place). A "vision cone with a ±35 deg
// half-angle" doesn't have a second spatial axis to open onto here, so it
// collapses to "is the target within range, on the side the guard is
// currently facing" - a directional range check, not a literal angle. The
// on-screen cone is rendered as a tapering gradient bar for the same reason
// (a wedge shape would imply vertical spread this game doesn't have). This
// is a deliberate scope trim, not a missed requirement - the *gameplay*
// behavior the angle was for (guards can't see behind themselves, range
// shrinks when you crouch) is fully implemented.
//
// Two meters only, per spec: Heat (one-way ratchet, never decays mid-run -
// same "why" as LookoutWatchModal's Suspicion meter) and a loot counter.
// There is no player-health meter and no game-over-by-damage - the only bust
// conditions are Heat hitting 100 or an ALERT guard physically touching the
// player. Cash loots bank immediately via addCash the instant a hold
// completes (same "already yours" feel as the Shooting Range's live score);
// a bust claws back only this run's own loot via addCash(-lootedThisRun),
// never the player's pre-existing bankroll, and assetSeizureOnFail is
// passed 0 to applyCrimeOutcome for exactly that reason - the cash
// consequence already happened here, that call is purely for
// notoriety/wanted/the jail-chance roll.

// RANGE_W/RANGE_H is the fixed CAMERA VIEWPORT - what's actually visible at
// once, sized to fit inside UnderworldModal's w-[640px] p-6 panel (592px of
// usable content width; 580 leaves a margin). It is no longer the whole
// alley: WORLD_W (below) is a much longer strip the camera pans across as
// the player walks, so "spread the map out" doesn't have to fight this
// panel's fixed width the way a single-screen layout did. Reach radii,
// speeds, sprite display sizes are unchanged from viewport-fit tuning
// (~83% of an earlier 700-wide single-screen pass) - they're gameplay-feel
// numbers independent of how much world the camera can see at once.
const RANGE_W = 580
const RANGE_H = 265
// Sidewalk sits ~85-92% down alley_bg.png; object-fit:cover on this viewport
// preserves the image's full height (see the aspect-ratio comment on
// RANGE_BG_URL below), so that fraction carries straight over to viewport px.
const GROUND_Y = 234

// The alley is 1600px of walkable world, ~2.76x the visible viewport - long
// enough that the camera pan (see cameraX in the component below) actually
// matters, and long enough to fit 3 guard patrol zones with real gaps
// between them instead of one crowded screen.
const WORLD_W = 1600

const ALLEY_BG_URL = '/assets/packs/crime-alley/alley_bg.png'
// 3168x1344 (2.357:1). No longer stretched to the viewport via object-fit -
// with a scrolling world the backdrop needs to actually be long enough to
// scroll, so it's tiled left-to-right at native aspect (scaled to
// RANGE_H tall) across WORLD_W instead. BG_TILE_W/BG_TILE_COUNT below drive
// that tiling; the repeating brick/pipe pattern reads as "more alley," not
// an obvious loop, at this length.
const BG_TILE_W = Math.round(RANGE_H * (3168 / 1344))
const BG_TILE_COUNT = Math.ceil(WORLD_W / BG_TILE_W)

const PLAYER_IDLE = { src: '/assets/packs/crime-alley/player_idle.png', w: 92, h: 215 }
const PLAYER_WALK = [
  { src: '/assets/packs/crime-alley/player_walk_1.png', w: 99, h: 202 },
  { src: '/assets/packs/crime-alley/player_walk_2.png', w: 101, h: 202 },
  { src: '/assets/packs/crime-alley/player_walk_3.png', w: 78, h: 203 },
]
const GUARD_IDLE = { src: '/assets/packs/crime-alley/guard_idle.png', w: 82, h: 216 }
const GUARD_WALK = [
  { src: '/assets/packs/crime-alley/guard_walk_1.png', w: 91, h: 201 },
  { src: '/assets/packs/crime-alley/guard_walk_2.png', w: 60, h: 170 },
]
const CRATE_CLOSED = { src: '/assets/packs/crime-alley/crate_closed.png', w: 358, h: 363 }
const CRATE_LOOTED = { src: '/assets/packs/crime-alley/crate_looted.png', w: 580, h: 392 }
const DUMPSTER_CLOSED = { src: '/assets/packs/crime-alley/dumpster_closed.png', w: 546, h: 433 }
const DUMPSTER_OPEN = { src: '/assets/packs/crime-alley/dumpster_open.png', w: 544, h: 463 }
const CASH_GLINT = { src: '/assets/packs/crime-alley/cash_bundle.png', w: 247, h: 176 }

// All sprites face RIGHT natively - flip with scaleX(-1) to face left.
const PLAYER_DISPLAY_H = 90
const GUARD_DISPLAY_H = 85
const CRATE_DISPLAY_H = 46
const DUMPSTER_DISPLAY_H = 61
const WALK_FRAME_MS = 140

// --- Movement ---
const WALK_SPEED = 91 // px/s
const CROUCH_SPEED = 46 // px/s, half of WALK_SPEED
const PLAYER_MIN_X = 20
const EXIT_X = 1560 // walking at/past this x = clean getaway (near WORLD_W's far edge)

// --- Interact reach ---
const LOOT_REACH = 28
const DUMPSTER_REACH = 28
const ATTACK_REACH = 28
const ATTACK_COOLDOWN_MS = 260
const LOOT_HOLD_MS = 1200
const LOOT_MIN = 150
const LOOT_MAX = 300

// --- Guards ---
const BASE_GUARD_SPEED = 33 // px/s patrol
const ALERT_SPEED = 75 // px/s while charging the player
const BASE_CONE_RANGE = 124
const DETECTION_FILL_PER_SEC = 100 / 1.2 // 100% over 1.2s continuous exposure
const DETECTION_DECAY_PER_SEC = 100 / 2 // 100% over 2s out of exposure
const TOUCH_BUST_RADIUS = 17

// --- Heat ---
const HEAT_ALERT_SPIKE = 25
const HEAT_SNEAK_TAKEDOWN = 5
const HEAT_ALERT_TAKEDOWN = 20
const HEAT_ESCALATION_THRESHOLD = 50
const HEAT_ESCALATION_SPEED_MULT = 1.25
const HEAT_ESCALATION_CONE_MULT = 1.2
const HEAT_BUST_THRESHOLD = 100

// Fixed layout - a straight line down the 1600px alley from the entrance
// (left) to the getaway edge (right), now long enough for 3 guard patrol
// zones with real breathing room between them instead of 2 crowded onto one
// screen. Positions are spaced so a dumpster's own reach circle never
// overlaps its paired crate's, so a single E press/hold near that pair is
// never ambiguous between "loot" and "hide".
const CRATE_DEFS = [
  { id: 'crate1', x: 60 },
  { id: 'crate2', x: 270 }, // sits inside guard1's patrol zone
  { id: 'crate3', x: 630 }, // sits inside guard2's patrol zone
  { id: 'crate4', x: 820 }, // the safer gap between guard2 and guard3
  { id: 'crate5', x: 1040 }, // sits inside guard3's patrol zone
]
const DUMPSTER_DEFS = [
  { id: 'dumpsterA', x: 450 }, // safe gap between guard1 and guard2
  { id: 'dumpsterB', x: 900 }, // safe gap between guard2 and guard3
  { id: 'dumpsterC', x: 1200 }, // past guard3, last hideout before the exit
]
const GUARD_DEFS = [
  { id: 'guard1', minX: 170, maxX: 360, x: 170, dir: 1 },
  { id: 'guard2', minX: 540, maxX: 740, x: 740, dir: -1 },
  { id: 'guard3', minX: 940, maxX: 1140, x: 1140, dir: -1 },
]

function isInCone(guard, playerX, playerCrouching, coneRange) {
  const effRange = playerCrouching ? coneRange * 0.5 : coneRange
  const dx = playerX - guard.x
  if (guard.dir >= 0) return dx >= 0 && dx <= effRange
  return dx <= 0 && -dx <= effRange
}

let popSeq = 0

export default function CrimeAlleyHeistModal({
  onClose,
  embedded = false,
  title = 'Crime Alley Heist',
  markName = 'The Back Lot',
  markDescription = '',
  buttonLabel = 'Run The Job',
  stakes,
}) {
  const {
    energyCost,
    notorietyIncreaseOnFail,
    wantedIncreaseOnFail,
    reputationDeltaOnFail,
    jailChanceOnFail,
    syndicateId = null,
    inHomeTurf = false,
  } = stakes

  const player = useGameStore((s) => s.player)
  const spendEnergy = useGameStore((s) => s.spendEnergy)
  const addCash = useGameStore((s) => s.addCash)
  const applyCrimeOutcome = useGameStore((s) => s.applyCrimeOutcome)
  const addReputation = useGameStore((s) => s.addReputation)

  const [screen, setScreen] = useState('intro') // 'intro' | 'heist' | 'result'
  const [energyError, setEnergyError] = useState(false)
  const [playerState, setPlayerState] = useState({ x: PLAYER_MIN_X, facing: 'left', crouching: false, hiding: false, moving: false })
  const [guards, setGuards] = useState([])
  const [crates, setCrates] = useState([])
  const [heat, setHeat] = useState(0)
  const [lootedThisRun, setLootedThisRun] = useState(0)
  const [stashesLooted, setStashesLooted] = useState(0)
  const [heldCrateId, setHeldCrateId] = useState(null)
  const [holdProgress, setHoldProgress] = useState(0)
  const [lootPops, setLootPops] = useState([])
  const [resultData, setResultData] = useState(null)

  const playerRef = useRef(playerState)
  const guardsRef = useRef([])
  const cratesRef = useRef([])
  const heatRef = useRef(0)
  const lootedThisRunRef = useRef(0)
  const stashesLootedRef = useRef(0)
  const keysRef = useRef(new Set())
  const prevEHeldRef = useRef(false)
  const holdCrateIdRef = useRef(null)
  const holdProgressRef = useRef(0)
  const lastAttackAtRef = useRef(0)
  const lastFrameAtRef = useRef(0)
  const rafRef = useRef(null)
  const resolvedRef = useRef(false)

  const cleanGetaway = useCallback((reason) => {
    if (resolvedRef.current) return
    resolvedRef.current = true
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    playVictorySound()
    setResultData({
      success: true,
      reason,
      lootedThisRun: lootedThisRunRef.current,
      stashesLooted: stashesLootedRef.current,
    })
    setScreen('result')
  }, [])

  const bust = useCallback(() => {
    if (resolvedRef.current) return
    resolvedRef.current = true
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    const lost = lootedThisRunRef.current
    if (lost > 0) addCash(-lost)
    const res = applyCrimeOutcome({
      success: false,
      payout: 0,
      notorietyIncreaseOnFail,
      wantedIncreaseOnFail,
      assetSeizureOnFail: 0,
      jailChanceOnFail,
      syndicateId,
      inHomeTurf,
    })
    if (reputationDeltaOnFail) addReputation(reputationDeltaOnFail)
    playDefeatSound()
    setResultData({
      success: false,
      lootedThisRun: lost,
      stashesLooted: stashesLootedRef.current,
      res,
    })
    setScreen('result')
  }, [
    addCash,
    applyCrimeOutcome,
    addReputation,
    notorietyIncreaseOnFail,
    wantedIncreaseOnFail,
    reputationDeltaOnFail,
    jailChanceOnFail,
    syndicateId,
    inHomeTurf,
  ])

  const addLootPop = (x, amount) => {
    const id = ++popSeq
    setLootPops((prev) => [...prev.slice(-5), { id, x, amount }])
    setTimeout(() => setLootPops((prev) => prev.filter((p) => p.id !== id)), 900)
  }

  const completeLoot = useCallback((crate) => {
    crate.looted = true
    const amount = LOOT_MIN + Math.floor(Math.random() * (LOOT_MAX - LOOT_MIN + 1))
    addCash(amount)
    lootedThisRunRef.current += amount
    stashesLootedRef.current += 1
    playPurchaseSound()
    addLootPop(crate.x, amount)
    setLootedThisRun(lootedThisRunRef.current)
    setStashesLooted(stashesLootedRef.current)
    setCrates(cratesRef.current.map((c) => ({ ...c })))
  }, [addCash])

  const toggleHideAt = (dumpster) => {
    const p = playerRef.current
    if (!p.hiding) {
      p.hiding = true
      p.hidingAt = dumpster.id
      p.x = dumpster.x
      p.moving = false
    } else {
      p.hiding = false
      p.hidingAt = null
    }
    setPlayerState({ ...p })
  }

  const handleAttack = useCallback(() => {
    if (resolvedRef.current || screen !== 'heist') return
    const p = playerRef.current
    if (p.hiding) return
    const now = performance.now()
    if (now - lastAttackAtRef.current < ATTACK_COOLDOWN_MS) return
    const target = guardsRef.current.find((g) => !g.removed && Math.abs(g.x - p.x) <= ATTACK_REACH)
    if (!target) return
    lastAttackAtRef.current = now
    const wasAlert = target.alert
    target.removed = true
    playSmashSound()
    const heatDelta = wasAlert ? HEAT_ALERT_TAKEDOWN : HEAT_SNEAK_TAKEDOWN
    heatRef.current = Math.min(100, heatRef.current + heatDelta)
    setHeat(heatRef.current)
    setGuards(guardsRef.current.map((g) => ({ ...g })))
    if (heatRef.current >= HEAT_BUST_THRESHOLD) bust()
  }, [screen, bust])

  // Single rAF loop owning the whole live heist: player movement/interact,
  // guard patrol/detection/alert-chase, heat, and the exit check.
  useEffect(() => {
    if (screen !== 'heist') return
    lastFrameAtRef.current = performance.now()
    const tick = (now) => {
      if (resolvedRef.current) return
      const dtSec = Math.min(0.05, (now - lastFrameAtRef.current) / 1000)
      lastFrameAtRef.current = now
      const heatEscalated = heatRef.current >= HEAT_ESCALATION_THRESHOLD

      const p = playerRef.current
      const eHeld = keysRef.current.has('KeyE')
      const eJustPressed = eHeld && !prevEHeldRef.current

      if (!p.hiding) {
        const left = keysRef.current.has('ArrowLeft') || keysRef.current.has('KeyA')
        const right = keysRef.current.has('ArrowRight') || keysRef.current.has('KeyD')
        const crouch = keysRef.current.has('ArrowDown') || keysRef.current.has('KeyS')
        p.crouching = crouch
        const inputX = (right ? 1 : 0) - (left ? 1 : 0)
        if (inputX !== 0) {
          const speed = crouch ? CROUCH_SPEED : WALK_SPEED
          p.x = clamp(PLAYER_MIN_X, WORLD_W - 5, p.x + inputX * speed * dtSec)
          p.facing = inputX > 0 ? 'right' : 'left'
          p.moving = true
        } else {
          p.moving = false
        }

        const nearDumpster = DUMPSTER_DEFS.find((d) => Math.abs(d.x - p.x) <= DUMPSTER_REACH)
        const nearCrate = cratesRef.current.find((c) => !c.looted && Math.abs(c.x - p.x) <= LOOT_REACH)

        if (nearDumpster && eJustPressed) {
          toggleHideAt(nearDumpster)
          holdCrateIdRef.current = null
          holdProgressRef.current = 0
        } else if (nearCrate && eHeld) {
          if (holdCrateIdRef.current !== nearCrate.id) {
            holdCrateIdRef.current = nearCrate.id
            holdProgressRef.current = 0
          }
          holdProgressRef.current += dtSec * 1000
          if (holdProgressRef.current >= LOOT_HOLD_MS) {
            completeLoot(nearCrate)
            holdCrateIdRef.current = null
            holdProgressRef.current = 0
          }
        } else {
          holdCrateIdRef.current = null
          holdProgressRef.current = 0
        }
      } else {
        // Hidden: the only legal input is un-hiding (tap E) - no movement,
        // no looting, no attacking while tucked in the dumpster.
        if (eJustPressed) {
          const d = DUMPSTER_DEFS.find((dd) => dd.id === p.hidingAt)
          if (d) toggleHideAt(d)
        }
        holdCrateIdRef.current = null
        holdProgressRef.current = 0
      }
      prevEHeldRef.current = eHeld

      let bustTouch = false
      for (const g of guardsRef.current) {
        if (g.removed) continue
        const speedMul = heatEscalated ? HEAT_ESCALATION_SPEED_MULT : 1
        if (g.alert) {
          if (!p.hiding) g.targetX = p.x
          const dx = g.targetX - g.x
          const dist = Math.abs(dx)
          if (dist > 0.5) {
            const dirToTarget = dx > 0 ? 1 : -1
            g.dir = dirToTarget
            const step = ALERT_SPEED * speedMul * dtSec
            g.x += dirToTarget * Math.min(step, dist)
          }
          if (!p.hiding && Math.abs(p.x - g.x) <= TOUCH_BUST_RADIUS) bustTouch = true
        } else {
          const speed = BASE_GUARD_SPEED * speedMul
          g.x += g.dir * speed * dtSec
          if (g.x >= g.maxX) {
            g.x = g.maxX
            g.dir = -1
          } else if (g.x <= g.minX) {
            g.x = g.minX
            g.dir = 1
          }
          const coneRange = BASE_CONE_RANGE * (heatEscalated ? HEAT_ESCALATION_CONE_MULT : 1)
          const inCone = !p.hiding && isInCone(g, p.x, p.crouching, coneRange)
          if (inCone) {
            g.detection = Math.min(100, g.detection + DETECTION_FILL_PER_SEC * dtSec)
          } else {
            g.detection = Math.max(0, g.detection - DETECTION_DECAY_PER_SEC * dtSec)
          }
          if (g.detection >= 100 && !g.alert) {
            g.alert = true
            g.targetX = p.x
            heatRef.current = Math.min(100, heatRef.current + HEAT_ALERT_SPIKE)
            playAlarmSound()
          }
        }
      }

      setHeat(heatRef.current)
      if (heatRef.current >= HEAT_BUST_THRESHOLD || bustTouch) {
        bust()
        return
      }

      if (!p.hiding && p.x >= EXIT_X) {
        cleanGetaway('getaway')
        return
      }

      setPlayerState({ ...p })
      setGuards(guardsRef.current.map((g) => ({ ...g })))
      setHeldCrateId(holdCrateIdRef.current)
      setHoldProgress(holdCrateIdRef.current ? clamp(0, 1, holdProgressRef.current / LOOT_HOLD_MS) : 0)

      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [screen, bust, cleanGetaway, completeLoot])

  useEffect(() => {
    if (screen !== 'heist') return
    const onKeyDown = (e) => {
      if (['ArrowLeft', 'ArrowRight', 'ArrowDown', 'KeyA', 'KeyD', 'KeyS', 'KeyE'].includes(e.code)) {
        e.preventDefault()
        keysRef.current.add(e.code)
      } else if (e.code === 'Space') {
        e.preventDefault()
        handleAttack()
      }
    }
    const onKeyUp = (e) => keysRef.current.delete(e.code)
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      keysRef.current = new Set()
    }
  }, [screen, handleAttack])

  const begin = () => {
    if (player.energy < energyCost) {
      setEnergyError(true)
      return
    }
    if (!spendEnergy(energyCost)) {
      setEnergyError(true)
      return
    }
    setEnergyError(false)
    playerRef.current = { x: PLAYER_MIN_X + 20, facing: 'left', crouching: false, hiding: false, hidingAt: null, moving: false }
    guardsRef.current = GUARD_DEFS.map((g) => ({ ...g, alert: false, detection: 0, removed: false, targetX: g.x }))
    cratesRef.current = CRATE_DEFS.map((c) => ({ ...c, looted: false }))
    heatRef.current = 0
    lootedThisRunRef.current = 0
    stashesLootedRef.current = 0
    keysRef.current = new Set()
    prevEHeldRef.current = false
    holdCrateIdRef.current = null
    holdProgressRef.current = 0
    lastAttackAtRef.current = 0
    resolvedRef.current = false
    setPlayerState({ ...playerRef.current })
    setGuards(guardsRef.current.map((g) => ({ ...g })))
    setCrates(cratesRef.current.map((c) => ({ ...c })))
    setHeat(0)
    setLootedThisRun(0)
    setStashesLooted(0)
    setHeldCrateId(null)
    setHoldProgress(0)
    setLootPops([])
    setResultData(null)
    setScreen('heist')
  }

  const bailOut = () => cleanGetaway('bailout')

  const heatPct = clamp(0, 100, heat)
  // Camera follows the player, centered, clamped so it never shows past
  // either end of the 1600px world - the pan that makes "spread the map
  // out" actually read as more alley instead of just more empty margin.
  const cameraX = clamp(0, Math.max(0, WORLD_W - RANGE_W), playerState.x - RANGE_W / 2)

  const renderCharacter = (x, facing, moving, frameIdle, frameWalk, displayH, extraStyle) => {
    const frames = moving ? frameWalk : [frameIdle]
    const frame = frames[Math.floor(performance.now() / WALK_FRAME_MS) % frames.length]
    const w = displayH * (frame.w / frame.h)
    return (
      <div
        className="pointer-events-none absolute"
        style={{ left: x, top: GROUND_Y, transform: 'translate(-50%, -100%)', ...extraStyle }}
      >
        <div
          className="absolute rounded-full bg-black/45"
          style={{ width: w * 0.7, height: 6, left: (w - w * 0.7) / 2, top: displayH - 3 }}
        />
        <img
          src={frame.src}
          alt=""
          style={{
            width: w,
            height: displayH,
            maxWidth: 'none',
            maxHeight: 'none',
            imageRendering: 'pixelated',
            transform: facing === 'left' ? 'scaleX(-1)' : 'none',
          }}
        />
      </div>
    )
  }

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
            A/D or arrows to move, S/down to crouch (slower, but guards see half as far). E to loot a crate
            (hold) or hide in a dumpster (tap - undetectable while hidden, but you can't move or act). Space or
            click to take down a guard when you're right next to them - a sneak takedown is quiet, decking one
            who's already onto you is loud. Walk off the far end of the alley (or Bail Out any time) to keep
            whatever you've grabbed and get out clean. Trip Heat to 100, or let an alerted guard reach you, and
            you lose this run's take and the street knows your face.
          </p>
          <div className="grid grid-cols-2 gap-y-1 text-xs">
            <span className="uppercase tracking-widest text-gray-500">Energy Cost</span>
            <span className={`text-right ${player.energy < energyCost ? 'text-red-400' : 'text-yellow-300'}`}>{energyCost}</span>
            <span className="uppercase tracking-widest text-gray-500">Stashes On Site</span>
            <span className="text-right text-cyan-300">{CRATE_DEFS.length}</span>
          </div>
          {energyError && (
            <div className="border-2 border-red-500/60 bg-red-950/40 p-2 text-center text-xs text-red-300">
              Not enough energy - need {energyCost}, have {player.energy}.
            </div>
          )}
          <button
            onClick={begin}
            disabled={player.energy < energyCost}
            className="w-full border-2 border-red-400 py-1.5 text-sm font-bold uppercase tracking-widest text-red-300 hover:bg-red-400 hover:text-black disabled:cursor-not-allowed disabled:border-gray-600 disabled:text-gray-500 disabled:hover:bg-transparent"
          >
            {buttonLabel} ({energyCost} Energy)
          </button>
        </div>
      )}

      {screen === 'heist' && (
        <div className="flex flex-col gap-3">
          <div
            onMouseDown={handleAttack}
            style={{ width: RANGE_W, height: RANGE_H }}
            className="relative mx-auto select-none overflow-hidden border-4 border-red-800 bg-[#0a0a12]"
          >
            {/* World layer - everything positioned in world-space (0..WORLD_W)
                lives in here, panned as one unit via cameraX so no individual
                entity's left/top math has to know the camera exists. The HUD
                overlay below is the one thing that stays OUTSIDE this layer -
                it's screen-space, fixed to the viewport corner regardless of
                where the camera is looking. */}
            <div
              className="pointer-events-none absolute inset-y-0 left-0"
              style={{ width: WORLD_W, transform: `translateX(${-cameraX}px)` }}
            >
              {/* Tiled backdrop - alley_bg.png repeated left-to-right at
                  native aspect (scaled to RANGE_H tall) to actually cover
                  WORLD_W, instead of one image stretched/cropped to a single
                  screen width. */}
              <div className="absolute inset-y-0 left-0 flex" style={{ width: BG_TILE_COUNT * BG_TILE_W }}>
                {Array.from({ length: BG_TILE_COUNT }).map((_, i) => (
                  <img
                    key={i}
                    src={ALLEY_BG_URL}
                    alt=""
                    style={{ width: BG_TILE_W, height: RANGE_H, flexShrink: 0, imageRendering: 'pixelated' }}
                  />
                ))}
              </div>

              {/* Exit threshold marker */}
              <div
                className="pointer-events-none absolute top-0 bottom-0 border-l-2 border-dashed border-yellow-400/40"
                style={{ left: EXIT_X }}
              />

            {/* Dumpsters */}
            {DUMPSTER_DEFS.map((d) => {
              const open = playerState.hiding && playerState.hidingAt === d.id
              const frame = open ? DUMPSTER_OPEN : DUMPSTER_CLOSED
              const w = DUMPSTER_DISPLAY_H * (frame.w / frame.h)
              const near = !playerState.hiding && Math.abs(playerState.x - d.x) <= DUMPSTER_REACH
              return (
                <div key={d.id} className="pointer-events-none absolute" style={{ left: d.x, top: GROUND_Y, transform: 'translate(-50%, -100%)' }}>
                  <img
                    src={frame.src}
                    alt=""
                    style={{ width: w, height: DUMPSTER_DISPLAY_H, maxWidth: 'none', maxHeight: 'none', imageRendering: 'pixelated' }}
                  />
                  {near && (
                    <div className="absolute -top-4 left-1/2 -translate-x-1/2 whitespace-nowrap border border-yellow-400/70 bg-black/70 px-1 text-[9px] uppercase tracking-widest text-yellow-300">
                      E: Hide
                    </div>
                  )}
                </div>
              )
            })}

            {/* Crates */}
            {crates.map((c) => {
              const frame = c.looted ? CRATE_LOOTED : CRATE_CLOSED
              const w = CRATE_DISPLAY_H * (frame.w / frame.h)
              const near = !playerState.hiding && !c.looted && Math.abs(playerState.x - c.x) <= LOOT_REACH
              const holding = heldCrateId === c.id
              return (
                <div key={c.id} className="pointer-events-none absolute" style={{ left: c.x, top: GROUND_Y, transform: 'translate(-50%, -100%)' }}>
                  {!c.looted && (
                    <img
                      src={CASH_GLINT.src}
                      alt=""
                      className="absolute animate-pulse opacity-70"
                      style={{ width: 17, height: 17 * (CASH_GLINT.h / CASH_GLINT.w), left: w / 2 - 8.5, top: -15, imageRendering: 'pixelated' }}
                    />
                  )}
                  <img
                    src={frame.src}
                    alt=""
                    style={{ width: w, height: CRATE_DISPLAY_H, maxWidth: 'none', maxHeight: 'none', imageRendering: 'pixelated' }}
                  />
                  {near && (
                    <div className="absolute -top-4 left-1/2 -translate-x-1/2 whitespace-nowrap border border-yellow-400/70 bg-black/70 px-1 text-[9px] uppercase tracking-widest text-yellow-300">
                      Hold E: Loot
                    </div>
                  )}
                  {holding && (
                    <div className="absolute -top-2 left-1/2 h-1.5 w-10 -translate-x-1/2 border border-yellow-400 bg-black/60">
                      <div className="h-full bg-yellow-400" style={{ width: `${holdProgress * 100}%` }} />
                    </div>
                  )}
                </div>
              )
            })}

            {/* Guards - vision indicator + detection meter + sprite */}
            {guards.map((g) => {
              if (g.removed) {
                return (
                  <div key={g.id} className="pointer-events-none absolute transition-all duration-300" style={{ left: g.x, top: GROUND_Y, transform: 'translate(-50%, -60%) scale(0.7)', opacity: 0 }} />
                )
              }
              const heatEscalated = heat >= HEAT_ESCALATION_THRESHOLD
              const coneRange = BASE_CONE_RANGE * (heatEscalated ? HEAT_ESCALATION_CONE_MULT : 1) * (playerState.crouching ? 0.5 : 1)
              const coneLeft = g.dir >= 0 ? g.x : g.x - coneRange
              const detectionColor = g.detection > 60 ? 'rgba(248,113,113,0.5)' : 'rgba(250,204,21,0.35)'
              return (
                <div key={g.id}>
                  {!g.alert && (
                    <div
                      className="pointer-events-none absolute"
                      style={{
                        left: coneLeft,
                        top: GROUND_Y - GUARD_DISPLAY_H * 0.62,
                        width: coneRange,
                        height: 12,
                        background: `linear-gradient(${g.dir >= 0 ? 'to right' : 'to left'}, ${detectionColor}, transparent)`,
                      }}
                    />
                  )}
                  {renderCharacter(
                    g.x,
                    g.dir >= 0 ? 'right' : 'left',
                    true,
                    GUARD_IDLE,
                    GUARD_WALK,
                    GUARD_DISPLAY_H,
                    g.alert
                      ? { filter: 'brightness(0.95) sepia(1) saturate(6) hue-rotate(-50deg)' }
                      : undefined
                  )}
                  {!g.alert && g.detection > 0 && (
                    <div
                      className="pointer-events-none absolute h-1 w-7 border border-black/40 bg-black/40"
                      style={{ left: g.x - 14, top: GROUND_Y - GUARD_DISPLAY_H - 8 }}
                    >
                      <div className="h-full bg-red-500" style={{ width: `${g.detection}%` }} />
                    </div>
                  )}
                  {g.alert && (
                    <div
                      className="pointer-events-none absolute whitespace-nowrap text-[10px] font-bold uppercase tracking-widest text-red-400"
                      style={{ left: g.x, top: GROUND_Y - GUARD_DISPLAY_H - 16, transform: 'translateX(-50%)' }}
                    >
                      ! Alert !
                    </div>
                  )}
                </div>
              )
            })}

            {/* Player (hidden inside a dumpster = invisible) */}
            {!playerState.hiding &&
              renderCharacter(
                playerState.x,
                playerState.facing,
                playerState.moving,
                PLAYER_IDLE,
                PLAYER_WALK,
                PLAYER_DISPLAY_H,
                performance.now() - lastAttackAtRef.current < 120 ? { transform: 'translate(-50%, -100%) scale(1.12)' } : undefined
              )}

              {/* Floating loot pickup markers */}
              {lootPops.map((p) => (
                <div
                  key={p.id}
                  className="pointer-events-none absolute animate-pulse whitespace-nowrap text-sm font-bold text-emerald-400"
                  style={{ left: p.x, top: GROUND_Y - 90, transform: 'translateX(-50%)' }}
                >
                  +${p.amount}
                </div>
              ))}
            </div>

            {/* HUD overlay - screen-space, outside the camera-panned world layer above */}
            <div className="pointer-events-none absolute left-2 top-2 flex flex-col gap-1">
              <span className="border border-emerald-400/70 bg-black/60 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-widest text-emerald-300">
                Banked: ${lootedThisRun}
              </span>
              <span className="border border-cyan-500/50 bg-black/60 px-1.5 py-0.5 text-[10px] uppercase tracking-widest text-cyan-300/90">
                Stashes Robbed: {stashesLooted}/{CRATE_DEFS.length}
              </span>
              {playerState.hiding && (
                <span className="border border-purple-400/70 bg-black/60 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-widest text-purple-300">
                  Hiding
                </span>
              )}
            </div>
          </div>

          <div>
            <div className="mb-0.5 flex items-center justify-between text-xs uppercase tracking-widest text-red-400">
              <span>Heat</span>
              <span>{Math.floor(heat)} / 100</span>
            </div>
            <div className="h-5 w-full border-2 border-red-500 bg-[#0a0a16]">
              <div
                className={`h-full bg-red-600 transition-[width] duration-75 ${heatPct >= 50 ? 'animate-pulse' : ''}`}
                style={{ width: `${heatPct}%` }}
              />
            </div>
          </div>

          <p className="text-center text-xs text-gray-500">A/D move &middot; S crouch &middot; E loot/hide &middot; Space/click attack</p>

          <button onClick={bailOut} className="w-full border-2 border-gray-500 py-1.5 text-xs text-gray-300 hover:bg-gray-700">
            Bail Out
          </button>
        </div>
      )}

      {screen === 'result' && resultData && (
        <div className="flex flex-col gap-2 border-2 border-red-500 bg-[#0f1020] p-3 text-sm">
          <p className="text-center text-lg font-bold text-red-300">
            {resultData.success ? (resultData.reason === 'bailout' ? 'Bailed Out' : 'Clean Getaway') : 'Busted'}
          </p>
          {resultData.success ? (
            <p className="text-center text-base font-bold text-green-400">Kept ${resultData.lootedThisRun.toLocaleString()}</p>
          ) : (
            <>
              <p className="text-center text-base font-bold text-red-400">
                Lost this run's take (${resultData.lootedThisRun.toLocaleString()})
              </p>
              <p className="text-center text-xs text-gray-400">
                Notoriety +{notorietyIncreaseOnFail} &middot; Wanted +{wantedIncreaseOnFail}
                {!!reputationDeltaOnFail && ` · Reputation ${reputationDeltaOnFail > 0 ? '+' : ''}${reputationDeltaOnFail}`}
                {resultData.res?.jailed && ' · Arrested'}
              </p>
            </>
          )}
          <p className="text-center text-xs text-gray-500">Stashes Robbed: {resultData.stashesLooted}/{CRATE_DEFS.length}</p>
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
      <div className="glass-panel relative w-[760px] max-w-[95vw] max-h-[92vh] overflow-y-auto border-4 border-red-500 bg-[#1c1d3a] p-6 font-mono text-white">
        {body}
      </div>
    </div>
  )
}
