import { useEffect, useState } from 'react'
import { useGameStore } from '../../store/useGameStore'
import { THEFT_ITEM } from '../../game/vehicleGen'
import { playClickSound, playSmashSound, playVictorySound, playAlarmSound } from '../../audio/sfx'

// Mirrors the exact baseSuccessChance/checkWitnesses stealVehicle() passes
// to executeCrime for each method (useGameStore.js) - kept here purely to
// drive the live odds preview below, not a second implementation of the
// roll itself. getCrimeSuccessChance applies the real formula (stats,
// notoriety, luck, witness penalty); this just tells it which method's
// base numbers to use.
const METHOD_PARAMS = {
  equipment: { baseSuccessChance: 0.75, checkWitnesses: true },
  smash: { baseSuccessChance: 0.45, checkWitnesses: true },
}

// How long the "breaking in" beat plays before revealing the outcome - the
// roll itself already happened (stealVehicle is a synchronous store call),
// this is purely a suspense delay so an attempt reads as an event instead
// of an instant, invisible dice roll behind a button.
const ATTEMPT_DURATION_MS = 1100

// Two methods, both routed through the store's stealVehicle() (which
// itself reuses executeCrime() - no bespoke RNG here, see useGameStore.js).
// 'equipment' needs THEFT_ITEM (Slim Jim) in inventory and is quiet/cheap;
// 'smash' needs nothing but is loud/expensive on failure.
//
// Three phases: 'choice' (pick a method, see its live odds), 'attempting'
// (a short suspense beat - the roll already resolved, this just delays
// showing it), 'result' (Success!/Caught! + the actual outcome message).
export default function VehicleTheftModal({ vehicle, onClose, onStolen }) {
  const inventory = useGameStore((s) => s.inventory)
  const stealVehicle = useGameStore((s) => s.stealVehicle)
  const getCrimeSuccessChance = useGameStore((s) => s.getCrimeSuccessChance)
  const [phase, setPhase] = useState('choice')
  const [method, setMethod] = useState(null)
  const [result, setResult] = useState(null)
  const [errorFeedback, setErrorFeedback] = useState(null)

  const hasTool = inventory.some((i) => i.id === THEFT_ITEM.id)
  const equipmentChance = Math.round(getCrimeSuccessChance(METHOD_PARAMS.equipment) * 100)
  const smashChance = Math.round(getCrimeSuccessChance(METHOD_PARAMS.smash) * 100)

  const attemptTheft = (chosenMethod) => {
    setErrorFeedback(null)
    const outcome = stealVehicle({ method: chosenMethod, vehicle })
    if (outcome.reason === 'need tool') {
      setErrorFeedback(`You need a ${THEFT_ITEM.name} to pick this lock quietly.`)
      return
    }
    if (outcome.reason === 'Not enough energy') {
      setErrorFeedback('Not enough energy to try that.')
      return
    }
    // A witnessed failure that also rolled a jail encounter (see
    // useGameStore.js's applyCrimeOutcome) sets pendingCrimeArrest -
    // WorldScreen.jsx's own effect takes over from here (the "CAUGHT
    // RED-HANDED" flash, then PoliceStopModal), so this modal steps aside
    // immediately instead of racing it with its own reveal.
    if (useGameStore.getState().pendingCrimeArrest) {
      onClose()
      return
    }
    if (chosenMethod === 'equipment') playClickSound()
    else playSmashSound()
    setMethod(chosenMethod)
    setResult(outcome)
    setPhase('attempting')
  }

  useEffect(() => {
    if (phase !== 'attempting') return
    const t = setTimeout(() => {
      if (result.success) playVictorySound()
      else playAlarmSound()
      setPhase('result')
    }, ATTEMPT_DURATION_MS)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase])

  const handleFooterClick = () => {
    if (phase === 'result') {
      if (result.success) onStolen?.(result.vehicle ?? vehicle)
      onClose()
      return
    }
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="w-[380px] border-4 border-red-500 bg-[#1c1d3a] p-6 font-mono text-white">
        <h2 className="mb-1 text-xl font-bold text-red-300">Steal Vehicle</h2>
        <p className="mb-4 text-sm text-gray-400">Target: {vehicle?.name || 'Unmarked Car'}</p>

        {phase === 'choice' && (
          <>
            {errorFeedback && (
              <div className="mb-3 border-2 border-red-500 bg-red-950/70 p-2 text-xs font-bold text-red-200">
                {errorFeedback}
              </div>
            )}
            <div className="flex flex-col gap-2">
              <button
                onClick={() => attemptTheft('equipment')}
                disabled={!hasTool}
                title={hasTool ? '' : `Buy a ${THEFT_ITEM.name} first (Gun Store Black Market)`}
                className={`flex items-center justify-between border-2 px-2 py-1 text-sm ${
                  hasTool
                    ? 'border-cyan-400 hover:bg-cyan-400 hover:text-black'
                    : 'cursor-not-allowed border-gray-700 text-gray-600'
                }`}
              >
                <span>Use Slim Jim (quiet){!hasTool ? ' — need Slim Jim' : ''}</span>
                {hasTool && <span className="font-bold">{equipmentChance}%</span>}
              </button>
              <button
                onClick={() => attemptTheft('smash')}
                className="flex items-center justify-between border-2 border-orange-500 px-2 py-1 text-sm hover:bg-orange-500 hover:text-black"
              >
                <span>Smash & Hotwire (noisy — high heat)</span>
                <span className="font-bold">{smashChance}%</span>
              </button>
            </div>
          </>
        )}

        {phase === 'attempting' && (
          <div className="py-6 text-center">
            <p className="animate-pulse text-lg font-bold uppercase tracking-widest text-yellow-300">
              {method === 'equipment' ? 'Picking the lock...' : 'Smashing the window...'}
            </p>
          </div>
        )}

        {phase === 'result' && (
          <div className="py-4 text-center">
            <p
              className={`mb-2 text-xl font-black uppercase tracking-widest ${
                result.success ? 'text-green-400' : 'text-red-400'
              }`}
            >
              {result.success ? 'Success!' : 'Caught!'}
            </p>
            <p className="text-sm text-gray-300">{result.message}</p>
          </div>
        )}

        <button
          onClick={handleFooterClick}
          disabled={phase === 'attempting'}
          className="mt-3 w-full border-4 border-gray-500 py-2 font-bold hover:bg-gray-500 disabled:opacity-40"
        >
          {phase === 'result' ? 'Continue' : 'Leave'}
        </button>
      </div>
    </div>
  )
}
