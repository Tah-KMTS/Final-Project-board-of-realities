import { useState } from 'react'

const PATH_CELLS = 5
const START_HP = 100

function rollD6() {
  return 1 + Math.floor(Math.random() * 6)
}

export default function DDMModal({
  opponentName,
  deckFlavorName = 'Standard Deck',
  opponentPowerBonus = 0,
  wagerLabel,
  onClose,
  onVictory,
  onDefeat,
}) {
  const [playerHp, setPlayerHp] = useState(START_HP)
  const [opponentHp, setOpponentHp] = useState(START_HP)
  const [playerProgress, setPlayerProgress] = useState(0)
  const [opponentProgress, setOpponentProgress] = useState(0)
  const [log, setLog] = useState([`${opponentName} unfolds their ${deckFlavorName} across the grid.`])
  const [outcome, setOutcome] = useState(null)
  const [lastRoll, setLastRoll] = useState(null)
  const [busy, setBusy] = useState(false)

  const appendLog = (line) => setLog((prev) => [...prev.slice(-5), line])

  const rollRound = () => {
    if (busy || outcome) return
    setBusy(true)

    const playerRoll = rollD6() + rollD6()
    const opponentRoll = rollD6() + rollD6() + opponentPowerBonus
    setLastRoll({ playerRoll, opponentRoll })

    let nextPlayerHp = playerHp
    let nextOpponentHp = opponentHp

    if (playerRoll > opponentRoll) {
      const dmg = (playerRoll - opponentRoll) * 8
      nextOpponentHp = Math.max(0, opponentHp - dmg)
      setOpponentProgress((p) => Math.min(PATH_CELLS, p + 1))
      appendLog(`You roll ${playerRoll} vs ${opponentRoll}. Your crest advances! (${dmg} dmg)`)
    } else if (opponentRoll > playerRoll) {
      const dmg = (opponentRoll - playerRoll) * 8
      nextPlayerHp = Math.max(0, playerHp - dmg)
      setPlayerProgress((p) => Math.min(PATH_CELLS, p + 1))
      appendLog(`You roll ${playerRoll} vs ${opponentRoll}. ${opponentName}'s crest advances! (${dmg} dmg)`)
    } else {
      appendLog(`Tie roll (${playerRoll} vs ${opponentRoll}). Crests hold their ground.`)
    }

    setPlayerHp(nextPlayerHp)
    setOpponentHp(nextOpponentHp)

    setTimeout(() => {
      if (nextOpponentHp <= 0) setOutcome('victory')
      else if (nextPlayerHp <= 0) setOutcome('defeat')
      setBusy(false)
    }, 350)
  }

  const handleContinue = () => {
    // Deliberately does NOT call onClose() itself: callers that chain into
    // more UI after a match (e.g. Cynn's reaction -> Tah intervention) need
    // this modal to stay mounted. Callers that want to end here call
    // onClose() from inside their own onVictory/onDefeat.
    if (outcome === 'victory' && onVictory) onVictory()
    if (outcome === 'defeat' && onDefeat) onDefeat()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="w-[460px] border-4 border-teal-400 bg-[#1c1d3a] p-6 font-mono text-white">
        <h2 className="mb-1 text-xl font-bold text-teal-300">Dungeon Dice Monsters</h2>
        <p className="mb-3 text-xs text-gray-400">vs. {opponentName} ({deckFlavorName}){wagerLabel ? ` — Bet: ${wagerLabel}` : ''}</p>

        <div className="mb-3 flex justify-between text-sm">
          <span>You: <span className="text-green-400">{playerHp} HP</span></span>
          <span>{opponentName}: <span className="text-red-400">{opponentHp} HP</span></span>
        </div>

        <div className="mb-3 flex items-center justify-between border-2 border-gray-700 bg-black p-2">
          {Array.from({ length: PATH_CELLS }).map((_, i) => (
            <div key={i} className="relative h-6 w-6 border border-gray-600">
              {playerProgress === i + 1 && <div className="absolute inset-0.5 rounded-full bg-green-400" />}
              {opponentProgress === PATH_CELLS - i && <div className="absolute inset-0.5 rounded-full bg-red-400" />}
            </div>
          ))}
        </div>

        {lastRoll && (
          <p className="mb-2 text-center text-xs text-yellow-300">
            Last roll: You {lastRoll.playerRoll} — {opponentName} {lastRoll.opponentRoll}
          </p>
        )}

        <div className="mb-3 h-20 overflow-y-auto border-2 border-gray-700 bg-black p-2 text-xs text-gray-300">
          {log.map((line, i) => (
            <div key={i}>{line}</div>
          ))}
        </div>

        {!outcome && (
          <button
            onClick={rollRound}
            disabled={busy}
            className="mb-3 w-full border-4 border-teal-400 bg-teal-500 py-2 font-bold text-black hover:bg-teal-400 disabled:opacity-50"
          >
            Roll Dice
          </button>
        )}

        {outcome === 'victory' && (
          <div className="mb-3 text-center">
            <p className="mb-2 font-bold text-green-400">You win the match!</p>
            <button
              onClick={handleContinue}
              className="border-4 border-green-400 bg-green-500 px-6 py-2 font-bold text-black hover:bg-green-400"
            >
              Continue
            </button>
          </div>
        )}

        {outcome === 'defeat' && (
          <div className="mb-3 text-center">
            <p className="mb-2 font-bold text-red-500">You lose the match.</p>
            <button
              onClick={handleContinue}
              className="border-4 border-gray-500 px-6 py-2 font-bold hover:bg-gray-500"
            >
              Continue
            </button>
          </div>
        )}

        {!outcome && (
          <button
            onClick={onClose}
            className="w-full border-2 border-gray-600 py-1 text-xs text-gray-400 hover:bg-gray-700"
          >
            Forfeit Match
          </button>
        )}
      </div>
    </div>
  )
}
