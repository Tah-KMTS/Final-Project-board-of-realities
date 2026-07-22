import { useState } from 'react'
import { useGameStore } from '../../store/useGameStore'
import { getCard, validateDeck } from './cardDatabase'

// Groups a flat Card_ID list into {cardId, count} for a compact UI, per
// the GDD's max-3-copies rule.
function groupCounts(cardIds) {
  const counts = {}
  for (const id of cardIds) counts[id] = (counts[id] || 0) + 1
  return Object.entries(counts).map(([cardId, count]) => ({ cardId, count }))
}

export default function DeckBuilderModal({ onClose }) {
  const deck = useGameStore((s) => s.world4.deck)
  const trunk = useGameStore((s) => s.world4.trunk)
  const setDominoDeck = useGameStore((s) => s.setDominoDeck)

  const [workingDeck, setWorkingDeck] = useState(deck)

  const trunkCounts = groupCounts(trunk)
  const deckCounts = groupCounts(workingDeck)
  const validation = validateDeck(workingDeck)

  const addToDeck = (cardId) => {
    const inDeck = workingDeck.filter((id) => id === cardId).length
    const owned = trunk.filter((id) => id === cardId).length
    if (inDeck >= 3 || inDeck >= owned) return
    if (workingDeck.length >= 60) return
    setWorkingDeck((d) => [...d, cardId])
  }

  const removeFromDeck = (cardId) => {
    const idx = workingDeck.indexOf(cardId)
    if (idx === -1) return
    setWorkingDeck((d) => d.filter((_, i) => i !== idx))
  }

  const handleSave = () => {
    if (!validation.valid) return
    setDominoDeck(workingDeck)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="flex max-h-[90vh] w-[560px] flex-col overflow-y-auto border-4 border-cyan-400 bg-[#1c1d3a] p-6 font-mono text-white">
        <h2 className="mb-1 text-xl font-bold text-cyan-300">Deck Builder</h2>
        <p className="mb-3 text-xs text-gray-400">Deck: {workingDeck.length}/60 cards (min 40, max 3 copies per card).</p>

        {!validation.valid && (
          <div className="mb-3 border-2 border-red-500 bg-red-950/40 p-2 text-xs text-red-300">
            {validation.errors.map((e, i) => <div key={i}>{e}</div>)}
          </div>
        )}

        <div className="mb-3">
          <p className="mb-1 text-sm font-bold text-gray-300">Your Deck</p>
          <div className="max-h-40 overflow-y-auto border-2 border-gray-600 bg-[#0f1020] p-2 text-xs">
            {deckCounts.length === 0 && <p className="text-gray-600">Empty.</p>}
            {deckCounts.map(({ cardId, count }) => {
              const card = getCard(cardId)
              return (
                <div key={cardId} className="mb-1 flex items-center justify-between">
                  <span>{card?.Name} x{count} ({card?.Primary_Type}{card?.Base_ATK != null ? `, ATK ${card.Base_ATK}` : ''})</span>
                  <button onClick={() => removeFromDeck(cardId)} className="border border-red-400 px-1 text-red-300 hover:bg-red-400 hover:text-black">
                    Remove
                  </button>
                </div>
              )
            })}
          </div>
        </div>

        <div className="mb-4">
          <p className="mb-1 text-sm font-bold text-gray-300">Your Trunk ({trunk.length} cards owned)</p>
          <div className="max-h-40 overflow-y-auto border-2 border-gray-600 bg-[#0f1020] p-2 text-xs">
            {trunkCounts.length === 0 && <p className="text-gray-600">No cards yet — buy packs at the shop.</p>}
            {trunkCounts.map(({ cardId, count }) => {
              const card = getCard(cardId)
              const inDeck = workingDeck.filter((id) => id === cardId).length
              return (
                <div key={cardId} className="mb-1 flex items-center justify-between">
                  <span>{card?.Name} (owned {count}, in deck {inDeck})</span>
                  <button
                    onClick={() => addToDeck(cardId)}
                    disabled={inDeck >= Math.min(3, count)}
                    className="border border-cyan-400 px-1 text-cyan-300 hover:bg-cyan-400 hover:text-black disabled:opacity-30"
                  >
                    Add
                  </button>
                </div>
              )
            })}
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleSave}
            disabled={!validation.valid}
            className="flex-1 border-4 border-green-400 bg-green-500 py-2 font-bold text-black hover:bg-green-400 disabled:opacity-40"
          >
            Save Deck
          </button>
          <button onClick={onClose} className="border-4 border-gray-500 px-4 py-2 font-bold hover:bg-gray-500">
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
