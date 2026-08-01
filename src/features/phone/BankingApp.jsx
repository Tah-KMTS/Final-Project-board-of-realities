import { useState } from 'react'
import { useGameStore } from '../../store/useGameStore'
import PortfolioTab from './PortfolioTab'
import BankModal from '../finance/BankModal'
import StockExchangeModal from '../finance/StockExchangeModal'

// Phone's Banking & Portfolio app. Portfolio is a read-only "what do I
// actually own" summary (see PortfolioTab.jsx) and the default landing tab,
// since the other 2 are both action screens with no single place that shows
// holdings across all of them at a glance. Those two each embed an existing
// modal (see each file's `embedded` prop): Bank & Realty (BankModal), Stock
// Exchange (StockExchangeModal, which itself already embeds a Crypto tab via
// CryptoModal). Syndicate Board (advisor recruitment) used to be a 3rd tab
// here but was removed - recruiting financial titans is still fully
// reachable by walking up to them in the overworld (NamedNpcModal.jsx also
// calls recruitFinanceNpc), this just drops the "browse everyone remotely"
// convenience screen.
const TABS = [
  { id: 'portfolio', label: 'Portfolio' },
  { id: 'bank', label: 'Bank & Realty' },
  { id: 'exchange', label: 'Stock Exchange' },
]

export default function BankingApp() {
  const [tab, setTab] = useState('portfolio')
  // clearWorld2 is the Stock Exchange's "Declare Victory" gate - grabbed
  // directly from the store rather than threaded through PhoneShell's `apps`
  // plug point, same as every other action these embedded modals call.
  const clearWorld2 = useGameStore((s) => s.clearWorld2)

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="mb-2 flex shrink-0 flex-wrap gap-1.5">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`rounded border px-2 py-1 text-xs font-bold transition-colors ${
              tab === t.id
                ? 'border-emerald-400 bg-emerald-400/20 text-emerald-300'
                : 'border-gray-600 text-gray-400 hover:border-gray-400'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {tab === 'portfolio' && <PortfolioTab />}
        {tab === 'bank' && <BankModal embedded />}
        {tab === 'exchange' && <StockExchangeModal embedded onDeclareVictory={clearWorld2} />}
      </div>
    </div>
  )
}
