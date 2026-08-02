import { useCallback, useEffect, useRef, useState } from 'react'
import { useGameStore } from '../../store/useGameStore'
import { clamp, computeFavorability } from './crimeDifficulty'

// Crime Alley's minigame - "Lookout Watch". Replaces the shared LeverageMeter
// race with a reaction game: a Safe/Hot signal alternates on a real-time
// timer, and the ONLY input (Space or click, same convention as
// LeverageMeter) is "Lean On Him" - acting during Safe banks Leverage,
// acting during Hot banks a flat Suspicion hit, and letting 3 Safe windows
// pass with no action in a row also costs Suspicion (the mark wanders off
// while you hesitate). Deliberately has NO passive per-second Suspicion
// creep (unlike LeverageMeter/CallCenterQTEModal/TheCircuitModal) - Crime
// Alley's whole hook is "the danger only exists while you commit," not
// "the mark's patience runs out regardless of input," so standing still and
// waiting for a Safe window is a legitimate, zero-risk strategy here. Same
// stakes shape and resolve()->applyCrimeOutcome contract as LeverageMeter -
// see that file's header comment for the full field list.
export default function LookoutWatchModal({
  onClose,
  embedded = false,
  title = 'Lookout Watch',
  markName = 'Some Guy Who Owes Somebody',
  markDescription = '',
  buttonLabel = 'Lean On Him',
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
  const [signal, setSignal] = useState('safe') // 'safe' | 'hot'
  const [resultData, setResultData] = useState(null)

  const leverageRef = useRef(0)
  const suspicionRef = useRef(0)
  const signalRef = useRef('safe')
  const signalEndsAtRef = useRef(0)
  const signalActedRef = useRef(false) // this window already scored
  const missedStreakRef = useRef(0)
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

  // Rolls the next signal window's phase and duration. Hot windows are
  // shorter and rarer than Safe ones for a good build (favorability widens
  // Safe, shrinks Hot) - never the other way, so a bad build faces more
  // frequent/longer exposure, not an unfair coin flip on which phase comes
  // next. +/-20% jitter on top of the favorability-derived base so the
  // rhythm isn't perfectly predictable metronome timing.
  const rollNextSignal = useCallback((nextPhase) => {
    const p = lockedRef.current
    const base = nextPhase === 'safe' ? p.safeDurationMs : p.hotDurationMs
    const jitter = base * (0.8 + Math.random() * 0.4)
    signalRef.current = nextPhase
    signalEndsAtRef.current = performance.now() + jitter
    signalActedRef.current = false
    setSignal(nextPhase)
  }, [])

  const handleAction = useCallback(() => {
    if (screen !== 'race' || resolvedRef.current || !lockedRef.current) return
    if (signalActedRef.current) return // one score per window
    signalActedRef.current = true
    if (signalRef.current === 'safe') {
      leverageRef.current += lockedRef.current.leveragePerHit
      missedStreakRef.current = 0
      setLeverage(leverageRef.current)
      if (leverageRef.current >= target) resolve(true)
    } else {
      suspicionRef.current += lockedRef.current.suspicionPerHotClick
      setSuspicion(suspicionRef.current)
      if (suspicionRef.current >= suspicionCap) resolve(false)
    }
  }, [screen, target, suspicionCap, resolve])

  // rAF loop - watches the current signal window's countdown, rolls the
  // next window when it expires, and (only for a Safe window that ends with
  // no action taken) counts a miss toward the 3-strike streak penalty.
  useEffect(() => {
    if (screen !== 'race') return
    const tick = (now) => {
      if (!resolvedRef.current && lockedRef.current && now >= signalEndsAtRef.current) {
        if (signalRef.current === 'safe' && !signalActedRef.current) {
          missedStreakRef.current += 1
          if (missedStreakRef.current >= 3) {
            missedStreakRef.current = 0
            suspicionRef.current += lockedRef.current.suspicionPerMissedStreak
            setSuspicion(suspicionRef.current)
            if (suspicionRef.current >= suspicionCap) resolve(false)
          }
        }
        if (!resolvedRef.current) rollNextSignal(signalRef.current === 'safe' ? 'hot' : 'safe')
      }
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [screen, suspicionCap, resolve, rollNextSignal])

  useEffect(() => {
    if (screen !== 'race') return
    const onKeyDown = (e) => {
      if (e.code === 'Space' || e.key === ' ') {
        e.preventDefault()
        handleAction()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [screen, handleAction])

  const begin = () => {
    if (player.energy < energyCost) return
    if (!spendEnergy(energyCost)) return
    const favorability = computeFavorability(baseSuccessChance)
    const params = {
      favorability,
      safeDurationMs: 900 + favorability * 1400,
      hotDurationMs: 1400 - favorability * 700,
      leveragePerHit: Math.max(5, Math.round(target / 5)),
      suspicionPerHotClick: Math.max(10, Math.round(suspicionCap / 4)),
      suspicionPerMissedStreak: Math.max(8, Math.round(suspicionCap / 5)),
    }
    lockedRef.current = params
    setLocked(params)
    leverageRef.current = 0
    suspicionRef.current = 0
    missedStreakRef.current = 0
    resolvedRef.current = false
    setLeverage(0)
    setSuspicion(0)
    setResultData(null)
    rollNextSignal('safe')
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

      <h2 className="mb-2 text-xl font-bold text-red-400">{title}</h2>

      {screen === 'intro' && (
        <div className="flex flex-col gap-3">
          <div className="border-2 border-red-500/60 bg-[#0f1020] p-3">
            <p className="text-sm font-bold text-red-300">{markName}</p>
            {markDescription && <p className="mt-1 text-xs text-gray-400">{markDescription}</p>}
          </div>
          <p className="text-xs text-gray-400">
            Watch the street. Move on him when it's Safe - move on him when it's Hot and you're the one who gets made.
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
            className="w-full border-2 border-red-400 py-1.5 text-sm font-bold uppercase tracking-widest text-red-300 hover:bg-red-400 hover:text-black disabled:opacity-30"
          >
            Begin
          </button>
        </div>
      )}

      {screen === 'race' && locked && (
        <div className="flex flex-col gap-3">
          <div
            className={`flex items-center justify-center border-4 py-4 text-2xl font-bold uppercase tracking-widest ${
              signal === 'safe' ? 'border-green-400 bg-green-500/10 text-green-300' : 'border-red-500 bg-red-500/20 text-red-300 animate-pulse'
            }`}
          >
            {signal === 'safe' ? 'Safe' : 'Hot'}
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

          <button
            onClick={handleAction}
            className="w-full border-4 border-red-400 py-3 text-base font-bold uppercase tracking-widest text-red-300 hover:bg-red-400 hover:text-black"
          >
            {buttonLabel} (Space)
          </button>

          <button onClick={walkAway} className="w-full border-2 border-gray-500 py-1.5 text-xs text-gray-300 hover:bg-gray-700">
            Walk Away
          </button>
        </div>
      )}

      {screen === 'result' && resultData && (
        <div className="flex flex-col gap-2 border-2 border-red-500 bg-[#0f1020] p-3 text-sm">
          <p className="text-center text-lg font-bold text-red-300">{resultData.success ? 'He Paid Up' : 'Made You'}</p>
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
      <div className="glass-panel relative w-[480px] max-h-[85vh] overflow-y-auto border-4 border-red-500 bg-[#1c1d3a] p-6 font-mono text-white">
        {body}
      </div>
    </div>
  )
}
