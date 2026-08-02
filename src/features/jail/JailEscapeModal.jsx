import { useState } from 'react'
import { useGameStore } from '../../store/useGameStore'

// No companion jailEngine.js: unlike DDMBoard/ddmEngine.js (a genuinely large
// probability-distribution engine worth splitting out), all of the actual
// resolution math here (sendToJail/payBail/attemptJailBribe) is a handful
// of one-line formulas that already live in useGameStore.js per the spec's
// fallback instruction - this component is purely presentational, the same
// split RiftCombatModal.jsx uses for its own (bigger) combat math.
//
// Follows the shared { onClose, onVictory } modal contract: this modal never
// closes itself on an outcome, the caller decides. onVictory fires when the
// player gets free (bail or bribe) - see WorldScreen.jsx, which emits the
// 'exitJail' bridge event from there to swap the scene back to the overworld.
//
// Opened via the guard-desk interactable inside the jailCell zone (walk up +
// press E), not force-popped the instant the player is arrested - the
// attempt cap (jail.bribeAttemptsToday) lives in the store rather than local
// component state specifically so it survives the player walking away from
// the desk and back, instead of resetting every time this modal remounts.
export default function JailEscapeModal({ onClose, onVictory }) {
  const jail = useGameStore((s) => s.jail)
  const cash = useGameStore((s) => s.cash)
  const payBail = useGameStore((s) => s.payBail)
  const attemptJailBribe = useGameStore((s) => s.attemptJailBribe)
  const getEffectiveLuck = useGameStore((s) => s.getEffectiveLuck)

  const [bribeAmount, setBribeAmount] = useState(() => Math.min(jail.bailCost, Math.round(cash)) || 0)
  const [log, setLog] = useState(['You are booked and thrown in a holding cell.'])
  const [outcome, setOutcome] = useState(null) // null | 'freed' | 'exhausted'
  const [busy, setBusy] = useState(false)

  const appendLog = (line) => setLog((prev) => [...prev.slice(-4), line])
  const attemptsLeft = 3 - jail.bribeAttemptsToday
  const maxBribe = Math.max(0, Math.round(cash))

  const handlePayBail = () => {
    if (busy || outcome) return
    const cost = jail.bailCost
    const ok = payBail()
    if (ok) {
      appendLog(`You paid $${cost.toLocaleString()} bail and walked out the front door.`)
      setOutcome('freed')
    } else {
      appendLog("You don't have enough cash for bail.")
    }
  }

  const handleAttemptBribe = () => {
    if (busy || outcome || attemptsLeft <= 0) return
    const amount = Math.max(0, Math.min(bribeAmount, maxBribe))
    setBusy(true)
    const isFinalAttempt = jail.bribeAttemptsToday === 2
    const result = attemptJailBribe(amount, isFinalAttempt)
    const attemptNumber = jail.bribeAttemptsToday + 1

    if (result.error === 'cash') {
      appendLog("You don't have that much cash on hand.")
    } else if (result.success) {
      appendLog(`Attempt ${attemptNumber}: $${amount.toLocaleString()} finds the right pocket. The guard looks away.`)
      setOutcome('freed')
    } else if (result.exhausted) {
      appendLog(`Attempt ${attemptNumber}: No dice - and the desk sergeant notices the pattern. (+1 day sentence, +5 Notoriety)`)
      setOutcome('exhausted')
    } else {
      appendLog(`Attempt ${attemptNumber}: $${amount.toLocaleString()} wasn't enough this time. ${3 - attemptNumber} attempt(s) left.`)
    }
    setBusy(false)
  }

  const handleContinue = () => {
    if (outcome === 'freed' && onVictory) onVictory()
    onClose()
  }

  const handleWait = () => {
    // Leave without resolving anything - jail stays exactly as it is. The
    // player can walk back up to the desk later, or press End Day to let
    // the sentence tick down on its own.
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
      <div className="w-[440px] border-4 border-gray-400 bg-[#1c1d3a] p-6 font-mono text-white">
        <h2 className="mb-2 text-xl font-bold text-gray-300">Booking Desk</h2>
        <p className="mb-3 text-xs text-gray-400">
          Pay your way out clean, or see if the desk sergeant's got a price today.
        </p>

        <div className="mb-4 border-2 border-gray-600 bg-[#0f1020] p-3 text-sm">
          <p>Sentence Remaining: <span className="text-red-400">{jail.sentenceDaysRemaining} day(s)</span></p>
          <p>Bail Cost: <span className="text-yellow-300">${jail.bailCost.toLocaleString()}</span></p>
          <p>Your Cash: <span className="text-green-400">${Math.round(cash).toLocaleString()}</span></p>
          <p>Effective Luck: <span className="text-cyan-300">{getEffectiveLuck()}</span></p>
        </div>

        <div className="mb-4 h-24 overflow-y-auto border-2 border-gray-700 bg-black p-2 text-xs text-gray-300">
          {log.map((line, i) => (
            <div key={i}>{line}</div>
          ))}
        </div>

        {!outcome && (
          <div className="flex flex-col gap-2">
            <button
              onClick={handlePayBail}
              disabled={busy || cash < jail.bailCost}
              className="border-2 border-green-400 bg-green-950 py-1.5 text-sm font-bold text-green-400 hover:bg-green-500 hover:text-black disabled:opacity-30"
            >
              Pay Bail (${jail.bailCost.toLocaleString()})
            </button>

            <div className="border-2 border-orange-900 bg-orange-950/40 p-2">
              <div className="mb-1 flex items-center justify-between text-xs text-orange-300">
                <span>Bribe Amount</span>
                <span>{attemptsLeft} attempt(s) left today</span>
              </div>
              <input
                type="range"
                min={0}
                max={Math.max(maxBribe, 1)}
                step={Math.max(1, Math.round(jail.bailCost / 20) || 1)}
                value={Math.min(bribeAmount, maxBribe)}
                onChange={(e) => setBribeAmount(Number(e.target.value))}
                disabled={busy || attemptsLeft <= 0}
                className="w-full"
              />
              <div className="mb-2 text-center text-sm text-yellow-300">
                ${Math.min(bribeAmount, maxBribe).toLocaleString()}
              </div>
              <button
                onClick={handleAttemptBribe}
                disabled={busy || attemptsLeft <= 0 || maxBribe <= 0}
                className="w-full border-2 border-orange-400 bg-orange-950 py-1.5 text-sm font-bold text-orange-400 hover:bg-orange-500 hover:text-black disabled:opacity-30"
              >
                Attempt Bribe
              </button>
            </div>

            <button
              onClick={handleWait}
              disabled={busy}
              className="border-4 border-gray-500 py-2 font-bold hover:bg-gray-500 disabled:opacity-50"
            >
              Step Away
            </button>
          </div>
        )}

        {outcome === 'freed' && (
          <div className="text-center">
            <p className="mb-3 font-bold text-green-400">You're free.</p>
            <button
              onClick={handleContinue}
              className="border-4 border-green-400 bg-green-500 px-6 py-2 font-bold text-black hover:bg-green-400"
            >
              Continue
            </button>
          </div>
        )}

        {outcome === 'exhausted' && (
          <div className="text-center">
            <p className="mb-2 font-bold text-red-500">Still locked up.</p>
            <p className="mb-3 text-xs text-gray-400">
              No more bribe attempts today. Pay bail if you can, try the service corridor, or wait out
              your sentence.
            </p>
            <button
              onClick={handleContinue}
              className="border-4 border-gray-500 px-6 py-2 font-bold hover:bg-gray-500"
            >
              Continue
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
