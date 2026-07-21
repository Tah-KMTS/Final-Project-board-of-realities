import { useState } from 'react'
import { useGameStore } from '../../store/useGameStore'
import { STARTER_DECK } from './cardGenerator'
import { playHitSound, playTakeDamageSound, playVictorySound, playDefeatSound } from '../../audio/sfx'

const START_LP = 8000

function bestCard(deck) {
  return deck.reduce((best, c) => (c.atk > best.atk ? c : best), deck[0])
}

let floatingTextSeq = 0

export default function DuelModal({
  opponentName,
  opponentDeck,
  opponentAtkModifier = 1,
  allowHolographicCheat = false,
  onClose,
  onVictory,
  onDefeat,
}) {
  const storeDeck = useGameStore((s) => s.world3.deck)
  const playerDeck = storeDeck.length > 0 ? storeDeck : STARTER_DECK

  const [playerLP, setPlayerLP] = useState(START_LP)
  const [opponentLP, setOpponentLP] = useState(START_LP)
  const [log, setLog] = useState([`A Shadow Game begins against ${opponentName}!`])
  const [outcome, setOutcome] = useState(null)
  const [busy, setBusy] = useState(false)
  const [playerFloats, setPlayerFloats] = useState([])
  const [opponentFloats, setOpponentFloats] = useState([])
  const [playerHitPulse, setPlayerHitPulse] = useState(0)
  const [opponentHitPulse, setOpponentHitPulse] = useState(0)

  const appendLog = (line) => setLog((prev) => [...prev.slice(-5), line])

  const spawnFloat = (setFloats, text) => {
    const id = ++floatingTextSeq
    setFloats((prev) => [...prev, { id, text }])
    setTimeout(() => setFloats((prev) => prev.filter((f) => f.id !== id)), 700)
  }

  const resolveTurn = (playerCard) => {
    if (busy || outcome) return
    setBusy(true)

    const opponentCard = bestCard(opponentDeck)
    const effectiveOpponentAtk = Math.round(opponentCard.atk * opponentAtkModifier)
    appendLog(`You summon ${playerCard.name} (ATK ${playerCard.atk}). ${opponentName} summons ${opponentCard.name} (ATK ${effectiveOpponentAtk}).`)

    let nextPlayerLP = playerLP
    let nextOpponentLP = opponentLP

    if (playerCard.atk > effectiveOpponentAtk) {
      const dmg = playerCard.atk - effectiveOpponentAtk
      nextOpponentLP = Math.max(0, opponentLP - dmg)
      appendLog(`${opponentCard.name} is destroyed! ${opponentName} takes ${dmg} damage.`)
      spawnFloat(setOpponentFloats, `-${dmg}`)
      setOpponentHitPulse((p) => p + 1)
      playHitSound()
    } else if (effectiveOpponentAtk > playerCard.atk) {
      const dmg = effectiveOpponentAtk - playerCard.atk
      nextPlayerLP = Math.max(0, playerLP - dmg)
      appendLog(`${playerCard.name} is destroyed! You take ${dmg} damage.`)
      spawnFloat(setPlayerFloats, `-${dmg}`)
      setPlayerHitPulse((p) => p + 1)
      playTakeDamageSound()
    } else {
      appendLog('Both monsters are destroyed in the clash. No damage.')
    }

    setPlayerLP(nextPlayerLP)
    setOpponentLP(nextOpponentLP)

    setTimeout(() => {
      if (nextOpponentLP <= 0) { setOutcome('victory'); playVictorySound() }
      else if (nextPlayerLP <= 0) { setOutcome('defeat'); playDefeatSound() }
      setBusy(false)
    }, 400)
  }

  const handleHolographicCheat = () => {
    appendLog('You quietly activate illegal holographic tech. The duel is over before it started.')
    setOutcome('victory')
    playVictorySound()
  }

  const handleContinue = () => {
    // Does not auto-close; caller's onVictory/onDefeat decides what happens
    // next, since some callers chain into more UI after a match resolves.
    if (outcome === 'victory' && onVictory) onVictory()
    if (outcome === 'defeat' && onDefeat) onDefeat()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="w-[520px] border-4 border-purple-500 bg-[#1c1d3a] p-6 font-mono text-white">
        <h2 className="mb-2 text-xl font-bold text-purple-300">Shadow Game vs. {opponentName}</h2>

        <div key={`opp-lp-${opponentHitPulse}`} className="relative mb-2 animate-shake">
          <div className="flex justify-between text-sm">
            <span>{opponentName}</span>
            <span className="text-red-400">{opponentLP} LP</span>
          </div>
          <div className="mt-1 h-3 w-full bg-gray-800">
            <div
              className="h-3 bg-red-500 transition-all"
              style={{ width: `${Math.max(0, (opponentLP / START_LP) * 100)}%` }}
            />
          </div>
          {opponentFloats.map((f) => (
            <span key={f.id} className="animate-float-up-fade pointer-events-none absolute right-0 top-0 font-bold text-red-400">
              {f.text}
            </span>
          ))}
        </div>

        <div key={`player-lp-${playerHitPulse}`} className="relative mb-3 animate-shake">
          <div className="flex justify-between text-sm">
            <span>You</span>
            <span className="text-green-400">{playerLP} LP</span>
          </div>
          <div className="mt-1 h-3 w-full bg-gray-800">
            <div
              className="h-3 bg-green-500 transition-all"
              style={{ width: `${Math.max(0, (playerLP / START_LP) * 100)}%` }}
            />
          </div>
          {playerFloats.map((f) => (
            <span key={f.id} className="animate-float-up-fade pointer-events-none absolute right-0 top-0 font-bold text-red-400">
              {f.text}
            </span>
          ))}
        </div>

        <div className="mb-3 h-28 overflow-y-auto border-2 border-gray-700 bg-black p-2 text-xs text-gray-300">
          {log.map((line, i) => (
            <div key={i}>{line}</div>
          ))}
        </div>

        {!outcome && (
          <>
            <p className="mb-1 text-xs text-gray-400">Choose a monster to summon and attack with:</p>
            <div className="mb-3 flex flex-wrap gap-2">
              {playerDeck.map((card) => (
                <button
                  key={card.id}
                  onClick={() => resolveTurn(card)}
                  disabled={busy}
                  className="border-2 border-purple-400 px-2 py-1 text-xs hover:bg-purple-400 hover:text-black disabled:opacity-40"
                  title={card.lore}
                >
                  {card.name} ({card.atk}/{card.def})
                </button>
              ))}
            </div>
            {allowHolographicCheat && (
              <button
                onClick={handleHolographicCheat}
                className="mb-3 w-full border-2 border-yellow-400 py-1 text-xs text-yellow-300 hover:bg-yellow-400 hover:text-black"
              >
                Activate KaibaCorp Holographic Cheat (instant win)
              </button>
            )}
          </>
        )}

        {outcome === 'victory' && (
          <div className="mb-3 text-center">
            <p className="mb-2 font-bold text-green-400">Victory!</p>
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
            <p className="mb-2 font-bold text-red-500">You lost the duel.</p>
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
            Forfeit Duel
          </button>
        )}
      </div>
    </div>
  )
}
