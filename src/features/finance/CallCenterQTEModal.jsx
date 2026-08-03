import { useCallback, useEffect, useRef, useState } from 'react'
import { useGameStore } from '../../store/useGameStore'
import { clamp, computeFavorability } from './crimeDifficulty'

// Call Center Ops' minigame - "Keep Them On The Line". Replaces the shared
// LeverageMeter race with a Simon-Says cue-matching QTE (arrow keys, same
// input convention RhythmGame already established for this project): a
// mood cue (Skeptical/Annoyed/Interested/Bored) appears, matched to one of
// 4 arrow keys, and must be pressed within a timing window before it times
// out. This is deliberately the ONE racket minigame that keeps LeverageMeter's
// original real-time-race shape (a passive Suspicion creep runs the whole
// call regardless of input, on top of a flat per-miss cost) - Call Center
// Ops is flavor-texted as "the longest con... keep the mark on the line
// without spooking them," i.e. attrition/patience, not a one-shot
// decision or reflex test, so a sustained race is the correct fit here
// specifically. Same stakes shape and resolve()->applyCrimeOutcome
// contract as LeverageMeter.
const MOODS = [
  { id: 'skeptical', label: 'Skeptical', key: 'ArrowUp', arrow: '↑' },
  { id: 'annoyed', label: 'Annoyed', key: 'ArrowDown', arrow: '↓' },
  { id: 'interested', label: 'Interested', key: 'ArrowLeft', arrow: '←' },
  { id: 'bored', label: 'Bored', key: 'ArrowRight', arrow: '→' },
]

const CUE_GAP_MS = 450 // dead time between cues - no input is scored here

export default function CallCenterQTEModal({
  onClose,
  embedded = false,
  title = 'Keep Them On The Line',
  markName = 'Whoever Picked Up',
  markDescription = '',
  buttonLabel = 'Keep Them On The Line',
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

  const [screen, setScreen] = useState('intro') // 'intro' | 'race' | 'result'
  const [locked, setLocked] = useState(null)
  const [leverage, setLeverage] = useState(0)
  const [suspicion, setSuspicion] = useState(0)
  const [cue, setCue] = useState(null) // current mood object, or null during the gap
  const [windowFrac, setWindowFrac] = useState(1) // 1 = just appeared, 0 = about to expire
  const [resultData, setResultData] = useState(null)

  const leverageRef = useRef(0)
  const suspicionRef = useRef(0)
  const cueRef = useRef(null)
  const cueScoredRef = useRef(false)
  const cueEndsAtRef = useRef(0)
  const lastTsRef = useRef(0)
  const rafRef = useRef(null)
  const resolvedRef = useRef(false)
  const lockedRef = useRef(null)

  const resolve = useCallback(
    (success) => {
      if (resolvedRef.current) return
      resolvedRef.current = true
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      const res = applyCrimeOutcome({
        success,
        payout,
        notorietyIncreaseOnFail,
        wantedIncreaseOnFail,
        assetSeizureOnFail,
        jailChanceOnFail,
        syndicateId,
        inHomeTurf,
      })
      if (!success && reputationDeltaOnFail) addReputation(reputationDeltaOnFail)
      setResultData({ success, res })
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

  const rollCue = useCallback(() => {
    const mood = MOODS[Math.floor(Math.random() * MOODS.length)]
    cueRef.current = mood
    cueScoredRef.current = false
    cueEndsAtRef.current = performance.now() + lockedRef.current.windowMs
    setCue(mood)
  }, [])

  const missCue = useCallback(() => {
    suspicionRef.current += lockedRef.current.suspicionPerMiss
    setSuspicion(suspicionRef.current)
    if (suspicionRef.current >= suspicionCap) {
      resolve(false)
      return
    }
    cueRef.current = null
    setCue(null)
    setTimeout(() => {
      if (!resolvedRef.current) rollCue()
    }, CUE_GAP_MS)
  }, [suspicionCap, resolve, rollCue])

  const handleKeyMatch = useCallback(
    (key) => {
      if (screen !== 'race' || resolvedRef.current || !cueRef.current || cueScoredRef.current) return
      cueScoredRef.current = true
      if (key === cueRef.current.key) {
        leverageRef.current += lockedRef.current.leveragePerCue
        setLeverage(leverageRef.current)
        if (leverageRef.current >= target) {
          resolve(true)
          return
        }
        cueRef.current = null
        setCue(null)
        setTimeout(() => {
          if (!resolvedRef.current) rollCue()
        }, CUE_GAP_MS)
      } else {
        missCue()
      }
    },
    [screen, target, resolve, rollCue, missCue]
  )

  // rAF loop - passive Suspicion creep (real elapsed time, frame-rate
  // independent, same clamp-on-resume convention as LeverageMeter's own
  // loop) plus the current cue's countdown/timeout.
  useEffect(() => {
    if (screen !== 'race') return
    lastTsRef.current = performance.now()
    const tick = (now) => {
      const dtSec = Math.min(0.05, (now - lastTsRef.current) / 1000)
      lastTsRef.current = now
      if (!resolvedRef.current && lockedRef.current) {
        suspicionRef.current += lockedRef.current.passiveSuspicionPerSec * dtSec
        setSuspicion(suspicionRef.current)
        if (suspicionRef.current >= suspicionCap) {
          resolve(false)
        } else if (cueRef.current && !cueScoredRef.current) {
          const remaining = clamp(0, 1, (cueEndsAtRef.current - now) / lockedRef.current.windowMs)
          setWindowFrac(remaining)
          if (remaining <= 0) {
            cueScoredRef.current = true
            missCue()
          }
        }
      }
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [screen, suspicionCap, resolve, missCue])

  useEffect(() => {
    if (screen !== 'race') return
    const onKeyDown = (e) => {
      if (MOODS.some((m) => m.key === e.code)) {
        e.preventDefault()
        handleKeyMatch(e.code)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [screen, handleKeyMatch])

  const begin = () => {
    if (player.energy < energyCost) return
    if (!spendEnergy(energyCost)) return
    const favorability = computeFavorability(baseSuccessChance)
    const params = {
      favorability,
      // Widened after live feedback that the original 700-1600ms window
      // felt too fast even reacting immediately - reading the mood icon,
      // recalling which arrow it maps to, then pressing all had to fit
      // inside that. 1100-2300ms leaves real room for the read-then-press
      // sequence, not just the press itself.
      windowMs: 1100 + favorability * 1200,
      leveragePerCue: Math.max(6, Math.round(target / 15)),
      suspicionPerMiss: Math.max(6, Math.round(suspicionCap / 12)),
      passiveSuspicionPerSec: 9 - (favorability - 0.5) * 10,
    }
    lockedRef.current = params
    setLocked(params)
    leverageRef.current = 0
    suspicionRef.current = 0
    resolvedRef.current = false
    setLeverage(0)
    setSuspicion(0)
    setResultData(null)
    rollCue()
    setScreen('race')
  }

  const walkAway = () => {
    resolvedRef.current = true
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    lockedRef.current = null
    setLocked(null)
    setScreen('intro')
    if (syndicateId) declineSyndicateJob(syndicateId)
  }

  const leveragePct = target > 0 ? clamp(0, 100, (leverage / target) * 100) : 0
  const suspicionPct = suspicionCap > 0 ? clamp(0, 100, (suspicion / suspicionCap) * 100) : 0

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
        <div className="flex flex-col gap-3">
          <div className="border-2 border-yellow-500/60 bg-[#0f1020] p-3">
            <p className="text-sm font-bold text-yellow-300">{markName}</p>
            {markDescription && <p className="mt-1 text-xs text-gray-400">{markDescription}</p>}
          </div>
          <p className="text-xs text-gray-400">
            Read the mood, hit the matching arrow before they hang up. Wrong key or too slow spooks them.
          </p>
          <div className="grid grid-cols-2 gap-y-1 text-xs">
            <span className="uppercase tracking-widest text-gray-500">Energy Cost</span>
            <span className="text-right text-yellow-300">{energyCost}</span>
            <span className="uppercase tracking-widest text-gray-500">Payout</span>
            <span className="text-right text-green-400">${payout.toLocaleString()}</span>
          </div>
          <button
            onClick={begin}
            disabled={player.energy < energyCost}
            className="w-full border-2 border-yellow-400 py-1.5 text-sm font-bold uppercase tracking-widest text-yellow-300 hover:bg-yellow-400 hover:text-black disabled:opacity-30"
          >
            Begin
          </button>
        </div>
      )}

      {screen === 'race' && locked && (
        <div className="flex flex-col gap-3">
          <div className="relative flex flex-col items-center justify-center border-4 border-yellow-400 bg-[#0f1020] py-4">
            {cue ? (
              <>
                <span className="text-3xl">{cue.arrow}</span>
                <span className="mt-1 text-sm font-bold uppercase tracking-widest text-yellow-300">{cue.label}</span>
              </>
            ) : (
              <span className="text-sm text-gray-500">...</span>
            )}
            <div className="mt-2 h-1.5 w-3/4 bg-gray-800">
              <div className="h-full bg-yellow-400 transition-[width] duration-75" style={{ width: `${(cue ? windowFrac : 0) * 100}%` }} />
            </div>
          </div>

          <div className="grid grid-cols-4 gap-1 text-center text-xs text-gray-500">
            {MOODS.map((m) => (
              <div key={m.id} className="border border-gray-700 py-1">
                {m.arrow} {m.label}
              </div>
            ))}
          </div>

          <div>
            <div className="mb-0.5 flex items-center justify-between text-xs uppercase tracking-widest text-cyan-300">
              <span>Leverage</span>
              <span>{Math.floor(leverage)} / {target}</span>
            </div>
            <div className="h-5 w-full border-2 border-cyan-500 bg-[#0a0a16]">
              <div className="h-full bg-cyan-500 transition-[width] duration-75" style={{ width: `${leveragePct}%` }} />
            </div>
          </div>

          <div>
            <div className="mb-0.5 flex items-center justify-between text-xs uppercase tracking-widest text-red-400">
              <span>Suspicion</span>
              <span>{Math.floor(suspicion)} / {suspicionCap}</span>
            </div>
            <div className="h-5 w-full border-2 border-red-500 bg-[#0a0a16]">
              <div
                className={`h-full bg-red-600 transition-[width] duration-75 ${suspicionPct > 75 ? 'animate-pulse' : ''}`}
                style={{ width: `${suspicionPct}%` }}
              />
            </div>
          </div>

          <p className="text-center text-xs text-gray-500">{buttonLabel} - arrow keys</p>

          <button onClick={walkAway} className="w-full border-2 border-gray-500 py-1.5 text-xs text-gray-300 hover:bg-gray-700">
            Walk Away
          </button>
        </div>
      )}

      {screen === 'result' && resultData && (
        <div className="flex flex-col gap-2 border-2 border-yellow-500 bg-[#0f1020] p-3 text-sm">
          <p className="text-center text-lg font-bold text-yellow-300">{resultData.success ? 'They Bought It' : 'Hung Up'}</p>
          {resultData.success ? (
            <p className="text-center text-base font-bold text-green-400">+${resultData.res.payout.toLocaleString()}</p>
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
      <div className="glass-panel relative w-[480px] max-h-[85vh] overflow-y-auto border-4 border-yellow-500 bg-[#1c1d3a] p-6 font-mono text-white">
        {body}
      </div>
    </div>
  )
}
