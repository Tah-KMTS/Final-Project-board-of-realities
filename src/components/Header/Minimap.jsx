import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Map, Minimize2, Maximize2, Compass } from 'lucide-react'
import { JAPAN_CITIES } from '../../features/world/japanCities'

export default function Minimap({ currentCityId = 'tokyo' }) {
  const [minimized, setMinimized] = useState(false)
  const city = JAPAN_CITIES.find((c) => c.id === currentCityId) || JAPAN_CITIES[0]

  return (
    <div className="fixed top-4 right-4 z-40 font-mono">
      <div className="rounded-lg border-2 border-cyan-500/80 bg-[#0d1127]/90 p-2.5 shadow-2xl backdrop-blur-md">
        {/* Minimap Header Bar */}
        <div className="flex items-center justify-between gap-2 border-b border-cyan-500/30 pb-1.5 text-xs text-cyan-300">
          <div className="flex items-center gap-1.5 font-bold">
            <Compass size={14} className="text-cyan-400 animate-spin-slow" />
            <span>{city.name.split(' ')[0]}</span>
          </div>
          <button
            onClick={() => setMinimized(!minimized)}
            className="rounded p-0.5 text-gray-400 hover:bg-cyan-900/50 hover:text-white transition-colors"
            title={minimized ? 'Expand Minimap' : 'Minimize Minimap'}
          >
            {minimized ? <Maximize2 size={13} /> : <Minimize2 size={13} />}
          </button>
        </div>

        {/* Minimap Canvas Body */}
        <AnimatePresence>
          {!minimized && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="mt-2"
            >
              <div className="relative h-36 w-48 overflow-hidden rounded border border-cyan-500/40 bg-[#090b1a]">
                {/* Water Body / River Representation */}
                <div className="absolute inset-x-0 bottom-0 h-10 bg-cyan-950/60 border-t border-cyan-700/40" />
                <div className="absolute top-2 right-2 text-[9px] text-cyan-400/80 italic">{city.region}</div>

                {/* Mountains Representation */}
                <div className="absolute top-1 left-2 flex gap-1">
                  <div className="h-0 w-0 border-x-8 border-b-12 border-x-transparent border-b-gray-700/60" />
                  <div className="h-0 w-0 border-x-6 border-b-10 border-x-transparent border-b-gray-600/60" />
                </div>

                {/* Character Landmarks Dots */}
                <div className="absolute top-10 left-8 h-3 w-3 rounded-full bg-yellow-400/80 animate-ping" title="Stock Exchange / Landmark" />
                <div className="absolute top-16 right-10 h-2.5 w-2.5 rounded-full bg-indigo-400/80" title="Government HQ" />
                <div className="absolute bottom-6 left-14 h-2.5 w-2.5 rounded-full bg-red-400/80" title="Syndicate Hotel" />

                {/* Player Indicator Marker */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center">
                  <div className="h-3 w-3 rounded-full bg-cyan-300 border-2 border-white shadow-lg animate-pulse" />
                  <span className="text-[8px] font-extrabold text-cyan-200 uppercase tracking-tighter">YOU</span>
                </div>
              </div>

              {/* Minimap Legend */}
              <div className="mt-1.5 flex justify-between text-[10px] text-gray-400">
                <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-yellow-400" /> Landmark</span>
                <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-indigo-400" /> Agency HQ</span>
                <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-red-400" /> Crime</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
