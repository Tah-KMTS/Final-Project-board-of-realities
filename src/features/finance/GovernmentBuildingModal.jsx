import { useState } from 'react'
import NamedNpcModal from './NamedNpcModal'
import GovernmentModal from '../../components/GovernmentModal'

// Building consolidation (Phase 2): FBI Headquarters (Hoover) + IRS Internal
// Revenue (Caplin) used to be 2 separate standalone buildings. They're now
// one physical building ('governmentBuilding' in OverworldScene.js's
// FINANCE_BUILDING_DEFS) with a tab per former tenant, plus a 3rd tab that
// embeds the existing elections/Fed/FTC/SCOTUS/Congress/Treasury/agencies
// hub (src/components/GovernmentModal.jsx) - previously only reachable via
// FinanceStatusBar's "Open Gov" button, which keeps working standalone and
// unaffected (see that component's embedded=false default).
const TABS = [
  { id: 'hoover', label: 'Hoover (FBI)' },
  { id: 'caplin', label: 'Caplin (IRS)' },
  { id: 'affairs', label: 'Government Affairs' },
]

export default function GovernmentBuildingModal({ onClose }) {
  const [tab, setTab] = useState('hoover')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="glass-panel w-[720px] border-4 border-amber-500 bg-[#1c1d3a] p-6 font-mono text-white">
        <p className="mb-1 text-[10px] uppercase tracking-widest text-gray-500">Government & Cultural District</p>
        <h2 className="mb-2 text-xl font-bold text-amber-300">Federal Government Building</h2>
        <p className="mb-3 text-xs text-gray-400">
          The FBI's Hoover, the IRS's Caplin, and the full machinery of federal oversight, all in one building.
        </p>

        <div className="mb-3 flex flex-wrap gap-2">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`border-2 px-3 py-1 text-xs font-bold ${
                tab === t.id ? 'border-amber-400 bg-amber-400/20 text-amber-300' : 'border-gray-600 text-gray-400 hover:border-gray-400'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="mb-4 max-h-[560px] overflow-y-auto">
          {tab === 'hoover' && <NamedNpcModal npcId="hoover" embedded />}
          {tab === 'caplin' && <NamedNpcModal npcId="caplin" embedded />}
          {tab === 'affairs' && <GovernmentModal embedded />}
        </div>

        <button onClick={onClose} className="w-full border-4 border-gray-500 py-2 font-bold hover:bg-gray-500">
          Leave the Government Building
        </button>
      </div>
    </div>
  )
}
