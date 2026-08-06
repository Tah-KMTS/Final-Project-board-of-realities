import { useGameStore } from '../../store/useGameStore'
import { REAL_ESTATE_LISTINGS } from './marketData'

// Split out of BankModal.jsx, which used to render this exact same listings
// block behind BOTH the Bank building AND the Real Estate Agency building
// (WorldScreen.jsx special-cased realEstateAgency to just open BankModal) -
// two buildings on the map, one identical mega-modal (banking/work
// shift/rob vault/real estate/corporate holdings all bundled together)
// behind either front door. Real Estate Agency now shows only its own
// listing, and Bank & Realty no longer carries a Real Estate section at
// all - see WorldScreen.jsx's realEstateAgency case and BankModal.jsx's own
// header comment for the other half of this split.
export default function RealEstateModal({ onClose }) {
  const cash = useGameStore((s) => s.cash)
  const world2 = useGameStore((s) => s.world2)
  const buyRealEstate = useGameStore((s) => s.buyRealEstate)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="w-[420px] max-h-[85vh] overflow-y-auto border-4 border-blue-400 bg-[#1c1d3a] p-6 font-mono text-white">
        <p className="mb-3 text-lg font-bold">Real Estate</p>
        <div className="mb-4 border-2 border-gray-600 bg-[#0f1020] p-3">
          {REAL_ESTATE_LISTINGS.map((listing) => {
            const owned = world2.realEstate.includes(listing.id)
            const milestoneLocked = listing.requiresMilestone && !(world2.netWorthMilestones || []).includes(listing.requiresMilestone)
            return (
              <div key={listing.id} className="mb-2 flex items-center justify-between border-b border-gray-700 pb-2 text-xs">
                <div>
                  <p className="font-bold">{listing.name}</p>
                  <p className="text-gray-400">${listing.price.toLocaleString()} • rent ${listing.rentPerTick}/tick</p>
                  {milestoneLocked && (
                    <p className="text-purple-400">Requires Conglomerate Threshold milestone ($1,000,000 net worth)</p>
                  )}
                </div>
                {owned ? (
                  <span className="text-green-400">Owned</span>
                ) : (
                  <button
                    onClick={() => buyRealEstate(listing)}
                    disabled={cash < listing.price || milestoneLocked}
                    className="border border-green-400 px-2 py-1 text-green-400 hover:bg-green-400 hover:text-black disabled:opacity-30"
                  >
                    Buy
                  </button>
                )}
              </div>
            )
          })}
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
