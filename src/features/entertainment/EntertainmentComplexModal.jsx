import { useState } from 'react'
import ConcertHallTab from './ConcertHallTab'
import SportsStadiumTab from './SportsStadiumTab'

// Entertainment Complex - one physical building, 2 tabs, same TABS-modal
// pattern as IndustrialZoneModal.jsx/UnderworldModal.jsx/
// BusinessCenterModal.jsx/GovernmentBuildingModal.jsx. Critically, tabs are
// conditionally rendered/unmounted when inactive ({tab === 'x' && <X/>}),
// not hidden via CSS - load-bearing for RhythmGame.jsx's (Concert Hall) and
// SprintRace.jsx's (Sports Stadium) keydown-listener/rAF-loop cleanup.
//
// Concert Hall (Dixon Trujillo's laundering-front venue + the arrow-key
// rhythm minigame) and Sports Stadium (Arnold Rothstein's fixed-odds
// operation + the arrow-key sprint QTE) are both real mini-games.
const TABS = [
  { id: 'concertHall', label: 'Concert Hall' },
  { id: 'sportsStadium', label: 'Sports Stadium' },
]

export default function EntertainmentComplexModal({ onClose }) {
  const [tab, setTab] = useState('concertHall')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="glass-panel w-[640px] border-4 border-fuchsia-500 bg-[#1c1d3a] p-6 font-mono text-white">
        <p className="mb-1 text-[10px] uppercase tracking-widest text-gray-500">Industrial District</p>
        <h2 className="mb-2 text-xl font-bold text-fuchsia-300">Entertainment Complex</h2>
        <p className="mb-3 text-xs text-gray-400">
          Two venues, one landlord problem: everybody involved is bored by the glamour and only interested in the
          invoice underneath it.
        </p>

        <div className="mb-3 flex flex-wrap gap-2">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`border-2 px-3 py-1 text-xs font-bold ${
                tab === t.id ? 'border-fuchsia-400 bg-fuchsia-400/20 text-fuchsia-200' : 'border-gray-600 text-gray-400 hover:border-gray-400'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="mb-4 max-h-[560px] overflow-y-auto">
          {tab === 'concertHall' && <ConcertHallTab />}
          {tab === 'sportsStadium' && <SportsStadiumTab />}
        </div>

        <button onClick={onClose} className="w-full border-4 border-gray-500 py-2 font-bold hover:bg-gray-500">
          Leave the Entertainment Complex
        </button>
      </div>
    </div>
  )
}
