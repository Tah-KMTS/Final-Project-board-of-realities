import { useState } from 'react'
import UnderworldModal from '../finance/UnderworldModal'
import HitmanContractModal from '../world/HitmanContractModal'
import SyndicateOperationsModal from '../world/SyndicateOperationsModal'
import NarcoticsTradeModal from '../world/NarcoticsTradeModal'

// Phone's Dark Web & Underground app. Four sub-tabs, each an existing modal
// embedded (see each file's `embedded` prop), same pattern as BankingApp.jsx:
// Underworld (UnderworldModal - itself already a tabbed hub for Black Market/
// Call Center Ops/Crime Alley/Speakeasy Hotel), Hitman Contracts
// (HitmanContractModal), Syndicate Ops (SyndicateOperationsModal - rackets/
// laundering/Murder Inc.), and Narcotics (NarcoticsTradeModal).
//
// Crypto's "Hack Exchange Wallet" action is NOT duplicated here - it already
// lives in CryptoModal.jsx, which is reachable via the Banking app's Stock
// Exchange tab (Banking & Portfolio -> Stock Exchange -> Crypto), so wiring
// it a second time here would just be two doors to the same room.
const TABS = [
  { id: 'underworld', label: 'Underworld' },
  { id: 'hitman', label: 'Hitman Contracts' },
  { id: 'syndicate', label: 'Syndicate Ops' },
  { id: 'narcotics', label: 'Narcotics' },
]

export default function DarkWebApp() {
  const [tab, setTab] = useState('underworld')

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="mb-2 flex shrink-0 flex-wrap gap-1.5">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`rounded border px-2 py-1 text-xs font-bold transition-colors ${
              tab === t.id
                ? 'border-red-500 bg-red-500/20 text-red-300'
                : 'border-gray-600 text-gray-400 hover:border-gray-400'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-y-auto">
        {tab === 'underworld' && <UnderworldModal embedded />}
        {tab === 'hitman' && <HitmanContractModal embedded />}
        {tab === 'syndicate' && <SyndicateOperationsModal embedded />}
        {tab === 'narcotics' && <NarcoticsTradeModal embedded />}
      </div>
    </div>
  )
}
