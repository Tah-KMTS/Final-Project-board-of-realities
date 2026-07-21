import { useGameStore } from '../../store/useGameStore'

export default function SupermarketModal({ onClose }) {
  const cash = useGameStore((s) => s.cash)
  const world1 = useGameStore((s) => s.world1)
  const buySpringOfNazarick = useGameStore((s) => s.buySpringOfNazarick)

  const springAvailable = world1.hunterRank !== 'S' && !world1.hasSpringOfNazarick

  const handleBuy = () => {
    buySpringOfNazarick()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="w-[420px] border-4 border-yellow-300 bg-[#1c1d3a] p-6 font-mono text-white">
        <h2 className="mb-3 text-xl font-bold text-yellow-300">Supermarket</h2>
        <div className="mb-4 flex items-center justify-between border-2 border-gray-600 bg-[#0f1020] p-3">
          <div>
            <p className="font-bold">Spring of Nazarick</p>
            <p className="text-xs text-gray-400">A dusty bottle of water. Probably nothing.</p>
          </div>
          {world1.hasSpringOfNazarick ? (
            <span className="text-xs text-green-400">Owned</span>
          ) : springAvailable ? (
            <button
              onClick={handleBuy}
              disabled={cash < 1}
              className="border-2 border-green-400 bg-green-500 px-3 py-1 text-xs font-bold text-black hover:bg-green-400 disabled:opacity-40"
            >
              Buy $1
            </button>
          ) : (
            <span className="text-xs text-red-400">Out of stock</span>
          )}
        </div>
        {!springAvailable && !world1.hasSpringOfNazarick && (
          <p className="mb-4 text-xs text-gray-500">
            Now that you're S-Rank, stores stopped carrying this. Word is a guy named Tan might still have one.
          </p>
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
