import { useGameStore } from '../../store/useGameStore'
import { COMPANY_LISTINGS } from './marketData'

export default function CorporateModal({ onClose }) {
  const cash = useGameStore((s) => s.cash)
  const world2 = useGameStore((s) => s.world2)
  const buyCompany = useGameStore((s) => s.buyCompany)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="w-[480px] border-4 border-purple-400 bg-[#1c1d3a] p-6 font-mono text-white">
        <h2 className="mb-2 text-xl font-bold text-purple-300">Corporate Holdings</h2>
        <p className="mb-3 text-xs text-gray-400">Mergers & acquisitions. Own a company, collect passive income.</p>

        {COMPANY_LISTINGS.map((listing) => {
          const owned = world2.companies.includes(listing.id)
          return (
            <div key={listing.id} className="mb-2 flex items-center justify-between border-b border-gray-700 pb-2 text-xs">
              <div>
                <p className="font-bold">{listing.name}</p>
                <p className="text-gray-400">${listing.price.toLocaleString()} • income ${listing.incomePerTick}/tick</p>
              </div>
              {owned ? (
                <span className="text-green-400">Owned</span>
              ) : (
                <button
                  onClick={() => buyCompany(listing)}
                  disabled={cash < listing.price}
                  className="border border-green-400 px-2 py-1 text-green-400 hover:bg-green-400 hover:text-black disabled:opacity-30"
                >
                  Acquire
                </button>
              )}
            </div>
          )
        })}

        <button
          onClick={onClose}
          className="mt-3 w-full border-4 border-gray-500 py-2 font-bold hover:bg-gray-500"
        >
          Leave
        </button>
      </div>
    </div>
  )
}
