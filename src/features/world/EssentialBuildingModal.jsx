import { useState } from 'react'
import { useGameStore } from '../../store/useGameStore'
import { ESSENTIAL_BUILDINGS_CATALOG } from './essentialBuildingsCatalog'

export default function EssentialBuildingModal({ buildingId = 'general_hospital', onClose }) {
  const building = ESSENTIAL_BUILDINGS_CATALOG.find((b) => b.id === buildingId) || ESSENTIAL_BUILDINGS_CATALOG[0]
  const cash = useGameStore((s) => s.cash)
  const addCash = useGameStore((s) => s.addCash)
  const addWantedLevel = useGameStore((s) => s.addWantedLevel)
  const healPlayer = useGameStore((s) => s.healPlayer || (() => {}))

  const [feedbackMsg, setFeedbackMsg] = useState(null)

  const handleService = (service) => {
    if (service.cost > 0 && cash < service.cost) {
      setFeedbackMsg(`Insufficient funds for ${service.name}! Needed $${service.cost.toLocaleString()}.`)
      return
    }

    if (service.cost > 0) {
      addCash(-service.cost)
    } else if (service.cost < 0) {
      addCash(Math.abs(service.cost)) // Loan payout!
    }

    if (service.id === 'full_heal') {
      healPlayer(100)
    } else if (service.id === 'warrant_payoff') {
      addWantedLevel(-2)
    }

    setFeedbackMsg(`✅ SERVICE AUTHORIZED: ${service.name}! (${service.effect})`)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 font-mono text-white">
      <div className="w-full max-w-2xl border-4 border-cyan-500/80 bg-[#0c1226] p-6 shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-cyan-500/40 pb-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded bg-cyan-950 px-2 py-0.5 text-xs font-bold text-cyan-300 uppercase tracking-wider">{building.city} • {building.district}</span>
              <span className="rounded bg-amber-950 border border-amber-500 px-2 py-0.5 text-xs font-bold text-amber-300">{building.height}</span>
            </div>
            <h2 className="text-2xl font-bold text-cyan-300 mt-1">{building.name}</h2>
            <p className="text-xs text-gray-300 mt-1">{building.description}</p>
          </div>
          <div className="text-right">
            <div className="text-xs text-gray-400">Presiding Official</div>
            <div className="text-sm font-bold text-yellow-300">{building.npc.name}</div>
            <div className="text-xs text-gray-400">{building.npc.title}</div>
          </div>
        </div>

        {/* Visual Architectural Facade Profile */}
        <div className="my-3 rounded border border-cyan-500/30 bg-[#121b38] p-3 text-xs">
          <div className="text-cyan-300 font-bold mb-1">Architectural Facade Specification:</div>
          <p className="text-gray-300 italic">{building.profile.facade}</p>
        </div>

        {/* Feedback Alert */}
        {feedbackMsg && (
          <div className="my-3 rounded border border-cyan-400 bg-cyan-950/80 p-3 text-center text-xs font-bold text-cyan-200">
            {feedbackMsg}
          </div>
        )}

        {/* Authorized Services */}
        <div className="my-4 space-y-3">
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Authorized Municipal Services:</h3>
          {building.services.map((srv) => (
            <div key={srv.id} className="flex items-center justify-between rounded border border-cyan-500/30 bg-[#162042] p-3 text-xs">
              <div>
                <div className="font-bold text-yellow-300 text-sm">{srv.name}</div>
                <div className="text-xs text-gray-300 mt-0.5">Effect: <span className="text-emerald-300">{srv.effect}</span></div>
              </div>
              <button
                onClick={() => handleService(srv)}
                className="rounded border border-cyan-400 bg-cyan-950 px-4 py-2 text-xs font-bold text-cyan-300 hover:bg-cyan-500 hover:text-black transition-all"
              >
                {srv.cost > 0 ? `Pay $${srv.cost.toLocaleString()}` : srv.cost < 0 ? `Borrow $${Math.abs(srv.cost).toLocaleString()}` : 'Authorize Free'}
              </button>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-800 bg-[#0d1226] p-3 text-right">
          <button
            onClick={onClose}
            className="border border-gray-600 bg-gray-800 px-6 py-2 text-xs font-bold text-white hover:bg-gray-700 transition-colors"
          >
            Leave Facility
          </button>
        </div>
      </div>
    </div>
  )
}
