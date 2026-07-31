import { useGameStore } from '../../store/useGameStore'
import { COMPANY_LISTINGS } from './marketData'

// `embedded` (default false): this modal was orphaned (no entry point
// anywhere in the game) until the Phone's Startups & M&A app wired it in
// (see src/features/phone/StartupsApp.jsx) - embedded skips the outer
// fixed-overlay wrapper and the bottom "Leave" button, same convention as
// every other hub-tab modal in this codebase (CryptoModal.jsx etc).
export default function CorporateModal({ onClose, embedded = false }) {
  const cash = useGameStore((s) => s.cash)
  const world2 = useGameStore((s) => s.world2)
  const buyCompany = useGameStore((s) => s.buyCompany)

  const body = (
    <>
        <h2 className="mb-2 text-xl font-bold text-purple-300">Corporate Holdings</h2>
        <p className="mb-3 text-xs text-gray-400">Mergers & acquisitions. Own a company, collect passive income.</p>

        {COMPANY_LISTINGS.map((listing) => {
          const owned = world2.companies.includes(listing.id)
          const milestoneLocked = listing.requiresMilestone && !(world2.netWorthMilestones || []).includes(listing.requiresMilestone)
          return (
            <div key={listing.id} className="mb-2 flex items-center justify-between border-b border-gray-700 pb-2 text-xs">
              <div>
                <p className="font-bold">{listing.name}</p>
                <p className="text-gray-400">${listing.price.toLocaleString()} • income ${listing.incomePerTick}/tick</p>
                {milestoneLocked && (
                  <p className="text-purple-400">Requires Conglomerate Threshold milestone ($1,000,000 net worth)</p>
                )}
              </div>
              {owned ? (
                <span className="text-green-400">Owned</span>
              ) : (
                <button
                  onClick={() => buyCompany(listing)}
                  disabled={cash < listing.price || milestoneLocked}
                  className="border border-green-400 px-2 py-1 text-green-400 hover:bg-green-400 hover:text-black disabled:opacity-30"
                >
                  Acquire
                </button>
              )}
            </div>
          )
        })}

        {!embedded && (
          <button
            onClick={onClose}
            className="mt-3 w-full border-4 border-gray-500 py-2 font-bold hover:bg-gray-500"
          >
            Leave
          </button>
        )}
    </>
  )

  if (embedded) return <div className="text-white">{body}</div>

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="w-[480px] border-4 border-purple-400 bg-[#1c1d3a] p-6 font-mono text-white">
        {body}
      </div>
    </div>
  )
}
