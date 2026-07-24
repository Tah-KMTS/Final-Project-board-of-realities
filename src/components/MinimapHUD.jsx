import React, { useState, useEffect, useRef } from 'react'
import { useGameStore } from '../store/useGameStore'
import { JAPAN_CITIES, getCityById } from '../features/world/japanCities'
import { TITAN_ROUTINES } from '../features/agents/agentMovementEngine'

export default function MinimapHUD({ onOpenGov }) {
  const world2 = useGameStore((s) => s.world2)
  const player = useGameStore((s) => s.player)
  const wantedLevel = useGameStore((s) => s.wantedLevel)
  const day = useGameStore((s) => s.day)

  const [isExpanded, setIsExpanded] = useState(true)
  const [selectedCityId, setSelectedCityId] = useState('tokyo')
  const [hoveredEntity, setHoveredEntity] = useState(null)
  const [filter, setFilter] = useState({
    landmarks: true,
    agents: true,
    government: true,
    syndicates: true,
  })

  const transitState = world2.transitState || { currentCity: 'tokyo', activeVehicle: 'On Foot', speedMultiplier: 1.0 }
  const masterAgents = world2.masterAgents || []
  const activeCityId = transitState.currentCity || selectedCityId
  const activeCity = getCityById(activeCityId)

  // Sync selected city with player's active city initially
  useEffect(() => {
    if (transitState.currentCity) {
      setSelectedCityId(transitState.currentCity)
    }
  }, [transitState.currentCity])

  const toggleFilter = (key) => {
    setFilter((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  // Get active agents in the selected city
  const cityAgents = Object.entries(TITAN_ROUTINES)
    .filter(([_, data]) => data.homeCity === activeCityId)
    .map(([id, data]) => {
      const scheduleStep = data.schedule[day % data.schedule.length] || data.schedule[0]
      return {
        id,
        name: data.name,
        location: scheduleStep.location,
        action: scheduleStep.action,
        x: scheduleStep.x,
        y: scheduleStep.y,
      }
    })

  // Normalize map coordinates (800x500 space to minimap view box)
  const mapWidth = 280
  const mapHeight = 180
  const scaleX = mapWidth / 800
  const scaleY = mapHeight / 500

  return (
    <div className="absolute top-3 right-3 z-30 font-mono text-white select-none">
      {/* Collapsed Radar Badge */}
      {!isExpanded ? (
        <button
          onClick={() => setIsExpanded(true)}
          className="flex items-center gap-2 rounded-lg border-2 border-cyan-400 bg-[#0c0e21]/90 px-3 py-2 shadow-2xl backdrop-blur-md hover:bg-cyan-500 hover:text-black transition-all"
        >
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-cyan-500"></span>
          </span>
          <span className="text-xs font-bold tracking-wider">🗺️ MINIMAP HUD [{activeCity.id.toUpperCase()}]</span>
        </button>
      ) : (
        /* Expanded Minimap Tactical HUD Window */
        <div className="w-[300px] rounded-xl border-2 border-cyan-500/70 bg-[#0c0e28]/95 p-3 shadow-2xl backdrop-blur-md flex flex-col gap-2">
          {/* Header Bar */}
          <div className="flex items-center justify-between border-b border-cyan-500/30 pb-2">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
              </span>
              <h3 className="text-xs font-bold text-cyan-300 tracking-wider">
                TACTICAL RADAR — {activeCity.name.split(' ')[0].toUpperCase()}
              </h3>
            </div>
            <button
              onClick={() => setIsExpanded(false)}
              className="text-xs text-gray-400 hover:text-cyan-300 transition-colors font-bold px-1.5 py-0.5 border border-gray-700 rounded bg-black/40"
              title="Minimize Radar"
            >
              ✕
            </button>
          </div>

          {/* City Selector Tabs */}
          <div className="grid grid-cols-4 gap-1 text-[10px] font-bold">
            {JAPAN_CITIES.map((c) => (
              <button
                key={c.id}
                onClick={() => setSelectedCityId(c.id)}
                className={`py-1 rounded border text-center transition-all ${
                  selectedCityId === c.id
                    ? 'border-cyan-400 bg-cyan-500/30 text-cyan-200 font-extrabold shadow'
                    : 'border-gray-800 bg-[#121535] text-gray-400 hover:text-white'
                }`}
              >
                {c.id.substring(0, 3).toUpperCase()}
              </button>
            ))}
          </div>

          {/* Visual Mini-Map Canvas / Radar SVG Box */}
          <div className="relative h-[180px] w-full rounded-lg border border-cyan-500/40 bg-[#080917] overflow-hidden shadow-inner">
            {/* Grid background effect */}
            <div
              className="absolute inset-0 opacity-20"
              style={{
                backgroundImage:
                  'radial-gradient(circle, #00f2ff 1px, transparent 1px), linear-gradient(to right, #00f2ff11 1px, transparent 1px), linear-gradient(to bottom, #00f2ff11 1px, transparent 1px)',
                backgroundSize: '20px 20px, 20px 20px, 20px 20px',
              }}
            />

            {/* Radar Sweeper Animation */}
            <div className="absolute inset-0 pointer-events-none opacity-30 animate-spin origin-center" style={{ animationDuration: '8s' }}>
              <div className="w-full h-full bg-gradient-to-tr from-transparent via-cyan-500/20 to-transparent" />
            </div>

            {/* Landmarks Pins */}
            {filter.landmarks &&
              activeCity.landmarks.map((poi) => {
                const px = (poi.coordinates.x / 500) * mapWidth
                const py = (poi.coordinates.y / 500) * mapHeight
                const isGov = poi.type === 'government_agency'
                const isSyndicate = poi.type === 'syndicate' || poi.type === 'character_built'

                if (!filter.government && isGov) return null
                if (!filter.syndicates && isSyndicate) return null

                return (
                  <div
                    key={poi.id}
                    className="absolute cursor-pointer transform -translate-x-1/2 -translate-y-1/2 group"
                    style={{ left: `${px}px`, top: `${py}px` }}
                    onMouseEnter={() => setHoveredEntity({ name: poi.name, detail: poi.owner ? `Owner: ${poi.owner}` : poi.type })}
                    onMouseLeave={() => setHoveredEntity(null)}
                  >
                    <div
                      className={`h-2.5 w-2.5 rounded-sm border ${
                        isGov
                          ? 'border-yellow-300 bg-yellow-500'
                          : isSyndicate
                          ? 'border-red-400 bg-red-500'
                          : 'border-cyan-300 bg-cyan-400'
                      } shadow-sm group-hover:scale-150 transition-transform`}
                    />
                  </div>
                )
              })}

            {/* Dynamic NPC / Titan Agents Dots */}
            {filter.agents &&
              cityAgents.map((agent) => {
                const ax = agent.x * scaleX
                const ay = agent.y * scaleY

                return (
                  <div
                    key={agent.id}
                    className="absolute cursor-pointer transform -translate-x-1/2 -translate-y-1/2 group z-10"
                    style={{ left: `${ax}px`, top: `${ay}px` }}
                    onMouseEnter={() => setHoveredEntity({ name: agent.name, detail: `${agent.location} • ${agent.action}` })}
                    onMouseLeave={() => setHoveredEntity(null)}
                  >
                    <div className="h-3 w-3 rounded-full border border-emerald-300 bg-emerald-400 animate-pulse shadow-md group-hover:scale-150 transition-transform" />
                  </div>
                )
              })}

            {/* Player Location Marker (Pulsing ring) */}
            <div className="absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 z-20 pointer-events-none">
              <span className="relative flex h-4 w-4">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-4 w-4 bg-cyan-300 border-2 border-white"></span>
              </span>
            </div>

            {/* Hover Tooltip Overlay */}
            {hoveredEntity && (
              <div className="absolute bottom-1 left-1 right-1 rounded border border-cyan-400/60 bg-black/90 px-2 py-1 text-[10px] z-30 shadow">
                <div className="font-bold text-yellow-300 truncate">{hoveredEntity.name}</div>
                <div className="text-gray-300 truncate">{hoveredEntity.detail}</div>
              </div>
            )}
          </div>

          {/* Quick Stats Bar */}
          <div className="grid grid-cols-2 gap-1 text-[10px] bg-[#121535] p-1.5 rounded border border-cyan-500/20">
            <div>
              <span className="text-gray-400">Vehicle:</span>{' '}
              <strong className="text-yellow-300">{transitState.activeVehicle || 'On Foot'}</strong>
            </div>
            <div className="text-right">
              <span className="text-gray-400">Wanted:</span>{' '}
              <strong className="text-orange-400">{'★'.repeat(wantedLevel) || 'Clean'}</strong>
            </div>
          </div>

          {/* Filter Toggles & Action Row */}
          <div className="flex items-center justify-between text-[10px] pt-1">
            <div className="flex gap-1">
              <button
                onClick={() => toggleFilter('landmarks')}
                className={`px-1.5 py-0.5 rounded border ${
                  filter.landmarks ? 'border-cyan-400 bg-cyan-500/20 text-cyan-300' : 'border-gray-800 text-gray-500'
                }`}
                title="Toggle Landmarks"
              >
                📍 POIs
              </button>
              <button
                onClick={() => toggleFilter('agents')}
                className={`px-1.5 py-0.5 rounded border ${
                  filter.agents ? 'border-emerald-400 bg-emerald-500/20 text-emerald-300' : 'border-gray-800 text-gray-500'
                }`}
                title="Toggle Agents"
              >
                👤 Agents
              </button>
            </div>
            {onOpenGov && (
              <button
                onClick={onOpenGov}
                className="border border-amber-400 bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold text-amber-300 hover:bg-amber-500 hover:text-black transition-all rounded"
              >
                🏛️ Gov Panel
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
