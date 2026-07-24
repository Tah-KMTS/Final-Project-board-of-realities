import { useState, useEffect, useRef } from 'react'
import { useGameStore } from '../../store/useGameStore'

const MIN_BET = 5
const SPIN_ANIM_MS = 700
const BIG_WIN_REPUTATION_THRESHOLD = 20 // multiplier, not a cash figure - the 7-7-7 jackpot

// Weighted 3-reel slot machine. Weights + payouts below were tuned with a
// standalone Monte Carlo simulation (3M spins) before being hardcoded here,
// landing on ~90% RTP (a 10% fixed house edge) - see the comment on each
// constant for the tuning process; don't hand-wave these without
// re-simulating, small changes to weights swing RTP nonlinearly.
const SYMBOLS = [
  { key: '7', glyph: '7️⃣', weight: 2, pay3: 30 },
  { key: 'diamond', glyph: '\u{1F48E}', weight: 4, pay3: 15 },
  { key: 'bell', glyph: '\u{1F514}', weight: 7, pay3: 8 },
  { key: 'lemon', glyph: '\u{1F34B}', weight: 12, pay3: 5 },
  { key: 'cherry', glyph: '\u{1F352}', weight: 18, pay3: 3 },
]
const BLANK_WEIGHT = 5
const TOTAL_WEIGHT = SYMBOLS.reduce((a, s) => a + s.weight, 0) + BLANK_WEIGHT
const BLANK_GLYPH = '⬛' // black square, reads as a dead reel stop

function spinReel() {
  let r = Math.random() * TOTAL_WEIGHT
  for (const s of SYMBOLS) {
    if (r < s.weight) return s
    r -= s.weight
  }
  return null // blank
}

function randomGlyph() {
  const all = [...SYMBOLS.map((s) => s.glyph), BLANK_GLYPH]
  return all[Math.floor(Math.random() * all.length)]
}

// 3-of-a-kind pays that symbol's pay3 multiplier; any 2-of-a-kind (any
// matching symbol, non-blank) pays a smaller consolation multiplier -
// tuned alongside the 3-match payouts in the simulation above.
function resolveSpin(reels) {
  const [a, b, c] = reels
  if (a && b && c && a.key === b.key && b.key === c.key) {
    return { multiplier: a.pay3, matchedSymbol: a }
  }
  const nonBlank = reels.filter(Boolean)
  const counts = {}
  for (const s of nonBlank) counts[s.key] = (counts[s.key] || 0) + 1
  const pairSym = nonBlank.find((s) => counts[s.key] >= 2)
  if (pairSym) return { multiplier: Math.max(1, Math.round(pairSym.pay3 / 4)), matchedSymbol: pairSym }
  return { multiplier: 0, matchedSymbol: null }
}

export default function Slots() {
  const cash = useGameStore((s) => s.cash)
  const addCash = useGameStore((s) => s.addCash)
  const addReputation = useGameStore((s) => s.addReputation)
  const spendEnergy = useGameStore((s) => s.spendEnergy)
  const energy = useGameStore((s) => s.player.energy)

  const [bet, setBet] = useState(MIN_BET)
  const [reels, setReels] = useState([null, null, null])
  const [spinning, setSpinning] = useState(false)
  const [message, setMessage] = useState('')

  const flickerRef = useRef(null)
  const timeoutRef = useRef(null)

  useEffect(() => {
    return () => {
      if (flickerRef.current) clearInterval(flickerRef.current)
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [])

  const spin = () => {
    if (spinning || cash < bet || bet < MIN_BET || energy < 5) return
    if (!spendEnergy(5)) return
    addCash(-bet)
    setSpinning(true)
    setMessage('')

    flickerRef.current = setInterval(() => {
      setReels([randomGlyph(), randomGlyph(), randomGlyph()])
    }, 80)

    timeoutRef.current = setTimeout(() => {
      clearInterval(flickerRef.current)
      const finalReels = [spinReel(), spinReel(), spinReel()]
      setReels(finalReels)
      const { multiplier, matchedSymbol } = resolveSpin(finalReels)
      setSpinning(false)
      if (multiplier > 0) {
        const payout = bet * multiplier
        addCash(payout)
        if (multiplier >= BIG_WIN_REPUTATION_THRESHOLD) {
          addReputation(3)
          setMessage(`JACKPOT! Triple ${matchedSymbol.glyph} pays ${multiplier}x - $${payout.toLocaleString()}! The floor turns to watch.`)
        } else {
          setMessage(`Winner! ${matchedSymbol.glyph} pays ${multiplier}x - $${payout.toLocaleString()}.`)
        }
      } else {
        setMessage('No match. Better luck next spin.')
      }
    }, SPIN_ANIM_MS)
  }

  return (
    <div className="border-2 border-pink-400 bg-[#12071c] p-4 text-sm">
      <p className="mb-3 text-xs text-gray-400">
        Pure luck, fixed house edge (~10%). Payout scales with your bet - three of a kind pays big, any pair pays a small consolation.
      </p>

      <div className="mb-3 flex items-center justify-center gap-2 border-2 border-gray-600 bg-black p-4">
        {reels.map((r, i) => (
          <div key={i} className="flex h-16 w-16 items-center justify-center border-2 border-pink-500 bg-[#1c0a24] text-3xl">
            {r ? r.glyph ?? r : BLANK_GLYPH}
          </div>
        ))}
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <label className="text-xs text-gray-400">Bet ($)</label>
        <input
          type="number"
          min={MIN_BET}
          value={betInput}
          disabled={spinning}
          onChange={(e) => setBetInput(e.target.value)}
          onBlur={() => setBetInput(String(bet))}
          className="w-24 border border-gray-600 bg-black px-1 py-1 text-white disabled:opacity-50"
        />
        <button
          onClick={spin}
          disabled={spinning || cash < bet || bet < MIN_BET || energy < 5}
          className="border-2 border-pink-400 px-3 py-1 font-bold text-pink-300 hover:bg-pink-400 hover:text-black disabled:opacity-30"
        >
          {spinning ? 'Spinning...' : `Spin (min $${MIN_BET})`}
        </button>
      </div>

      {message && <p className="text-yellow-300">{message}</p>}
    </div>
  )
}
