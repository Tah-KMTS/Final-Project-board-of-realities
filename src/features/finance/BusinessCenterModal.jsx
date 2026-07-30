import { useState } from 'react'
import NamedNpcModal from './NamedNpcModal'
import InteractiveLocationModal from '../world/InteractiveLocationModal'

// Building consolidation (Phase 2): Buffett HQ (Biffle Tower) + Vanderbilt
// Rail Co. + Rusk Industries (Musk) + Oaktree Cycle Capital (Howard Marks) +
// Apple Glass HQ (Jobs) used to be 5 separate standalone buildings. They're
// now one physical building ('businessCenter' in OverworldScene.js's
// FINANCE_BUILDING_DEFS) with a tab per former tenant - same TABS pattern as
// CasinoModal.jsx. Note: fordRougeComplex (Ford) is a SIXTH former single-
// tenant HQ but is deliberately NOT part of this hub - it's earmarked for a
// future Industrial Zone and is left completely untouched.
const TABS = [
  { id: 'buffett', label: 'Buffett' },
  { id: 'vanderbilt', label: 'Vanderbilt' },
  { id: 'musk', label: 'Musk' },
  { id: 'howardmarks', label: 'Howard Marks' },
  { id: 'jobs', label: 'Jobs' },
]

export default function BusinessCenterModal({ onClose }) {
  const [tab, setTab] = useState('buffett')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="glass-panel w-[640px] border-4 border-slate-400 bg-[#1c1d3a] p-6 font-mono text-white">
        <p className="mb-1 text-[10px] uppercase tracking-widest text-gray-500">Financial District</p>
        <h2 className="mb-2 text-xl font-bold text-slate-300">Capital Business Center</h2>
        <p className="mb-3 text-xs text-gray-400">
          Five titans, five floors, one lobby. Buffett, Vanderbilt, Musk, Howard Marks, and Jobs all keep offices here.
        </p>

        <div className="mb-3 flex flex-wrap gap-2">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`border-2 px-3 py-1 text-xs font-bold ${
                tab === t.id ? 'border-slate-400 bg-slate-400/20 text-slate-200' : 'border-gray-600 text-gray-400 hover:border-gray-400'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="mb-4 max-h-[520px] overflow-y-auto">
          {tab === 'buffett' && <NamedNpcModal npcId="buffett" embedded />}
          {tab === 'vanderbilt' && <NamedNpcModal npcId="vanderbilt" embedded />}
          {tab === 'musk' && <NamedNpcModal npcId="musk" embedded />}
          {tab === 'howardmarks' && <NamedNpcModal npcId="howardmarks" embedded />}
          {/* Jobs keeps his Apple Glass Design Studio prototype-testing action
              (InteractiveLocationModal's apple_lab entry) rather than the
              plain NamedNpcModal the other 4 tenants get - unchanged content,
              just embedded here instead of its own building/intercept. */}
          {tab === 'jobs' && <InteractiveLocationModal locationId="apple_lab" embedded />}
        </div>

        <button onClick={onClose} className="w-full border-4 border-gray-500 py-2 font-bold hover:bg-gray-500">
          Leave the Business Center
        </button>
      </div>
    </div>
  )
}
