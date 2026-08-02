import { useEffect, useRef, useState } from 'react'
import { difficultyToParams } from './mazeDifficulty'

const KEY_GLYPH = { ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→' }
const KEYS = Object.keys(KEY_GLYPH)

function buildSequence(length) {
  return Array.from({ length }, () => KEYS[Math.floor(Math.random() * KEYS.length)])
}

// Exercise Yard (jailMaze segment 1) - arrow-key sequence QTE. stepRef is
// the authoritative progress pointer, bumped synchronously inside the
// keydown handler against performance.now()-armed timeouts (same reasoning
// features/entertainment/SprintRace.jsx documents for judging input
// immediately rather than through a setState round-trip); stepIndex state
// only exists to repaint which glyph is currently highlighted.
export default function ExerciseYard({ difficulty, onComplete, onWalkAway }) {
  const { length, perPressWindowMs } = difficultyToParams(1, difficulty)
  const sequenceRef = useRef(null)
  if (sequenceRef.current === null) sequenceRef.current = buildSequence(length)
  const sequence = sequenceRef.current

  const stepRef = useRef(0)
  const resolvedRef = useRef(false)
  const timeoutRef = useRef(null)
  const [stepIndex, setStepIndex] = useState(0)
  const [started, setStarted] = useState(false)

  const finish = (success) => {
    if (resolvedRef.current) return
    resolvedRef.current = true
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    onComplete(success)
  }

  useEffect(() => {
    const armWindow = () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      // A missed window (no press at all before perPressWindowMs elapses)
      // fails the checkpoint exactly like a wrong key - there's no partial
      // credit for a stalled sequence, and this is also what stops the
      // checkpoint from ever hanging open indefinitely.
      timeoutRef.current = setTimeout(() => finish(false), perPressWindowMs)
    }
    armWindow()

    const handleKeyDown = (e) => {
      if (resolvedRef.current || !KEYS.includes(e.key)) return
      e.preventDefault()
      if (e.repeat) return
      setStarted(true)
      if (e.key !== sequence[stepRef.current]) {
        finish(false)
        return
      }
      stepRef.current += 1
      if (stepRef.current >= sequence.length) {
        finish(true)
        return
      }
      setStepIndex(stepRef.current)
      armWindow()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const giveUp = () => {
    // Once the first press has registered there's no free walk-away left -
    // giving up now runs through the same finish(false) path a missed
    // window or wrong key would (no cost-free retries).
    if (started) finish(false)
    else onWalkAway()
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-center gap-2">
        {sequence.map((key, i) => (
          <span
            key={i}
            className={`flex h-10 w-10 items-center justify-center border-2 text-xl font-bold ${
              i < stepIndex
                ? 'border-green-500 bg-green-900/30 text-green-400'
                : i === stepIndex
                ? 'animate-pulse border-yellow-400 bg-yellow-900/30 text-yellow-300'
                : 'border-gray-600 bg-[#0f1020] text-gray-500'
            }`}
          >
            {KEY_GLYPH[key]}
          </span>
        ))}
      </div>
      <p className="text-center text-xs uppercase tracking-widest text-gray-500">
        Match the highlighted arrow before the window closes
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
