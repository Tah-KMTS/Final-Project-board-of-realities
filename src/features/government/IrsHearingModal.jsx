import { useState } from 'react'
import { useGameStore } from '../../store/useGameStore'

export default function IrsHearingModal({ onClose }) {
  const cash = useGameStore((s) => s.cash)
  const addCash = useGameStore((s) => s.addCash)
  const [auditMsg, setAuditMsg] = useState(null)

  const handleSettleTax = () => {
    const penalty = 50000
    if (cash < penalty) {
      setAuditMsg('Insufficient funds to settle back taxes & IRS penalties!')
      return
    }
    addCash(-penalty)
    setAuditMsg('📋 IRS AUDIT SETTLED: Paid $50,000 back taxes and cleared IRS Criminal Investigation Division audit!')
  }

  const handleOffshoreShelter = () => {
    if (Math.random() < 0.5) {
      setAuditMsg('💰 OFFSHORE SHELTER SUCCESSFUL: IRS auditors failed to detect encrypted offshore asset accounts!')
    } else {
      addCash(-100000)
      setAuditMsg('🚨 IRS CID SEIZURE: Offshore accounts intercepted! IRS seized $100,000 in tax penalties.')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 font-mono text-white">
      <div className="w-full max-w-xl border-4 border-emerald-500/80 bg-[#0a1813] p-6 shadow-2xl">
        {/* Header */}
        <div className="border-b border-emerald-500/40 pb-3">
          <span className="rounded bg-emerald-900/60 px-2 py-0.5 text-xs font-bold text-emerald-300">KYOTO HISTORIC DISTRICT</span>
          <h2 className="text-2xl font-bold text-emerald-300 mt-1">📋 IRS INTERNAL REVENUE HEARING CHAMBER</h2>
          <p className="text-xs text-gray-300">Presiding Officer: IRS Commissioner Mortimer Caplin & CID Audit Special Agents.</p>
        </div>

        {/* Audit Status */}
        <div className="my-4 rounded border border-emerald-500/30 bg-[#10241b] p-3 text-xs">
          <div className="text-emerald-300 font-bold">IRS High Wealth Audit Investigation:</div>
          <p className="text-gray-300 mt-1">IRS CID is reviewing capital gains tax returns, dividend yields, and syndicate property holdings.</p>
        </div>

        {/* Alert Msg */}
        {auditMsg && (
          <div className="my-3 rounded border border-emerald-400 bg-emerald-950/80 p-3 text-center text-xs font-bold text-emerald-200">
            {auditMsg}
          </div>
        )}

        {/* Actions */}
        <div className="mt-4 grid grid-cols-2 gap-3">
          <button
            onClick={handleSettleTax}
            className="border border-emerald-400 bg-emerald-950/50 py-3 text-xs font-bold text-emerald-300 hover:bg-emerald-500 hover:text-black transition-all"
          >
            💵 Pay Tax Settlement ($50,000)
          </button>
          <button
            onClick={handleOffshoreShelter}
            className="border border-yellow-400 bg-yellow-950/50 py-3 text-xs font-bold text-yellow-300 hover:bg-yellow-500 hover:text-black transition-all"
          >
            🏦 Attempt Offshore Asset Shelter
          </button>
        </div>

        <button
          onClick={onClose}
          className="mt-4 w-full border border-gray-600 bg-gray-800 py-2 text-xs text-gray-300 hover:bg-gray-700 hover:text-white"
        >
          Leave IRS Building
        </button>
      </div>
    </div>
  )
}
