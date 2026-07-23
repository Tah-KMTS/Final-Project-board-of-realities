import { useState } from 'react'
import { useGameStore } from '../../store/useGameStore'

export default function FbiInterrogationModal({ onClose }) {
  const cash = useGameStore((s) => s.cash)
  const addCash = useGameStore((s) => s.addCash)
  const wantedLevel = useGameStore((s) => s.wantedLevel)
  const addWantedLevel = useGameStore((s) => s.addWantedLevel)
  const [fbiMsg, setFbiMsg] = useState(null)

  const handlePostBail = () => {
    const bailCost = 150000
    if (cash < bailCost) {
      setFbiMsg('Insufficient cash to post Federal Bail Bond ($150,000)!')
      return
    }
    addCash(-bailCost)
    addWantedLevel(-wantedLevel) // Clear wanted level completely!
    setFbiMsg('🚨 FBI BAIL RELEASED: Posted $150,000 Federal Bail Bond! FBI Wiretap & Arrest Warrant cleared.')
  }

  const handleBribe = () => {
    if (Math.random() < 0.4) {
      addWantedLevel(-3)
      setFbiMsg('🤫 BUREAU BRIBE SUCCESSFUL: High-ranking agent suppressed wiretap evidence. Heat reduced by -3!')
    } else {
      addWantedLevel(1)
      setFbiMsg('🚨 FBI RICO INDICTMENT: Attempted bribery intercepted by J. Edgar Hoover! Wanted level increased!')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 font-mono text-white">
      <div className="w-full max-w-xl border-4 border-red-600/90 bg-[#170a0d] p-6 shadow-2xl">
        {/* Header */}
        <div className="border-b border-red-600/40 pb-3">
          <span className="rounded bg-red-950/80 px-2 py-0.5 text-xs font-bold text-red-300">OSAKA COMMERCIAL DISTRICT</span>
          <h2 className="text-2xl font-bold text-red-400 mt-1">🕵️ FBI DETENTION & INTERROGATION VAULT</h2>
          <p className="text-xs text-gray-300">Presiding Official: 1st FBI Director J. Edgar Hoover & Organized Crime Section.</p>
        </div>

        {/* Bureau Status */}
        <div className="my-4 rounded border border-red-600/30 bg-[#241014] p-3 text-xs">
          <div className="text-red-400 font-bold">Federal RICO Investigation & Wiretap Status:</div>
          <p className="text-gray-300 mt-1">You are under federal bureau interrogation regarding syndicate extortion, bootlegging, and financial raids.</p>
        </div>

        {/* Alert Msg */}
        {fbiMsg && (
          <div className="my-3 rounded border border-red-500 bg-red-950/80 p-3 text-center text-xs font-bold text-red-200">
            {fbiMsg}
          </div>
        )}

        {/* Actions */}
        <div className="mt-4 grid grid-cols-2 gap-3">
          <button
            onClick={handlePostBail}
            className="border border-red-500 bg-red-950/60 py-3 text-xs font-bold text-red-300 hover:bg-red-600 hover:text-white transition-all"
          >
            📜 Post Federal Bail Bond ($150,000)
          </button>
          <button
            onClick={handleBribe}
            className="border border-yellow-500 bg-yellow-950/60 py-3 text-xs font-bold text-yellow-300 hover:bg-yellow-500 hover:text-black transition-all"
          >
            🤫 Attempt Bureau Official Bribe
          </button>
        </div>

        <button
          onClick={onClose}
          className="mt-4 w-full border border-gray-600 bg-gray-800 py-2 text-xs text-gray-300 hover:bg-gray-700 hover:text-white"
        >
          Leave FBI Interrogation Vault
        </button>
      </div>
    </div>
  )
}
