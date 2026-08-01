import { useEffect, useRef, useState } from 'react'
import { useGameStore } from '../../store/useGameStore'

// Bonded Cargo Pier ("the wharf") - Cast & Reel fishing + manifest-fraud.
// Self-contained like Slots.jsx/RussianRoulette.jsx: owns its own
// addCash/spendEnergy calls, no onVictory/onDefeat handshake, just onClose.
// Pure probability, resolve-then-animate (same shape as Slots' spin) - no
// real-time input.

const CAST_ENERGY_COST = 5
const CAST_CASH_COST = 10
const CAST_ANIM_MS = 600
const RECORD_REPUTATION_GAIN = 2 // matches Slots.jsx's big-win-reputation convention (addReputation on the rarest outcome)

// Weighted catch table, same shape as Slots.jsx's SYMBOLS table. Values are
// hand-picked to feel like a small-stakes side hustle relative to the $10
// bait / 5 energy per cast - not Monte-Carlo-tuned like Slots' RTP, since
// there's no bet/payout ratio to balance here (Declare Honest is zero-risk).
const CATCH_TIERS = [
  { key: 'common', label: 'Common catch', weight: 50, value: 15, flavor: 'A modest fish. Barely worth logging.' },
  { key: 'uncommon', label: 'Uncommon catch', weight: 30, value: 40, flavor: 'A decent haul. Nothing that raises eyebrows at the scale.' },
  { key: 'rare', label: 'Rare catch', weight: 15, value: 120, flavor: 'A genuinely good catch. A dockhand actually glances over.' },
  { key: 'record', label: 'Record catch', weight: 5, value: 400, flavor: 'A record-sized catch. Someone brings out a camera nobody asked for.' },
]
const TOTAL_TIER_WEIGHT = CATCH_TIERS.reduce((a, t) => a + t.weight, 0)

function rollCatchTier() {
  let r = Math.random() * TOTAL_TIER_WEIGHT
  for (const t of CATCH_TIERS) {
    if (r < t.weight) return t
    r -= t.weight
  }
  return CATCH_TIERS[0]
}

// Deadpan, mundane-crime register - bureaucratic-boring corruption, not
// dramatic. A ship "lost at sea" that never sailed, a bill of lading that
// says "textiles" over an empty hold. Customs officers/inspectors stay
// generic/unnamed flavor, no new named characters.
const CAST_LINES = [
  'You pay the bait vendor exact change. He does not look up.',
  'The line goes in off Pier 9, next to a forklift nobody is using.',
  'A gull watches the water with more interest than you can currently muster.',
]
const NO_BITE_LINES = [
  'Nothing. The water is uneventful today.',
  'No bite. Somewhere, a customs officer stamps a form.',
  'The line just sits there. So does the paperwork on your desk.',
]
const GOT_AWAY_LINES = [
  'Something tugs, then thinks better of it.',
  'It gets away. You update the log to say it never existed, which is at least good practice.',
  'Almost - the line snaps back empty.',
]

function randomLine(lines) {
  return lines[Math.floor(Math.random() * lines.length)]
}

export default function WharfModal({ onClose }) {
  const cash = useGameStore((s) => s.cash)
  const energy = useGameStore((s) => s.player.energy)
  const stats = useGameStore((s) => s.player.stats)
  const addCash = useGameStore((s) => s.addCash)
  const spendEnergy = useGameStore((s) => s.spendEnergy)
  const addReputation = useGameStore((s) => s.addReputation)
  const getEffectiveLuck = useGameStore((s) => s.getEffectiveLuck)
  const executeCrime = useGameStore((s) => s.executeCrime)

  const [casting, setCasting] = useState(false)
  const [message, setMessage] = useState('')
  // Set once a catch lands, cleared once the player picks Declare/Pad -
  // gates casting again until the current catch is resolved.
  const [pendingCatch, setPendingCatch] = useState(null)

  const timeoutRef = useRef(null)
  useEffect(() => () => { if (timeoutRef.current) clearTimeout(timeoutRef.current) }, [])

  const canCast = !casting && !pendingCatch && cash >= CAST_CASH_COST && energy >= CAST_ENERGY_COST

  const castLine = () => {
    if (!canCast) return
    // Order per spec: check cash/energy sufficient (canCast above) -> spendEnergy -> addCash(-bait).
    if (!spendEnergy(CAST_ENERGY_COST)) return
    addCash(-CAST_CASH_COST)
    setCasting(true)
    setMessage(randomLine(CAST_LINES))

    timeoutRef.current = setTimeout(() => {
      setCasting(false)
      const per = stats.PER ?? 5
      const agi = stats.AGI ?? 5

      const biteChance = Math.max(0.4, Math.min(0.9, 0.7 + (per - 5) * 0.02))
      if (Math.random() >= biteChance) {
        setMessage(randomLine(NO_BITE_LINES))
        return
      }

      const effectiveLuck = getEffectiveLuck()
      const reelChance = Math.max(0.3, Math.min(0.85, 0.55 + (agi - 5) * 0.03 + (effectiveLuck - 5) * 0.01))
      if (Math.random() >= reelChance) {
        setMessage(randomLine(GOT_AWAY_LINES))
        return
      }

      const tier = rollCatchTier()
      if (tier.key === 'record') addReputation(RECORD_REPUTATION_GAIN)
      setMessage(`${tier.label}! ${tier.flavor}`)
      setPendingCatch(tier)
    }, CAST_ANIM_MS)
  }

  const declareHonest = () => {
    if (!pendingCatch) return
    addCash(pendingCatch.value)
    setMessage(`You weigh it, log it, and take the honest cut ($${pendingCatch.value.toLocaleString()}). The clipboard is satisfied.`)
    setPendingCatch(null)
  }

  const padManifest = () => {
    if (!pendingCatch) return
    const res = executeCrime({
      type: 'padManifest',
      baseSuccessChance: 0.6,
      payout: pendingCatch.value * 2,
      notorietyIncreaseOnFail: 4,
      wantedIncreaseOnFail: 0,
      energyCost: 0,
      assetSeizureOnFail: 0,
      jailChanceOnFail: 0.03,
    })
    // Arrest (jailed:true inside res) is fully handled by WorldScreen.jsx's
    // existing jail.inJail effect - nothing to do here beyond showing the
    // result text executeCrime already built (mirrors BankModal/TempleModal's
    // "just surface res.message" pattern).
    if (res.success) {
      setMessage(`The manifest clears customs without a second glance. ${res.message}`)
    } else {
      setMessage(`An inspector actually reads the manifest this time. ${res.message || res.reason}`)
    }
    setPendingCatch(null)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="glass-panel w-[440px] border-4 border-cyan-700 bg-[#0e1b24] p-6 font-mono text-white">
        <p className="mb-1 text-[10px] uppercase tracking-widest text-cyan-600">Industrial District</p>
        <h2 className="mb-2 text-xl font-bold text-cyan-200">Bonded Cargo Pier</h2>
        <p className="mb-4 text-xs text-gray-400">
          A ship that was "lost at sea" never actually sailed. A bill of lading says "textiles" over an empty
          hold. Between inspections, there is nothing to do but fish off the end of the pier.
        </p>

        <div className="mb-4 border-2 border-gray-600 bg-[#0f1020] p-3 text-sm">
          <p>Cash: <span className="text-green-400">${Math.round(cash).toLocaleString()}</span></p>
          <p>Energy: <span className="text-yellow-300">{energy}</span></p>
        </div>

        <button
          onClick={castLine}
          disabled={!canCast}
          className="mb-3 w-full border-2 border-cyan-400 py-1.5 text-sm font-bold text-cyan-300 hover:bg-cyan-400 hover:text-black disabled:opacity-30"
        >
          {casting ? 'Casting...' : `Cast Line (5 Energy, $${CAST_CASH_COST} bait)`}
        </button>

        {pendingCatch && (
          <div className="mb-4 flex flex-col gap-2 border-2 border-yellow-600 bg-[#1a1508] p-3">
            <p className="text-xs text-yellow-300">
              Declare it honestly, or pad the manifest and report the catch as double its actual weight.
            </p>
            <button
              onClick={declareHonest}
              className="border-2 border-green-400 py-1.5 text-sm font-bold text-green-300 hover:bg-green-400 hover:text-black"
            >
              Declare Honest (+${pendingCatch.value.toLocaleString()})
            </button>
            <button
              onClick={padManifest}
              className="border-2 border-red-500 bg-red-950 py-1.5 text-sm font-bold text-red-400 hover:bg-red-500 hover:text-black"
            >
              Pad the Manifest (claim ${(pendingCatch.value * 2).toLocaleString()})
            </button>
          </div>
        )}

        {message && <p className="mb-4 text-xs italic text-gray-300">{message}</p>}

        <button onClick={onClose} className="w-full border-4 border-gray-500 py-2 font-bold hover:bg-gray-500">
          Leave
        </button>
      </div>
    </div>
  )
}
