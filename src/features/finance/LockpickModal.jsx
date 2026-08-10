import { useCallback, useEffect, useRef, useState } from 'react'
import { useGameStore } from '../../store/useGameStore'
import { clamp } from './crimeDifficulty'
import { playGoodHitSound, playBadHitSound, playSmashSound, playPurchaseSound, playVictorySound, playDefeatSound, playClickSound } from '../../audio/sfx'

// Black Market's minigame - replaces FencesTableModal's haggling ladder
// (still in the file, just no longer wired to blackMarket's action - see
// districtBuildings.js) with a real-time lockpick/safe-cracker: find the
// hidden angle, hold pressure to turn the cylinder, don't run out of pick
// or time. Same rAF-loop-over-CSS/divs shape every minigame in this family
// uses (CrimeAlleyHeistModal.jsx is the closest reference for the ref-
// mirrored-state tick-loop pattern) - Phaser is reserved for the persistent
// overworld map only, never a job minigame. A `LockpickManager` class was
// asked for too, but this codebase's minigames are always React components
// consuming a shared `stakes` prop (see FencesTableModal.jsx /
// districtBuildings.js's MINIGAME_COMPONENTS dispatch), not standalone
// engine-agnostic classes - kept that contract instead of introducing a
// second, inconsistent one.
//
// Art: real sprites this time, not this codebase's usual procedural CSS/
// SVG (see LOCKPICK_ASSETS below) - the user supplied a pixel-art lockpick
// sheet (public/assets/packs/lockpick/, cropped+chroma-keyed from their
// source file) and asked for it specifically. Dial and cylinder are static
// images; the pick tool is the one thing that actually rotates (a real
// <img>, CSS-rotated around the dial's center - see the picking screen's
// JSX), same "rotating pick tool sprite" the original spec asked for. The
// progress ring and jam-flash border stay procedural (no sprite exists for
// a partial-fill arc) - a hybrid, not a wholesale replacement.
//
// TARGET IS HIDDEN, not shown - only proximity feedback (a warmth bar +
// the pick's own color shifting cold-blue to hot-red) tells the player how
// close they are, same "feel it out" convention real lockpicking games use.
// Being close lets a wrong-angle push still creep the cylinder a little
// (squared falloff, so it's a nudge, not a shortcut) before it jams; being
// far off jams almost immediately and drains pick integrity fast.
const LOCKPICK_ASSETS = {
  dial: '/assets/packs/lockpick/lp_dial.png',
  pick: '/assets/packs/lockpick/lp_pick1.png',
  cylinder: '/assets/packs/lockpick/lp_cylinder.png',
  tensionBar: '/assets/packs/lockpick/lp_tensionbar.png',
}
// lp_pick1.png is a long, thin hook pick (native 424x33) - hook tip on the
// LEFT, handle on the RIGHT. It's positioned with its RIGHT edge pinned to
// the dial's exact center (transform-origin: 100% 50%) so it reads as a
// tool reaching in from the rim toward the lock, not a needle growing out
// of the middle. NEEDLE_ANGLE_OFFSET corrects for the sprite's native
// left-pointing rest orientation against this file's own angle convention
// (0deg = up/12-o'clock, clockwise-positive - see the pointer-move handler
// below) - confirmed by rendering, not derived on paper.
const NEEDLE_W = 130
const NEEDLE_H = 11
const NEEDLE_ANGLE_OFFSET = 90

const TIERS = {
  easy: { label: 'Easy', toleranceDeg: 26, timerSec: 30, driftDegPerSec: 0, payoutMult: 0.65 },
  medium: { label: 'Medium', toleranceDeg: 14, timerSec: 20, driftDegPerSec: 0, payoutMult: 1 },
  hard: { label: 'Hard', toleranceDeg: 9, timerSec: 15, driftDegPerSec: 22, payoutMult: 1.55 },
}

const ARROW_ROTATE_SPEED = 220 // deg/sec, held ArrowLeft/ArrowRight
const PROGRESS_RATE = 42 // %/sec while force held inside the sweet spot
const PARTIAL_CREEP_RATE = 12 // %/sec ceiling for the close-but-wrong creep, scaled by proximity^2
const DURABILITY_DRAIN_RATE = 60 // %/sec ceiling while force held outside the sweet spot, scaled by (1-proximity)
const JAM_FX_THROTTLE_MS = 220
const PICK_START_HP = 100

const REWARD_FLAVOR = [
  'a bundle of untraceable cash',
  'a handful of loose crypto keys',
  'a case of unmarked tech',
  "a dead man's ledger, worth more to the right buyer",
  'a lockbox of pawned jewelry',
]

function angleDiff(a, b) {
  const d = Math.abs(a - b) % 360
  return d > 180 ? 360 - d : d
}

// Blue (cold) -> red (hot) as proximity goes 0 -> 1.
function warmthColor(proximity) {
  const hue = 210 - clamp(0, 1, proximity) * 210
  return `hsl(${hue}, 85%, 55%)`
}

export default function LockpickModal({
  onClose,
  embedded = false,
  title = 'Crack The Safe',
  markName = 'A Fence Who Asks No Questions',
  markDescription = '',
  buttonLabel = 'Pick The Lock',
  stakes,
}) {
  const {
    payout,
    notorietyIncreaseOnFail,
    wantedIncreaseOnFail,
    reputationDeltaOnFail,
    assetSeizureOnFail,
    jailChanceOnFail,
    energyCost,
    syndicateId = null,
    inHomeTurf = false,
  } = stakes

  const player = useGameStore((s) => s.player)
  const spendEnergy = useGameStore((s) => s.spendEnergy)
  const applyCrimeOutcome = useGameStore((s) => s.applyCrimeOutcome)
  const addReputation = useGameStore((s) => s.addReputation)
  const declineSyndicateJob = useGameStore((s) => s.declineSyndicateJob)

  const [screen, setScreen] = useState('intro') // 'intro' | 'picking' | 'result'
  const [tier, setTier] = useState('medium')
  const [energyError, setEnergyError] = useState(false)
  const [pickAngle, setPickAngle] = useState(0)
  const [progress, setProgress] = useState(0)
  const [durability, setDurability] = useState(PICK_START_HP)
  const [timeLeft, setTimeLeft] = useState(0)
  const [proximity, setProximity] = useState(0)
  const [jamFlash, setJamFlash] = useState(false)
  const [resultData, setResultData] = useState(null)

  const dialRef = useRef(null)
  const tierRef = useRef(TIERS.medium)
  const pickAngleRef = useRef(0)
  const targetAngleRef = useRef(0)
  const mouseAngleRef = useRef(null)
  const mouseDownRef = useRef(false)
  const keysRef = useRef(new Set())
  const progressRef = useRef(0)
  const durabilityRef = useRef(PICK_START_HP)
  const timeLeftRef = useRef(0)
  const lastAtRef = useRef(0)
  const lastJamFxAtRef = useRef(0)
  const rafRef = useRef(null)
  const resolvedRef = useRef(false)

  const resolve = useCallback(
    (success, reasonLabel) => {
      if (resolvedRef.current) return
      resolvedRef.current = true
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      const finalPayout = Math.round(payout * tierRef.current.payoutMult)
      const res = applyCrimeOutcome({
        success,
        payout: finalPayout,
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
      setResultData({
        success,
        res,
        reasonLabel,
        loot: REWARD_FLAVOR[Math.floor(Math.random() * REWARD_FLAVOR.length)],
      })
      setScreen('result')
    },
    [payout, notorietyIncreaseOnFail, wantedIncreaseOnFail, assetSeizureOnFail, jailChanceOnFail, syndicateId, inHomeTurf, reputationDeltaOnFail, applyCrimeOutcome, addReputation]
  )

  // Single rAF loop: pick aim (keys or mouse), target drift (Hard), force
  // resolution (progress vs. jam/durability drain), timer, win/lose checks.
  useEffect(() => {
    if (screen !== 'picking') return
    lastAtRef.current = performance.now()
    const tick = (now) => {
      if (resolvedRef.current) return
      const dt = Math.min(0.05, (now - lastAtRef.current) / 1000)
      lastAtRef.current = now
      const t = tierRef.current

      timeLeftRef.current = Math.max(0, timeLeftRef.current - dt)

      if (t.driftDegPerSec > 0) {
        targetAngleRef.current = (targetAngleRef.current + t.driftDegPerSec * dt + 360) % 360
      }

      const left = keysRef.current.has('ArrowLeft')
      const right = keysRef.current.has('ArrowRight')
      if (left || right) {
        const dir = (right ? 1 : 0) - (left ? 1 : 0)
        pickAngleRef.current = (pickAngleRef.current + dir * ARROW_ROTATE_SPEED * dt + 360) % 360
      } else if (mouseAngleRef.current != null) {
        pickAngleRef.current = mouseAngleRef.current
      }

      const forceHeld = keysRef.current.has('Space') || mouseDownRef.current
      const diff = angleDiff(pickAngleRef.current, targetAngleRef.current)
      const prox = clamp(0, 1, 1 - diff / 180)
      const inSweetSpot = diff <= t.toleranceDeg

      if (forceHeld) {
        if (inSweetSpot) {
          progressRef.current = Math.min(100, progressRef.current + PROGRESS_RATE * dt)
        } else {
          progressRef.current = Math.min(100, progressRef.current + PARTIAL_CREEP_RATE * dt * prox * prox)
          const drain = DURABILITY_DRAIN_RATE * dt * (1 - prox)
          if (drain > 0.01) {
            durabilityRef.current = Math.max(0, durabilityRef.current - drain)
            if (now - lastJamFxAtRef.current > JAM_FX_THROTTLE_MS) {
              lastJamFxAtRef.current = now
              playBadHitSound()
              setJamFlash(true)
              setTimeout(() => setJamFlash(false), 150)
            }
          }
        }
      }

      setPickAngle(pickAngleRef.current)
      setProgress(progressRef.current)
      setDurability(durabilityRef.current)
      setTimeLeft(timeLeftRef.current)
      setProximity(prox)

      if (progressRef.current >= 100) {
        playSmashSound()
        resolve(true)
        return
      }
      if (durabilityRef.current <= 0) {
        resolve(false, 'The pick snapped clean off in the mechanism.')
        return
      }
      if (timeLeftRef.current <= 0) {
        resolve(false, "Time's up - too much noise, someone's coming.")
        return
      }

      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [screen, resolve])

  // Keyboard: Arrow keys aim, Space applies force (held). Mouse aim/force
  // are wired directly on the dial element below (onPointerDown/Up/Move),
  // not here - they need the dial's own bounding rect.
  useEffect(() => {
    if (screen !== 'picking') return
    const onKeyDown = (e) => {
      if (['ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
        e.preventDefault()
        keysRef.current.add(e.code)
      }
    }
    const onKeyUp = (e) => keysRef.current.delete(e.code)
    const onWindowPointerUp = () => {
      mouseDownRef.current = false
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('pointerup', onWindowPointerUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('pointerup', onWindowPointerUp)
      keysRef.current = new Set()
      mouseDownRef.current = false
    }
  }, [screen])

  const handleDialPointerMove = (e) => {
    const el = dialRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const cx = rect.left + rect.width / 2
    const cy = rect.top + rect.height / 2
    const dx = e.clientX - cx
    const dy = e.clientY - cy
    // atan2(dx, -dy) puts 0deg at 12 o'clock and increases clockwise -
    // matches the tick marks/needle rendering below, which both start
    // their rotation from "up," not from the SVG's native 3-o'clock zero.
    mouseAngleRef.current = (Math.atan2(dx, -dy) * (180 / Math.PI) + 360) % 360
  }

  const begin = () => {
    if (player.energy < energyCost) {
      setEnergyError(true)
      return
    }
    if (!spendEnergy(energyCost)) {
      setEnergyError(true)
      return
    }
    playClickSound()
    setEnergyError(false)
    const t = TIERS[tier]
    tierRef.current = t
    pickAngleRef.current = 0
    targetAngleRef.current = Math.random() * 360
    mouseAngleRef.current = null
    mouseDownRef.current = false
    keysRef.current = new Set()
    progressRef.current = 0
    durabilityRef.current = PICK_START_HP
    timeLeftRef.current = t.timerSec
    resolvedRef.current = false
    setPickAngle(0)
    setProgress(0)
    setDurability(PICK_START_HP)
    setTimeLeft(t.timerSec)
    setProximity(0)
    setResultData(null)
    setScreen('picking')
  }

  const walkAway = () => {
    playClickSound()
    setScreen('intro')
    if (syndicateId) declineSyndicateJob(syndicateId)
  }

  const timerPct = tierRef.current.timerSec > 0 ? clamp(0, 100, (timeLeft / tierRef.current.timerSec) * 100) : 0
  const needleColor = warmthColor(proximity)

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

      <h2 className="mb-2 text-xl font-bold text-purple-300">{title}</h2>

      {screen === 'intro' && (
        <div className="flex min-w-0 flex-col gap-3">
          <img
            src={LOCKPICK_ASSETS.cylinder}
            alt=""
            className="mx-auto h-24 w-auto"
            style={{ imageRendering: 'pixelated' }}
          />
          <div className="min-w-0 border-2 border-purple-500/60 bg-[#0f1020] p-3">
            <p className="break-words [overflow-wrap:anywhere] text-sm font-bold text-purple-300">{markName}</p>
            {markDescription && (
              <p className="mt-1 break-words [overflow-wrap:anywhere] text-xs text-gray-400">{markDescription}</p>
            )}
          </div>
          <p className="text-xs text-gray-400">
            Aim the pick with the mouse or Left/Right arrows, then hold Space (or click and hold on the dial) to
            apply pressure. The target angle is hidden - the pick glows hotter the closer you are. Force applied
            off-angle jams the cylinder and chews through your pick; run out of pick or time and the job's blown.
          </p>

          <div className="grid grid-cols-3 gap-2">
            {Object.entries(TIERS).map(([id, t]) => (
              <button
                key={id}
                onClick={() => {
                  playClickSound()
                  setTier(id)
                }}
                className={`flex flex-col items-center gap-1 border-2 p-2 text-xs ${
                  tier === id ? 'border-purple-400 bg-purple-400/20 text-purple-200' : 'border-gray-600 text-gray-400 hover:border-gray-400'
                }`}
              >
                <span className="font-bold uppercase tracking-widest">{t.label}</span>
                <span>{t.timerSec}s</span>
                <span>±{t.toleranceDeg}°{t.driftDegPerSec > 0 ? ' · moving' : ''}</span>
                <span className="text-green-400">${Math.round(payout * t.payoutMult).toLocaleString()}</span>
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-y-1 text-xs">
            <span className="uppercase tracking-widest text-gray-500">Energy Cost</span>
            <span className={`text-right ${player.energy < energyCost ? 'text-red-400' : 'text-yellow-300'}`}>{energyCost}</span>
          </div>
          {energyError && (
            <div className="border-2 border-red-500/60 bg-red-950/40 p-2 text-center text-xs text-red-300">
              Not enough energy - need {energyCost}, have {player.energy}.
            </div>
          )}
          <button
            onClick={begin}
            disabled={player.energy < energyCost}
            className="w-full border-2 border-purple-400 py-1.5 text-sm font-bold uppercase tracking-widest text-purple-300 hover:bg-purple-400 hover:text-black disabled:cursor-not-allowed disabled:border-gray-600 disabled:text-gray-500 disabled:hover:bg-transparent"
          >
            {buttonLabel} ({TIERS[tier].label})
          </button>
        </div>
      )}

      {screen === 'picking' && (
        <div className={`flex min-w-0 flex-col gap-3 ${jamFlash ? 'animate-[shake_0.15s_ease-in-out]' : ''}`}>
          <style>{`@keyframes shake { 0%,100%{transform:translateX(0)} 25%{transform:translateX(-4px)} 75%{transform:translateX(4px)} }`}</style>

          <div>
            <div className="mb-0.5 flex items-center justify-between text-xs uppercase tracking-widest text-red-400">
              <span>Pick Integrity</span>
              <span>{Math.floor(durability)} / 100</span>
            </div>
            {/* lp_tensionbar.png is a static pre-rendered red->green gradient
                strip (its own baked-in hourglass sits in the middle) - used
                as a themed backdrop rather than a fillable bar, with a thin
                marker sliding along it to show the actual current value
                (right edge = full 100, sliding left as durability drains). */}
            <div className="relative h-4 w-full overflow-hidden border-2 border-red-500">
              <img src={LOCKPICK_ASSETS.tensionBar} alt="" className="h-full w-full" style={{ imageRendering: 'pixelated', objectFit: 'fill' }} />
              <div
                className={`absolute top-0 h-full w-[3px] bg-white shadow-[0_0_4px_2px_rgba(255,255,255,0.8)] transition-[left] duration-100 ${durability < 30 ? 'animate-pulse' : ''}`}
                style={{ left: `${durability}%` }}
              />
            </div>
          </div>

          <div
            ref={dialRef}
            onPointerMove={handleDialPointerMove}
            onPointerDown={() => {
              mouseDownRef.current = true
            }}
            onPointerUp={() => {
              mouseDownRef.current = false
            }}
            className={`relative mx-auto select-none border-4 bg-[#0a0a12] ${jamFlash ? 'border-red-500' : 'border-gray-700'}`}
            style={{ width: 220, height: 220, borderRadius: '50%', touchAction: 'none' }}
          >
            <img
              src={LOCKPICK_ASSETS.dial}
              alt=""
              className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
              style={{ width: 190, height: 190, imageRendering: 'pixelated' }}
              draggable={false}
            />
            {/* progress ring - cylinder rotation toward open, procedural
                (no sprite exists for a partial-fill arc) */}
            <svg viewBox="0 0 200 200" width="220" height="220" className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
              <circle
                cx={100}
                cy={100}
                r={96}
                fill="none"
                stroke="#22c55e"
                strokeWidth={5}
                strokeDasharray={2 * Math.PI * 96}
                strokeDashoffset={2 * Math.PI * 96 * (1 - progress / 100)}
                transform="rotate(-90 100 100)"
                strokeLinecap="round"
                opacity={0.9}
              />
            </svg>
            {/* rotating pick tool - real sprite (lp_pick1.png), right edge
                pinned to dial center, hue-rotated cold->hot with proximity -
                see NEEDLE_ANGLE_OFFSET's comment above for the rotation math. */}
            <div
              className="pointer-events-none absolute left-1/2 top-1/2"
              style={{
                width: NEEDLE_W,
                height: NEEDLE_H,
                transformOrigin: '100% 50%',
                transform: `translate(-100%, -50%) rotate(${pickAngle + NEEDLE_ANGLE_OFFSET}deg)`,
              }}
            >
              <img
                src={LOCKPICK_ASSETS.pick}
                alt=""
                className="h-full w-full"
                style={{ imageRendering: 'pixelated', filter: `drop-shadow(0 0 4px ${needleColor}) saturate(${1 + proximity * 2})` }}
                draggable={false}
              />
            </div>
            <div className="pointer-events-none absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#8a7a4a]" />
          </div>

          <div>
            <div className="mb-0.5 flex items-center justify-between text-xs uppercase tracking-widest text-cyan-300">
              <span>Warmth</span>
              <span>{Math.round(proximity * 100)}%</span>
            </div>
            <div className="h-2 w-full border border-cyan-700 bg-[#0a0a16]">
              <div className="h-full transition-[width] duration-100" style={{ width: `${proximity * 100}%`, background: needleColor }} />
            </div>
          </div>

          <div>
            <div className="mb-0.5 flex items-center justify-between text-xs uppercase tracking-widest text-yellow-300">
              <span>Time</span>
              <span>{timeLeft.toFixed(1)}s</span>
            </div>
            <div className="h-2 w-full border border-yellow-700 bg-[#0a0a16]">
              <div
                className={`h-full bg-yellow-400 transition-[width] duration-100 ${timerPct < 25 ? 'animate-pulse' : ''}`}
                style={{ width: `${timerPct}%` }}
              />
            </div>
          </div>

          <p className="text-center text-xs text-gray-500">Mouse / Left-Right: aim &middot; Hold Space or click the dial: apply pressure</p>

          <button onClick={walkAway} className="w-full border-2 border-gray-500 py-1.5 text-xs text-gray-300 hover:bg-gray-700">
            Walk Away
          </button>
        </div>
      )}

      {screen === 'result' && resultData && (
        <div className="flex flex-col gap-2 border-2 border-purple-500 bg-[#0f1020] p-3 text-sm">
          <p className="text-center text-lg font-bold text-purple-300">{resultData.success ? 'Lock Cracked' : 'Job Blown'}</p>
          {resultData.success ? (
            <div className="border-2 border-green-500/60 bg-green-500/10 p-2 text-center">
              <p className="text-xs uppercase tracking-widest text-green-300">Loot</p>
              <p className="mt-1 text-sm text-gray-200">Inside: {resultData.loot}.</p>
              <p className="mt-1 text-base font-bold text-green-400">+${resultData.res.payout.toLocaleString()}</p>
            </div>
          ) : (
            <>
              <p className="text-center text-base font-bold text-red-400">{resultData.reasonLabel}</p>
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
              className="flex-1 border-2 border-purple-400 py-1.5 text-sm font-bold text-purple-300 hover:bg-purple-400 hover:text-black"
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
      <div className="glass-panel relative w-[480px] max-h-[90vh] overflow-y-auto border-4 border-purple-500 bg-[#1c1d3a] p-6 font-mono text-white">
        {body}
      </div>
    </div>
  )
}
