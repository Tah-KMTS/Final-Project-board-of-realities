import { useEffect, useRef, useState } from 'react'
import { difficultyToParams } from './mazeDifficulty'

// Oscillation cadence isn't part of the difficulty spec for this segment
// (only the target band width scales with `d`) - reused from
// features/finance/TradeMeter.jsx's SWEEP_PERIOD_MS for a consistent feel
// with the game's other meter minigame.
const SWEEP_PERIOD_MS = 1600
// Defensive cap, not part of the difficulty math: segments 1 and 3 both
// have an explicit time budget that fails the checkpoint on its own, but
// this hold-and-release segment doesn't per spec. Without a ceiling, an
// indefinitely held key/button would hang the checkpoint open forever.
// Past this, the hold auto-releases as a fail.
const MAX_HOLD_MS = 4000

// Fence Line (jailMaze segment 2) - hold-and-release power meter. Holding
// starts the marker oscillating; releasing locks in wherever it currently
// sits and scores it against the target band.
export default function FenceLine({ difficulty, onComplete, onWalkAway }) {
  const { zoneWidth } = difficultyToParams(2, difficulty)
  const zoneStartRef = useRef(Math.random() * (1 - zoneWidth))
  const zoneStart = zoneStartRef.current

  const [holding, setHolding] = useState(false)
  const [markerPos, setMarkerPos] = useState(0)
  const markerPosRef = useRef(0)
  const startTimeRef = useRef(0)
  const rafRef = useRef(null)
  const resolvedRef = useRef(false)
  const holdingRef = useRef(false)

  const stopLoop = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    rafRef.current = null
  }

  const finish = (success) => {
    if (resolvedRef.current) return
    resolvedRef.current = true
    holdingRef.current = false
    stopLoop()
    onComplete(success)
  }

  const release = () => {
    if (!holdingRef.current || resolvedRef.current) return
    holdingRef.current = false
    setHolding(false)
    stopLoop()
    const pos = markerPosRef.current
    finish(pos >= zoneStart && pos <= zoneStart + zoneWidth)
  }

  const startHold = () => {
    if (holdingRef.current || resolvedRef.current) return
    holdingRef.current = true
    setHolding(true)
    startTimeRef.current = performance.now()
    const tick = (now) => {
      const elapsed = now - startTimeRef.current
      const pos = (Math.sin((elapsed / SWEEP_PERIOD_MS) * Math.PI * 2) + 1) / 2
      markerPosRef.current = pos
      setMarkerPos(pos)
      if (elapsed >= MAX_HOLD_MS) {
        holdingRef.current = false
        setHolding(false)
        stopLoop()
        finish(false)
        return
      }
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
  }

  // Space bar doubles as the hold control (keydown starts, keyup releases)
  // so this doesn't require a mouse.
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key !== ' ' || resolvedRef.current || e.repeat) return
      e.preventDefault()
      startHold()
    }
    const handleKeyUp = (e) => {
      if (e.key !== ' ') return
      e.preventDefault()
      release()
    }
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
      stopLoop()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const giveUp = () => {
    // Mid-hold, giving up releases-as-a-fail rather than a free walk-away -
    // the hold starting IS the first input for this segment.
    if (holdingRef.current) {
      finish(false)
      return
    }
    onWalkAway()
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="relative h-5 w-full border-2 border-gray-600 bg-[#0f1020]">
        <div
          className="absolute top-0 h-full bg-green-800/60"
          style={{ left: `${zoneStart * 100}%`, width: `${zoneWidth * 100}%` }}
        />
        {holding && (
          <div className="absolute top-0 h-full w-[3px] bg-yellow-300" style={{ left: `${markerPos * 100}%` }} />
        )}
      </div>
      <p className="text-center text-xs uppercase tracking-widest text-gray-500">
        Hold to climb, release inside the green band
      </p>
      <button
        onMouseDown={startHold}
        onMouseUp={release}
        onMouseLeave={release}
        onTouchStart={(e) => { e.preventDefault(); startHold() }}
        onTouchEnd={(e) => { e.preventDefault(); release() }}
        className="w-full select-none border-4 border-green-400 bg-green-500/20 py-2 font-bold uppercase tracking-widest text-green-300 hover:bg-green-500/40"
      >
        {holding ? 'Release!' : 'Hold (Space)'}
      </button>
      <button
        onClick={giveUp}
        className="w-full border-2 border-gray-500 py-1.5 text-xs uppercase tracking-widest text-gray-400 hover:bg-gray-700"
      >
        {holding ? 'Give Up' : 'Walk Away'}
      </button>
    </div>
  )
}
