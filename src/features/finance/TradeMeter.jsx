import { useEffect, useRef, useState } from 'react'
import { useGameStore } from '../../store/useGameStore'

const SWEEP_PERIOD_MS = 1600
const ZONE_WIDTH = 0.2

function randomZone() {
  return { start: Math.random() * (1 - ZONE_WIDTH) }
}

// Discount/bonus scales with how centered the hit was: full width = smallest
// edge-of-zone bonus, dead center = the biggest bonus. No fail state -
// missing the zone entirely just executes at plain market price.
function multiplierFor(direction, pos, zone) {
  const zoneEnd = zone.start + ZONE_WIDTH
  if (pos < zone.start || pos > zoneEnd) return 1
  const center = zone.start + ZONE_WIDTH / 2
  const centering = 1 - Math.abs(pos - center) / (ZONE_WIDTH / 2)
  return direction === 'buy' ? 0.85 - 0.15 * centering : 1.15 + 0.15 * centering
}

export default function TradeMeter({ stock, holding }) {
  const buyStock = useGameStore((s) => s.buyStock)
  const sellStock = useGameStore((s) => s.sellStock)
  const [qty, setQty] = useState(1)
  const [direction, setDirection] = useState(null) // null | 'buy' | 'sell'
  const [zone, setZone] = useState(null)
  const [markerPos, setMarkerPos] = useState(0.5)
  const [resultText, setResultText] = useState('')
  const markerPosRef = useRef(0.5)
  const startTimeRef = useRef(0)
  const rafRef = useRef(null)

  useEffect(() => {
    if (!direction) return
    const tick = (now) => {
      const elapsed = now - startTimeRef.current
      const pos = (Math.sin((elapsed / SWEEP_PERIOD_MS) * Math.PI * 2) + 1) / 2
      markerPosRef.current = pos
      setMarkerPos(pos)
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [direction])

  const startAiming = (dir) => {
    setResultText('')
    setZone(randomZone())
    startTimeRef.current = performance.now()
    setDirection(dir)
  }

  const execute = () => {
    const pos = markerPosRef.current
    const multiplier = multiplierFor(direction, pos, zone)
    const hit = multiplier !== 1

    if (direction === 'buy') {
      const ok = buyStock(stock.ticker, qty, multiplier)
      setResultText(
        !ok ? 'Not enough cash for that trade.' : hit ? `Filled at a ${Math.round((1 - multiplier) * 100)}% discount!` : 'Filled at market price.'
      )
    } else {
      const ok = sellStock(stock.ticker, qty, multiplier)
      setResultText(
        !ok ? "You don't have enough shares." : hit ? `Filled at a ${Math.round((multiplier - 1) * 100)}% bonus!` : 'Filled at market price.'
      )
    }
    setDirection(null)
    setZone(null)
  }

  const zoneStartPct = zone ? zone.start * 100 : 0
  const canSell = holding && holding.shares > 0

  return (
    <div className="mb-2 border-b border-gray-700 pb-2 text-xs">
      <div className="mb-1 flex items-center justify-between">
        <div>
          <p className="font-bold">{stock.name} ({stock.ticker})</p>
          <p className="text-gray-400">
            ${stock.price.toFixed(2)}/share
            {holding ? ` • You own ${holding.shares.toFixed(2)}` : ''}
          </p>
        </div>
        <input
          type="number"
          min="1"
          value={qty}
          onChange={(e) => setQty(Math.max(1, Math.floor(Number(e.target.value)) || 1))}
          className="w-14 border border-gray-600 bg-black px-1 py-0.5 text-white"
        />
      </div>

      {direction && (
        <div className="relative mb-1 h-4 w-full border border-gray-600 bg-black">
          <div
            className="absolute top-0 h-full bg-green-700/50"
            style={{ left: `${zoneStartPct}%`, width: `${ZONE_WIDTH * 100}%` }}
          />
          <div className="absolute top-0 h-full w-[3px] bg-yellow-300" style={{ left: `${markerPos * 100}%` }} />
        </div>
      )}

      <div className="flex items-center gap-1">
        {!direction ? (
          <>
            <button
              onClick={() => startAiming('buy')}
              className="border border-green-400 px-2 py-1 text-green-400 hover:bg-green-400 hover:text-black"
            >
              Buy
            </button>
            <button
              onClick={() => startAiming('sell')}
              disabled={!canSell}
              className="border border-red-400 px-2 py-1 text-red-400 hover:bg-red-400 hover:text-black disabled:opacity-30"
            >
              Sell
            </button>
          </>
        ) : (
          <button
            onClick={execute}
            className="border border-yellow-300 px-3 py-1 font-bold text-yellow-300 hover:bg-yellow-300 hover:text-black"
          >
            Execute {direction === 'buy' ? 'Buy' : 'Sell'}!
          </button>
        )}
        {resultText && <span className="text-gray-300">{resultText}</span>}
      </div>
    </div>
  )
}
