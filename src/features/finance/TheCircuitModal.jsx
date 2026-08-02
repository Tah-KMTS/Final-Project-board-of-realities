import { useCallback, useEffect, useRef, useState } from 'react'
import { useGameStore } from '../../store/useGameStore'
import { clamp, computeFavorability } from './crimeDifficulty'

const STOPS = [
  { id: 0, label: 'Green Mill', icon: '🎷' },
  { id: 1, label: 'The Cellar', icon: '🥃' },
  { id: 2, label: 'Back Door', icon: '🚪' },
  { id: 3, label: 'Counting Room', icon: '💰' },
]

// Speakeasy Hotel's minigame - "The Circuit" (Capone's Bootleg & Protection
// Squeeze). Replaces the shared LeverageMeter race with an escalating
// Simon-Says sequence-memory game: the nightly collection route flashes in
// order, then the player recites it back before a passive Suspicion creep
// (the "beat cop's patrol" clock, same real-time-tick shape LeverageMeter's
// original used) catches up. This is deliberately the most demanding of the
// 4 racket minigames - the only one with a named Boss and a live jail
// chance on failure, so a real memory test is the correct emotional beat.
// Wrong recall doesn't grow the sequence (retry at the same length) but
// does cost a flat, real Suspicion hit - only a full clean recall banks
// Leverage and escalates. Same stakes shape and
// resolve()->applyCrimeOutcome contract as LeverageMeter.
export default function TheCircuitModal({
  onClose,
  embedded = false,
  title = 'The Circuit',
  markName = "Capone's Club Circuit",
  markDescription = '',
  // buttonLabel is part of the shared leverage-block prop shape (see
  // LeverageMeter.jsx) but unused here - this minigame's input is clicking
  // the 4 stop buttons directly, not one repeated action button.
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

  const [screen, setScreen] = useState('intro') // 'intro' | 'showing' | 'input' | 'race' (race wraps both) | 'result'
  const [locked, setLocked] = useState(null)
  const [leverage, setLeverage] = useState(0)
  const [suspicion, setSuspicion] = useState(0)
  const [sequence, setSequence] = useState([])
  const [phase, setPhase] = useState('showing') // 'showing' | 'input'
  const [flashIndex, setFlashIndex] = useState(-1)
  const [inputProgress, setInputProgress] = useState(0)
  const [roundMsg, setRoundMsg] = useState(null)
  const [resultData, setResultData] = useState(null)

  const suspicionRef = useRef(0)
  const leverageRef = useRef(0)
  const lastTsRef = useRef(0)
  const rafRef = useRef(null)
  const resolvedRef = useRef(false)
  const lockedRef = useRef(null)
  const inputProgressRef = useRef(0)
  const sequenceRef = useRef([])
  const flashTimeoutsRef = useRef([])

  const resolve = useCallback(
    (success) => {
      if (resolvedRef.current) return
      resolvedRef.current = true
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      flashTimeoutsRef.current.forEach(clearTimeout)
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

  const playSequence = useCallback((seq) => {
    setPhase('showing')
    setInputProgress(0)
    inputProgressRef.current = 0
    flashTimeoutsRef.current.forEach(clearTimeout)
    flashTimeoutsRef.current = []
    const flashMs = lockedRef.current.flashMs
    seq.forEach((stopId, i) => {
      flashTimeoutsRef.current.push(
        setTimeout(() => setFlashIndex(stopId), i * flashMs * 1.6)
      )
      flashTimeoutsRef.current.push(
        setTimeout(() => setFlashIndex(-1), i * flashMs * 1.6 + flashMs)
      )
    })
    flashTimeoutsRef.current.push(
      setTimeout(() => {
        if (!resolvedRef.current) setPhase('input')
      }, seq.length * flashMs * 1.6)
    )
  }, [])

  const startRound = useCallback(
    (growSequence) => {
      let seq = sequenceRef.current
      if (growSequence || seq.length === 0) {
        const nextLen = seq.length === 0 ? lockedRef.current.startLen : seq.length + lockedRef.current.growthPerRound
        seq = Array.from({ length: nextLen }, () => Math.floor(Math.random() * STOPS.length))
      }
      sequenceRef.current = seq
      setSequence(seq)
      playSequence(seq)
    },
    [playSequence]
  )

  const handleStopClick = (stopId) => {
    if (screen !== 'race' || phase !== 'input' || resolvedRef.current) return
    const idx = inputProgressRef.current
    if (stopId === sequenceRef.current[idx]) {
      const nextIdx = idx + 1
      inputProgressRef.current = nextIdx
      setInputProgress(nextIdx)
      if (nextIdx >= sequenceRef.current.length) {
        leverageRef.current += lockedRef.current.leveragePerRound
        setLeverage(leverageRef.current)
        setRoundMsg(`Clean run - +${lockedRef.current.leveragePerRound} leverage. The route grows.`)
        if (leverageRef.current >= target) {
          resolve(true)
          return
        }
        startRound(true)
      }
    } else {
      suspicionRef.current += lockedRef.current.suspicionPerMistake
      setSuspicion(suspicionRef.current)
      setRoundMsg(`Wrong stop - +${lockedRef.current.suspicionPerMistake} suspicion. Same route, try again.`)
      if (suspicionRef.current >= suspicionCap) {
        resolve(false)
        return
      }
      startRound(false)
    }
  }

  // rAF loop - passive Suspicion creep only (the sequence-flash/input state
  // machine above is timer/click driven, not per-frame).
  useEffect(() => {
    if (screen !== 'race') return
    lastTsRef.current = performance.now()
    const tick = (now) => {
      const dtSec = Math.min(0.05, (now - lastTsRef.current) / 1000)
      lastTsRef.current = now
      if (!resolvedRef.current && lockedRef.current) {
        suspicionRef.current += lockedRef.current.passiveSuspicionPerSec * dtSec
        setSuspicion(suspicionRef.current)
        if (suspicionRef.current >= suspicionCap) resolve(false)
      }
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [screen, suspicionCap, resolve])

  const begin = () => {
    if (player.energy < energyCost) return
    if (!spendEnergy(energyCost)) return
    const favorability = computeFavorability(baseSuccessChance)
    const params = {
      favorability,
      startLen: Math.round(clamp(2, 4, 4 - favorability * 2)),
      growthPerRound: favorability >= 0.5 ? 1 : 2,
      flashMs: 350 + favorability * 400,
      leveragePerRound: Math.max(10, Math.round(target / 7)),
      suspicionPerMistake: Math.max(8, Math.round(suspicionCap / 9)),
      passiveSuspicionPerSec: Math.max(2, 6 - (favorability - 0.5) * 8),
    }
    lockedRef.current = params
    setLocked(params)
    leverageRef.current = 0
    suspicionRef.current = 0
    sequenceRef.current = []
    resolvedRef.current = false
    setLeverage(0)
    setSuspicion(0)
    setRoundMsg(null)
    setResultData(null)
    setScreen('race')
    startRound(true)
  }

  const walkAway = () => {
    resolvedRef.current = true
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    flashTimeoutsRef.current.forEach(clearTimeout)
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

      <h2 className="mb-2 text-xl font-bold text-orange-300">{title}</h2>

      {screen === 'intro' && (
        <div className="flex flex-col gap-3">
          <div className="border-2 border-orange-500/60 bg-[#0f1020] p-3">
            <p className="text-sm font-bold text-orange-300">{markName}</p>
            {markDescription && <p className="mt-1 text-xs text-gray-400">{markDescription}</p>}
          </div>
          <p className="text-xs text-gray-400">
            Watch the route, then walk it back in the same order. Miss a stop and the patrol notices.
          </p>
          <div className="grid grid-cols-2 gap-y-1 text-xs">
            <span className="uppercase tracking-widest text-gray-500">Energy Cost</span>
            <span className="text-right text-yellow-300">{energyCost}</span>
            <span className="uppercase tracking-widest text-gray-500">Payout</span>
            <span className="text-right text-green-400">${payout.toLocaleString()}</span>
            {jailChanceOnFail > 0 && (
              <>
                <span className="uppercase tracking-widest text-gray-500">Jail Risk On Fail</span>
                <span className="text-right text-red-400">{Math.round(jailChanceOnFail * 100)}%</span>
              </>
            )}
          </div>
          <button
            onClick={begin}
            disabled={player.energy < energyCost}
            className="w-full border-2 border-orange-400 py-1.5 text-sm font-bold uppercase tracking-widest text-orange-300 hover:bg-orange-400 hover:text-black disabled:opacity-30"
          >
            Begin
          </button>
        </div>
      )}

      {screen === 'race' && locked && (
        <div className="flex flex-col gap-3">
          <p className="text-center text-xs uppercase tracking-widest text-gray-500">
            {phase === 'showing' ? 'Watch the route...' : `Walk it back (${inputProgress}/${sequence.length})`}
          </p>

          <div className="grid grid-cols-4 gap-2">
            {STOPS.map((stop) => (
              <button
                key={stop.id}
                onClick={() => handleStopClick(stop.id)}
                disabled={phase !== 'input'}
                className={`flex flex-col items-center gap-1 border-4 py-3 text-2xl transition-colors ${
                  flashIndex === stop.id
                    ? 'border-orange-300 bg-orange-400/40'
                    : 'border-orange-700/60 bg-[#0f1020] hover:enabled:bg-orange-500/10'
                } disabled:cursor-not-allowed`}
              >
                <span>{stop.icon}</span>
                <span className="text-[9px] uppercase tracking-widest text-gray-400">{stop.label}</span>
              </button>
            ))}
          </div>

          {roundMsg && <p className="text-center text-xs italic text-gray-400">{roundMsg}</p>}

          <div>
            <div className="mb-0.5 flex items-center justify-between text-xs uppercase tracking-widest text-cyan-300">
              <span>Leverage</span>
              <span>{Math.floor(leverage)} / {target}</span>
            </div>
            <div className="h-5 w-full border-2 border-cyan-500 bg-[#0a0a16]">
              <div className="h-full bg-cyan-500 transition-[width] duration-150" style={{ width: `${leveragePct}%` }} />
            </div>
          </div>

          <div>
            <div className="mb-0.5 flex items-center justify-between text-xs uppercase tracking-widest text-red-400">
              <span>Suspicion</span>
              <span>{Math.floor(suspicion)} / {suspicionCap}</span>
            </div>
            <div className="h-5 w-full border-2 border-red-500 bg-[#0a0a16]">
              <div
                className={`h-full bg-red-600 transition-[width] duration-150 ${suspicionPct > 75 ? 'animate-pulse' : ''}`}
                style={{ width: `${suspicionPct}%` }}
              />
            </div>
          </div>

          <button onClick={walkAway} className="w-full border-2 border-gray-500 py-1.5 text-xs text-gray-300 hover:bg-gray-700">
            Walk Away
          </button>
        </div>
      )}

      {screen === 'result' && resultData && (
        <div className="flex flex-col gap-2 border-2 border-orange-500 bg-[#0f1020] p-3 text-sm">
          <p className="text-center text-lg font-bold text-orange-300">{resultData.success ? 'Collections Made' : 'Patrol Caught You'}</p>
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
              className="flex-1 border-2 border-orange-400 py-1.5 text-sm font-bold text-orange-300 hover:bg-orange-400 hover:text-black"
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
      <div className="glass-panel relative w-[480px] max-h-[85vh] overflow-y-auto border-4 border-orange-500 bg-[#1c1d3a] p-6 font-mono text-white">
        {body}
      </div>
    </div>
  )
}
