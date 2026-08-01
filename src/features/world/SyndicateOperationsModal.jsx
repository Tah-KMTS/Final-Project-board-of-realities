import { useState } from 'react'
import { useGameStore } from '../../store/useGameStore'
import { SYNDICATE_OPERATIONS_CATALOG, hireMurderIncHitman } from './syndicateActivitiesEngine'
import MoneyLaunderingModal from './MoneyLaunderingModal'
import { getCharacterPortrait } from '../../data/characterPortraits'

const LAUNDERING_MIN_DECLARE = 5000
const LAUNDERING_ENERGY_COST = 20

export default function SyndicateOperationsModal({ onClose }) {
  const [activeTab, setActiveTab] = useState('rackets') // 'rackets' | 'laundering' | 'hitmen'
  const [selectedSyndicate, setSelectedSyndicate] = useState(SYNDICATE_OPERATIONS_CATALOG[0])
  const [targetNameInput, setTargetNameInput] = useState('Rival Executive')
  const [feedbackMsg, setFeedbackMsg] = useState(null)
  const [showMoneyLaundering, setShowMoneyLaundering] = useState(false)

  const cash = useGameStore((s) => s.cash)
  const addCash = useGameStore((s) => s.addCash)
  const player = useGameStore((s) => s.player)

  const handleContractHitman = () => {
    const res = hireMurderIncHitman(targetNameInput, cash)
    if (res.success) {
      addCash(-res.cost)
      setFeedbackMsg(res.log)
    } else {
      setFeedbackMsg(res.reason)
    }
  }

  const handleCollectTolls = (syn) => {
    const toll = syn.dailyExtortionYield
    addCash(toll)
    setFeedbackMsg(`🩸 PROTECTION TOLL COLLECTED: Collected $${toll.toLocaleString()} extortion yield from ${syn.name} (${syn.territory})!`)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 font-mono text-white">
      <div className="w-full max-w-4xl border-4 border-red-600/80 bg-[#12080a] p-6 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-red-600/40 pb-3">
          <div>
            <span className="rounded bg-red-950 px-2 py-0.5 text-xs font-bold text-red-300 uppercase tracking-wider">CRIME SYNDICATE & CARTEL UNDERWORLD</span>
            <h2 className="text-2xl font-bold text-red-400 mt-1">🩸 CRIME SYNDICATE RACKETS & MONEY LAUNDERING</h2>
            <p className="text-xs text-gray-300">Medellin Cartel, Chicago Outfit, National Syndicate, Murder Inc., Five Families, Rothstein, Opium Cartel.</p>
          </div>
        </div>

        {/* Tab Selection */}
        <div className="flex border-b border-gray-800 bg-[#210c0e] text-xs font-bold my-3">
          <button
            onClick={() => setActiveTab('rackets')}
            className={`flex-1 py-2.5 ${activeTab === 'rackets' ? 'bg-red-600 text-white font-extrabold' : 'text-gray-400 hover:text-white'}`}
          >
            🩸 Cartel Rackets & Tolls
          </button>
          <button
            onClick={() => setActiveTab('laundering')}
            className={`flex-1 py-2.5 ${activeTab === 'laundering' ? 'bg-emerald-600 text-white font-extrabold' : 'text-gray-400 hover:text-white'}`}
          >
            💵 Money Laundering (Clean Dirty Cash)
          </button>
          <button
            onClick={() => setActiveTab('hitmen')}
            className={`flex-1 py-2.5 ${activeTab === 'hitmen' ? 'bg-purple-600 text-white font-extrabold' : 'text-gray-400 hover:text-white'}`}
          >
            💥 Murder, Inc. Hitman Contracts
          </button>
        </div>

        {/* Feedback Alert */}
        {feedbackMsg && (
          <div className="my-2 rounded border border-red-500 bg-red-950/90 p-2.5 text-center text-xs font-bold text-red-200">
            {feedbackMsg}
          </div>
        )}

        {/* Tab Content Body */}
        <div className="my-3 space-y-4 max-h-[50vh] overflow-y-auto pr-1">
          {/* TAB 1: RACKETS */}
          {activeTab === 'rackets' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {SYNDICATE_OPERATIONS_CATALOG.map((syn) => (
                <div key={syn.id} className="rounded border border-red-600/40 bg-[#1c0d10] p-4 text-xs shadow-md">
                  <div className="flex items-start justify-between border-b border-red-900/50 pb-2">
                    <div>
                      <h3 className="font-bold text-red-300 text-base">{syn.name}</h3>
                      <div className="text-yellow-300 text-xs">Boss: {syn.boss}</div>
                      <div className="text-gray-400 text-[11px]">Territory: {syn.territory}</div>
                    </div>
                  </div>
                  <div className="my-2 space-y-1 text-gray-300">
                    <div>• Rackets: <span className="text-gray-200">{syn.rackets.join(', ')}</span></div>
                    <div>• Primary Contraband: <span className="text-emerald-300">{syn.primaryNarcotic}</span></div>
                    <div className="text-yellow-300 italic">• Perk: {syn.specialPerk}</div>
                  </div>
                  <button
                    onClick={() => handleCollectTolls(syn)}
                    className="w-full mt-2 rounded border border-red-500 bg-red-950 py-1.5 text-xs font-bold text-red-300 hover:bg-red-600 hover:text-white transition-all"
                  >
                    🩸 Collect Protection Toll (${syn.dailyExtortionYield.toLocaleString()})
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* TAB 2: MONEY LAUNDERING */}
          {activeTab === 'laundering' && (
            <div className="space-y-4">
              <div className="rounded border border-emerald-500/40 bg-[#102117] p-4 text-xs">
                <h3 className="text-sm font-bold text-emerald-300 uppercase tracking-wider mb-1">💵 Money Laundering Operations</h3>
                <p className="text-gray-300">
                  Route dirty extortion and narcotics cash through up to 4 legitimate venues, hop by hop. Every hop's
                  audit-heat cost is shown in exact numbers before you confirm it - push your luck for a bigger clean
                  payout, or cash out early and keep what you've already banked.
                </p>
                <button
                  onClick={() => setShowMoneyLaundering(true)}
                  disabled={cash < LAUNDERING_MIN_DECLARE || player.energy < LAUNDERING_ENERGY_COST}
                  className="mt-4 w-full rounded border border-emerald-400 bg-emerald-950 py-2 text-xs font-bold text-emerald-300 hover:bg-emerald-500 hover:text-black transition-all disabled:opacity-30"
                >
                  Launder Cash
                </button>
              </div>
            </div>
          )}
          {showMoneyLaundering && <MoneyLaunderingModal onClose={() => setShowMoneyLaundering(false)} />}

          {/* TAB 3: HITMEN */}
          {activeTab === 'hitmen' && (
            <div className="space-y-4">
              <div className="rounded border border-purple-500/40 bg-[#191024] p-4 text-xs">
                <h3 className="text-sm font-bold text-purple-300 uppercase tracking-wider mb-1">💥 Murder, Inc. Contract Homicides</h3>
                <p className="text-gray-300">Retain Bugsy Siegel & Albert Anastasia's enforcement squad for a discreet contract homicide ($50,000).</p>
                <div className="mt-4 flex gap-3 items-center">
                  <input
                    type="text"
                    value={targetNameInput}
                    onChange={(e) => setTargetNameInput(e.target.value)}
                    className="w-64 rounded border border-purple-500 bg-black/60 px-3 py-1.5 text-xs text-white font-mono"
                    placeholder="Target Executive Name"
                  />
                  <button
                    onClick={handleContractHitman}
                    className="rounded border border-purple-400 bg-purple-950 px-5 py-1.5 text-xs font-bold text-purple-300 hover:bg-purple-500 hover:text-black transition-all"
                  >
                    💥 Issue Contract Hit ($50,000)
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-800 bg-[#0d0506] p-3 text-right">
          <button
            onClick={onClose}
            className="border border-gray-600 bg-gray-800 px-6 py-2 text-xs font-bold text-white hover:bg-gray-700 transition-colors"
          >
            Close Syndicate Modal
          </button>
        </div>
      </div>
    </div>
  )
}
