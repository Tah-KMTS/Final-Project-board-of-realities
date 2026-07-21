import { useEffect, useState } from 'react'
import { useGameStore } from '../../store/useGameStore'
import { REAL_ESTATE_LISTINGS, JOB_WAGE, JOB_COOLDOWN_MS } from './marketData'

export default function BankModal({ onClose }) {
  const cash = useGameStore((s) => s.cash)
  const world2 = useGameStore((s) => s.world2)
  const buyRealEstate = useGameStore((s) => s.buyRealEstate)
  const workShift = useGameStore((s) => s.workShift)
  const [now, setNow] = useState(Date.now())

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 500)
    return () => clearInterval(id)
  }, [])

  const cooldownRemaining = Math.max(0, world2.jobCooldownUntil - now)
  const canWork = cooldownRemaining <= 0

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="w-[480px] border-4 border-blue-400 bg-[#1c1d3a] p-6 font-mono text-white">
        <h2 className="mb-2 text-xl font-bold text-blue-300">Bank & Realty Office</h2>

        <div className="mb-4 border-2 border-gray-600 bg-[#0f1020] p-3">
          <p className="mb-2 text-sm font-bold">9-to-5 Job</p>
          <p className="mb-2 text-xs text-gray-400">Work a shift for ${JOB_WAGE}.</p>
          <button
            onClick={workShift}
            disabled={!canWork}
            className="w-full border-2 border-green-400 bg-green-500 py-1 text-sm font-bold text-black hover:bg-green-400 disabled:opacity-40"
          >
            {canWork ? `Work Shift (+$${JOB_WAGE})` : `On cooldown (${Math.ceil(cooldownRemaining / 1000)}s)`}
          </button>
        </div>

        <div className="mb-4 border-2 border-gray-600 bg-[#0f1020] p-3">
          <p className="mb-2 text-sm font-bold">Real Estate</p>
          {REAL_ESTATE_LISTINGS.map((listing) => {
            const owned = world2.realEstate.includes(listing.id)
            return (
              <div key={listing.id} className="mb-2 flex items-center justify-between border-b border-gray-700 pb-2 text-xs">
                <div>
                  <p className="font-bold">{listing.name}</p>
                  <p className="text-gray-400">${listing.price.toLocaleString()} • rent ${listing.rentPerTick}/tick</p>
                </div>
                {owned ? (
                  <span className="text-green-400">Owned</span>
                ) : (
                  <button
                    onClick={() => buyRealEstate(listing)}
                    disabled={cash < listing.price}
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
