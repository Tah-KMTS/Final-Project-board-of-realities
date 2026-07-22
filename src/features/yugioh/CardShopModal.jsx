import { useGameStore } from '../../store/useGameStore'
import { generateDeck } from './cardGenerator'

const PACK_COST = 500
const PACK_SIZE = 3

export default function CardShopModal({ onClose }) {
  const cash = useGameStore((s) => s.cash)
  const deck = useGameStore((s) => s.world3.deck)
  const buyBoosterPack = useGameStore((s) => s.buyBoosterPack)
  const shopTier = useGameStore((s) => s.getCardShopTier())

  const handleBuyPack = () => {
    const cards = generateDeck(PACK_SIZE, shopTier)
    buyBoosterPack(PACK_COST, cards)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="w-[480px] border-4 border-indigo-400 bg-[#1c1d3a] p-6 font-mono text-white">
        <h2 className="mb-2 text-xl font-bold text-indigo-300">Duke Devlin's Card Shop</h2>
        <p className="mb-3 text-xs text-gray-400">"Every pack is one-of-a-kind. Try your luck."</p>

        <button
          onClick={handleBuyPack}
          disabled={cash < PACK_COST}
          className="mb-4 w-full border-4 border-green-400 bg-green-500 py-2 font-bold text-black hover:bg-green-400 disabled:opacity-40"
        >
          Buy Booster Pack (${PACK_COST}, {PACK_SIZE} cards, Tier {shopTier})
        </button>

        <div className="mb-3 max-h-56 overflow-y-auto border-2 border-gray-600 bg-[#0f1020] p-3 text-xs">
          <p className="mb-2 font-bold">Your Deck ({deck.length} cards)</p>
          {deck.length === 0 && <p className="text-gray-500">No cards yet — you'll duel with a starter deck.</p>}
          {deck.map((card) => (
            <div key={card.id} className="mb-1 border-b border-gray-700 pb-1">
              <span className="font-bold">{card.name}</span> — ATK {card.atk} / DEF {card.def}
            </div>
          ))}
        </div>

        <button
          onClick={onClose}
          className="w-full border-4 border-gray-500 py-2 font-bold hover:bg-gray-500"
        >
          Leave
        </button>
      </div>
    </div>
  )
}
