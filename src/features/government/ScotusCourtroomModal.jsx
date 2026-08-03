import { useState } from 'react'
import { useGameStore } from '../../store/useGameStore'
import { SCOTUS_JUSTICES } from './scotusEngine'

export default function ScotusCourtroomModal({ onClose }) {
  const cash = useGameStore((s) => s.cash)
  const addCash = useGameStore((s) => s.addCash)
  const addWantedLevel = useGameStore((s) => s.addWantedLevel)
  const [verdictMsg, setVerdictMsg] = useState(null)

  const handleHireCounsel = () => {
    if (cash < 250000) {
      setVerdictMsg('Insufficient cash to retain Elite Constitutional Defense Counsel ($250,000)!')
      return
    }
    addCash(-250000)
    addWantedLevel(-2)
    setVerdictMsg('⚖️ SCOTUS RULING: Retained Constitutional Counsel! Supreme Court issued a 5-4 injunction reversing FTC fines & lowering wanted level by -2!')
  }

  const handlePresentEvidence = () => {
    if (Math.random() < 0.6) {
      addWantedLevel(-1)
      setVerdictMsg('⚖️ SCOTUS RULING: Constitutional evidence accepted! Court struck down SEC regulatory overreach.')
    } else {
      setVerdictMsg('⚖️ SCOTUS RULING: Evidence deemed insufficient; petition for certiorari denied.')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 font-mono text-white">
      <div className="w-full max-w-2xl border-4 border-purple-500/80 bg-[#0d0a1c] p-6 shadow-2xl">
        {/* Header */}
        <div className="border-b border-purple-500/40 pb-3">
          <span className="rounded bg-purple-900/60 px-2 py-0.5 text-xs font-bold text-purple-300">TOKYO JUDICIAL DISTRICT</span>
          <h2 className="text-2xl font-bold text-purple-300 mt-1">⚖️ SUPREME COURT OF THE UNITED STATES (SCOTUS)</h2>
          <p className="text-xs text-gray-300">Presiding Justices: John Marshall, Earl Warren, Louis Brandeis, Ruth Bader Ginsburg, Antonin Scalia.</p>
        </div>

        {/* Bench Justices Display */}
        <div className="my-4 rounded border border-purple-500/30 bg-[#14102b] p-3 text-xs">
          <div className="text-purple-300 font-bold mb-1">Presiding Supreme Court Bench:</div>
          <div className="grid grid-cols-3 gap-2 text-xs text-gray-300">
            {SCOTUS_JUSTICES.slice(0, 6).map((j) => (
              <div key={j.id} className="rounded bg-purple-950/40 p-1.5 border border-purple-800/40">
                • {j.name}
              </div>
            ))}
          </div>
        </div>

        {/* Ruling Alert */}
        {verdictMsg && (
          <div className="my-3 rounded border border-purple-400 bg-purple-950/80 p-3 text-center text-xs font-bold text-purple-200">
            {verdictMsg}
          </div>
        )}

        {/* Trial Actions */}
        <div className="mt-4 grid grid-cols-2 gap-3">
          <button
            onClick={handleHireCounsel}
            className="border border-purple-400 bg-purple-950/50 py-3 text-xs font-bold text-purple-300 hover:bg-purple-500 hover:text-black transition-all"
          >
            ⚖️ Hire Elite Legal Counsel ($250,000)
          </button>
          <button
            onClick={handlePresentEvidence}
            className="border border-indigo-400 bg-indigo-950/50 py-3 text-xs font-bold text-indigo-300 hover:bg-indigo-500 hover:text-black transition-all"
          >
            📜 Present Constitutional Evidence
          </button>
        </div>

        <button
          onClick={onClose}
          className="mt-4 w-full border border-gray-600 bg-gray-800 py-2 text-xs text-gray-300 hover:bg-gray-700 hover:text-white"
        >
          Leave SCOTUS Chamber
        </button>
      </div>
    </div>
  )
}
