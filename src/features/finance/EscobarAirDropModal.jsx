import { useEffect, useRef, useState } from 'react'
import { useGameStore } from '../../store/useGameStore'
import BossJobGate from './BossJobGate'

// Escobar's Air-Drop Route Planner - Medellin Syndicate Boss-tier signature
// job. Pablo Escobar (Boss) commissions the run; Gustavo Gaviria (Underboss,
// "Air-Drop Logistics & Processing Laboratory Infrastructure" per
// src/data/syndicate.js) is the actual radar-evasion/logistics genius whose
// voice narrates the briefing - Escobar sets the stakes, Gaviria plans the
// route.
//
// STRUCTURAL NOTE - precommit, not hop-by-hop (do not "simplify" this away):
// unlike MoneyLaunderingModal's reactive hop-by-hop puzzle (react to each
// step as it happens), this is a PRECOMMIT routing puzzle. The player sees
// the entire 5-leg board, every lane's exact fuel/detection cost, AND which
// 2 legs are radar-hot, all up front on the 'plan' screen, with zero
// consequences until every leg has a lane chosen. Only then does "Commit
// Route" lock the whole plan in and play it out leg by leg on the
// 'resolving' screen. There is no way to see a leg's outcome and revise a
// later leg's choice - that reactive shape is deliberately MoneyLaunderingModal's
// territory, not this job's.
//
// v1 scope: pure fuel/altitude/radar. No mid-route refuel or transshipment
// nodes - cut per the design brief to keep the 5-leg board legible.

const ENERGY_COST = 35
const PAYOUT = 12000
const LEG_COUNT = 5
const LANES = ['low', 'mid', 'high']
const LANE_LABEL = { low: 'Low', mid: 'Mid', high: 'High' }
const LANE_FLAVOR = {
  low: 'Hugs the treetops. Burns fuel, hides from radar.',
  mid: 'Standard cruising altitude. Balanced risk.',
  high: 'Above the weather. Cheap on fuel, lights up every scope in range.',
}
// Per-leg base cost (see design brief): Low = fuel 3 / detect 2, Mid = fuel 2
// / detect 5, High = fuel 1 / detect 9.
const LANE_COSTS = {
  low: { fuel: 3, detect: 2 },
  mid: { fuel: 2, detect: 5 },
  high: { fuel: 1, detect: 9 },
}
// Hot-leg terrain-masking rule: flying low through a hot leg only adds a
// flat +4 (terrain masks you even under active radar attention); Mid/High
// eat the full rolled hotLegSpike instead.
const HOT_LOW_BONUS = 4

function clamp(min, max, v) {
  return Math.max(min, Math.min(max, v))
}

// Setup randomness only (which 2 of 5 legs are hot) - shown to the player
// BEFORE they touch anything, so it never decides the outcome on its own,
// only the terrain the player then has to plan around.
function pickHotLegs() {
  const pool = [0, 1, 2, 3, 4]
  const hot = []
  while (hot.length < 2) {
    const idx = Math.floor(Math.random() * pool.length)
    hot.push(pool.splice(idx, 1)[0])
  }
  return hot.sort((a, b) => a - b)
}

function legDetectCost(lane, isHot, hotLegSpike) {
  const base = LANE_COSTS[lane].detect
  if (!isHot) return base
  return base + (lane === 'low' ? HOT_LOW_BONUS : hotLegSpike)
}

// Deterministic resolution over an already-fully-chosen route - this is the
// "commit at once" half of the precommit shape. Walks legs 1..5 in order,
// accumulating fuel/detection; if cumulative fuel ever exceeds the budget
// the plane can't make it any further and the run aborts right there
// (mid-route, before reaching leg 5's drop point). Otherwise, once all 5
// legs are flown, total detection is checked against the ceiling.
function computeResolution(laneChoices, locked) {
  const { fuelBudget, detectionCeiling, hotLegSpike, hotLegs } = locked
  const legs = []
  let fuelUsed = 0
  let detection = 0
  let outcome = 'clean'
  let abortAtLeg = null

  for (let i = 0; i < laneChoices.length; i++) {
    const lane = laneChoices[i]
    const isHot = hotLegs.includes(i)
    const fuelCost = LANE_COSTS[lane].fuel
    const detectCost = legDetectCost(lane, isHot, hotLegSpike)
    fuelUsed += fuelCost
    detection += detectCost
    legs.push({ leg: i, lane, isHot, fuelCost, detectCost, fuelCumulative: fuelUsed, detectionCumulative: detection })
    if (fuelUsed > fuelBudget) {
      outcome = 'abort'
      abortAtLeg = i
      break
    }
  }

  if (outcome !== 'abort' && detection >= detectionCeiling) {
    outcome = 'radarLock'
  }

  return { legs, outcome, abortAtLeg, finalFuel: fuelUsed, finalDetection: detection }
}

// `embedded` mirrors DistrictBuildingModal/LeverageMeter's convention: skip
// the outer fixed overlay + own X button when a wrapping hub modal (the
// "Boss Jobs" tab of UnderworldModal.jsx) already supplies both - stacking
// two full-screen overlays is exactly what DistrictBuildingModal's own
// header comment warns against.
export default function EscobarAirDropModal({ onClose, embedded = false }) {
  const spendEnergy = useGameStore((s) => s.spendEnergy)
  const applyCrimeOutcome = useGameStore((s) => s.applyCrimeOutcome)
  const declineSyndicateJob = useGameStore((s) => s.declineSyndicateJob)
  const markBossJobAttempted = useGameStore((s) => s.markBossJobAttempted)
  const player = useGameStore((s) => s.player)

  const [committed, setCommitted] = useState(false)
  const [screen, setScreen] = useState('plan') // 'plan' | 'resolving' | 'result' (only meaningful once committed)
  const [locked, setLocked] = useState(null) // { fuelBudget, detectionCeiling, hotLegSpike, hotLegs } - locked at mission start
  const [laneChoices, setLaneChoices] = useState(Array(LEG_COUNT).fill(null))
  const [resolution, setResolution] = useState(null)
  const [revealIndex, setRevealIndex] = useState(0)
  const [resultData, setResultData] = useState(null)

  const resolvedRef = useRef(false)

  // startMission is the single "locked at start" commitment point: spends
  // energy, stamps today's boss-job cooldown, and locks in every
  // stat-derived budget for the whole run (mirrors VaultCrackModal reading
  // INT once via getState() rather than the reactive `player` above, so
  // stat changes mid-run never retroactively help or hurt an in-flight
  // plan). Reused verbatim by the result screen's "Fly Another Route" -
  // each new route is a fresh commitment, energy and all.
  const startMission = () => {
    if (player.energy < ENERGY_COST) return
    if (!spendEnergy(ENERGY_COST)) return
    markBossJobAttempted('medellin_cartel')

    const state = useGameStore.getState()
    const INT = state.player.stats.INT ?? 5
    const PER = state.player.stats.PER ?? 5
    const effectiveLuck = state.getEffectiveLuck()

    const fuelBudget = clamp(8, 14, Math.round(10 + (INT - 5) * 0.6))
    const detectionCeiling = clamp(32, 55, Math.round(40 + (PER - 5) * 2))
    const hotLegSpike = clamp(6, 14, Math.round(10 - (effectiveLuck - 5) * 0.5))
    const hotLegs = pickHotLegs()

    setLocked({ fuelBudget, detectionCeiling, hotLegSpike, hotLegs })
    setLaneChoices(Array(LEG_COUNT).fill(null))
    setResolution(null)
    setResultData(null)
    resolvedRef.current = false
    setRevealIndex(0)
    setCommitted(true)
    setScreen('plan')
  }

  const chooseLane = (legIndex, lane) => {
    setLaneChoices((prev) => {
      const next = [...prev]
      next[legIndex] = lane
      return next
    })
  }

  const allLegsChosen = laneChoices.every((v) => v != null)

  const commitRoute = () => {
    if (!allLegsChosen || !locked) return
    const res = computeResolution(laneChoices, locked)
    setResolution(res)
    resolvedRef.current = false
    setRevealIndex(0)
    setScreen('resolving')
  }

  // Reveal loop - purely a "watch it resolve" animation over an ALREADY
  // deterministic result (computeResolution ran synchronously in
  // commitRoute above). No choice is made here, nothing here can change the
  // outcome - it's the precommit shape's payoff, dramatizing a plan that
  // was already fully locked in. Timers are tracked and cleared on
  // cleanup/unmount so a closed modal never fires a late setState.
  useEffect(() => {
    if (screen !== 'resolving' || !resolution) return
    let cancelled = false
    const timeouts = []
    const steps = resolution.legs.length
    for (let i = 0; i <= steps; i++) {
      const t = setTimeout(() => {
        if (cancelled) return
        setRevealIndex(i)
        if (i === steps && !resolvedRef.current) {
          resolvedRef.current = true
          finalizeResolution(resolution)
        }
      }, i * 550)
      timeouts.push(t)
    }
    return () => {
      cancelled = true
      timeouts.forEach(clearTimeout)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen, resolution])

  const finalizeResolution = (res) => {
    if (res.outcome === 'abort') {
      // Soft abort: fuel ran out before the drop. No payout, no
      // notoriety/wanted/jail - applyCrimeOutcome is never called at all.
      // Standing takes exactly the walk-away hit (-1), per the design
      // brief's explicit "same as walk-away" - declineSyndicateJob is the
      // one path in this codebase that already produces that exact delta.
      declineSyndicateJob('medellin_cartel')
      setResultData({ outcome: 'abort' })
    } else if (res.outcome === 'radarLock') {
      const out = applyCrimeOutcome({
        success: false,
        notorietyIncreaseOnFail: 30,
        wantedIncreaseOnFail: 4,
        assetSeizureOnFail: 0,
        jailChanceOnFail: 0.15,
        syndicateId: 'medellin_cartel',
      })
      setResultData({ outcome: 'radarLock', res: out })
    } else {
      const out = applyCrimeOutcome({
        success: true,
        payout: PAYOUT,
        syndicateId: 'medellin_cartel',
      })
      setResultData({ outcome: 'clean', res: out })
    }
    setScreen('result')
  }

  // Walk away before committing a route - same convention as
  // VaultCrackModal/LeverageMeter: no applyCrimeOutcome call, only the
  // walk-away standing hit via declineSyndicateJob.
  const walkAway = () => {
    declineSyndicateJob('medellin_cartel')
    setResultData({ outcome: 'walkAway' })
    setScreen('result')
  }

  const revealedLegs = resolution ? resolution.legs.slice(0, Math.min(revealIndex, resolution.legs.length)) : []

  const body = (
    <>
        {!embedded && (
          <button
            onClick={onClose}
            aria-label="Close"
            className="absolute right-3 top-3 border border-gray-500 px-2 py-0.5 text-xs text-gray-400 hover:bg-gray-600 hover:text-white"
          >
            X
          </button>
        )}

        <p className="mb-1 text-[10px] uppercase tracking-widest text-gray-500">Medellin Syndicate - Boss Job</p>
        <h2 className="mb-2 text-xl font-bold text-orange-400">Air-Drop Route Planner</h2>

        {!committed && (
          <BossJobGate
            syndicateId="medellin_cartel"
            jobLabel="Air-Drop Route Planner"
            borderClass="border-orange-600"
            textClass="text-orange-300"
            barClass="bg-orange-500"
          >
            <div className="flex flex-col gap-3">
              <div className="border-2 border-orange-600/60 bg-[#0f1020] p-3">
                <p className="text-sm font-bold text-orange-300">Pablo Escobar, "El Patron"</p>
                <p className="mt-1 text-xs text-gray-400">
                  "Plata o Plomo, mi amigo - and today it's plata." A full air shipment needs to cross five legs of
                  open corridor. Gustavo Gaviria has already mapped the radar picture; the route is yours to fly.
                </p>
              </div>
              <div className="border-2 border-orange-600/40 bg-[#0f1020] p-3">
                <p className="text-sm font-bold text-orange-300">Gustavo Gaviria, "The Operational Brain"</p>
                <p className="mt-1 text-xs text-gray-400">
                  "Low altitude burns fuel but the trees hide you. High altitude is cheap on fuel and lights up
                  every scope in the hemisphere. Pick your poison per leg - I'll tell you which two are hot before
                  you commit to anything."
                </p>
              </div>
              <div className="grid grid-cols-2 gap-y-1 text-xs">
                <span className="uppercase tracking-widest text-gray-500">Energy Cost</span>
                <span className="text-right text-yellow-300">{ENERGY_COST}</span>
                <span className="uppercase tracking-widest text-gray-500">Payout (clean landing)</span>
                <span className="text-right text-green-400">${PAYOUT.toLocaleString()}</span>
              </div>
              <button
                onClick={startMission}
                disabled={player.energy < ENERGY_COST}
                className="w-full border-2 border-orange-500 py-1.5 text-sm font-bold uppercase tracking-widest text-orange-300 hover:bg-orange-500 hover:text-black disabled:opacity-30"
              >
                Plan Route
              </button>
            </div>
          </BossJobGate>
        )}

        {committed && screen === 'plan' && locked && (
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-y-1 border-2 border-gray-600 bg-[#0f1020] p-2 text-xs">
              <span className="uppercase tracking-widest text-gray-500">Fuel Budget</span>
              <span className="text-right text-cyan-300">{locked.fuelBudget}</span>
              <span className="uppercase tracking-widest text-gray-500">Detection Ceiling</span>
              <span className="text-right text-red-400">{locked.detectionCeiling}</span>
              <span className="uppercase tracking-widest text-gray-500">Hot-Leg Radar Spike (Mid/High)</span>
              <span className="text-right text-red-400">+{locked.hotLegSpike}</span>
            </div>

            <p className="text-xs text-gray-400">
              Radar's already made two legs (marked HOT below). Flying Low through a hot leg only costs +{HOT_LOW_BONUS} detection - the canopy still hides you some. Choose a lane for all 5 legs, then commit the whole route at once.
            </p>

            <div className="flex flex-col gap-2">
              {Array.from({ length: LEG_COUNT }, (_, i) => i).map((legIndex) => {
                const isHot = locked.hotLegs.includes(legIndex)
                return (
                  <div key={legIndex} className={`border-2 ${isHot ? 'border-red-500' : 'border-gray-600'} bg-[#0f1020] p-2`}>
                    <div className="mb-1 flex items-center justify-between text-xs">
                      <span className="font-bold text-white">Leg {legIndex + 1}</span>
                      {isHot && <span className="border border-red-500 px-1 text-[10px] font-bold uppercase text-red-400">Hot</span>}
                    </div>
                    <div className="flex gap-2">
                      {LANES.map((lane) => {
                        const selected = laneChoices[legIndex] === lane
                        const detect = legDetectCost(lane, isHot, locked.hotLegSpike)
                        return (
                          <button
                            key={lane}
                            onClick={() => chooseLane(legIndex, lane)}
                            title={LANE_FLAVOR[lane]}
                            className={`flex-1 border-2 p-1.5 text-left text-[11px] ${
                              selected ? 'border-orange-400 bg-orange-500/20 text-orange-200' : 'border-gray-600 text-gray-300 hover:border-gray-400'
                            }`}
                          >
                            <div className="font-bold">{LANE_LABEL[lane]}</div>
                            <div>fuel {LANE_COSTS[lane].fuel} / detect {detect}</div>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>

            <button
              onClick={commitRoute}
              disabled={!allLegsChosen}
              className="w-full border-4 border-green-400 py-2 text-sm font-bold uppercase tracking-widest text-green-300 hover:bg-green-400 hover:text-black disabled:opacity-30"
            >
              Commit Route
            </button>

            <button onClick={walkAway} className="w-full border-2 border-gray-500 py-1.5 text-xs text-gray-300 hover:bg-gray-700">
              Walk Away
            </button>
          </div>
        )}

        {committed && screen === 'resolving' && resolution && (
          <div className="flex flex-col gap-2">
            <p className="text-center text-xs uppercase tracking-widest text-gray-400">Flying the route...</p>
            <div className="flex flex-col gap-1 border-2 border-gray-700 bg-[#0a0a16] p-2">
              {revealedLegs.map((leg) => (
                <div key={leg.leg} className="flex items-center justify-between text-xs">
                  <span>
                    Leg {leg.leg + 1}: {LANE_LABEL[leg.lane]}
                    {leg.isHot && <span className="text-red-400"> (hot)</span>}
                  </span>
                  <span className="text-gray-400">
                    fuel {leg.fuelCumulative}/{locked.fuelBudget} - detect {leg.detectionCumulative}/{locked.detectionCeiling}
                  </span>
                </div>
              ))}
              {revealIndex < resolution.legs.length && <p className="text-center text-[10px] text-gray-600">...</p>}
            </div>
          </div>
        )}

        {committed && screen === 'result' && resultData && (
          <div className="flex flex-col gap-2 border-2 border-orange-500 bg-[#0f1020] p-3 text-sm">
            {resultData.outcome === 'clean' && (
              <>
                <p className="text-center text-lg font-bold text-green-400">Clean Landing</p>
                <p className="text-center text-base font-bold text-green-400">+${resultData.res.payout.toLocaleString()}</p>
              </>
            )}
            {resultData.outcome === 'radarLock' && (
              <>
                <p className="text-center text-lg font-bold text-red-400">Radar Lock</p>
                <p className="text-center text-xs text-gray-300">{resultData.res.message}</p>
                <p className="text-center text-xs text-gray-400">
                  Notoriety +30 &middot; Wanted +4
                  {resultData.res.fine > 0 && ` · Seized $${resultData.res.fine.toLocaleString()}`}
                  {resultData.res.jailed && ' · Arrested'}
                </p>
              </>
            )}
            {resultData.outcome === 'abort' && (
              <>
                <p className="text-center text-lg font-bold text-yellow-300">Route Scrubbed</p>
                <p className="text-center text-xs text-gray-400">
                  Ran dry over open corridor on leg {resolution.abortAtLeg + 1}. No drop, no payout - but no exposure
                  either. Standing -1.
                </p>
              </>
            )}
            {resultData.outcome === 'walkAway' && (
              <>
                <p className="text-center text-lg font-bold text-gray-300">Mission Scrubbed</p>
                <p className="text-center text-xs text-gray-400">Called it off before takeoff. Standing -1.</p>
              </>
            )}
            <div className="mt-1 flex gap-2">
              <button
                onClick={startMission}
                disabled={player.energy < ENERGY_COST}
                className="flex-1 border-2 border-orange-400 py-1.5 text-sm font-bold text-orange-300 hover:bg-orange-400 hover:text-black disabled:opacity-30"
              >
                Fly Another Route
              </button>
              <button onClick={onClose} className="flex-1 border-2 border-gray-600 py-1.5 text-sm text-gray-400 hover:bg-gray-700">
                Leave
              </button>
            </div>
          </div>
        )}
    </>
  )

  if (embedded) return body

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="glass-panel relative w-[560px] max-h-[85vh] overflow-y-auto border-4 border-orange-600 bg-[#1c1d3a] p-6 font-mono text-white">
        {body}
      </div>
    </div>
  )
}
