import { useEffect, useRef, useState } from 'react'
import { difficultyToParams } from './mazeDifficulty'

const LEFT_KEYS = new Set(['ArrowLeft', 'a', 'A'])
const RIGHT_KEYS = new Set(['ArrowRight', 'd', 'D'])

function normalizeKey(key) {
  if (LEFT_KEYS.has(key)) return 'L'
  if (RIGHT_KEYS.has(key)) return 'R'
  return null
}

// Final Stretch (jailMaze segment 3) - alternating-key mash. Reuses the
// key-normalization + ref-owns-the-truth architecture from
// features/entertainment/SprintRace.jsx (see that file for the fuller
// original with AI racers and stat-tuned stumble windows); this checkpoint
// only needs the core "count clean L/R alternations before time runs out"
// loop, since the whole difficulty knob here is already
// targetAlternations/timeBudgetMs, derived upstream via
// getMazeSegmentDifficulty from AGI/streetwise/effective Luck/wantedLevel.
export default function FinalStretch({ difficulty, onComplete, onWalkAway }) {
  const { targetAlternations, timeBudgetMs } = difficultyToParams(3, difficulty)
  const countRef = useRef(0)
  const lastKeyRef = useRef(null)
  const resolvedRef = useRef(false)
  const startedRef = useRef(false)
  const startTimeRef = useRef(null)
  const rafRef = useRef(null)
  const [count, setCount] = useState(0)
  const [msLeft, setMsLeft] = useState(timeBudgetMs)
  const [started, setStarted] = useState(false)

  const finish = (success) => {
    if (resolvedRef.current) return
    resolvedRef.current = true
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    onComplete(success)
  }

  useEffect(() => {
    // The clock only starts ticking once the player commits their first
    // press (see handleKeyDown below) - not on mount - so standing on the
    // Walk Away option doesn't silently burn the time budget.
    const tickClock = () => {
      if (resolvedRef.current) return
      const elapsed = performance.now() - startTimeRef.current
      const remaining = timeBudgetMs - elapsed
      if (remaining <= 0) {
        setMsLeft(0)
        finish(false)
        return
      }
      setMsLeft(remaining)
      rafRef.current = requestAnimationFrame(tickClock)
    }

    const handleKeyDown = (e) => {
      const dir = normalizeKey(e.key)
      if (!dir || resolvedRef.current) return
      e.preventDefault()
      if (e.repeat) return

      if (!startedRef.current) {
        startedRef.current = true
        setStarted(true)
        startTimeRef.current = performance.now()
        rafRef.current = requestAnimationFrame(tickClock)
      }

      // Same key twice in a row isn't a fail here (unlike SprintRace's
      // stumble penalty) - it just doesn't advance the count, so mashing
      // one key alone can never clear the checkpoint.
      if (dir === lastKeyRef.current) return
      lastKeyRef.current = dir
      const next = countRef.current + 1
      countRef.current = next
      setCount(next)
      if (next >= targetAlternations) finish(true)
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const giveUp = () => {
    if (started) finish(false)
    else onWalkAway()
  }

  const pct = Math.max(0, Math.min(1, msLeft / timeBudgetMs))

  return (
    <div className="flex flex-col gap-3">
      <div className="relative h-3 w-full border-2 border-gray-600 bg-[#0f1020]">
        <div className="h-full bg-orange-500" style={{ width: `${pct * 100}%` }} />
      </div>
      <p className="text-center text-2xl font-black tracking-widest text-orange-300">
        {count} / {targetAlternations}
      </p>
      <p className="text-center text-[10px] uppercase tracking-widest text-gray-500">
        Mash Left/Right (or A/D) - clean alternations only
      </p>
      <button
        onClick={giveUp}
        className="w-full border-2 border-gray-500 py-1.5 text-xs uppercase tracking-widest text-gray-400 hover:bg-gray-700"
      >
        {started ? 'Give Up' : 'Walk Away'}
      </button>
    </div>
  )
}
