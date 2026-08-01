import { useState } from 'react'
import DistrictBuildingModal from './DistrictBuildingModal'
import NamedNpcModal from './NamedNpcModal'
import InteractiveLocationModal from '../world/InteractiveLocationModal'

// Building consolidation (Phase 2): Black Market + Call Center Ops + Crime
// Alley (Lucky Luciano) + Speakeasy Hotel (Al Capone) used to be 4 separate
// standalone buildings on the map. They're now one physical building
// ('underworld' in OverworldScene.js's FINANCE_BUILDING_DEFS) with a tab per
// former tenant - same TABS pattern as CasinoModal.jsx.
//
// Crime Alley used to independently trigger BOTH DistrictBuildingModal (via
// WorldScreen.jsx's DISTRICT_BUILDING_IDS branch) AND NamedNpcModal (via the
// npcId branch) stacked on top of each other at once, because the building
// def carried both an id DistrictBuildingModal keyed on and an npcId
// NamedNpcModal keyed on - two independent JSX conditions in WorldScreen.jsx
// both matching the same activeModal. That's deliberately NOT reproduced
// here: the Crime Alley tab below composes both pieces of content in one
// tab body instead of leaving them stacked.
const TABS = [
  { id: 'blackMarket', label: 'Black Market' },
  { id: 'callCenterOps', label: 'Call Center Ops' },
  { id: 'crimeAlley', label: 'Crime Alley' },
  { id: 'speakeasy', label: 'Speakeasy Hotel' },
]

export default function UnderworldModal({ onClose }) {
  const [tab, setTab] = useState('blackMarket')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="glass-panel w-[640px] border-4 border-red-500 bg-[#1c1d3a] p-6 font-mono text-white">
        <p className="mb-1 text-[10px] uppercase tracking-widest text-gray-500">Underground District</p>
        <h2 className="mb-2 text-xl font-bold text-red-400">The Underworld</h2>
        <p className="mb-3 text-xs text-gray-400">
          Fenced goods, boiler-room scams, back-alley shakedowns, and Prohibition-era bootlegging, all under one roof
          nobody official ever checks.
        </p>

        <div className="mb-3 flex flex-wrap gap-2">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`border-2 px-3 py-1 text-xs font-bold ${
                tab === t.id ? 'border-red-500 bg-red-500/20 text-red-300' : 'border-gray-600 text-gray-400 hover:border-gray-400'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="mb-4 max-h-[460px] overflow-y-auto">
          {tab === 'blackMarket' && <DistrictBuildingModal buildingId="blackMarket" embedded />}
          {tab === 'callCenterOps' && <DistrictBuildingModal buildingId="callCenterOps" embedded />}
          {tab === 'crimeAlley' && (
            <div className="flex flex-col gap-4">
              <DistrictBuildingModal buildingId="crimeAlley" embedded />
              <div className="border-t-2 border-gray-700 pt-4">
                <p className="mb-2 text-[10px] uppercase tracking-widest text-gray-500">Also lurking here</p>
                <NamedNpcModal npcId="luciano" embedded />
              </div>
            </div>
          )}
          {tab === 'speakeasy' && <InteractiveLocationModal locationId="speakeasy_club" embedded />}
        </div>

        <button onClick={onClose} className="w-full border-4 border-gray-500 py-2 font-bold hover:bg-gray-500">
          Leave the Underworld
        </button>
      </div>
    </div>
  )
}
