import React from 'react'
import { useGameStore } from '../store/useGameStore'

// Map flattening: this used to be a 4-city picker (Tokyo/Kyoto/Osaka/Sapporo)
// with a fare/train-pass system built around switchCity(). There's only one
// city now (see OverworldScene.js's header comment above
// FINANCE_BUILDING_DEFS), so there's nothing left to pick between - the
// picker grid, CITY_METADATA, JAPAN_CITIES import, and the whole
// departingCity/transitProgress boarding animation are gone. What's kept is
// the Station Shop entry point (vehicles & train passes, sourced from
// interactiveLocations.js's `transit_hub`), which was already a separate,
// decoupled sub-modal opened via `onOpenTransitShop` - not part of the
// city-picker itself - so it survives untouched.
export default function TownTravelUI({ onClose, onOpenTransitShop }) {
  const cash = useGameStore((s) => s.cash)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fade-in font-mono">
      {/* Outer wooden-style container panel (CSS gradient, no external art) */}
      <div
        className="relative w-full max-w-lg overflow-y-auto rounded-2xl border-4 border-[#785338] shadow-2xl p-6 text-amber-100 select-none"
        style={{
          background: 'linear-gradient(to bottom, rgba(35, 23, 16, 0.94), rgba(20, 14, 10, 0.97))',
        }}
      >
        {/* Banner Heading */}
        <div className="relative flex flex-col items-center justify-center mb-6 pt-2">
          <div className="w-72 md:w-96 rounded-lg border-2 border-amber-700 bg-[#3a2718] py-3 text-center shadow-lg">
            <h2 className="text-xl md:text-2xl font-black tracking-wider text-amber-200 drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)] uppercase">
              🚆 Central Train Station
            </h2>
            <p className="text-xs text-amber-300/90 font-bold tracking-tight">
              Capital Syndicate Transit Hub
            </p>
          </div>

          {/* Close Button */}
          <button
            onClick={onClose}
            className="absolute top-0 right-0 flex h-8 w-8 items-center justify-center rounded border-2 border-red-500 bg-red-800 font-bold text-red-100 hover:scale-110 hover:bg-red-700 active:scale-95 transition-transform"
            title="Close Station"
          >
            ✕
          </button>
        </div>

        {/* Status & Wallet Ribbon */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6 p-3 bg-[#1e130c]/80 border-2 border-amber-800/80 rounded-xl">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-full border-2 border-amber-600 bg-[#2a1a10] text-lg">
              🧭
            </div>
            <div>
              <div className="text-xs text-amber-400 font-bold uppercase tracking-wider">
                Current Location
              </div>
              <div className="text-sm font-extrabold text-amber-100">🚆 Capital Syndicate</div>
            </div>
          </div>

          <div className="px-3 py-1.5 bg-black/50 rounded-lg border border-amber-700/60 text-xs font-bold">
            Wallet: <span className="text-emerald-400">${Math.round(cash).toLocaleString()}</span>
          </div>
        </div>

        {/* Station Shop - vehicles & train passes (interactiveLocations.js's
            transit_hub). trainStation opens this modal directly rather
            than a generic building interior, so this button is the
            location's only entry point - see WorldScreen.jsx. */}
        {onOpenTransitShop && (
          <div className="flex justify-center mb-4">
            <button
              onClick={onOpenTransitShop}
              className="px-5 py-2 text-xs font-black uppercase text-emerald-100 rounded-lg border-2 border-emerald-500 bg-emerald-800 hover:bg-emerald-700 active:scale-95 transition-all shadow-md"
            >
              🛍️ Visit Station Shop (Vehicles & Passes)
            </button>
          </div>
        )}

        {/* Cozy Footer Info */}
        <div className="text-center text-xs text-amber-400/70 pt-2 border-t border-amber-950">
          💡 Tip: The Station Shop sells vehicles and a lifetime transit pass.
        </div>
      </div>
    </div>
  )
}
