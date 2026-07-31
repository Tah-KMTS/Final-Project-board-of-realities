import { useState } from 'react'
import { useGameStore } from '../../store/useGameStore'

// No companion jailEngine.js: unlike DDMBoard/ddmEngine.js (a genuinely large
// probability-distribution engine worth splitting out), all of the actual
// resolution math here (sendToJail/payBail/attemptJailEscape) is a handful
// of one-line formulas that already live in useGameStore.js per the spec's
// fallback instruction - this component is purely presentational, the same
// split RiftCombatModal.jsx uses for its own (bigger) combat math.
//
// Follows the shared { onClose, onVictory, onDefeat } modal contract: this
// modal never closes itself on an outcome, the caller decides. onVictory
// fires when the player gets free (bail or escape); onDefeat fires when a
// 3-round escape sitting is exhausted and the player is still locked up.
export default function JailEscapeModal({ onClose, onVictory, onDefeat }) {
  const jail = useGameStore((s) => s.jail)
  const cash = useGameStore((s) => s.cash)
  const payBail = useGameStore((s) => s.payBail)
  const attemptJailEscape = useGameStore((s) => s.attemptJailEscape)
  const getEffectiveLuck = useGameStore((s) => s.getEffectiveLuck)

  const [roundsUsed, setRoundsUsed] = useState(0)
  const [log, setLog] = useState(['You are booked and thrown in a holding cell.'])
  const [outcome, setOutcome] = useState(null) // null | 'freed' | 'exhausted'
  const [busy, setBusy] = useState(false)

  const appendLog = (line) => setLog((prev) => [...prev.slice(-4), line])
  const attemptsLeft = 3 - roundsUsed

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

  const handleAttemptEscape = () => {
    if (busy || outcome || attemptsLeft <= 0) return
    setBusy(true)
    const isFinalAttempt = roundsUsed === 2
    const result = attemptJailEscape(isFinalAttempt)
    const roundNumber = roundsUsed + 1
    setRoundsUsed(roundNumber)

    if (result.success) {
      appendLog(`Round ${roundNumber}: You slip past the guards and escape into the night!`)
      setOutcome('freed')
    } else if (result.exhausted) {
      appendLog(`Round ${roundNumber}: Caught again - and this time they notice. (+1 day sentence, +5 Notoriety)`)
      setOutcome('exhausted')
    } else {
      appendLog(`Round ${roundNumber}: Escape attempt failed. ${3 - roundNumber} attempt(s) left.`)
    }
    setBusy(false)
  }

  const handleContinue = () => {
    if (outcome === 'freed' && onVictory) onVictory()
    if (outcome === 'exhausted' && onDefeat) onDefeat()
    onClose()
  }

  const handleWait = () => {
    // Leave without resolving anything - jail stays exactly as it is. The
    // player can come back later (walking into a gated building while
    // jail.inJail is true re-opens this modal, see WorldScreen.jsx), or just
    // press End Day to let the sentence tick down on its own.
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
      <div className="w-[440px] border-4 border-gray-400 bg-[#1c1d3a] p-6 font-mono text-white">
        <h2 className="mb-2 text-xl font-bold text-gray-300">You're Locked Up</h2>
        <p className="mb-3 text-xs text-gray-400">
          Bad luck, or not enough of it - you got caught. Pay your way out or try to slip the cell.
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
            <button
              onClick={handleAttemptEscape}
              disabled={busy || attemptsLeft <= 0}
              className="border-2 border-orange-400 bg-orange-950 py-1.5 text-sm font-bold text-orange-400 hover:bg-orange-500 hover:text-black disabled:opacity-30"
            >
              Attempt Escape ({attemptsLeft} attempt(s) left today)
            </button>
            <button
              onClick={handleWait}
              disabled={busy}
              className="border-4 border-gray-500 py-2 font-bold hover:bg-gray-500 disabled:opacity-50"
            >
              Sit Tight For Now
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
              You're out of attempts for today. Pay bail if you can, wait out your sentence, or come
              back and try again after resting.
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
