import { useEffect, useRef, useState } from 'react'
import { useGameStore } from '../../store/useGameStore'

// Bonded Cargo Pier ("the wharf") - Cast & Reel fishing + manifest-fraud.
// Self-contained like Slots.jsx/RussianRoulette.jsx: owns its own
// addCash/spendEnergy calls, no onVictory/onDefeat handshake, just onClose.
//
// The bite check (did anything even bite?) is a plain PER-gated dice roll -
// there's no meaningful input to attach to it, so it stays a resolve-then-
// animate roll like Slots' spin. Once something bites, the reel phase is a
// real-time rAF-driven minigame (same live-ref/state-for-render shape as
// TradeMeter.jsx's timed buy/sell meter): hold Left/Right (or A/D) to keep a
// drifting fish inside your reel zone before tension maxes out or the clock
// runs out.

const CAST_ENERGY_COST = 5
const CAST_CASH_COST = 10
const CAST_ANIM_MS = 600
const RECORD_REPUTATION_GAIN = 2 // matches Slots.jsx's big-win-reputation convention (addReputation on the rarest outcome)

// --- Reel minigame tuning ---
// These four constants are coupled - changing one can silently kill an entire
// outcome. Let f = the fraction of the reel spent in-zone, T = REEL_MAX_MS/1000:
//   - tension only stays flat at f = DRAIN/(FILL+DRAIN) = 35/90 ~= 0.611
//   - surviving T seconds without a tension break needs T*(FILL - (FILL+DRAIN)*f) < 100
//   - NOT winning within T needs T*f < WIN_IN_ZONE_MS/1000
// The clock is only a real third outcome when those last two overlap, i.e.
// roughly T < 6.7s at the current FILL/DRAIN/WIN values. At the original
// T = 8s there was NO such f: any pace tentative enough to still be reeling at
// 8s had already broken tension, so "line snapped after 8 seconds" was dead
// code and the on-screen countdown could never actually run out. T = 6s leaves
// a genuine (if narrow) f ~= 0.43-0.50 band where an over-cautious player
// times out, and also tightens pacing for a repeatable side activity. Skilled
// play is unaffected - tracking the fish closely wins in ~3.3s either way.
const REEL_MAX_MS = 6000 // hard clock - line snaps if you haven't won or broken tension by then
const WIN_IN_ZONE_MS = 3000 // accumulate 3.0s of in-zone time to land the fish
const TENSION_FILL_PER_SEC = 55 // tension gained per second while the fish is outside the zone
const TENSION_DRAIN_PER_SEC = 35 // tension lost per second while the fish is inside the zone
// Half-amplitude of the fish's sine drift around its center. Not specified by
// the design pass, chosen so the fish sweeps roughly [0.15, 0.85] before
// bias/noise are applied - enough room for the zone to matter without ever
// pinning the fish flush against either edge of the track.
const FISH_AMPLITUDE = 0.35
// How fast (track-widths/sec) the reel-zone cursor moves while a direction
// key is held. Not specified by the design pass either; tuned by hand so the
// ~0.12-0.35-wide zone can plausibly chase the fish's sine sweep (whose peak
// speed near mid-track scales with 1/periodMs) without the zone feeling like
// it's on rails.
const CURSOR_SPEED = 1.6
// Per-frame random-walk step for the small noise term layered onto the sine
// drift, clamped to +/-0.06 so it roughens the path without swamping it.
const NOISE_STEP = 0.01
const NOISE_CLAMP = 0.06

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

// quality (0-1) is how much of the reel phase was spent with the fish inside
// your zone. It biases the catch-tier weights before rolling - reward skill
// without making a clean reel a guaranteed record. Table itself, values, and
// reputation gain are untouched; only the weights going into the roll move.
function tierWeightMultiplier(key, quality) {
  if (quality < 0.4) {
    if (key === 'common' || key === 'uncommon') return 1.3
    if (key === 'rare' || key === 'record') return 0.4
  } else if (quality > 0.75) {
    if (key === 'common') return 0.5
    if (key === 'rare') return 1.8
    if (key === 'record') return 3
  }
  return 1
}

function rollCatchTier(quality) {
  const weighted = CATCH_TIERS.map((t) => ({ tier: t, weight: t.weight * tierWeightMultiplier(t.key, quality) }))
  const total = weighted.reduce((a, w) => a + w.weight, 0)
  let r = Math.random() * total
  for (const w of weighted) {
    if (r < w.weight) return w.tier
    r -= w.weight
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
const BITE_LINE = 'The line goes taut. Something is on the other end of it.'
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

  // --- Reel minigame render state (live values live in refs; these are only
  // updated once per rAF frame purely so the JSX has something to read from,
  // same split TradeMeter.jsx uses for its sweep marker) ---
  const [reeling, setReeling] = useState(false)
  const [zoneWidth, setZoneWidth] = useState(0.22)
  const [fishPos, setFishPos] = useState(0.5)
  const [zoneStart, setZoneStart] = useState(0.39)
  const [tension, setTension] = useState(0)
  const [inZoneMs, setInZoneMs] = useState(0)

  const timeoutRef = useRef(null)
  const reelParamsRef = useRef({ zoneWidth: 0.22, periodMs: 1200, driftCenterBias: 0 })
  const fishPosRef = useRef(0.5)
  const zoneStartRef = useRef(0.39)
  const tensionRef = useRef(0)
  const inZoneMsRef = useRef(0)
  const noiseRef = useRef(0)
  const keysRef = useRef({ left: false, right: false })
  const startTimeRef = useRef(0)
  const lastTimeRef = useRef(0)
  const rafRef = useRef(null)

  useEffect(() => () => { if (timeoutRef.current) clearTimeout(timeoutRef.current) }, [])

  const canCast = !casting && !reeling && !pendingCatch && cash >= CAST_CASH_COST && energy >= CAST_ENERGY_COST

  const finishReel = (outcome, elapsedAtWinMs) => {
    setReeling(false)
    if (outcome === 'lose') {
      setMessage(randomLine(GOT_AWAY_LINES))
      return
    }
    const quality = Math.max(0, Math.min(1, inZoneMsRef.current / elapsedAtWinMs))
    const tier = rollCatchTier(quality)
    if (tier.key === 'record') addReputation(RECORD_REPUTATION_GAIN)
    setMessage(`${tier.label}! ${tier.flavor}`)
    setPendingCatch(tier)
  }

  const startReel = () => {
    const agi = stats.AGI ?? 5
    const effectiveLuck = getEffectiveLuck()
    const nextZoneWidth = Math.max(0.12, Math.min(0.35, 0.22 + (agi - 5) * 0.015))
    const periodMs = Math.max(800, Math.min(1400, 1400 - (agi - 5) * 40))
    const driftCenterBias = (effectiveLuck - 5) * 0.01

    reelParamsRef.current = { zoneWidth: nextZoneWidth, periodMs, driftCenterBias }
    fishPosRef.current = 0.5
    zoneStartRef.current = Math.max(0, Math.min(1 - nextZoneWidth, 0.5 - nextZoneWidth / 2))
    tensionRef.current = 0
    inZoneMsRef.current = 0
    noiseRef.current = 0
    keysRef.current = { left: false, right: false }
    startTimeRef.current = performance.now()
    lastTimeRef.current = startTimeRef.current

    setZoneWidth(nextZoneWidth)
    setFishPos(fishPosRef.current)
    setZoneStart(zoneStartRef.current)
    setTension(0)
    setInZoneMs(0)
    setReeling(true)
  }

  // Reel loop + key listeners - only live while `reeling` is true, torn down
  // on outcome, unmount, or modal close (React runs this cleanup in all
  // three cases since they all unmount/rerun the effect).
  useEffect(() => {
    if (!reeling) return undefined

    const handleKeyDown = (e) => {
      const k = e.key.toLowerCase()
      if (k === 'arrowleft' || k === 'a') { keysRef.current.left = true; e.preventDefault() }
      else if (k === 'arrowright' || k === 'd') { keysRef.current.right = true; e.preventDefault() }
    }
    const handleKeyUp = (e) => {
      const k = e.key.toLowerCase()
      if (k === 'arrowleft' || k === 'a') keysRef.current.left = false
      else if (k === 'arrowright' || k === 'd') keysRef.current.right = false
    }
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)

    const tick = (now) => {
      const dt = Math.min(0.05, (now - lastTimeRef.current) / 1000) // clamp so a stalled tab can't dump a huge dt in one frame
      lastTimeRef.current = now
      const elapsed = now - startTimeRef.current
      const { zoneWidth: zw, periodMs, driftCenterBias } = reelParamsRef.current

      noiseRef.current = Math.max(-NOISE_CLAMP, Math.min(NOISE_CLAMP, noiseRef.current + (Math.random() - 0.5) * NOISE_STEP))
      const fishPosVal = Math.max(0, Math.min(1,
        0.5 + driftCenterBias + FISH_AMPLITUDE * Math.sin(elapsed / periodMs) + noiseRef.current
      ))
      fishPosRef.current = fishPosVal

      const dir = (keysRef.current.right ? 1 : 0) - (keysRef.current.left ? 1 : 0)
      zoneStartRef.current = Math.max(0, Math.min(1 - zw, zoneStartRef.current + dir * CURSOR_SPEED * dt))

      const inZone = fishPosVal >= zoneStartRef.current && fishPosVal <= zoneStartRef.current + zw
      if (inZone) {
        inZoneMsRef.current += dt * 1000
        tensionRef.current = Math.max(0, tensionRef.current - TENSION_DRAIN_PER_SEC * dt)
      } else {
        tensionRef.current = Math.min(100, tensionRef.current + TENSION_FILL_PER_SEC * dt)
      }

      setFishPos(fishPosVal)
      setZoneStart(zoneStartRef.current)
      setTension(tensionRef.current)
      setInZoneMs(inZoneMsRef.current)

      if (inZoneMsRef.current >= WIN_IN_ZONE_MS) {
        finishReel('win', elapsed)
        return
      }
      if (tensionRef.current >= 100 || elapsed >= REEL_MAX_MS) {
        finishReel('lose')
        return
      }
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
      cancelAnimationFrame(rafRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reeling])

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

      const biteChance = Math.max(0.4, Math.min(0.9, 0.7 + (per - 5) * 0.02))
      if (Math.random() >= biteChance) {
        setMessage(randomLine(NO_BITE_LINES))
        return
      }

      setMessage(BITE_LINE)
      startReel()
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
        <p className="mb-1 text-xs uppercase tracking-widest text-cyan-600">Industrial District</p>
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
          {casting ? 'Casting...' : reeling ? 'Line is out...' : `Cast Line (5 Energy, $${CAST_CASH_COST} bait)`}
        </button>

        {reeling && (
          <div className="mb-4 border-2 border-cyan-700 bg-[#0a141c] p-3">
            <p className="mb-2 text-xs text-cyan-300">
              Hold Left / Right (or A / D) to keep the fish inside the zone.
            </p>
            <div className="relative mb-2 h-5 w-full border border-gray-600 bg-black">
              <div
                className="absolute top-0 h-full bg-cyan-700/50"
                style={{ left: `${zoneStart * 100}%`, width: `${zoneWidth * 100}%` }}
              />
              <div className="absolute top-0 h-full w-[3px] bg-yellow-300" style={{ left: `${fishPos * 100}%` }} />
            </div>
            <div className="mb-1 flex items-center justify-between text-xs text-gray-400">
              <span>In-zone: {(inZoneMs / 1000).toFixed(1)}s / 3.0s</span>
              <span>Tension</span>
            </div>
            <div className="h-2 w-full border border-gray-600 bg-black">
              <div className="h-full bg-red-500" style={{ width: `${tension}%` }} />
            </div>
          </div>
        )}

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
