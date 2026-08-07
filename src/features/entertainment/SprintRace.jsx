import { useEffect, useRef, useState } from 'react'
import { useGameStore } from '../../store/useGameStore'
import { playClickSound, playStaggerSound, playVictorySound, playDefeatSound } from '../../audio/sfx'

// Sports Stadium arrow-key sprint QTE. Mirrors RhythmGame.jsx's shadow-state
// rAF architecture as closely as a "count discrete alternating strides"
// mechanic allows: refs own the per-frame/per-keypress truth (stride counts,
// AI schedules, lockout timers), React state is only touched for what
// actually needs to re-render (live stride counter, stumble toast, leave
// confirmation). Runners render as plain positioned <div>s moved via direct
// DOM style writes every tick/keypress - not React state, not <canvas>,
// same technique RhythmGame.jsx uses for its note lanes.
//
// Mounts fresh (via conditional-render in SportsStadiumTab.jsx) once per
// race and unmounts on finish/forfeit - same tab-conditional-unmount
// reliance RhythmGame.jsx documents for its keydown-listener/rAF cleanup.

const TARGET_STRIDES = 40
const FIELD_SIZE = 6 // player + 5 AI
const AI_MIN_INTERVAL_MS = 180
const AI_MAX_INTERVAL_MS = 260
const SURGE_START_STRIDE = 30 // 1-indexed: "from stride 30 of 40 onward"
const SURGE_FACTOR = 0.85 // the Favorite's late-race kick, 15% faster strides
const STUMBLE_TOAST_MS = 450

const TRACK_WIDTH_PX = 480
const LANE_HEIGHT_PX = 32

const LEFT_KEYS = new Set(['ArrowLeft', 'a', 'A'])
const RIGHT_KEYS = new Set(['ArrowRight', 'd', 'D'])

const RIVAL_COLORS = ['#e0507a', '#4aa8e0', '#e0c040', '#4ac07a', '#a06ae0']

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))

function normalizeKey(key) {
  if (LEFT_KEYS.has(key)) return 'L'
  if (RIGHT_KEYS.has(key)) return 'R'
  return null
}

// Precomputed once at race start (per the feasibility pass: NOT independent
// setInterval per AI racer, which risks drift/desync against the player's
// rAF-driven loop). Each racer gets a full 40-stride array of cumulative-ms
// OFFSETS from race start (not baked absolute timestamps) so that pausing
// (shifting raceStartRef forward) uniformly shifts every racer's schedule,
// same trick RhythmGame.jsx uses for songStartRef/note target times.
function buildAiSchedules(fixApplied) {
  const racerCount = FIELD_SIZE - 1
  const baseCadences = Array.from(
    { length: racerCount },
    () => AI_MIN_INTERVAL_MS + Math.random() * (AI_MAX_INTERVAL_MS - AI_MIN_INTERVAL_MS)
  )

  // The Favorite = whichever AI rolled the fastest (lowest ms/stride) cadence.
  let favoriteIdx = 0
  baseCadences.forEach((c, i) => {
    if (c < baseCadences[favoriteIdx]) favoriteIdx = i
  })

  const racers = baseCadences.map((baseCadence, i) => {
    const offsets = new Array(TARGET_STRIDES)
    let cumulative = 0
    for (let strideNum = 1; strideNum <= TARGET_STRIDES; strideNum++) {
      // Per-stride jitter for flavor - the schedule is still fully
      // precomputed up front, just with individually varied stride lengths
      // instead of one flat cadence repeated 40 times.
      let interval = baseCadence + (Math.random() * 30 - 15)
      // Drama beat: only the Favorite, only the final quarter, and only if
      // the player didn't pay Rothstein's man to have a word with them.
      if (i === favoriteIdx && strideNum >= SURGE_START_STRIDE && !fixApplied) {
        interval *= SURGE_FACTOR
      }
      cumulative += interval
      offsets[strideNum - 1] = cumulative
    }
    return { baseCadence, offsets }
  })

  return { racers, favoriteIdx }
}

export default function SprintRace({ tier, fixApplied, onFinish }) {
  const [strideDisplay, setStrideDisplay] = useState(0)
  const [stumbleToast, setStumbleToast] = useState(false)
  const [leaveConfirm, setLeaveConfirm] = useState(false)

  // --- Refs: the actual per-frame/per-keypress truth --------------------
  const playerStrideCountRef = useRef(0)
  const lastStrideKeyRef = useRef(null)
  const lastStrideTimeRef = useRef(0)
  const lockoutUntilRef = useRef(0)
  const playerFinishTimeRef = useRef(null)
  const finishedRef = useRef(false)
  const pausedRef = useRef(false)
  const hiddenAtRef = useRef(0)
  const rafRef = useRef(null)
  const stumbleToastTimeoutRef = useRef(null)
  const runnerElRefs = useRef([])
  const aiProgressPointerRef = useRef(new Array(FIELD_SIZE - 1).fill(0))

  const raceStartRef = useRef(null)
  const aiRef = useRef(null)

  // AGI/VIT/STR/PER + effective Luck, read once at race start via
  // getState() into refs (spec item 6) - not a reactive subscription, so a
  // mid-race stat change (there isn't one, but for future-proofing) can't
  // retune the debounce windows out from under an in-progress race.
  const statsRef = useRef(null)
  if (statsRef.current === null) {
    const state = useGameStore.getState()
    const stats = state.player.stats
    const AGI = stats.AGI ?? 5
    const VIT = stats.VIT ?? 5
    const STR = stats.STR ?? 5
    const PER = stats.PER ?? 5
    statsRef.current = {
      effectiveMinInterval: Math.max(70, 90 - (AGI - 5) * 3),
      staminaThreshold: clamp(Math.round(10 + (VIT - 5) * 1.5), 6, 20),
      stumbleLockoutMs: Math.max(150, 400 - (STR - 5) * 15),
      graceWindowMs: clamp(70 + (PER - 5) * 5, 40, 100),
      effectiveLuck: state.getEffectiveLuck(),
    }
  }

  // Race-start timestamp + the full precomputed AI schedule, captured once
  // (lazy-init on first render, same pattern as statsRef above) rather than
  // in an effect, so the Favorite's identity is already known for the very
  // first paint (used to badge their lane).
  if (raceStartRef.current === null) {
    raceStartRef.current = performance.now()
    lastStrideTimeRef.current = raceStartRef.current
    aiRef.current = buildAiSchedules(fixApplied)
  }

  const writePlayerPosition = (strideCount) => {
    const el = runnerElRefs.current[0]
    if (el) el.style.transform = `translateX(${(strideCount / TARGET_STRIDES) * TRACK_WIDTH_PX}px)`
  }

  const finishRace = (reason) => {
    if (finishedRef.current) return
    finishedRef.current = true
    if (rafRef.current) cancelAnimationFrame(rafRef.current)

    let place = null
    if (reason === 'complete') {
      const finishTime = playerFinishTimeRef.current
      const aiFinishTimes = aiRef.current.racers.map(
        (r) => raceStartRef.current + r.offsets[TARGET_STRIDES - 1]
      )
      // AI finish timestamps are known constants the instant the race
      // starts (fully precomputed schedule) - so "who finished first" is
      // just a comparison against those numbers, never a race condition
      // against a live AI timer/callback.
      const beatenByCount = aiFinishTimes.filter((t) => t < finishTime).length
      place = beatenByCount + 1
      // Matches SportsStadiumTab.jsx's own PLACE_MULTIPLIER - 1st/2nd/3rd
      // pay, 4th-6th don't - so this jingle tracks the same "did it pay"
      // line the results screen shows, not an arbitrary threshold.
      if (place <= 3) playVictorySound()
      else playDefeatSound()
    }

    onFinish({
      place,
      strides: playerStrideCountRef.current,
      reason,
      effectiveLuckAtStart: statsRef.current.effectiveLuck,
      favoriteIdx: aiRef.current.favoriteIdx,
    })
  }

  // --- Keyboard capture --------------------------------------------------
  // Stride/stumble judgment happens synchronously right here against
  // performance.now(), not inside the rAF tick, not gated behind setState -
  // same reasoning RhythmGame.jsx documents for its hit judgment. e.repeat
  // filtering is the single highest-risk detail per the feasibility pass:
  // a held key's browser auto-repeat must never be misread as a deliberate
  // same-key stumble.
  useEffect(() => {
    const handleKeyDown = (e) => {
      const dir = normalizeKey(e.key)
      if (!dir) return
      e.preventDefault()
      if (e.repeat) return
      if (pausedRef.current || finishedRef.current) return

      const now = performance.now()
      const cfg = statsRef.current

      // Stumble lockout in effect: all input is dropped, tempo only, no
      // strides are ever lost/reversed/re-triggered by this.
      if (now < lockoutUntilRef.current) return

      const lastKey = lastStrideKeyRef.current

      if (lastKey !== null && dir === lastKey) {
        // Same-key repeat.
        if (now - lastStrideTimeRef.current <= cfg.graceWindowMs) {
          // Inside the grace window - read as a fast-alternation artifact,
          // not a deliberate stumble. No penalty, no count.
          return
        }
        // Deliberate stumble: locks out counted strides for a beat.
        playStaggerSound()
        lockoutUntilRef.current = now + cfg.stumbleLockoutMs
        setStumbleToast(true)
        if (stumbleToastTimeoutRef.current) clearTimeout(stumbleToastTimeoutRef.current)
        stumbleToastTimeoutRef.current = setTimeout(() => setStumbleToast(false), STUMBLE_TOAST_MS)
        return
      }

      // Opposite key (or the very first press of the race) - candidate
      // stride. The debounce floor is normally effectiveMinInterval, but
      // every staminaThreshold-th stride is a forced "breather" gate that
      // needs the slower 180ms floor instead.
      const nextStrideNumber = playerStrideCountRef.current + 1
      const isBreather = nextStrideNumber % cfg.staminaThreshold === 0
      const requiredInterval = isBreather ? 180 : cfg.effectiveMinInterval
      if (lastKey !== null && now - lastStrideTimeRef.current < requiredInterval) {
        // Too fast to count yet - a tempo throttle, not a stumble. Dropped
        // silently; alternation state is untouched, try again.
        return
      }

      playClickSound()
      playerStrideCountRef.current = nextStrideNumber
      lastStrideKeyRef.current = dir
      lastStrideTimeRef.current = now
      setStrideDisplay(nextStrideNumber)
      writePlayerPosition(nextStrideNumber)

      if (nextStrideNumber >= TARGET_STRIDES) {
        playerFinishTimeRef.current = now
        finishRace('complete')
      }
    }
    const handleKeyUp = (e) => {
      if (normalizeKey(e.key)) e.preventDefault()
    }
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // --- Pause the race clock when the tab loses focus, same shifting-
  // timestamp approach RhythmGame.jsx uses: every AI stride is stored as an
  // offset from raceStartRef, so shifting raceStartRef forward by the
  // hidden duration shifts every AI racer's schedule consistently, with no
  // per-racer bookkeeping needed.
  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden) {
        pausedRef.current = true
        hiddenAtRef.current = performance.now()
      } else if (pausedRef.current) {
        raceStartRef.current += performance.now() - hiddenAtRef.current
        pausedRef.current = false
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [])

  // --- rAF tick: advances each AI racer's on-screen position from the
  // precomputed schedule. Player position is instead written directly from
  // the keydown handler on every counted stride (immediate feedback,
  // consistent with RhythmGame.jsx's hideNoteEl direct-DOM-write-on-hit).
  useEffect(() => {
    const tick = () => {
      if (!pausedRef.current && !finishedRef.current) {
        const now = performance.now()
        aiRef.current.racers.forEach((racer, i) => {
          let idx = aiProgressPointerRef.current[i]
          while (idx < TARGET_STRIDES && now >= raceStartRef.current + racer.offsets[idx]) idx++
          aiProgressPointerRef.current[i] = idx

          const prevOffset = idx === 0 ? 0 : racer.offsets[idx - 1]
          const nextOffset = idx < TARGET_STRIDES ? racer.offsets[idx] : racer.offsets[TARGET_STRIDES - 1]
          const elapsedInStride = now - (raceStartRef.current + prevOffset)
          const strideSpan = Math.max(1, nextOffset - prevOffset)
          const frac = idx >= TARGET_STRIDES ? 0 : clamp(elapsedInStride / strideSpan, 0, 1)
          const displayStrides = Math.min(TARGET_STRIDES, idx + frac)

          const el = runnerElRefs.current[i + 1]
          if (el) el.style.transform = `translateX(${(displayStrides / TARGET_STRIDES) * TRACK_WIDTH_PX}px)`
        })
      }
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      if (stumbleToastTimeoutRef.current) clearTimeout(stumbleToastTimeoutRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const favoriteIdx = aiRef.current.favoriteIdx

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex w-full items-center justify-between text-sm">
        <span className="text-gray-300">{tier.label}</span>
        <span className="font-bold text-emerald-300">Stride: {strideDisplay} / {TARGET_STRIDES}</span>
      </div>

      <div className="relative h-6 w-full text-center">
        {stumbleToast && <p className="text-lg font-black tracking-widest text-red-400">STUMBLE!</p>}
      </div>

      <div
        className="relative border-2 border-gray-700 bg-[#0a1a0e] p-2"
        style={{ width: TRACK_WIDTH_PX + 32 }}
      >
        {Array.from({ length: FIELD_SIZE }).map((_, laneIdx) => {
          const isPlayer = laneIdx === 0
          const aiIdx = laneIdx - 1
          const color = isPlayer ? '#4ac0e0' : RIVAL_COLORS[aiIdx % RIVAL_COLORS.length]
          const label = isPlayer ? 'YOU' : `Rival ${aiIdx + 1}${aiIdx === favoriteIdx ? ' ⭐' : ''}`
          return (
            <div
              key={laneIdx}
              className="relative mb-1 border-b border-gray-800"
              style={{ width: TRACK_WIDTH_PX, height: LANE_HEIGHT_PX }}
            >
              <span className="absolute left-0 top-0 z-10 text-xs text-gray-400">{label}</span>
              <div className="absolute right-0 top-0 h-full w-0.5 bg-white/60" />
              <div
                ref={(el) => (runnerElRefs.current[laneIdx] = el)}
                className="absolute bottom-0.5 h-3 w-3 rounded-full"
                style={{ backgroundColor: color, transform: 'translateX(0px)', willChange: 'transform' }}
              />
            </div>
          )
        })}
      </div>

      <p className="text-xs text-gray-500">
        Alternate Left/Right (or A/D) as fast and as cleanly as you can - 40 clean strides wins the day. Repeating
        the same key too fast is a stumble.
      </p>

      {!leaveConfirm ? (
        <button
          onClick={() => setLeaveConfirm(true)}
          className="mt-1 border-2 border-gray-600 px-3 py-1 text-xs text-gray-400 hover:border-red-500 hover:text-red-400"
        >
          Leave the Track
        </button>
      ) : (
        <div className="mt-1 flex items-center gap-2 text-xs">
          <span className="text-red-400">Pull out mid-race? Entry fee is forfeit either way.</span>
          <button onClick={() => finishRace('forfeit')} className="border-2 border-red-500 px-2 py-0.5 font-bold text-red-400 hover:bg-red-500 hover:text-black">
            Yes, leave
          </button>
          <button onClick={() => setLeaveConfirm(false)} className="border-2 border-gray-600 px-2 py-0.5 text-gray-400 hover:bg-gray-700">
            Keep running
          </button>
        </div>
      )}
    </div>
  )
}
