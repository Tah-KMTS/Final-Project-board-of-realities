import { useCallback, useEffect, useRef, useState } from 'react'
import { useGameStore } from '../../store/useGameStore'
import { clamp } from './crimeDifficulty'
import { playGoodHitSound, playBadHitSound, playAlarmSound, playVictorySound, playDefeatSound, playClickSound } from '../../audio/sfx'

// Call Center Ops' minigame - replaces CallCenterQTEModal.jsx (still in the
// file, just no longer wired to callCenterOps's action - see
// districtBuildings.js) with a real-time signal-intercept: answer the CRT's
// prompt on the matching keypad code before it expires, while a second,
// concurrent job - keeping the frequency slider inside a drifting green
// zone - runs the whole time in the background. Let either one lapse and
// the Trace Meter climbs; fill it and the line's burned. Same rAF-loop-
// over-CSS/divs shape every minigame in this family uses
// (CrimeAlleyHeistModal.jsx is the closest reference for the ref-mirrored-
// state tick-loop pattern) - Phaser is reserved for the persistent
// overworld map only, never a job minigame. A `CallCenterManager` class was
// asked for too, same answer as LockpickModal.jsx's own header comment:
// this codebase's minigames are React components consuming a shared
// `stakes` prop (districtBuildings.js's MINIGAME_COMPONENTS dispatch), not
// standalone engine-agnostic classes.
//
// Art: real sprites (public/assets/packs/callcenter/, cropped straight from
// the user's source sheet - it already shipped with real per-pixel alpha,
// no chroma-key pass needed unlike the lockpick sheet). The CRT and keypad
// panels keep their own baked-in placeholder text/labels visible underneath
// - this file's own text sits on a semi-opaque backdrop over just the
// readable area rather than trying to fully occlude them, same "overlay,
// don't repaint" approach LockpickModal.jsx takes with its dial sprite.
// Keypad button hit-areas and the frequency-slider track are positioned by
// PERCENTAGE of each cropped image's own box (measured against the source
// sheet by hand, see the constants below) rather than fixed pixels, so they
// stay aligned regardless of how large the image renders.
const ASSETS = {
  crt: '/assets/packs/callcenter/cc2_crt.png',
  keypad: '/assets/packs/callcenter/cc2_keypad.png',
  trace: '/assets/packs/callcenter/cc2_trace.png',
  slider: '/assets/packs/callcenter/cc2_slider.png',
  callConnected: '/assets/packs/callcenter/cc2_call_connected.png',
  lineTraced: '/assets/packs/callcenter/cc2_line_traced.png',
  headset: '/assets/packs/callcenter/cc2_headset.png',
}

// Measured against the source sheet's own keypad crop - button label
// centers as a fraction of the cropped image's width/height.
const KEYPAD_CODES = ['A1', 'B2', 'C3', '7X', '4Y', '2Z', '5P', '6Q', '8R']
const KEYPAD_POS = [
  { x: 0.336, y: 0.346 },
  { x: 0.573, y: 0.346 },
  { x: 0.809, y: 0.346 },
  { x: 0.336, y: 0.583 },
  { x: 0.573, y: 0.583 },
  { x: 0.809, y: 0.583 },
  { x: 0.336, y: 0.811 },
  { x: 0.573, y: 0.811 },
  { x: 0.809, y: 0.811 },
]
// Number keys 1-9 select the grid in reading order (left-right, top-bottom)
// - matches KEYPAD_POS's own order, so KEY_CODE_ORDER[e.key - '1'] is always
// the code under that numeral.
const KEY_CODE_ORDER = KEYPAD_CODES

// Usable slider track as a fraction of the cropped slider image's width
// (the "0" and "100" tick labels' own centers - see this file's crop notes)
// - freq 0-100 maps linearly onto [TRACK_X0, TRACK_X1].
const TRACK_X0 = 0.01
const TRACK_X1 = 0.94
const TRACK_Y = 0.32

const TIERS = {
  tier1: { id: 'tier1', label: 'Tier 1 - Easy', promptCount: 5, promptTimerSec: 5, driftIntervalSec: 6, zoneWidth: 24, traceFillPerSec: 5, payoutMult: 1 },
  tier2: { id: 'tier2', label: 'Tier 2 - Hard', promptCount: 8, promptTimerSec: 3, driftIntervalSec: 3, zoneWidth: 14, traceFillPerSec: 8, payoutMult: 1.7 },
}
const WRONG_TRACE_PENALTY = 20 // flat, on a wrong keypad press or an expired prompt timer
const FREQ_ADJUST_SPEED = 75 // units/sec via held Left/Right arrows
const FLASH_MS = 220

function rollPrompt(exclude) {
  const pool = exclude == null ? KEYPAD_CODES : KEYPAD_CODES.filter((c) => c !== exclude)
  return pool[Math.floor(Math.random() * pool.length)]
}

export default function SignalInterceptModal({
  onClose,
  embedded = false,
  title = 'Run a Scam Script',
  markName = 'Whoever Picked Up',
  markDescription = '',
  buttonLabel = 'Patch In',
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

  const [screen, setScreen] = useState('intro') // 'intro' | 'playing' | 'result'
  const [tier, setTier] = useState('tier1')
  const [energyError, setEnergyError] = useState(false)
  const [promptIndex, setPromptIndex] = useState(0)
  const [promptCode, setPromptCode] = useState(KEYPAD_CODES[0])
  const [promptTimeLeft, setPromptTimeLeft] = useState(0)
  const [freq, setFreq] = useState(50)
  const [freqTarget, setFreqTarget] = useState(50)
  const [traceMeter, setTraceMeter] = useState(0)
  const [flash, setFlash] = useState(null) // { key, good } | null
  const [traceFlash, setTraceFlash] = useState(false)
  const [resultData, setResultData] = useState(null)

  const sliderRef = useRef(null)
  const tierRef = useRef(TIERS.tier1)
  const promptIndexRef = useRef(0)
  const promptCodeRef = useRef(KEYPAD_CODES[0])
  const promptTimeLeftRef = useRef(0)
  const driftTimerRef = useRef(0)
  const freqRef = useRef(50)
  const freqTargetRef = useRef(50)
  const traceMeterRef = useRef(0)
  const keysRef = useRef(new Set())
  const draggingRef = useRef(false)
  const lastAtRef = useRef(0)
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
      setResultData({ success, res, reasonLabel })
      setScreen('result')
    },
    [payout, notorietyIncreaseOnFail, wantedIncreaseOnFail, assetSeizureOnFail, jailChanceOnFail, syndicateId, inHomeTurf, reputationDeltaOnFail, applyCrimeOutcome, addReputation]
  )

  const nextPrompt = useCallback(() => {
    const code = rollPrompt(promptCodeRef.current)
    promptCodeRef.current = code
    promptTimeLeftRef.current = tierRef.current.promptTimerSec
    setPromptCode(code)
    setPromptTimeLeft(tierRef.current.promptTimerSec)
  }, [])

  const applyTracePenalty = useCallback((now) => {
    traceMeterRef.current = Math.min(100, traceMeterRef.current + WRONG_TRACE_PENALTY)
    setTraceMeter(traceMeterRef.current)
    setTraceFlash(true)
    setTimeout(() => setTraceFlash(false), FLASH_MS)
    playAlarmSound()
  }, [])

  const handleKeypadPress = useCallback(
    (code) => {
      if (resolvedRef.current || screen !== 'playing') return
      const now = performance.now()
      const correct = code === promptCodeRef.current
      setFlash({ key: code, good: correct })
      setTimeout(() => setFlash(null), FLASH_MS)
      if (correct) {
        playGoodHitSound()
        promptIndexRef.current += 1
        setPromptIndex(promptIndexRef.current)
        if (promptIndexRef.current >= tierRef.current.promptCount) {
          resolve(true)
          return
        }
        nextPrompt()
      } else {
        playBadHitSound()
        applyTracePenalty(now)
        nextPrompt()
      }
    },
    [screen, resolve, nextPrompt, applyTracePenalty]
  )

  // Single rAF loop: prompt countdown (timeout = wrong), frequency drift +
  // untuned Trace fill, arrow-key freq nudging, win/lose checks.
  useEffect(() => {
    if (screen !== 'playing') return
    lastAtRef.current = performance.now()
    const tick = (now) => {
      if (resolvedRef.current) return
      const dt = Math.min(0.05, (now - lastAtRef.current) / 1000)
      lastAtRef.current = now
      const t = tierRef.current

      promptTimeLeftRef.current = Math.max(0, promptTimeLeftRef.current - dt)
      if (promptTimeLeftRef.current <= 0) {
        playBadHitSound()
        applyTracePenalty(now)
        nextPrompt()
      }

      const left = keysRef.current.has('ArrowLeft')
      const right = keysRef.current.has('ArrowRight')
      if ((left || right) && !draggingRef.current) {
        const dir = (right ? 1 : 0) - (left ? 1 : 0)
        freqRef.current = clamp(0, 100, freqRef.current + dir * FREQ_ADJUST_SPEED * dt)
      }

      driftTimerRef.current += dt
      if (driftTimerRef.current >= t.driftIntervalSec) {
        driftTimerRef.current = 0
        freqTargetRef.current = 10 + Math.random() * 80
        playClickSound()
      }

      const inZone = Math.abs(freqRef.current - freqTargetRef.current) <= t.zoneWidth / 2
      if (!inZone) {
        traceMeterRef.current = Math.min(100, traceMeterRef.current + t.traceFillPerSec * dt)
      }

      setPromptTimeLeft(promptTimeLeftRef.current)
      setFreq(freqRef.current)
      setFreqTarget(freqTargetRef.current)
      setTraceMeter(traceMeterRef.current)

      if (traceMeterRef.current >= 100) {
        resolve(false, "LINE TRACED - they're already dispatching someone.")
        return
      }

      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [screen, resolve, nextPrompt, applyTracePenalty])

  useEffect(() => {
    if (screen !== 'playing') return
    const onKeyDown = (e) => {
      if (e.code === 'ArrowLeft' || e.code === 'ArrowRight') {
        e.preventDefault()
        keysRef.current.add(e.code)
        return
      }
      const digit = Number(e.key)
      if (digit >= 1 && digit <= 9) {
        e.preventDefault()
        handleKeypadPress(KEY_CODE_ORDER[digit - 1])
      }
    }
    const onKeyUp = (e) => keysRef.current.delete(e.code)
    const onWindowPointerUp = () => {
      draggingRef.current = false
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('pointerup', onWindowPointerUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('pointerup', onWindowPointerUp)
      keysRef.current = new Set()
      draggingRef.current = false
    }
  }, [screen, handleKeypadPress])

  const setFreqFromClientX = (clientX) => {
    const el = sliderRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const x0 = rect.left + rect.width * TRACK_X0
    const x1 = rect.left + rect.width * TRACK_X1
    const frac = clamp(0, 1, (clientX - x0) / (x1 - x0))
    freqRef.current = frac * 100
    setFreq(freqRef.current)
  }

  const handleSliderPointerDown = (e) => {
    draggingRef.current = true
    setFreqFromClientX(e.clientX)
  }
  const handleSliderPointerMove = (e) => {
    if (draggingRef.current) setFreqFromClientX(e.clientX)
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
    promptIndexRef.current = 0
    const firstCode = rollPrompt(null)
    promptCodeRef.current = firstCode
    promptTimeLeftRef.current = t.promptTimerSec
    driftTimerRef.current = 0
    freqRef.current = 50
    freqTargetRef.current = 10 + Math.random() * 80
    traceMeterRef.current = 0
    keysRef.current = new Set()
    draggingRef.current = false
    resolvedRef.current = false
    setPromptIndex(0)
    setPromptCode(firstCode)
    setPromptTimeLeft(t.promptTimerSec)
    setFreq(50)
    setFreqTarget(freqTargetRef.current)
    setTraceMeter(0)
    setFlash(null)
    setTraceFlash(false)
    setResultData(null)
    setScreen('playing')
  }

  const walkAway = () => {
    playClickSound()
    setScreen('intro')
    if (syndicateId) declineSyndicateJob(syndicateId)
  }

  const t = TIERS[tier]

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

      <h2 className="mb-2 text-xl font-bold text-yellow-300">{title}</h2>

      {screen === 'intro' && (
        <div className="flex min-w-0 flex-col gap-3">
          <img src={ASSETS.headset} alt="" className="mx-auto h-20 w-auto" style={{ imageRendering: 'pixelated' }} />
          <div className="min-w-0 border-2 border-yellow-500/60 bg-[#0f1020] p-3">
            <p className="break-words [overflow-wrap:anywhere] text-sm font-bold text-yellow-300">{markName}</p>
            {markDescription && (
              <p className="mt-1 break-words [overflow-wrap:anywhere] text-xs text-gray-400">{markDescription}</p>
            )}
          </div>
          <p className="text-xs text-gray-400">
            The CRT throws up a code - hit the matching keypad button (click it, or press 1-9) before its timer
            runs out. At the same time, keep the frequency slider's marker inside the green zone (drag it, or hold
            Left/Right) - it drifts on its own, and drifting untuned fills the Trace Meter. A wrong code or an
            expired prompt costs a flat chunk of Trace too. Fill the Trace Meter and the line's burned.
          </p>

          <div className="grid grid-cols-2 gap-2">
            {Object.entries(TIERS).map(([id, tt]) => (
              <button
                key={id}
                onClick={() => {
                  playClickSound()
                  setTier(id)
                }}
                className={`flex flex-col items-center gap-1 border-2 p-2 text-xs ${
                  tier === id ? 'border-yellow-400 bg-yellow-400/20 text-yellow-200' : 'border-gray-600 text-gray-400 hover:border-gray-400'
                }`}
              >
                <span className="font-bold uppercase tracking-widest">{tt.label}</span>
                <span>{tt.promptCount} prompts &middot; {tt.promptTimerSec}s each</span>
                <span className="text-green-400">${Math.round(payout * tt.payoutMult).toLocaleString()}</span>
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
            className="w-full border-2 border-yellow-400 py-1.5 text-sm font-bold uppercase tracking-widest text-yellow-300 hover:bg-yellow-400 hover:text-black disabled:cursor-not-allowed disabled:border-gray-600 disabled:text-gray-500 disabled:hover:bg-transparent"
          >
            {buttonLabel} ({t.label})
          </button>
        </div>
      )}

      {screen === 'playing' && (
        <div className={`flex min-w-0 flex-col gap-3 ${traceFlash ? 'animate-[shake_0.15s_ease-in-out]' : ''}`}>
          <style>{`@keyframes shake { 0%,100%{transform:translateX(0)} 25%{transform:translateX(-4px)} 75%{transform:translateX(4px)} }`}</style>

          <div className="flex items-center justify-between text-xs uppercase tracking-widest text-yellow-300">
            <span>Prompt {promptIndex} / {t.promptCount}</span>
          </div>

          <div className="relative mx-auto" style={{ width: 520 }}>
            <img src={ASSETS.trace} alt="" className="w-full" style={{ imageRendering: 'pixelated' }} draggable={false} />
            <div className="mt-1 h-4 w-full border-2 border-red-500 bg-[#0a0a16]">
              <div
                className={`h-full bg-red-500 transition-[width] duration-100 ${traceMeter > 70 ? 'animate-pulse' : ''}`}
                style={{ width: `${traceMeter}%` }}
              />
            </div>
          </div>

          {/* Widened at the user's explicit request (this row used to force
              a horizontal scrollbar inside the old 640px panel) - CRT and
              keypad both ~1.9x their original size, matching the wider
              WIDE_BANNER_W panel UnderworldModal.jsx now gives this tab. */}
          <div className="flex items-center justify-center gap-8">
            {/* CRT: prompt code + its countdown, overlaid on the sprite's own
                screen area (see the TRACK_ and KEYPAD_POS measured constants
                above for the same technique) */}
            <div className="relative" style={{ width: 400, height: 261 }}>
              <img src={ASSETS.crt} alt="" className="absolute inset-0 h-full w-full" style={{ imageRendering: 'pixelated' }} draggable={false} />
              <div
                className="absolute flex flex-col items-center justify-center gap-2 bg-black/55"
                style={{ left: '27%', top: '22%', width: '64%', height: '58%' }}
              >
                <span className="text-xs uppercase tracking-widest text-green-500">Scan Code</span>
                <span className="text-4xl font-bold text-green-400">{promptCode}</span>
                <span className={`text-sm font-bold ${promptTimeLeft < 1.5 ? 'animate-pulse text-red-400' : 'text-green-400'}`}>
                  {promptTimeLeft.toFixed(1)}s
                </span>
              </div>
            </div>

            {/* Keypad: 9 transparent hit-areas over the sprite's own printed
                codes, positioned via KEYPAD_POS's measured percentages. */}
            <div className="relative" style={{ width: 300 }}>
              <img src={ASSETS.keypad} alt="" className="w-full" style={{ imageRendering: 'pixelated' }} draggable={false} />
              {KEYPAD_CODES.map((code, i) => {
                const pos = KEYPAD_POS[i]
                const isFlash = flash?.key === code
                return (
                  <button
                    key={code}
                    onClick={() => handleKeypadPress(code)}
                    className={`absolute -translate-x-1/2 -translate-y-1/2 rounded ${
                      isFlash ? (flash.good ? 'bg-green-400/50' : 'bg-red-500/50') : 'bg-transparent hover:bg-white/10'
                    }`}
                    style={{ left: `${pos.x * 100}%`, top: `${pos.y * 100}%`, width: '28%', height: '22%' }}
                    aria-label={code}
                  />
                )
              })}
            </div>
          </div>

          <div>
            <div className="mb-0.5 flex items-center justify-between text-xs uppercase tracking-widest text-cyan-300">
              <span>Frequency Tuning</span>
              <span>{Math.round(freq)}</span>
            </div>
            <div
              ref={sliderRef}
              onPointerDown={handleSliderPointerDown}
              onPointerMove={handleSliderPointerMove}
              className="relative mx-auto select-none"
              style={{ width: 720, touchAction: 'none' }}
            >
              <img src={ASSETS.slider} alt="" className="w-full" style={{ imageRendering: 'pixelated' }} draggable={false} />
              {/* drifting green zone */}
              <div
                className="pointer-events-none absolute h-5 -translate-x-1/2 -translate-y-1/2 rounded-sm bg-green-400/40 border border-green-300"
                style={{
                  left: `${(TRACK_X0 + (freqTarget / 100) * (TRACK_X1 - TRACK_X0)) * 100}%`,
                  top: `${TRACK_Y * 100}%`,
                  width: `${((t.zoneWidth / 100) * (TRACK_X1 - TRACK_X0)) * 100}%`,
                }}
              />
              {/* player marker */}
              <div
                className="pointer-events-none absolute h-8 w-2 -translate-x-1/2 -translate-y-1/2 bg-cyan-300 shadow-[0_0_6px_2px_rgba(103,232,249,0.8)]"
                style={{ left: `${(TRACK_X0 + (freq / 100) * (TRACK_X1 - TRACK_X0)) * 100}%`, top: `${TRACK_Y * 100}%` }}
              />
            </div>
          </div>

          <p className="text-center text-xs text-gray-500">1-9 or click: answer &middot; Left/Right or drag: tune</p>

          <button onClick={walkAway} className="w-full border-2 border-gray-500 py-1.5 text-xs text-gray-300 hover:bg-gray-700">
            Walk Away
          </button>
        </div>
      )}

      {screen === 'result' && resultData && (
        <div className="flex flex-col gap-2 border-2 border-yellow-500 bg-[#0f1020] p-3 text-sm">
          <img
            src={resultData.success ? ASSETS.callConnected : ASSETS.lineTraced}
            alt={resultData.success ? 'Call Connected' : 'Line Traced'}
            className="mx-auto h-14 w-auto"
            style={{ imageRendering: 'pixelated' }}
          />
          {resultData.success ? (
            <p className="text-center text-base font-bold text-green-400">+${resultData.res.payout.toLocaleString()}</p>
          ) : (
            <>
              <p className="text-center text-xs text-red-300">{resultData.reasonLabel}</p>
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
      <div className="glass-panel relative w-[900px] max-w-[95vw] max-h-[90vh] overflow-y-auto border-4 border-yellow-500 bg-[#1c1d3a] p-6 font-mono text-white">
        {body}
      </div>
    </div>
  )
}
