import React, { useState } from 'react'
import { useGameStore } from '../store/useGameStore'
import { JAPAN_CITIES, getCityById } from '../features/world/japanCities'

// Kenney UI Pack Adventure Asset Paths
const ASSETS = {
  panelBrown: '/assets/packs/kenney_ui-pack-adventure/PNG/Default/panel_brown.png',
  panelDark: '/assets/packs/kenney_ui-pack-adventure/PNG/Default/panel_brown_dark.png',
  panelBorder: '/assets/packs/kenney_ui-pack-adventure/PNG/Default/panel_border_brown.png',
  panelPaper: '/assets/packs/kenney_ui-pack-adventure/PNG/Default/panel_grid_paper.png',
  bannerHanging: '/assets/packs/kenney_ui-pack-adventure/PNG/Default/banner_hanging.png',
  buttonBrown: '/assets/packs/kenney_ui-pack-adventure/PNG/Default/button_brown.png',
  buttonGrey: '/assets/packs/kenney_ui-pack-adventure/PNG/Default/button_grey.png',
  buttonRedClose: '/assets/packs/kenney_ui-pack-adventure/PNG/Default/button_red_close.png',
  compass: '/assets/packs/kenney_ui-pack-adventure/PNG/Default/minimap_compass_toon_n.png',
  star: '/assets/packs/kenney_ui-pack-adventure/PNG/Default/minimap_icon_star_yellow.png',
  ring: '/assets/packs/kenney_ui-pack-adventure/PNG/Default/minimap_ring_brown.png',
  arrow: '/assets/packs/kenney_ui-pack-adventure/PNG/Default/minimap_arrow_a.png',
  progressGreen: '/assets/packs/kenney_ui-pack-adventure/PNG/Default/progress_green.png',
}

const CITY_METADATA = {
  tokyo: {
    emoji: '🏛️',
    tagline: 'Luxury Financial Capital & Tech Hub',
    description: 'A sprawling neon metropolis where wall street tycoons and high-tech corporate giants build glass skyscrapers along Tokyo Bay.',
    ticketPrice: 50,
    accentColor: 'from-amber-600/30 to-amber-900/40',
    borderColor: 'border-amber-500/60',
    badgeBg: 'bg-amber-950/80 text-amber-300 border-amber-600',
  },
  kyoto: {
    emoji: '⛩️',
    tagline: 'Historical & Cultural Sanctuary',
    description: 'Serene bamboo forests, ancient Shinto pagodas, and traditional machiya tea houses framed by the Higashiyama mountains.',
    ticketPrice: 50,
    accentColor: 'from-rose-600/30 to-rose-900/40',
    borderColor: 'border-rose-500/60',
    badgeBg: 'bg-rose-950/80 text-rose-300 border-rose-600',
  },
  osaka: {
    emoji: '🐙',
    tagline: 'Merchant Quarter & Underground Nightlife',
    description: 'Bustling merchant arcades along Dotonbori Canal, lively food stalls, secret speakeasies, and underground dock vaults.',
    ticketPrice: 50,
    accentColor: 'from-cyan-600/30 to-blue-900/40',
    borderColor: 'border-cyan-500/60',
    badgeBg: 'bg-cyan-950/80 text-cyan-300 border-cyan-600',
  },
  sapporo: {
    emoji: '❄️',
    tagline: 'Northern Alpine & Industrial Frontier',
    description: 'Majestic snow-capped mountain ranges, vast mega assembly steel complexes, and pristine northern wilderness.',
    ticketPrice: 50,
    accentColor: 'from-sky-600/30 to-indigo-900/40',
    borderColor: 'border-sky-400/60',
    badgeBg: 'bg-sky-950/80 text-sky-300 border-sky-400',
  },
}

export default function TownTravelUI({ onClose, onTravel }) {
  const currentCityId = useGameStore((s) => s.currentCityId || 'tokyo')
  const switchCity = useGameStore((s) => s.switchCity)
  const cash = useGameStore((s) => s.cash)
  const addCash = useGameStore((s) => s.addCash)
  const transitState = useGameStore((s) => s.world2?.transitState)

  const [departingCity, setDepartingCity] = useState(null)
  const [transitProgress, setTransitProgress] = useState(0)

  const currentCity = getCityById(currentCityId)
  const hasPass = transitState?.hasTrainPass || false

  const handleTravel = (targetCityId) => {
    if (targetCityId === currentCityId) return

    const cityMeta = CITY_METADATA[targetCityId] || CITY_METADATA.tokyo
    const fare = hasPass ? 0 : cityMeta.ticketPrice

    if (cash < fare) {
      alert(`Insufficient funds! You need $${fare} for an Express Train ticket to ${targetCityId.toUpperCase()}.`)
      return
    }

    setDepartingCity(targetCityId)
    setTransitProgress(10)

    // Simulate train ride progress animation
    let p = 10
    const interval = setInterval(() => {
      p += 30
      if (p >= 100) {
        setTransitProgress(100)
        clearInterval(interval)
        setTimeout(() => {
          if (fare > 0) {
            addCash(-fare)
          }
          switchCity(targetCityId)
          if (onTravel) {
            onTravel(targetCityId)
          }
          if (onClose) {
            onClose()
          }
        }, 600)
      } else {
        setTransitProgress(p)
      }
    }, 300)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fade-in font-mono">
      {/* Cozy Outer Kenney UI Wooden Container Panel */}
      <div
        className="relative w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-2xl border-4 border-[#785338] shadow-2xl p-6 text-amber-100 select-none"
        style={{
          backgroundImage: `linear-gradient(to bottom, rgba(35, 23, 16, 0.94), rgba(20, 14, 10, 0.97)), url(${ASSETS.panelDark})`,
          backgroundSize: 'cover',
        }}
      >
        {/* Kenney UI Banner Heading */}
        <div className="relative flex flex-col items-center justify-center mb-6 pt-2">
          <img
            src={ASSETS.bannerHanging}
            alt="Travel Banner"
            className="w-72 md:w-96 h-auto drop-shadow-lg"
          />
          <div className="absolute top-4 flex flex-col items-center text-center">
            <h2 className="text-xl md:text-2xl font-black tracking-wider text-amber-200 drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)] uppercase">
              🚆 Japan Express Station
            </h2>
            <p className="text-xs text-amber-300/90 font-bold tracking-tight">
              Cozy Shinkansen Travel Line
            </p>
          </div>

          {/* Close Button */}
          <button
            onClick={onClose}
            className="absolute top-0 right-0 p-1 hover:scale-110 active:scale-95 transition-transform"
            title="Close Station"
          >
            <img src={ASSETS.buttonRedClose} alt="Close" className="w-8 h-8 drop-shadow" />
          </button>
        </div>

        {/* Departure Transition Overlay */}
        {departingCity ? (
          <div className="my-12 flex flex-col items-center justify-center p-8 bg-[#2a1a10]/90 border-2 border-amber-600/60 rounded-xl shadow-inner text-center">
            <div className="relative mb-6">
              <img src={ASSETS.ring} alt="Ring" className="w-24 h-24 animate-spin-slow" />
              <span className="absolute inset-0 flex items-center justify-center text-4xl">
                🚅
              </span>
            </div>
            <h3 className="text-2xl font-bold text-amber-200 mb-2">
              Boarding Express Train to {CITY_METADATA[departingCity]?.emoji} {departingCity.toUpperCase()}...
            </h3>
            <p className="text-sm text-amber-300/80 mb-6 italic">
              "Enjoy your comfortable scenic journey across Japan!"
            </p>

            {/* Cozy Kenney Progress Bar */}
            <div className="w-full max-w-md h-6 bg-black/60 rounded-full border-2 border-amber-700 p-1 relative overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-emerald-600 to-green-400 rounded-full transition-all duration-300 ease-out flex items-center justify-end pr-2 text-xs font-bold text-black"
                style={{ width: `${transitProgress}%` }}
              >
                {transitProgress}%
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* Status & Wallet Ribbon */}
            <div className="flex flex-wrap items-center justify-between gap-3 mb-6 p-3 bg-[#1e130c]/80 border-2 border-amber-800/80 rounded-xl">
              <div className="flex items-center gap-3">
                <div className="relative flex items-center justify-center w-10 h-10">
                  <img src={ASSETS.ring} alt="Ring" className="absolute w-10 h-10" />
                  <img src={ASSETS.compass} alt="Compass" className="w-6 h-6 z-10" />
                </div>
                <div>
                  <div className="text-xs text-amber-400 font-bold uppercase tracking-wider">
                    Current Location
                  </div>
                  <div className="text-sm font-extrabold text-amber-100">
                    {CITY_METADATA[currentCityId]?.emoji} {currentCity?.name}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-4 text-xs font-bold">
                <div className="px-3 py-1.5 bg-black/50 rounded-lg border border-amber-700/60">
                  Wallet: <span className="text-emerald-400">${Math.round(cash).toLocaleString()}</span>
                </div>
                <div className="px-3 py-1.5 bg-black/50 rounded-lg border border-amber-700/60">
                  Ticket Fare: <span className="text-amber-300">{hasPass ? 'FREE (Express Pass)' : '$50 / trip'}</span>
                </div>
              </div>
            </div>

            {/* City Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              {JAPAN_CITIES.map((city) => {
                const meta = CITY_METADATA[city.id] || CITY_METADATA.tokyo
                const isCurrent = city.id === currentCityId
                const fare = hasPass ? 0 : meta.ticketPrice

                return (
                  <div
                    key={city.id}
                    className={`relative flex flex-col justify-between p-4 rounded-xl border-2 transition-all duration-200 bg-gradient-to-br ${meta.accentColor} ${
                      isCurrent
                        ? 'border-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.3)] ring-2 ring-emerald-400/50'
                        : `${meta.borderColor} hover:border-amber-300 hover:scale-[1.01]`
                    }`}
                  >
                    <div>
                      {/* Card Header */}
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div>
                          <span className="text-2xl mr-2">{meta.emoji}</span>
                          <span className="text-base font-bold text-amber-100">
                            {city.id.toUpperCase()}
                          </span>
                          <div className="text-xs text-amber-300/80 italic font-semibold">
                            {meta.tagline}
                          </div>
                        </div>

                        {isCurrent && (
                          <span className="flex items-center gap-1 text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-900/90 text-emerald-300 border border-emerald-500 shadow">
                            <img src={ASSETS.star} alt="Current" className="w-3.5 h-3.5" />
                            Here
                          </span>
                        )}
                      </div>

                      {/* Description */}
                      <p className="text-xs text-amber-200/90 leading-relaxed mb-3">
                        {meta.description}
                      </p>

                      {/* Details Badge list */}
                      <div className="space-y-1 mb-4 text-[11px]">
                        <div className="flex items-center gap-1.5 text-amber-300/90">
                          <span className="text-amber-400">🏞️ Topography:</span>
                          <span className="truncate">{city.topography}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-amber-300/90">
                          <span className="text-amber-400">🏛️ Landmarks:</span>
                          <span className="truncate">
                            {city.landmarks.map((l) => l.name).slice(0, 2).join(', ')}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 text-amber-300/90">
                          <span className="text-amber-400">👥 Residents:</span>
                          <span className="truncate">{city.primaryResidents.slice(0, 3).join(', ')}</span>
                        </div>
                      </div>
                    </div>

                    {/* Action Button */}
                    <div className="pt-2 border-t border-amber-900/40 flex items-center justify-between">
                      <span className="text-xs font-semibold text-amber-300/80">
                        {isCurrent ? 'Station Platform Active' : fare === 0 ? 'Pass Travel: $0' : `Fare: $${fare}`}
                      </span>

                      {isCurrent ? (
                        <button
                          disabled
                          className="px-4 py-1.5 text-xs font-bold rounded bg-emerald-950/80 text-emerald-400 border border-emerald-600/60 cursor-default"
                        >
                          ✓ Current City
                        </button>
                      ) : (
                        <button
                          onClick={() => handleTravel(city.id)}
                          className="relative group px-5 py-2 text-xs font-black uppercase text-amber-100 rounded-lg overflow-hidden border-2 border-amber-500 bg-amber-800 hover:bg-amber-700 active:scale-95 transition-all shadow-md flex items-center gap-1.5"
                          style={{
                            backgroundImage: `url(${ASSETS.buttonBrown})`,
                            backgroundSize: 'cover',
                          }}
                        >
                          <span>Board Express</span>
                          <span className="group-hover:translate-x-1 transition-transform">🚅</span>
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Cozy Footer Info */}
            <div className="text-center text-[11px] text-amber-400/70 pt-2 border-t border-amber-950">
              💡 Tip: Traveling between cities updates your active environment, local businesses, government agencies, and character encounters.
            </div>
          </>
        )}
      </div>
    </div>
  )
}
