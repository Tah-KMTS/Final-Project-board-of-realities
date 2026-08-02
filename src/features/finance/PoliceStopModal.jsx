import { useEffect, useRef, useState } from 'react'
import { useGameStore } from '../../store/useGameStore'
import FinanceSkirmishModal from './FinanceSkirmishModal'
import { getPoliceReadProbability } from './financeSkirmishEngine'
import { generateSwatSquad } from './financeNpcs'

// The "real arrest pipeline" - replaces the old flat financePoliceEncounter
// (which dropped the player straight into combat with no other options).
// This is the choice screen shown first; FinanceSkirmishModal (the 4-choice
// Attack/Heavy/Guard/Dodge skirmish engine) is only reached here on a
// "Fight Now" pick or after a failed Bribe/Flee attempt, following the same
// internal-phase pattern as CynnEncounterModal (own onClose only from
// WorldScreen's point of view - all escalation happens inside this
// component).
//
// Flee's hit-zone width matches the spec's own formula
// (max(0.08, 0.2 - wantedLevel*0.02)) - tighter than TradeMeter's fixed 0.2
// width since a heftier Wanted level means faster, more coordinated cops.

const FLEE_SWEEP_PERIOD_MS = 1200

function randomFleeZone(width) {
  return { start: Math.random() * (1 - width) }
}

export default function PoliceStopModal({ wantedLevel, onClose }) {
  const cash = useGameStore((s) => s.cash)
  const attemptStreetBribe = useGameStore((s) => s.attemptStreetBribe)
  const addWantedLevel = useGameStore((s) => s.addWantedLevel)
  const sendToJail = useGameStore((s) => s.sendToJail)

  // 'choice' -> 'bribeResolved' | 'fleeAiming' -> 'fleeResolved' | 'combat'
  const [phase, setPhase] = useState('choice')
  const [resultText, setResultText] = useState('')
  const [resultSuccess, setResultSuccess] = useState(false)

  const [markerPos, setMarkerPos] = useState(0.5)
  const markerPosRef = useRef(0.5)
  const startTimeRef = useRef(0)
  const rafRef = useRef(null)

  const bribeCost = 500 * wantedLevel * wantedLevel
  const canAffordBribe = cash >= bribeCost
  const fleeZoneWidth = Math.max(0.08, 0.2 - wantedLevel * 0.02)
  const [fleeZone] = useState(() => randomFleeZone(fleeZoneWidth))

  useEffect(() => {
    if (phase !== 'fleeAiming') return
    startTimeRef.current = performance.now()
    const tick = (now) => {
      const elapsed = now - startTimeRef.current
      const pos = (Math.sin((elapsed / FLEE_SWEEP_PERIOD_MS) * Math.PI * 2) + 1) / 2
      markerPosRef.current = pos
      setMarkerPos(pos)
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [phase])

  const handleBribe = () => {
    if (!canAffordBribe) return
    const { success } = attemptStreetBribe(bribeCost)
    setResultSuccess(success)
    setResultText(
      success
        ? `The officer pockets the $${bribeCost.toLocaleString()} and waves you off. Nothing happened here.`
        : `The officer takes your $${bribeCost.toLocaleString()} anyway and calls it in as a bribery attempt. Cuffs come out.`
    )
    setPhase('bribeResolved')
  }

  const handleStartFlee = () => setPhase('fleeAiming')

  const handleFleeAttempt = () => {
    const pos = markerPosRef.current
    const hit = pos >= fleeZone.start && pos <= fleeZone.start + fleeZoneWidth
    if (hit) addWantedLevel(-1)
    setResultSuccess(hit)
    setResultText(
      hit
        ? 'You cut through an alley and lose them in the crowd. Your Wanted Level drops.'
        : "You clip a trash can and go down hard. They're on you before you can get up."
    )
    setPhase('fleeResolved')
  }

  const handleResolvedContinue = () => {
    if (resultSuccess) {
      onClose()
    } else {
      // Bribe/flee failure - "no extra Wanted penalty here, they're already
      // caught" per spec. Straight into the same combat the old flat
      // encounter always opened, just gated behind a failed skill attempt
      // now instead of being the only option.
      setPhase('combat')
    }
  }

  if (phase === 'combat') {
    return (
      <FinanceSkirmishModal
        title="Police Confrontation"
        monster={generateSwatSquad(wantedLevel)}
        readProbability={getPoliceReadProbability(wantedLevel)}
        onClose={onClose}
        // Win reward stays -1 (not the old Hunter-only -5 full-reset) -
        // matches the "real arrest pipeline" nerf this same file already
        // documents above for Bribe/Flee.
        onVictory={() => addWantedLevel(-1)}
        onDefeat={() => sendToJail()}
        // Retreat used to be a free, instant escape from an active arrest -
        // strictly better than both Bribe (costs cash) and Flee (real skill
        // risk), so nobody had a reason to ever pick either. +1 Wanted for
        // bailing on the fight (resisting, then running) makes Retreat a
        // real third option with its own cost, not a dominant one - and
        // since maybeSpawnPolice's re-encounter roll is driven by
        // wantedLevel, this is also the fix for encounters feeling like
        // they "pop right back" after a consequence-free retreat: now
        // retreating is the one option that actively raises how likely the
        // next one is, instead of the choice being invisible to that system.
        onRetreat={() => addWantedLevel(1)}
        retreatLabel="Break and Run (+1 Wanted)"
      />
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="w-[480px] border-4 border-blue-400 bg-[#1c1d3a] p-6 font-mono text-white">
        <h2 className="mb-2 text-xl font-bold text-blue-300">Police Stop</h2>

        {phase === 'choice' && (
          <>
            <p className="mb-4 text-sm text-gray-300">
              Sirens. A patrol car pulls up on you - your heat finally caught up. {'★'.repeat(wantedLevel)}
            </p>
            <div className="flex flex-col gap-2">
              <button
                onClick={handleBribe}
                disabled={!canAffordBribe}
                className="flex flex-col items-start border-2 border-yellow-400 p-2 text-left hover:bg-yellow-400 hover:text-black disabled:opacity-30"
              >
                <span className="font-bold">Bribe on the spot</span>
                <span className="text-xs">
                  ${bribeCost.toLocaleString()}{!canAffordBribe ? ' — not enough cash' : ''}
                </span>
              </button>
              <button
                onClick={handleStartFlee}
                className="border-2 border-green-400 p-2 text-left font-bold hover:bg-green-400 hover:text-black"
              >
                Flee
              </button>
              <button
                onClick={() => setPhase('combat')}
                className="border-2 border-red-500 p-2 text-left font-bold hover:bg-red-500 hover:text-black"
              >
                Fight Now
              </button>
            </div>
          </>
        )}

        {phase === 'fleeAiming' && (
          <>
            <p className="mb-2 text-sm text-gray-300">Time it right to break their line of sight.</p>
            <div className="relative mb-3 h-5 w-full border border-gray-600 bg-black">
              <div
                className="absolute top-0 h-full bg-green-700/50"
                style={{ left: `${fleeZone.start * 100}%`, width: `${fleeZoneWidth * 100}%` }}
              />
              <div className="absolute top-0 h-full w-[3px] bg-yellow-300" style={{ left: `${markerPos * 100}%` }} />
            </div>
            <button
              onClick={handleFleeAttempt}
              className="w-full border-4 border-yellow-300 bg-yellow-400 py-2 font-bold text-black hover:bg-yellow-300"
            >
              Break Away Now!
            </button>
          </>
        )}

        {(phase === 'bribeResolved' || phase === 'fleeResolved') && (
          <div className="text-center">
            <p className={`mb-4 text-sm ${resultSuccess ? 'text-green-400' : 'text-red-400'}`}>{resultText}</p>
            <button
              onClick={handleResolvedContinue}
              className={`border-4 px-6 py-2 font-bold ${
                resultSuccess
                  ? 'border-green-400 bg-green-500 text-black hover:bg-green-400'
                  : 'border-red-500 bg-red-600 text-white hover:bg-red-500'
              }`}
            >
              {resultSuccess ? 'Continue' : 'Face Them'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
