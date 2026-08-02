import { useState } from 'react'
import { useGameStore } from '../../store/useGameStore'
import { NET_WORTH_WIN_TARGET, FINANCE_VICTORY_TARGET } from './marketData'
import TradeMeter from './TradeMeter'
import CryptoModal from './CryptoModal'

// Building consolidation (Phase 2): Crypto HQ was deleted as a standalone
// building and is reached as a tab here instead (see CasinoModal.jsx for the
// identical pattern - TABS array + embedded content).
const TABS = [
  { id: 'exchange', label: 'Stock Exchange' },
  { id: 'crypto', label: 'Crypto' },
]

// `embedded` (default false): standalone building access (walking up to the
// Stock Exchange) keeps working exactly as before. When true (Phone app ->
// Banking & Portfolio's "Stock Exchange" tab - see src/features/phone/
// BankingApp.jsx), skip the outer fixed-overlay wrapper and the bottom
// "Leave" button - same convention as CryptoModal.jsx, which this modal
// already embeds one level deeper for its own Crypto tab.
export default function StockExchangeModal({ onClose, onDeclareVictory, embedded = false }) {
  const cash = useGameStore((s) => s.cash)
  const world2 = useGameStore((s) => s.world2)
  const computeNetWorth = useGameStore((s) => s.computeNetWorth)
  const [tab, setTab] = useState('exchange')

  const netWorth = computeNetWorth()
  // Live, reversible check against FINANCE_VICTORY_TARGET ($10M, the "True
  // Tycoon" milestone number) - this is the real Declare Victory gate.
  // NET_WORTH_WIN_TARGET ($1B) stays a flavor-only flex goal: once THAT is
  // also met, the same button just swaps its copy (see below), it doesn't
  // gate anything new or change onDeclareVictory's behavior.
  const winMet = netWorth >= FINANCE_VICTORY_TARGET
  const flexMet = netWorth >= NET_WORTH_WIN_TARGET

  const body = (
    <>
        <h2 className="mb-2 text-xl font-bold text-green-300">Stock Exchange</h2>

        <div className="mb-3 flex flex-wrap gap-2">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`border-2 px-3 py-1 text-xs font-bold ${
                tab === t.id ? 'border-green-400 bg-green-400/20 text-green-300' : 'border-gray-600 text-gray-400 hover:border-gray-400'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'exchange' && (
          <>
            <p className="mb-3 text-xs text-gray-400">
              Prices drift every few seconds. Time your Buy/Sell to hit the green zone for a better price.
            </p>

            <div className="mb-3 border-2 border-gray-600 bg-[#0f1020] p-3 text-sm">
              <p>Cash: <span className="text-green-400">${Math.round(cash).toLocaleString()}</span></p>
              <p>Net Worth: <span className="text-yellow-300">${Math.round(netWorth).toLocaleString()}</span> / ${flexMet ? NET_WORTH_WIN_TARGET.toLocaleString() : FINANCE_VICTORY_TARGET.toLocaleString()}</p>
            </div>

            <div className="mb-4 max-h-64 overflow-y-auto border-2 border-gray-600 bg-[#0f1020] p-3">
              {world2.stocks.map((stock) => (
                <TradeMeter
                  key={stock.ticker}
                  stock={stock}
                  holding={world2.portfolio[stock.ticker]}
                  shortHolding={world2.shortPositions?.[stock.ticker]}
                />
              ))}
            </div>

            {winMet && (
              <button
                onClick={onDeclareVictory}
                className="mb-3 w-full border-4 border-yellow-400 bg-yellow-500 py-2 font-bold text-black hover:bg-yellow-400"
              >
                {flexMet ? 'Ascend as a Titan of Industry' : 'Declare Yourself the Richest Person Alive'}
              </button>
            )}
          </>
        )}

        {tab === 'crypto' && (
          <div className="mb-4 max-h-[420px] overflow-y-auto">
            <CryptoModal embedded />
          </div>
        )}

        {!embedded && (
          <button
            onClick={onClose}
            className="w-full border-4 border-gray-500 py-2 font-bold hover:bg-gray-500"
          >
            Leave
          </button>
        )}
    </>
  )

  if (embedded) return <div className="text-white">{body}</div>

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="w-[520px] border-4 border-green-400 bg-[#1c1d3a] p-6 font-mono text-white">
        {body}
      </div>
    </div>
  )
}
