import { useState } from 'react'
import { useGameStore } from '../../store/useGameStore'
import { FAMOUS_HITMEN_CATALOG } from './famousHitmenCatalog'
import { executeHitmanContract } from './hitmanAgentEngine'

export default function HitmanContractModal({ onClose }) {
  const [selectedHitman, setSelectedHitman] = useState(FAMOUS_HITMEN_CATALOG[0])
  const [targetNameInput, setTargetNameInput] = useState('Corrupt Rival Financier')
  const [framingOption, setFramingOption] = useState('innocent_citizen') // 'innocent_citizen' | 'rival_cartel' | 'none'
  const [feedbackMsg, setFeedbackMsg] = useState(null)

  const cash = useGameStore((s) => s.cash)
  const addCash = useGameStore((s) => s.addCash)

  const handleIssueContract = () => {
    if (cash < selectedHitman.price) {
      setFeedbackMsg(`Insufficient cash! Needed $${selectedHitman.price.toLocaleString()} for ${selectedHitman.name}.`)
      return
    }

    addCash(-selectedHitman.price)
    const result = executeHitmanContract(selectedHitman.id, targetNameInput, framingOption)
    setFeedbackMsg(`💥 CONTRACT EXECUTED: ${result.hitmanName} eliminated ${targetNameInput} using ${result.signatureWeapon}! ${result.framingLog}`)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 font-mono text-white">
      <div className="w-full max-w-4xl border-4 border-red-700/80 bg-[#160608] p-6 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-red-700/40 pb-3">
          <div>
            <span className="rounded bg-red-950 px-2 py-0.5 text-xs font-bold text-red-300 uppercase tracking-wider">HISTORICAL CONTRACT ASSASSINS</span>
            <h2 className="text-2xl font-bold text-red-400 mt-1">💥 FAMOUS HISTORICAL HITMEN AGENCIES</h2>
            <p className="text-xs text-gray-300">Richard Kuklinski, Charles Harrelson, Nicoletti, Bugsy Siegel, Abe Kid Twist Reles.</p>
          </div>
        </div>

        {/* Feedback Alert */}
        {feedbackMsg && (
          <div className="my-2 rounded border border-red-500 bg-red-950/90 p-3 text-center text-xs font-bold text-red-200">
            {feedbackMsg}
          </div>
        )}

        {/* Hitmen Selection Grid */}
        <div className="my-3 grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[42vh] overflow-y-auto pr-1">
          {FAMOUS_HITMEN_CATALOG.map((hitman) => (
            <div
              key={hitman.id}
              onClick={() => setSelectedHitman(hitman)}
              className={`cursor-pointer rounded border p-3 text-xs transition-all ${
                selectedHitman.id === hitman.id ? 'border-red-400 bg-red-950/70 shadow-lg' : 'border-red-950 bg-[#240b0e] hover:bg-[#330f14]'
              }`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-bold text-red-300 text-sm">{hitman.name}</h3>
                  <div className="text-[11px] text-yellow-300 font-semibold">{hitman.syndicate}</div>
                </div>
                <span className="rounded bg-red-950 px-2 py-0.5 text-xs font-bold text-emerald-400">
                  ${hitman.price.toLocaleString()}
                </span>
              </div>
              <div className="mt-2 space-y-1 text-gray-300 text-[11px]">
                <div>• Signature Weapon: <b className="text-yellow-200">{hitman.signatureWeapon}</b></div>
                <div>• Ethics/Method: <span className="text-gray-200">{hitman.ethics}</span></div>
                <div>• Signature Trace: <span className="text-cyan-300">{hitman.signatureTrace}</span></div>
                <div className="text-purple-300 font-semibold mt-1">
                  🕵️ Detective Pursuit: {hitman.detectiveCounterpart.name} ({hitman.detectiveCounterpart.agency})
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Framing & Target Configuration Bar */}
        <div className="my-3 rounded border border-red-800 bg-[#260a0e] p-4 text-xs space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-gray-300 font-bold mb-1">Target Name:</label>
              <input
                type="text"
                value={targetNameInput}
                onChange={(e) => setTargetNameInput(e.target.value)}
                className="w-full rounded border border-red-500 bg-black/60 px-3 py-1.5 text-xs text-white font-mono"
                placeholder="Target Name"
              />
            </div>
            <div>
              <label className="block text-gray-300 font-bold mb-1">Framing Strategy:</label>
              <select
                value={framingOption}
                onChange={(e) => setFramingOption(e.target.value)}
                className="w-full rounded border border-red-500 bg-black/60 px-3 py-1.5 text-xs text-white font-mono"
              >
                <option value="innocent_citizen">🎭 Frame Innocent Citizen (Planted Stolen Weapon)</option>
                <option value="rival_cartel">💣 Frame Rival Cartel (Planted Medellin Cocaine / Shells)</option>
                <option value="none">🤫 Clean Execution (No Framing / Signature Trace Only)</option>
              </select>
            </div>
          </div>

          <button
            onClick={handleIssueContract}
            className="w-full rounded border border-red-500 bg-red-600 py-2.5 text-xs font-bold text-white hover:bg-red-500 transition-all shadow-lg"
          >
            💥 Issue Hitman Contract on {targetNameInput} (${selectedHitman.price.toLocaleString()})
          </button>
        </div>

        {/* Footer */}
        <div className="border-t border-gray-800 bg-[#0d0304] p-3 text-right">
          <button
            onClick={onClose}
            className="border border-gray-600 bg-gray-800 px-6 py-2 text-xs font-bold text-white hover:bg-gray-700 transition-colors"
          >
            Close Hitmen Interface
          </button>
        </div>
      </div>
    </div>
  )
}
