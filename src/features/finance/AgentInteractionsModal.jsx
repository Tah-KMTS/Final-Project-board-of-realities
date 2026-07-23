import { useState } from 'react'
import { useGameStore } from '../../store/useGameStore'
import { FINANCE_NPCS } from './financeNpcs'
import { ARCHETYPE_PROFILES } from './agentEngine'

export default function AgentInteractionsModal({ onClose }) {
  const world2 = useGameStore((s) => s.world2)
  const [filterType, setFilterType] = useState('all') // 'all' | 'raids' | 'alliances'

  const eventFeed = world2.agentEventFeed || []
  const agentsState = world2.agentsState || {}

  const filteredFeed = eventFeed.filter((evt) => {
    if (filterType === 'raids') return evt.type === 'raid'
    if (filterType === 'alliances') return evt.type === 'alliance'
    return true
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
      <div className="flex h-[85vh] w-full max-w-4xl flex-col border-4 border-cyan-500/70 bg-[#0c1024] font-mono text-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b-2 border-cyan-500/40 bg-[#141838] px-6 py-4">
          <div>
            <h1 className="text-2xl font-bold text-cyan-400 tracking-wide">⚡ TITAN INTELLIGENCE & INTER-AGENT FEED</h1>
            <p className="text-xs text-gray-400">Autonomous market events, hostile raids, and multi-agent alliances simulated live each day.</p>
          </div>
          <div className="text-right">
            <div className="text-xs text-gray-400">Active Agents</div>
            <div className="text-lg font-bold text-cyan-300">{FINANCE_NPCS.length} Titans</div>
          </div>
        </div>

        {/* Filter Buttons */}
        <div className="flex border-b border-gray-800 bg-[#161a3b] px-6 py-2.5 gap-3 text-xs font-bold">
          <span className="text-gray-400 self-center">Filter Live Feed:</span>
          <button
            onClick={() => setFilterType('all')}
            className={`px-3 py-1 rounded transition-colors ${filterType === 'all' ? 'bg-cyan-500 text-black font-extrabold' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'}`}
          >
            All Events ({eventFeed.length})
          </button>
          <button
            onClick={() => setFilterType('raids')}
            className={`px-3 py-1 rounded transition-colors ${filterType === 'raids' ? 'bg-red-500 text-white font-extrabold' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'}`}
          >
            ⚔️ Hostile Raids
          </button>
          <button
            onClick={() => setFilterType('alliances')}
            className={`px-3 py-1 rounded transition-colors ${filterType === 'alliances' ? 'bg-emerald-500 text-black font-extrabold' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'}`}
          >
            🤝 Alliances & Syndicates
          </button>
        </div>

        {/* Main Feed Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-3">
          {filteredFeed.length === 0 ? (
            <div className="flex h-64 flex-col items-center justify-center rounded border border-dashed border-gray-800 text-center text-gray-500">
              <span className="text-4xl mb-2">📡</span>
              <p className="text-sm font-bold text-gray-400">No agent interaction logs recorded yet.</p>
              <p className="text-xs max-w-md mt-1">Press 'End Day' in the main game interface to trigger daily autonomous multi-agent interactions and titan raids!</p>
            </div>
          ) : (
            filteredFeed.map((evt) => (
              <div
                key={evt.id}
                className={`rounded border p-3 text-xs shadow-md transition-all ${
                  evt.type === 'raid'
                    ? 'border-red-500/40 bg-red-950/20 text-red-200'
                    : evt.type === 'alliance'
                    ? 'border-emerald-500/40 bg-emerald-950/20 text-emerald-200'
                    : 'border-cyan-500/40 bg-cyan-950/20 text-cyan-200'
                }`}
              >
                <div className="flex items-center justify-between border-b border-white/10 pb-1.5 mb-1.5 text-[11px]">
                  <span className="font-bold text-yellow-400">DAY {evt.day} EVENT</span>
                  <span className="uppercase tracking-wider font-semibold text-[10px] text-gray-400">{evt.type}</span>
                </div>
                <div className="font-medium text-sm leading-relaxed">{evt.text}</div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-800 bg-[#121429] p-4 text-right">
          <button
            onClick={onClose}
            className="border-2 border-gray-600 bg-gray-800 px-6 py-2 text-xs font-bold text-white hover:bg-gray-700 transition-colors"
          >
            Close Feed
          </button>
        </div>
      </div>
    </div>
  )
}
