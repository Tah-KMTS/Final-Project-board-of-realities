export default function SwimmingStatusOverlay({ fatigue = 25, statusMsg = '', onExitWater }) {
  const isDanger = fatigue >= 80

  return (
    <div className="fixed bottom-12 left-1/2 -translate-x-1/2 z-40 font-mono">
      <div className={`rounded-xl border-2 p-3 shadow-2xl backdrop-blur-md w-80 text-white transition-all ${
        isDanger ? 'bg-red-950/90 border-red-500 shadow-[0_0_25px_rgba(239,68,68,0.6)] animate-pulse' : 'bg-cyan-950/90 border-cyan-400'
      }`}>
        {/* Header */}
        <div className="flex items-center justify-between border-b border-cyan-500/30 pb-1.5 text-xs">
          <span className="font-extrabold flex items-center gap-1.5 text-cyan-300">
            🏊 SWIMMING FATIGUE GAUGE
          </span>
          <span className="text-[10px] font-bold text-gray-300">Stat: Endurance Active</span>
        </div>

        {/* Fatigue Progress Bar */}
        <div className="my-2">
          <div className="flex justify-between text-[11px] font-bold mb-1">
            <span className="text-gray-300">Fatigue Level:</span>
            <span className={isDanger ? 'text-red-400 font-black' : 'text-cyan-300'}>{fatigue.toFixed(0)}%</span>
          </div>
          <div className="h-3 w-full rounded-full bg-black/60 overflow-hidden border border-cyan-500/40 p-0.5">
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                fatigue >= 80 ? 'bg-red-500' : fatigue >= 50 ? 'bg-yellow-400' : 'bg-cyan-400'
              }`}
              style={{ width: `${Math.min(100, fatigue)}%` }}
            />
          </div>
        </div>

        {/* Status Alert Message */}
        <div className="text-[11px] font-semibold text-center italic text-cyan-200 mt-1">
          {statusMsg}
        </div>

        {/* Exit Water / Rest Button */}
        <button
          onClick={onExitWater}
          className="mt-2.5 w-full rounded border border-cyan-400 bg-cyan-950 py-1 text-xs font-bold text-cyan-300 hover:bg-cyan-500 hover:text-black transition-all"
        >
          🦶 Swim to Shore & Rest
        </button>
      </div>
    </div>
  )
}
