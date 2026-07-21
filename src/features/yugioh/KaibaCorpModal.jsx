import { useGameStore } from '../../store/useGameStore'

const KAIBACORP_PRICE = 3000000

export default function KaibaCorpModal({ onClose }) {
  const cash = useGameStore((s) => s.cash)
  const ownsKaibaCorp = useGameStore((s) => s.world3.ownsKaibaCorp)
  const buyKaibaCorp = useGameStore((s) => s.buyKaibaCorp)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="w-[440px] border-4 border-blue-500 bg-[#1c1d3a] p-6 font-mono text-white">
        <h2 className="mb-2 text-xl font-bold text-blue-300">KaibaCorp Tower</h2>
        <p className="mb-4 text-sm text-gray-300">
          "You want to buy my company? ...Fine. Everyone has a price, apparently. Even me." — Seto Kaiba
        </p>

        {ownsKaibaCorp ? (
          <p className="mb-4 text-green-400">You already own KaibaCorp. Holographic tech and satellite deck-builders are at your disposal.</p>
        ) : (
          <button
            onClick={() => buyKaibaCorp(KAIBACORP_PRICE)}
            disabled={cash < KAIBACORP_PRICE}
            className="mb-4 w-full border-4 border-blue-400 bg-blue-500 py-2 font-bold text-black hover:bg-blue-400 disabled:opacity-40"
          >
            Buy KaibaCorp (${KAIBACORP_PRICE.toLocaleString()})
          </button>
        )}

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
