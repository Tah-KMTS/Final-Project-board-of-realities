import { useState } from 'react'
import { useGameStore } from '../../store/useGameStore'
import { SYNDICATE_MEMBERS } from '../../data/syndicate'
import BossJobGate from './BossJobGate'

// Lepke's Contract Deduction - Murder, Inc. Boss-tier signature job.
// Louis "Lepke" Buchalter reviews contract hit requests "with corporate
// efficiency" per his bio in src/data/syndicate.js - this job is written to
// match that: it resolves ENTIRELY as planning and paperwork. The player's
// whole interaction is deducing a routine from schedule/location clues.
// There is no depicted violence and no described harm anywhere in this
// file - "Contract Closed / Invoice Paid" vs. "Contract Blown, Target
// Alerted" is as far as the flavor goes, matching the same unglamorous,
// administrative register the rest of Capital Syndicate uses for crime.
//
// Mastermind-adjacent, reusing VaultCrackModal's exact-match counting logic
// (see VaultCrackModal.jsx's scoreGuess) adapted for HETEROGENEOUS slots:
// (timeBlock 1-5, route 1-3, approach 1-2) = 30 combinations. Because the
// three slots draw from three totally different domains, a guess digit can
// never "belong" to the wrong slot the way VaultCrackModal's white pegs
// require (a route guess is never secretly a time-block value) - so the
// cross-slot partial-match pass simply doesn't apply here. What carries
// over is the per-position exact-match check itself, reduced to a single
// COUNT of correct slots (0-3) with NO positional reveal - the player is
// never told WHICH slot(s) matched. That count-only feedback (not a richer
// per-slot correct/incorrect readout) is what keeps 3 slots a real
// deduction problem instead of trivially solvable slot-by-slot; do not
// "helpfully" add positional feedback later, it collapses the puzzle.
//
// v1 scope note: the documented fallback if 3-dim/count-only ever proves
// untunable is 2 dimensions (15 combos) with per-slot correctness shown.
// Shipping the 3-dim version here; PER-scaled attempts (4-9, see
// computeAttempts) are the tuning lever if it ever needs softening instead.

const ENERGY_COST = 30
const PAYOUT = 10000

// timeBlock 1-5 maps onto the 5 real dailySchedule keys every roster member
// has (see src/data/syndicate.js) IN THIS EXACT ORDER, so the guess buttons
// can show real time-of-day + location flavor instead of "Time Block 3".
const TIME_BLOCK_KEYS = ['morning', 'midday', 'afternoon', 'night', 'midnight']

// Route/approach have no real-data equivalent (dailySchedule doesn't track
// travel routes) - these are invented, deliberately mundane/administrative
// labels, consistent with the "planning and paperwork" tone.
const ROUTES = [
  { id: 1, label: 'Route A', flavor: 'Waterfront service road' },
  { id: 2, label: 'Route B', flavor: 'Midtown delivery alley' },
  { id: 3, label: 'Route C', flavor: 'Financial District access road' },
]
const APPROACHES = [
  { id: 1, label: 'Approach 1', flavor: 'On foot' },
  { id: 2, label: 'Approach 2', flavor: 'By vehicle' },
]

function clamp(min, max, v) {
  return Math.max(min, Math.min(max, v))
}

// Setup randomness only (target pick, secret combination, flavor location) -
// none of it decides success/fail on its own; the player's guesses do that.
function pickTarget() {
  const pool = SYNDICATE_MEMBERS.filter((m) => m.syndicateId !== 'murder_inc')
  return pool[Math.floor(Math.random() * pool.length)]
}

function rollSecret() {
  return {
    timeBlock: 1 + Math.floor(Math.random() * 5),
    route: 1 + Math.floor(Math.random() * 3),
    approach: 1 + Math.floor(Math.random() * 2),
  }
}

// Count-only scoring - see the file header's "adapted for heterogeneous
// slots" comment for why there's no white-peg-equivalent pass here.
function countCorrect(secret, guess) {
  let n = 0
  if (guess.timeBlock === secret.timeBlock) n++
  if (guess.route === secret.route) n++
  if (guess.approach === secret.approach) n++
  return n
}

// `embedded` mirrors DistrictBuildingModal/LeverageMeter's convention: skip
// the outer fixed overlay + own X button when a wrapping hub modal (the
// "Boss Jobs" tab of UnderworldModal.jsx) already supplies both.
export default function ContractDeductionModal({ onClose, embedded = false }) {
  const player = useGameStore((s) => s.player)
  const spendEnergy = useGameStore((s) => s.spendEnergy)
  const applyCrimeOutcome = useGameStore((s) => s.applyCrimeOutcome)
  const declineSyndicateJob = useGameStore((s) => s.declineSyndicateJob)
  const markBossJobAttempted = useGameStore((s) => s.markBossJobAttempted)

  const [committed, setCommitted] = useState(false)
  const [screen, setScreen] = useState('puzzle') // 'puzzle' | 'result' (only meaningful once committed)
  const [target, setTarget] = useState(null)
  const [flavorLocation, setFlavorLocation] = useState('')
  const [secret, setSecret] = useState(null)
  const [attemptsMax, setAttemptsMax] = useState(0)
  const [attemptsLeft, setAttemptsLeft] = useState(0)
  const [guesses, setGuesses] = useState([])
  const [pickTimeBlock, setPickTimeBlock] = useState(null)
  const [pickRoute, setPickRoute] = useState(null)
  const [pickApproach, setPickApproach] = useState(null)
  const [resultData, setResultData] = useState(null)

  // The "locked at start" commitment point: spends energy, stamps today's
  // cooldown, re-rolls the target/secret/flavor, and re-locks the
  // PER-derived attempts budget for a fresh case file. Reused by the
  // result screen's "Take Another Contract" - each new case is a fresh
  // commitment, energy and all (see BossJobGate.jsx / OffshoreAuditModal.jsx
  // for why retries aren't hard-blocked by the once-per-day gate itself).
  const startCase = () => {
    if (player.energy < ENERGY_COST) return
    if (!spendEnergy(ENERGY_COST)) return
    markBossJobAttempted('murder_inc')

    const PER = useGameStore.getState().player.stats.PER ?? 5
    const maxAttempts = clamp(4, 9, 6 + Math.floor((PER - 5) / 3))
    const nextTarget = pickTarget()
    const flavorKey = TIME_BLOCK_KEYS[Math.floor(Math.random() * TIME_BLOCK_KEYS.length)]

    setTarget(nextTarget)
    setFlavorLocation(nextTarget.dailySchedule[flavorKey].location)
    setSecret(rollSecret())
    setAttemptsMax(maxAttempts)
    setAttemptsLeft(maxAttempts)
    setGuesses([])
    setPickTimeBlock(null)
    setPickRoute(null)
    setPickApproach(null)
    setResultData(null)
    setCommitted(true)
    setScreen('puzzle')
  }

  const resolveOutcome = (success) => {
    const res = applyCrimeOutcome({
      success,
      payout: PAYOUT,
      notorietyIncreaseOnFail: 25,
      wantedIncreaseOnFail: 3,
      assetSeizureOnFail: 0.15,
      jailChanceOnFail: 0.2,
      syndicateId: 'murder_inc',
    })
    setResultData({ outcome: success ? 'closed' : 'blown', res })
    setScreen('result')
  }

  const submitGuess = () => {
    if (pickTimeBlock == null || pickRoute == null || pickApproach == null) return
    const guess = { timeBlock: pickTimeBlock, route: pickRoute, approach: pickApproach }
    const correct = countCorrect(secret, guess)
    setGuesses((prev) => [...prev, { guess, correct }])
    setPickTimeBlock(null)
    setPickRoute(null)
    setPickApproach(null)

    if (correct === 3) {
      resolveOutcome(true)
      return
    }
    const remaining = attemptsLeft - 1
    if (remaining <= 0) {
      setAttemptsLeft(0)
      resolveOutcome(false)
      return
    }
    setAttemptsLeft(remaining)
  }

  // Walk away mid-case: same convention as VaultCrackModal/LeverageMeter -
  // no applyCrimeOutcome call, only the walk-away standing hit.
  const walkAway = () => {
    declineSyndicateJob('murder_inc')
    setResultData({ outcome: 'walkAway' })
    setScreen('result')
  }

  const guessReady = pickTimeBlock != null && pickRoute != null && pickApproach != null

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

        <p className="mb-1 text-[10px] uppercase tracking-widest text-gray-500">Murder, Inc. - Boss Job</p>
        <h2 className="mb-2 text-xl font-bold text-zinc-200">Contract Deduction</h2>

        {!committed && (
          <BossJobGate
            syndicateId="murder_inc"
            jobLabel="Contract Deduction"
            borderClass="border-zinc-500"
            textClass="text-zinc-200"
            barClass="bg-zinc-400"
          >
            <div className="flex flex-col gap-3">
              <div className="border-2 border-zinc-500/60 bg-[#0f1020] p-3">
                <p className="text-sm font-bold text-zinc-200">Lepke Buchalter, "The Industrial Extortionist"</p>
                <p className="mt-1 text-xs text-gray-400">
                  "Murder is an industrial discipline requiring clean execution and zero trace." A contract needs a
                  routine worked out on paper before it's filed: which time block, which route, which approach. Get
                  all three right, or the file gets pulled and the target is warned off.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-y-1 text-xs">
                <span className="uppercase tracking-widest text-gray-500">Energy Cost</span>
                <span className="text-right text-yellow-300">{ENERGY_COST}</span>
                <span className="uppercase tracking-widest text-gray-500">Payout</span>
                <span className="text-right text-green-400">${PAYOUT.toLocaleString()}</span>
              </div>
              <p className="text-[10px] text-gray-500">
                Cold pricing, not a jackpot - and the highest jail risk of the three Boss jobs. This one is paperwork
                with real exposure if the file gets pulled.
              </p>
              <button
                onClick={startCase}
                disabled={player.energy < ENERGY_COST}
                className="w-full border-2 border-zinc-400 py-1.5 text-sm font-bold uppercase tracking-widest text-zinc-200 hover:bg-zinc-400 hover:text-black disabled:opacity-30"
              >
                Open The Case File
              </button>
            </div>
          </BossJobGate>
        )}

        {committed && screen === 'puzzle' && target && secret && (
          <div className="flex flex-col gap-3">
            <div className="border-2 border-gray-600 bg-[#0f1020] p-2 text-xs">
              <p className="font-bold text-white">
                Subject: {target.name} <span className="text-gray-400">({target.syndicateName})</span>
              </p>
              <p className="mt-1 text-gray-400">Last seen at: {flavorLocation}</p>
              <p className="mt-1 flex items-center justify-between">
                <span className="text-gray-400">Attempts left</span>
                <span className="font-bold text-cyan-300">{attemptsLeft} / {attemptsMax}</span>
              </p>
            </div>

            <div>
              <p className="mb-1 text-[10px] uppercase tracking-widest text-gray-500">Time Block</p>
              <div className="grid grid-cols-1 gap-1">
                {TIME_BLOCK_KEYS.map((key, idx) => {
                  const block = target.dailySchedule[key]
                  const id = idx + 1
                  const selected = pickTimeBlock === id
                  return (
                    <button
                      key={key}
                      onClick={() => setPickTimeBlock(id)}
                      className={`border-2 p-1.5 text-left text-[11px] ${
                        selected ? 'border-zinc-300 bg-zinc-300/20 text-white' : 'border-gray-600 text-gray-300 hover:border-gray-400'
                      }`}
                    >
                      <span className="font-bold">{block.time}</span>
                      <span className="text-gray-500"> - {block.location}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="mb-1 text-[10px] uppercase tracking-widest text-gray-500">Route</p>
                <div className="flex flex-col gap-1">
                  {ROUTES.map((r) => {
                    const selected = pickRoute === r.id
                    return (
                      <button
                        key={r.id}
                        onClick={() => setPickRoute(r.id)}
                        className={`border-2 p-1.5 text-left text-[11px] ${
                          selected ? 'border-zinc-300 bg-zinc-300/20 text-white' : 'border-gray-600 text-gray-300 hover:border-gray-400'
                        }`}
                      >
                        <span className="font-bold">{r.label}</span>
                        <span className="text-gray-500"> - {r.flavor}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
              <div>
                <p className="mb-1 text-[10px] uppercase tracking-widest text-gray-500">Approach</p>
                <div className="flex flex-col gap-1">
                  {APPROACHES.map((a) => {
                    const selected = pickApproach === a.id
                    return (
                      <button
                        key={a.id}
                        onClick={() => setPickApproach(a.id)}
                        className={`border-2 p-1.5 text-left text-[11px] ${
                          selected ? 'border-zinc-300 bg-zinc-300/20 text-white' : 'border-gray-600 text-gray-300 hover:border-gray-400'
                        }`}
                      >
                        <span className="font-bold">{a.label}</span>
                        <span className="text-gray-500"> - {a.flavor}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>

            <button
              onClick={submitGuess}
              disabled={!guessReady}
              className="w-full border-2 border-green-400 py-1.5 text-sm font-bold text-green-300 hover:bg-green-400 hover:text-black disabled:opacity-30"
            >
              File The Guess
            </button>

            <div>
              <p className="mb-1 text-xs font-bold text-gray-400">Filed Guesses</p>
              <div className="max-h-32 overflow-y-auto border-2 border-gray-700 bg-[#0a0a16] p-2">
                {guesses.length === 0 && <p className="text-xs text-gray-500">No guesses filed yet.</p>}
                {guesses.map((g, i) => (
                  <div key={i} className="flex items-center justify-between border-b border-gray-800 py-1 text-xs last:border-b-0">
                    <span className="text-gray-300">
                      T{g.guess.timeBlock} / R{g.guess.route} / A{g.guess.approach}
                    </span>
                    <span className="font-bold text-cyan-300">{g.correct} / 3 correct</span>
                  </div>
                ))}
              </div>
              <p className="mt-1 text-[10px] text-gray-500">
                Only a count of correct slots is reported - never which ones.
              </p>
            </div>

            <button onClick={walkAway} className="w-full border-2 border-gray-500 py-1.5 text-xs text-gray-300 hover:bg-gray-700">
              Walk Away
            </button>
          </div>
        )}

        {committed && screen === 'result' && resultData && (
          <div className="flex flex-col gap-2 border-2 border-zinc-500 bg-[#0f1020] p-3 text-sm">
            {resultData.outcome === 'closed' && (
              <>
                <p className="text-center text-lg font-bold text-green-400">Contract Closed</p>
                <p className="text-center text-base font-bold text-green-400">Invoice Paid: +${resultData.res.payout.toLocaleString()}</p>
              </>
            )}
            {resultData.outcome === 'blown' && (
              <>
                <p className="text-center text-lg font-bold text-red-400">Contract Blown</p>
                <p className="text-center text-xs text-gray-300">Target Alerted. {resultData.res.message}</p>
                <p className="text-center text-xs text-gray-400">
                  Notoriety +25 &middot; Wanted +3
                  {resultData.res.fine > 0 && ` · Seized $${resultData.res.fine.toLocaleString()}`}
                  {resultData.res.jailed && ' · Arrested'}
                </p>
              </>
            )}
            {resultData.outcome === 'walkAway' && (
              <>
                <p className="text-center text-lg font-bold text-gray-300">Case File Withdrawn</p>
                <p className="text-center text-xs text-gray-400">Pulled the file before it went anywhere. Standing -1.</p>
              </>
            )}
            <div className="mt-1 flex gap-2">
              <button
                onClick={startCase}
                disabled={player.energy < ENERGY_COST}
                className="flex-1 border-2 border-zinc-400 py-1.5 text-sm font-bold text-zinc-200 hover:bg-zinc-400 hover:text-black disabled:opacity-30"
              >
                Take Another Contract
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
      <div className="glass-panel relative w-[560px] max-h-[85vh] overflow-y-auto border-4 border-zinc-500 bg-[#1c1d3a] p-6 font-mono text-white">
        {body}
      </div>
    </div>
  )
}
