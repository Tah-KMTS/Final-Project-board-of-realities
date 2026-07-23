import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Minimize2, Maximize2, Compass, Radar } from 'lucide-react'
import { JAPAN_CITIES } from '../../features/world/japanCities'
import { useGameStore } from '../../store/useGameStore'

export default function Minimap({ currentCityId: propCityId }) {
  const [minimized, setMinimized] = useState(false)
  const currentCityId = useGameStore((s) => s.currentCityId || propCityId || 'tokyo')
  const switchCity = useGameStore((s) => s.switchCity || (() => {}))

  const city = JAPAN_CITIES.find((c) => c.id === currentCityId) || JAPAN_CITIES[0]

  return (
    <div className="fixed top-4 right-4 z-40 font-mono">
      <div className="rounded-xl border-2 border-cyan-400/80 bg-[#080d1a]/95 p-3 shadow-[0_0_25px_rgba(6,182,212,0.3)] backdrop-blur-xl w-72">
        {/* Minimap Header Bar */}
        <div className="flex items-center justify-between gap-2 border-b border-cyan-500/30 pb-2 text-xs text-cyan-300">
          <div className="flex items-center gap-1.5 font-extrabold tracking-wider uppercase">
            <Radar size={15} className="text-cyan-400 animate-spin" />
            <span>RADAR MINIMAP • {city.name.split(' ')[0]}</span>
          </div>
          <button
            onClick={() => setMinimized(!minimized)}
            className="rounded p-1 text-gray-400 hover:bg-cyan-900/50 hover:text-white transition-colors"
            title={minimized ? 'Expand Radar Minimap' : 'Minimize Radar Minimap'}
          >
            {minimized ? <Maximize2 size={14} /> : <Minimize2 size={14} />}
          </button>
        </div>

        {/* 4 Japanese Cities Fast-Travel Nav Bar */}
        {!minimized && (
          <div className="my-2 grid grid-cols-4 gap-1 text-[9px] font-extrabold">
            <button
              onClick={() => switchCity('tokyo')}
              className={`py-1 rounded text-center transition-all border ${
                currentCityId === 'tokyo'
                  ? 'border-cyan-400 bg-cyan-500 text-black font-extrabold shadow-[0_0_10px_rgba(6,182,212,0.5)] scale-105'
                  : 'border-gray-800 bg-gray-900 text-gray-400 hover:text-white'
              }`}
            >
              🗼 Tokyo
            </button>
            <button
              onClick={() => switchCity('kyoto')}
              className={`py-1 rounded text-center transition-all border ${
                currentCityId === 'kyoto'
                  ? 'border-yellow-400 bg-yellow-500 text-black font-extrabold shadow-[0_0_10px_rgba(234,179,8,0.5)] scale-105'
                  : 'border-gray-800 bg-gray-900 text-gray-400 hover:text-white'
              }`}
            >
              ⛩️ Kyoto
            </button>
            <button
              onClick={() => switchCity('osaka')}
              className={`py-1 rounded text-center transition-all border ${
                currentCityId === 'osaka'
                  ? 'border-red-400 bg-red-600 text-white font-extrabold shadow-[0_0_10px_rgba(239,68,68,0.5)] scale-105'
                  : 'border-gray-800 bg-gray-900 text-gray-400 hover:text-white'
              }`}
            >
              🐙 Osaka
            </button>
            <button
              onClick={() => switchCity('sapporo')}
              className={`py-1 rounded text-center transition-all border ${
                currentCityId === 'sapporo'
                  ? 'border-indigo-400 bg-indigo-600 text-white font-extrabold shadow-[0_0_10px_rgba(99,102,241,0.5)] scale-105'
                  : 'border-gray-800 bg-gray-900 text-gray-400 hover:text-white'
              }`}
            >
              ❄️ Sapporo
            </button>
          </div>
        )}

        {/* Radar Minimap Canvas Display */}
        <AnimatePresence>
          {!minimized && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="mt-1"
            >
              <div className="relative h-36 w-full overflow-hidden rounded-lg border border-cyan-500/50 bg-[#040714] shadow-inner">
                {/* High-Tech Radar Grid Circles */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="h-28 w-28 rounded-full border border-cyan-500/20" />
                  <div className="absolute h-18 w-18 rounded-full border border-cyan-500/30" />
                  <div className="absolute h-8 w-8 rounded-full border border-cyan-500/40" />
                  <div className="absolute inset-x-0 top-1/2 h-[1px] bg-cyan-500/20" />
                  <div className="absolute inset-y-0 left-1/2 w-[1px] bg-cyan-500/20" />
                </div>

                {/* Rotating Radar Sweep Beam Line */}
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                  <div className="h-28 w-28 rounded-full animate-spin-slow origin-center bg-gradient-to-tr from-transparent via-cyan-500/10 to-cyan-400/40" />
                </div>

                {/* Regional Topography Title */}
                <div className="absolute top-2 right-2 text-[9px] text-cyan-400 font-bold tracking-wider uppercase bg-black/60 px-1.5 py-0.5 rounded border border-cyan-500/30">
                  {city.region}
                </div>

                {/* Physical Food & Supermarket Icon Marker */}
                <div className="absolute top-7 left-10 flex items-center gap-1 bg-emerald-950/80 border border-emerald-500/60 px-1 py-0.5 rounded" title="Physical Food & Supermarket">
                  <span className="text-[10px]">🍔</span>
                  <span className="text-[8px] font-bold text-emerald-300">FOOD</span>
                </div>

                {/* Government HQ Marker */}
                <div className="absolute top-16 right-8 flex items-center gap-1 bg-blue-950/80 border border-blue-500/60 px-1 py-0.5 rounded" title="Government HQ">
                  <span className="text-[10px]">🏛️</span>
                  <span className="text-[8px] font-bold text-blue-300">GOV</span>
                </div>

                {/* Syndicate Crime Vault Marker */}
                <div className="absolute bottom-5 left-12 flex items-center gap-1 bg-red-950/80 border border-red-500/60 px-1 py-0.5 rounded" title="Syndicate Vault">
                  <span className="text-[10px]">🩸</span>
                  <span className="text-[8px] font-bold text-red-300">SYNDICATE</span>
                </div>

                {/* Corporate Skyscraper Landmark Marker */}
                <div className="absolute top-20 left-28 flex items-center gap-1 bg-yellow-950/80 border border-yellow-500/60 px-1 py-0.5 rounded" title="Corporate Skyscraper">
                  <span className="text-[10px]">🏢</span>
                  <span className="text-[8px] font-bold text-yellow-300">TOWER</span>
                </div>

                {/* Player Radar Blip Indicator */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center">
                  <div className="h-3.5 w-3.5 rounded-full bg-cyan-300 border-2 border-white shadow-[0_0_12px_#22d3ee] animate-pulse" />
                  <span className="text-[8px] font-extrabold text-cyan-200 uppercase tracking-tighter mt-0.5">YOU</span>
                </div>
              </div>

              {/* Minimap Legend Bar */}
              <div className="mt-2 grid grid-cols-4 gap-1 text-[9px] text-gray-300 border-t border-gray-800 pt-1.5">
                <span className="flex items-center gap-1"><span className="text-[10px]">🍔</span> Food</span>
                <span className="flex items-center gap-1"><span className="text-[10px]">🏛️</span> Agency</span>
                <span className="flex items-center gap-1"><span className="text-[10px]">🩸</span> Cartel</span>
                <span className="flex items-center gap-1"><span className="text-[10px]">🏢</span> Tower</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
