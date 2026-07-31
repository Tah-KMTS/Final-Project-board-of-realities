import { useState } from 'react'
import { useGameStore } from '../../store/useGameStore'
import { TITAN_ROUTINES } from '../agents/agentMovementEngine'
import { FINANCE_NPCS } from './financeNpcs'
import { getCityById } from '../world/japanCities'

// `embedded` (default false): the former "Titan Feed" header button's
// content. That button is gone (folded into the Phone's Social/X app - see
// src/features/phone/SocialApp.jsx); embedded=true drops the outer
// fixed-overlay wrapper and the bottom "Close Feed" button, same convention
// as every other hub-tab modal in this codebase (CryptoModal.jsx etc).
export default function AgentInteractionsModal({ onClose, embedded = false }) {
  const world2 = useGameStore((s) => s.world2)
  const currentCityId = useGameStore((s) => s.currentCityId) || 'tokyo'
  const [filterType, setFilterType] = useState('all') // 'all' | 'butterfly' | 'migration' | 'assets' | 'city'
  const [tab, setTab] = useState('feed') // 'feed' | 'roster'

  const eventFeed = world2.agentEventFeed || []
  const masterAgents = world2.masterAgents || []
  const city = getCityById(currentCityId)

  const filteredFeed = eventFeed.filter((evt) => {
    if (filterType === 'butterfly') return evt.title?.includes('Butterfly') || evt.type === 'butterfly'
    if (filterType === 'migration') return evt.title?.includes('Migration') || evt.type === 'migration'
    if (filterType === 'assets') return evt.title?.includes('Asset') || evt.type === 'asset'
    if (filterType === 'city') return evt.city === currentCityId || evt.text?.includes(city.name)
    return true
  })

  // Build a roster of all finance NPCs with their routine data
  const npcRoster = FINANCE_NPCS.map((npc) => {
    const routine = TITAN_ROUTINES[npc.id]
    const agentState = (world2.agentsState || {})[npc.id]
    const isRecruited = (world2.recruitedAdvisors || []).includes(npc.id)
    const currentStep = routine?.schedule?.[0]
    return {
      ...npc,
      homeCity: routine?.homeCity || 'tokyo',
      currentAction: agentState?.currentAction || currentStep?.action || '📊 Monitoring Markets',
      currentLocation: agentState?.currentLocation || currentStep?.location || 'Capital District',
      currentMood: agentState?.currentMood || 'Bullish',
      isRecruited,
      isInCurrentCity: (routine?.homeCity || 'tokyo') === currentCityId,
    }
  })

  const cityResidents = npcRoster.filter((n) => n.isInCurrentCity)
  const otherNpcs = npcRoster.filter((n) => !n.isInCurrentCity)

  const body = (
    <>
        {/* Header - flex-wrap (rather than a fixed two-column
            justify-between) so this doesn't overflow/clip when embedded in
            the Phone's much narrower ~312px app slot (see
            src/features/phone/SocialApp.jsx), not just the wide standalone
            modal this was originally designed for. */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b-2 border-cyan-500/40 bg-[#141838] px-6 py-4">
          <div>
            <h1 className="text-lg font-bold text-cyan-400 tracking-wide">⚡ 76-AGENT INTELLIGENCE NETWORK</h1>
            <p className="text-xs text-gray-400 mt-0.5">
              Autonomous agents • City schedules • Daily interactions • Butterfly effects
            </p>
          </div>
          <div className="text-right">
            <div className="text-xs text-gray-400">Now In</div>
            <div className="text-sm font-bold text-yellow-300">{city.name}</div>
            <div className="text-xs text-cyan-300">{cityResidents.length} resident agents</div>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex flex-wrap border-b border-gray-800 bg-[#161a3b] px-4 pt-2 gap-1 text-xs font-bold">
          <button
            onClick={() => setTab('feed')}
            className={`px-4 py-2 rounded-t transition-colors ${tab === 'feed' ? 'bg-cyan-600 text-white' : 'text-gray-400 hover:text-white'}`}
          >
            📡 Live Event Feed ({eventFeed.length})
          </button>
          <button
            onClick={() => setTab('roster')}
            className={`px-4 py-2 rounded-t transition-colors ${tab === 'roster' ? 'bg-yellow-600 text-black font-extrabold' : 'text-gray-400 hover:text-white'}`}
          >
            🧑‍💼 Agent Roster ({FINANCE_NPCS.length})
          </button>
        </div>

        {tab === 'feed' && (
          <>
            {/* Filter Buttons */}
            <div className="flex border-b border-gray-800 bg-[#0e1230] px-6 py-2 gap-2 text-xs font-bold flex-wrap">
              <span className="text-gray-400 self-center">Filter:</span>
              {[
                { id: 'all', label: `All (${eventFeed.length})`, active: 'bg-cyan-500 text-black' },
                { id: 'butterfly', label: '🦋 Butterfly', active: 'bg-fuchsia-500 text-black' },
                { id: 'migration', label: '✈️ Migrations', active: 'bg-emerald-500 text-black' },
                { id: 'assets', label: '💰 Assets', active: 'bg-yellow-500 text-black' },
                { id: 'city', label: `🏙️ In ${city.name.split(' ')[0]}`, active: 'bg-orange-500 text-black' },
              ].map((f) => (
                <button
                  key={f.id}
                  onClick={() => setFilterType(f.id)}
                  className={`px-3 py-1 rounded transition-colors ${filterType === f.id ? f.active + ' font-extrabold' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'}`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-3">
              {filteredFeed.length === 0 ? (
                <div className="flex h-64 flex-col items-center justify-center rounded border border-dashed border-gray-800 text-center text-gray-500">
                  <span className="text-4xl mb-2">📡</span>
                  <p className="text-sm font-bold text-gray-400">No agent interaction logs yet.</p>
                  <p className="text-xs max-w-md mt-1 text-gray-500">
                    Press <span className="text-cyan-300 font-bold">End Day</span> to trigger autonomous agent interactions, butterfly chain reactions, and town migrations!
                  </p>
                </div>
              ) : (
                filteredFeed.map((evt) => (
                  <div
                    key={evt.id}
                    className="rounded border border-cyan-500/40 bg-cyan-950/20 p-3 text-xs text-cyan-200 shadow-md"
                  >
                    <div className="flex items-center justify-between border-b border-white/10 pb-1.5 mb-1.5 text-[11px]">
                      <span className="font-bold text-yellow-400">{evt.title || 'AGENT INTEL LOG'}</span>
                      <span className="uppercase tracking-wider font-semibold text-[10px] text-gray-400">{evt.id}</span>
                    </div>
                    <div className="font-medium text-sm leading-relaxed">{evt.text}</div>
                  </div>
                ))
              )}
            </div>
          </>
        )}

        {tab === 'roster' && (
          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {/* City residents first */}
            <div className="text-xs font-bold text-cyan-300 mb-2 border-b border-cyan-800 pb-1">
              🏙️ {city.name.split('(')[0].trim()} Residents ({cityResidents.length})
            </div>
            {cityResidents.map((npc) => (
              <NpcRosterCard key={npc.id} npc={npc} highlight />
            ))}

            {/* Other city agents */}
            <div className="text-xs font-bold text-gray-400 mt-4 mb-2 border-b border-gray-800 pb-1">
              🌏 Agents in Other Cities ({otherNpcs.length})
            </div>
            {otherNpcs.map((npc) => (
              <NpcRosterCard key={npc.id} npc={npc} highlight={false} />
            ))}
          </div>
        )}

        {/* Footer */}
        {!embedded && (
          <div className="border-t border-gray-800 bg-[#121429] p-4 text-right">
            <button
              onClick={onClose}
              className="border-2 border-gray-600 bg-gray-800 px-6 py-2 text-xs font-bold text-white hover:bg-gray-700 transition-colors"
            >
              Close Feed
            </button>
          </div>
        )}
    </>
  )

  // Embedded mode drops the fixed h-[90vh] overlay panel entirely - the
  // wrapping Phone app tab already gives this its own scrollable area, same
  // reasoning as GovernmentModal.jsx's embedded branch.
  if (embedded) return <div className="flex max-h-[70vh] flex-col overflow-y-auto text-white">{body}</div>

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 font-mono">
      <div className="flex h-[90vh] w-full max-w-4xl flex-col border-4 border-cyan-500/70 bg-[#0c1024] text-white shadow-2xl">
        {body}
      </div>
    </div>
  )
}

function NpcRosterCard({ npc, highlight }) {
  const CITY_LABELS = { tokyo: '🏛️ Tokyo', kyoto: '⛩️ Kyoto', osaka: '🐙 Osaka', sapporo: '❄️ Sapporo' }
  const MOOD_COLORS = {
    'Bullish': 'text-emerald-300', 'Bearish': 'text-red-400',
    'Aggressive Raid': 'text-orange-400', 'Defensive Hold': 'text-blue-300', 'Opportunistic': 'text-yellow-300',
  }
  return (
    <div className={`rounded border px-3 py-2 flex items-start gap-3 text-xs ${highlight ? 'border-cyan-500/40 bg-cyan-950/15' : 'border-gray-700/40 bg-gray-900/30'}`}>
      {/* Color swatch based on outfit palette */}
      <div
        className="shrink-0 w-8 h-8 rounded border border-gray-600 flex items-center justify-center text-[10px] font-bold"
        style={{ backgroundColor: npc.palette?.outfit || '#1a1a1a', color: '#ffffff' }}
      >
        {npc.name.split(' ').map((w) => w[0]).slice(0, 2).join('')}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-bold text-yellow-300">{npc.name}</span>
          <span className="text-gray-400 text-[10px]">{npc.title}</span>
          {npc.isRecruited && <span className="text-emerald-400 font-bold text-[10px] border border-emerald-600 px-1 rounded">BOARD MEMBER</span>}
        </div>
        <div className="text-gray-300 mt-0.5 truncate">{npc.currentAction}</div>
        <div className="flex gap-3 mt-0.5 text-[10px]">
          <span className="text-gray-500">📍 {npc.currentLocation}</span>
          <span className="text-gray-500">{CITY_LABELS[npc.homeCity] || npc.homeCity}</span>
          <span className={MOOD_COLORS[npc.currentMood] || 'text-gray-400'}>{npc.currentMood}</span>
        </div>
      </div>
    </div>
  )
}
