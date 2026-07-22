import { useState } from 'react'
import { useGameStore } from '../../store/useGameStore'
import { buildNpcDeck } from './cardDatabase'
import DominoDuelModal from './DominoDuelModal'

export default function DominoNpcModal({ npc, onClose }) {
  const deck = useGameStore((s) => s.world4.deck)
  const recordDominoDuelResult = useGameStore((s) => s.recordDominoDuelResult)
  const recordTier4Defeat = useGameStore((s) => s.recordTier4Defeat)
  const [dueling, setDueling] = useState(false)
  const [opponentDeck] = useState(() => buildNpcDeck(npc.Tier))
  const [resultDp, setResultDp] = useState(null)

  const handleVictory = () => {
    const dp = recordDominoDuelResult({ won: true, tier: npc.Tier })
    if (npc.Tier === 4) recordTier4Defeat(npc.NPC_ID)
    setResultDp(dp)
  }

  const handleDefeat = () => {
    const dp = recordDominoDuelResult({ won: false, tier: npc.Tier })
    setResultDp(dp)
  }

  if (dueling) {
    return (
      <DominoDuelModal
        opponentNpc={npc}
        playerDeckIds={deck}
        opponentDeckIds={opponentDeck}
        onClose={onClose}
        onVictory={handleVictory}
        onDefeat={handleDefeat}
      />
    )
  }

  if (resultDp !== null) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
        <div className="w-[380px] border-4 border-purple-400 bg-[#1c1d3a] p-6 text-center font-mono text-white">
          <p className="mb-2 text-lg font-bold text-yellow-300">+{resultDp} DP</p>
          <button onClick={onClose} className="w-full border-4 border-green-400 bg-green-500 py-2 font-bold text-black hover:bg-green-400">
            Continue
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="w-[420px] border-4 border-purple-400 bg-[#1c1d3a] p-6 font-mono text-white">
        <h2 className="mb-2 text-xl font-bold text-purple-300">{npc.Name}</h2>
        <p className="mb-1 text-xs text-gray-500">Tier {npc.Tier} • {npc.Deck_Archetype}</p>
        <p className="mb-4 text-sm text-gray-300">"{npc.Dialog_PreDuel}"</p>
        <div className="flex gap-3">
          <button
            onClick={() => setDueling(true)}
            disabled={deck.length < 40}
            className="flex-1 border-4 border-red-400 bg-red-500 py-2 font-bold text-black hover:bg-red-400 disabled:opacity-40"
          >
            Duel
          </button>
          <button onClick={onClose} className="border-4 border-gray-500 px-4 py-2 font-bold hover:bg-gray-500">
            Walk Away
          </button>
        </div>
        {deck.length < 40 && <p className="mt-2 text-xs text-red-400">Your deck needs at least 40 cards - build one at the PC.</p>}
      </div>
    </div>
  )
}
