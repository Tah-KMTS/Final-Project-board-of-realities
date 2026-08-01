import { useEffect, useRef, useState } from 'react'
import { difficultyToParams } from './mazeDifficulty'

// Cell Block Corridor (jailMaze segment 0) - a single committed press into a
// sweeping "blind spot." Same sweep-then-commit shape as
// features/finance/TradeMeter.jsx's Buy/Sell timing (a marker oscillates via
// rAF, one button locks in wherever it currently sits), but trimmed to ONE
// press instead of TradeMeter's repeatable aim-then-execute economy - this
// checkpoint only ever gets one shot, pass or fail.
//
// Because the single press IS both the first input and the resolving input,
// there's no separate "started" state to track for the walk-away rule -
// Walk Away stays available right up until commit() fires, then this
// component unmounts (the parent swaps in the result screen).
export default function CellBlockCorridor({ difficulty, onComplete, onWalkAway }) {
  const { zoneWidth, sweepPeriodMs } = difficultyToParams(0, difficulty)
  // Random zone start is picked once per mount (lazy ref init), not
  // re-rolled on every render.
  const zoneStartRef = useRef(Math.random() * (1 - zoneWidth))
  const zoneStart = zoneStartRef.current

  const [markerPos, setMarkerPos] = useState(0)
  const markerPosRef = useRef(0)
  const startTimeRef = useRef(performance.now())
  const rafRef = useRef(null)
  const resolvedRef = useRef(false)

  useEffect(() => {
    const tick = (now) => {
      const elapsed = now - startTimeRef.current
      const pos = (Math.sin((elapsed / sweepPeriodMs) * Math.PI * 2) + 1) / 2
      markerPosRef.current = pos
      setMarkerPos(pos)
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [sweepPeriodMs])

  const commit = () => {
    if (resolvedRef.current) return
    resolvedRef.current = true
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    const pos = markerPosRef.current
    onComplete(pos >= zoneStart && pos <= zoneStart + zoneWidth)
  }

  // Space/Enter double as the commit input so the player isn't forced to
  // click precisely under time pressure.
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.key === ' ' || e.key === 'Enter') && !resolvedRef.current) {
        e.preventDefault()
        commit()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="flex flex-col gap-3">
      <div className="relative h-5 w-full border-2 border-gray-600 bg-[#0f1020]">
        <div
          className="absolute top-0 h-full bg-red-900/60"
          style={{ left: `${zoneStart * 100}%`, width: `${zoneWidth * 100}%` }}
        />
        <div className="absolute top-0 h-full w-[3px] bg-yellow-300" style={{ left: `${markerPos * 100}%` }} />
      </div>
      <p className="text-center text-[10px] uppercase tracking-widest text-gray-500">
        Red band = the guard's blind spot
      </p>
      <button
        onClick={commit}
        className="w-full border-4 border-yellow-400 bg-yellow-500/20 py-2 font-bold uppercase tracking-widest text-yellow-300 hover:bg-yellow-500/40"
      >
        Go (Space)
      </button>
      <button
        onClick={onWalkAway}
        className="w-full border-2 border-gray-500 py-1.5 text-xs uppercase tracking-widest text-gray-400 hover:bg-gray-700"
      >
        Walk Away
      </button>
    </div>
  )
}
