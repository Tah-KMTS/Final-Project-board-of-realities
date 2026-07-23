import { useEffect, useRef, useState } from 'react'
import { useGameStore } from '../../store/useGameStore'
import { rollCollectible } from './collectibles'

const PLAY_COST = 8
const SWEEP_PERIOD_MS = 1400
const GRIP_ZONE = { start: 0.4, width: 0.2 } // fixed center zone - stopping inside it is a "good grab"

const RARITY_COLOR = {
  common: 'text-gray-300',
  uncommon: 'text-green-300',
  rare: 'text-cyan-300',
  legendary: 'text-yellow-300',
}

// Timing-based grab: a claw-strength meter sweeps left-right, the player
// stops it with a click, and how close the stop is to the grip zone's
// center determines `grabQuality` (0..1), which reweights the collectible
// rarity odds toward the better table in collectibles.js. Simplification:
// this is a probability-weighted grab, not a physics-simulated claw arm.
export default function ClawMachine() {
  const cash = useGameStore((s) => s.cash)
  const addCash = useGameStore((s) => s.addCash)
  const addItem = useGameStore((s) => s.addItem)

  const [sweeping, setSweeping] = useState(false)
  const [markerPos, setMarkerPos] = useState(0)
  const [prize, setPrize] = useState(null)
  const markerPosRef = useRef(0)
  const startTimeRef = useRef(0)
  const rafRef = useRef(null)

  useEffect(() => {
    if (!sweeping) return
    const tick = (now) => {
      const elapsed = now - startTimeRef.current
      const pos = (Math.sin((elapsed / SWEEP_PERIOD_MS) * Math.PI * 2) + 1) / 2
      markerPosRef.current = pos
      setMarkerPos(pos)
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [sweeping])

  const startGrab = () => {
    if (cash < PLAY_COST) return
    addCash(-PLAY_COST)
    setPrize(null)
    startTimeRef.current = performance.now()
    setSweeping(true)
  }

  const stopGrab = () => {
    setSweeping(false)
    const pos = markerPosRef.current
    const zoneEnd = GRIP_ZONE.start + GRIP_ZONE.width
    let grabQuality = 0
    if (pos >= GRIP_ZONE.start && pos <= zoneEnd) {
      const center = GRIP_ZONE.start + GRIP_ZONE.width / 2
      grabQuality = 1 - Math.abs(pos - center) / (GRIP_ZONE.width / 2)
    }
    const item = rollCollectible(grabQuality)
    addItem(item)
    setPrize(item)
  }

  return (
    <div className="border-2 border-cyan-400 bg-[#0a1622] p-4 text-sm">
      <p className="mb-3 text-xs text-gray-400">
        Time the claw's grip strength - land it in the green zone for better odds at a rare figure. ${PLAY_COST}/play.
      </p>

      <div className="relative mb-3 h-5 w-full border border-gray-600 bg-black">
        <div
          className="absolute top-0 h-full bg-green-700/50"
          style={{ left: `${GRIP_ZONE.start * 100}%`, width: `${GRIP_ZONE.width * 100}%` }}
        />
        {sweeping && <div className="absolute top-0 h-full w-[3px] bg-yellow-300" style={{ left: `${markerPos * 100}%` }} />}
      </div>

      {!sweeping ? (
        <button
          onClick={startGrab}
          disabled={cash < PLAY_COST}
          className="border-2 border-cyan-400 px-3 py-1 font-bold text-cyan-300 hover:bg-cyan-400 hover:text-black disabled:opacity-30"
        >
          Insert Token (${PLAY_COST})
        </button>
      ) : (
        <button onClick={stopGrab} className="border-2 border-yellow-300 px-3 py-1 font-bold text-yellow-300 hover:bg-yellow-300 hover:text-black">
          Grab!
        </button>
      )}

      {prize && (
        <p className="mt-3">
          You won: <span className={`font-bold ${RARITY_COLOR[prize.rarity]}`}>{prize.name}</span>{' '}
          <span className="text-gray-500">({prize.rarity}, est. ${prize.sellValue})</span>
        </p>
      )}
    </div>
  )
}
