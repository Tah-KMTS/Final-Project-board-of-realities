import { useState } from 'react'
import { useGameStore } from '../../store/useGameStore'

export default function AgentInteractionsModal({ onClose }) {
  const world2 = useGameStore((s) => s.world2)
  const [filterType, setFilterType] = useState('all') // 'all' | 'butterfly' | 'migration' | 'assets'

  const eventFeed = world2.agentEventFeed || []
  const masterAgents = world2.masterAgents || []

  const filteredFeed = eventFeed.filter((evt) => {
    if (filterType === 'butterfly') return evt.title?.includes('Butterfly') || evt.type === 'butterfly'
    if (filterType === 'migration') return evt.title?.includes('Migration') || evt.type === 'migration'
    if (filterType === 'assets') return evt.title?.includes('Asset') || evt.type === 'asset'
    return true
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 font-mono">
      <div className="flex h-[85vh] w-full max-w-4xl flex-col border-4 border-cyan-500/70 bg-[#0c1024] text-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b-2 border-cyan-500/40 bg-[#141838] px-6 py-4">
          <div>
            <h1 className="text-2xl font-bold text-cyan-400 tracking-wide">⚡ 76-AGENT INTELLIGENCE & INTERACTION FEED</h1>
            <p className="text-xs text-gray-400">Autonomous market events, butterfly chain reactions, city migrations & asset purchases.</p>
          </div>
          <div className="text-right">
            <div className="text-xs text-gray-400">Active Agents</div>
            <div className="text-lg font-bold text-cyan-300">{masterAgents.length || 76} Characters</div>
          </div>
        </div>

        {/* Filter Buttons */}
        <div className="flex border-b border-gray-800 bg-[#161a3b] px-6 py-2.5 gap-2 text-xs font-bold flex-wrap">
          <span className="text-gray-400 self-center">Filter Live Feed:</span>
          <button
            onClick={() => setFilterType('all')}
            className={`px-3 py-1 rounded transition-colors ${filterType === 'all' ? 'bg-cyan-500 text-black font-extrabold' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'}`}
          >
            All Events ({eventFeed.length})
          </button>
          <button
            onClick={() => setFilterType('butterfly')}
            className={`px-3 py-1 rounded transition-colors ${filterType === 'butterfly' ? 'bg-fuchsia-500 text-black font-extrabold' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'}`}
          >
            🦋 Butterfly Effects
          </button>
          <button
            onClick={() => setFilterType('migration')}
            className={`px-3 py-1 rounded transition-colors ${filterType === 'migration' ? 'bg-emerald-500 text-black font-extrabold' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'}`}
          >
            ✈️ Town Migrations
          </button>
          <button
            onClick={() => setFilterType('assets')}
            className={`px-3 py-1 rounded transition-colors ${filterType === 'assets' ? 'bg-yellow-500 text-black font-extrabold' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'}`}
          >
            💰 Asset Acquisitions
          </button>
        </div>

        {/* Main Feed Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-3">
          {filteredFeed.length === 0 ? (
            <div className="flex h-64 flex-col items-center justify-center rounded border border-dashed border-gray-800 text-center text-gray-500">
              <span className="text-4xl mb-2">📡</span>
              <p className="text-sm font-bold text-gray-400">No agent interaction logs recorded yet.</p>
              <p className="text-xs max-w-md mt-1">Press 'End Day' in the main game interface to trigger daily autonomous 76-agent interactions, butterfly chain reactions, and town migrations!</p>
            </div>
          ) : (
            filteredFeed.map((evt) => (
              <div
                key={evt.id}
                className="rounded border border-cyan-500/40 bg-cyan-950/20 p-3 text-xs text-cyan-200 shadow-md"
              >
                <div className="flex items-center justify-between border-b border-white/10 pb-1.5 mb-1.5 text-[11px]">
                  <span className="font-bold text-yellow-400">{evt.title || 'AGENT INTELLIGENCE LOG'}</span>
                  <span className="uppercase tracking-wider font-semibold text-[10px] text-gray-400">{evt.id}</span>
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
