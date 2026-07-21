import { useState } from 'react'
import { useGameStore } from '../../store/useGameStore'

const GAMES = [
  { id: 'coin', label: 'Coin Toss', odds: 0.5 },
  { id: 'dice', label: 'Dice Roll (high roll wins)', odds: 0.5 },
  { id: 'sprint', label: '100m Sprint', odds: 0.45 },
]

export default function ChallengeModal({ opponentName, isYugi = false, onClose, onWin }) {
  const cash = useGameStore((s) => s.cash)
  const addCash = useGameStore((s) => s.addCash)
  const [game, setGame] = useState(GAMES[0])
  const [bet, setBet] = useState(100)
  const [result, setResult] = useState(null)

  const handlePlay = () => {
    const won = Math.random() < game.odds
    setResult(won ? 'win' : 'lose')
    if (!isYugi) {
      addCash(won ? bet : -bet)
    }
  }

  const handleContinue = () => {
    if (result === 'win' && isYugi && onWin) onWin()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="w-[420px] border-4 border-cyan-400 bg-[#1c1d3a] p-6 font-mono text-white">
        <h2 className="mb-2 text-xl font-bold text-cyan-300">Challenge {opponentName}</h2>

        {!result && (
          <>
            <p className="mb-2 text-xs text-gray-400">Pick a game:</p>
            <div className="mb-3 flex flex-col gap-2">
              {GAMES.map((g) => (
                <button
                  key={g.id}
                  onClick={() => setGame(g)}
                  className={`border-2 py-1 text-sm ${game.id === g.id ? 'border-cyan-400 bg-cyan-400 text-black' : 'border-gray-600'}`}
                >
                  {g.label}
                </button>
              ))}
            </div>

            {!isYugi && (
              <div className="mb-3 flex items-center gap-2 text-sm">
                <span>Bet: $</span>
                <input
                  type="number"
                  min="1"
                  max={cash}
                  value={bet}
                  onChange={(e) => setBet(Math.max(1, Math.min(cash, Number(e.target.value) || 1)))}
                  className="w-24 border border-gray-600 bg-black px-2 py-1 text-white"
                />
              </div>
            )}
            {isYugi && (
              <p className="mb-3 text-xs text-yellow-300">If you beat Yugi, he forfeits and you clear this world.</p>
            )}

            <button
              onClick={handlePlay}
              className="mb-3 w-full border-4 border-cyan-400 bg-cyan-500 py-2 font-bold text-black hover:bg-cyan-400"
            >
              Play
            </button>
          </>
        )}

        {result && (
          <div className="mb-3 text-center">
            <p className={`mb-2 font-bold ${result === 'win' ? 'text-green-400' : 'text-red-500'}`}>
              {result === 'win' ? 'You won!' : 'You lost.'}
              {!isYugi && (result === 'win' ? ` +$${bet}` : ` -$${bet}`)}
            </p>
            <button
              onClick={handleContinue}
              className="border-4 border-green-400 bg-green-500 px-6 py-2 font-bold text-black hover:bg-green-400"
            >
              Continue
            </button>
          </div>
        )}

        {!result && (
          <button
            onClick={onClose}
            className="w-full border-2 border-gray-600 py-1 text-xs text-gray-400 hover:bg-gray-700"
          >
            Back Out
          </button>
        )}
      </div>
    </div>
  )
}
