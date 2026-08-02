import { useCallback, useEffect, useRef, useState } from 'react'
import { useGameStore } from '../../store/useGameStore'

// Leverage - the shared "dual-meter race" negotiation minigame. Built to
// replace the flat Math.random() < 0.5 coin-flip DistrictBuildingModal
// currently uses for its `gamble` actions (Crime Alley / Black Market /
// Call Center Ops - see districtBuildings.js), plus any other "lean on
// someone" beat across the four NPC-hub buildings. NOT wired into any of
// those modals yet - that's a follow-up task, see the bottom of this
// file's sibling summary for the exact prop contract it'll need.
//
// Deliberately a different feel from TradeMeter (a single static timing
// zone you aim for once, no fail state). This is a race between two
// meters that BOTH move while you play:
//
//   Leverage   0 -> stakes.target          (you're winning this one)
//   Suspicion  0 -> stakes.suspicionCap    (the mark is winning this one)
//
// Leverage hits its target first  -> success.
// Suspicion hits its cap first    -> failure.
//
// The only input is "Apply Pressure" (Space key or click). Every
// successful press:
//   + pressurePerTap towards Leverage   (stat-scaled, locked in at start)
//   + a FIXED +3 towards Suspicion      (deliberately NOT stat-scaled -
//     applying pressure always carries irreducible risk; no build can
//     make pressing itself costless)
// Suspicion ALSO creeps up passiveSuspicionPerSec every second on its
// own, whether or not you're pressing - the mark's patience running out
// regardless of player input. That passive tick is what forces paced
// play: sit on your hands too long and you lose anyway; mash too fast
// and the fixed per-tap suspicion cost buries you before Leverage can
// catch up. A universal (also NOT stat-scaled) 220ms rate limit on top
// means even a stat-maxed build has to time presses, not blindly mash.
//
// Difficulty is DERIVED from executeCrime's existing success-probability
// formula (see useGameStore.js) - same reads (stats.streetwise,
// notoriety, getEffectiveLuck()), same 0.05-0.95 clamp - just redirected
// from a single coin-flip weight into meter tuning. A build that would
// have had a high success chance under the old system gets an easier
// race here (bigger taps, slower passive suspicion), not a guaranteed
// win; a bad build gets a harder one, not an impossible one.
//
// Resolution bypasses executeCrime entirely: the player's meter race
// IS the outcome, fed straight into applyCrimeOutcome({ success, ...
// stakes }) - the same bypass pattern VaultCrackModal uses for its
// Mastermind puzzle. No second hidden dice roll stacked on top of the
// minigame result. energyCost is spent once at start regardless of
// outcome, matching every other executeCrime caller's convention.
//
// Contract: self-contained, onClose only - no onVictory/onDefeat
// handshake. This intentionally does NOT follow the combat-modal
// contract (RiftCombatModal/DuelModal); it matches every existing
// finance minigame (VaultCrackModal, WharfModal, Slots) where nothing
// upstream branches on the result. `embedded` mirrors
// DistrictBuildingModal's convention: skip the overlay + own close
// controls when a wrapping hub modal (e.g. a future tabbed
// UnderworldModal) already supplies both.

// Universal rate limit - NOT stat-scaled. This is a floor every build
// hits, not a difficulty knob; it exists purely so "mash Space as fast
// as possible" is never the optimal strategy.
const MIN_TAP_INTERVAL_MS = 220

// Fixed per-tap suspicion cost - see header comment. Never touched by
// favorability/stats. Pressing always costs exactly this much risk.
const SUSPICION_PER_TAP = 3

function clamp(min, max, v) {
  return Math.max(min, Math.min(max, v))
}

// Locked-at-start difficulty derivation. Mirrors executeCrime's
// successProb formula in useGameStore.js almost verbatim, just fed into
// meter tuning instead of a single Math.random() roll:
//
//   favorability = clamp(0.05, 0.95,
//     baseSuccessChance + streetwise*0.02 - notoriety*0.002 + (luck-5)*0.01)
//   pressurePerTap         = round(6 + (favorability - 0.5) * 8)   // ~2..10
//   passiveSuspicionPerSec = round(9 - (favorability - 0.5) * 10)  // ~4..14
//
// Reads getEffectiveLuck() (not stats.luck raw) so the Temple's Chapel
// Blessing buff applies here exactly like it does everywhere else Luck
// matters. Computed once, at the moment the player commits (spends
// energy), and never recalculated mid-race - same "locked at start"
// convention VaultCrackModal uses for its INT-derived attempt count.
function computeLockedParams(baseSuccessChance) {
  const state = useGameStore.getState()
  const streetwise = state.player.stats.streetwise ?? 5
  const effectiveLuck = state.getEffectiveLuck()
  const favorability = clamp(
    0.05,
    0.95,
    baseSuccessChance + streetwise * 0.02 - state.notoriety * 0.002 + (effectiveLuck - 5) * 0.01
  )
  const pressurePerTap = Math.round(6 + (favorability - 0.5) * 8)
  const passiveSuspicionPerSec = Math.round(9 - (favorability - 0.5) * 10)
  return { favorability, pressurePerTap, passiveSuspicionPerSec }
}

// stakes shape (all required unless noted):
//   target                    - Leverage needed to win
//   suspicionCap = 100        - Suspicion that loses it (optional, defaults 100)
//   payout                    - $ awarded to applyCrimeOutcome on success
//   notorietyIncreaseOnFail
//   wantedIncreaseOnFail
//   reputationDeltaOnFail     - optional, signed. applyCrimeOutcome (see
//     useGameStore.js) has no concept of reputation at all - it only knows
//     cash/notoriety/wantedLevel/asset-seizure/jail - so this is applied
//     directly via addReputation right here in resolve() rather than being
//     threaded through applyCrimeOutcome. First consumer: districtBuildings.js's
//     Underground District actions, which used to apply a reputation hit
//     alongside their old flat wanted-level hit.
//   assetSeizureOnFail        - 0..1 fraction of cash seized on fail
//   jailChanceOnFail          - 0..1 base jail chance on fail
//   energyCost                - spent once at Begin, win or lose
//   baseSuccessChance         - 0..1, fed into computeLockedParams above
//   syndicateId               - optional. One of the 7 canonical ids from
//     syndicateStandingEngine.js (see districtBuildings.js/IndustrialZoneModal
//     .jsx/BusinessCenterModal.jsx/GovernmentBuildingModal.jsx for the actual
//     per-building mapping + bio justification). Omitted entirely by any
//     action that isn't branded to one of the 7 Bosses - passing `undefined`
//     through to applyCrimeOutcome/declineSyndicateJob is a no-op there, so
//     an unbranded action behaves byte-identical to before this field
//     existed.
//   inHomeTurf                - optional bool, only meaningful alongside
//     syndicateId. Whether this building's district is that syndicate's own
//     territory (see syndicateStandingEngine.js's isHomeTurf) - only ever
//     set true when the district genuinely matches; defaults to false
//     (the conservative choice) everywhere else.
export default function LeverageMeter({
  onClose,
  embedded = false,
  title = 'Leverage',
  markName = 'The Mark',
  markDescription = '',
  buttonLabel = 'Apply Pressure',
  stakes,
}) {
  const {
    target,
    suspicionCap = 100,
    payout,
    notorietyIncreaseOnFail,
    wantedIncreaseOnFail,
    reputationDeltaOnFail,
    assetSeizureOnFail,
    jailChanceOnFail,
    energyCost,
    baseSuccessChance,
    syndicateId = null,
    inHomeTurf = false,
  } = stakes

  const player = useGameStore((s) => s.player)
  const spendEnergy = useGameStore((s) => s.spendEnergy)
  const applyCrimeOutcome = useGameStore((s) => s.applyCrimeOutcome)
  const addReputation = useGameStore((s) => s.addReputation)
  const declineSyndicateJob = useGameStore((s) => s.declineSyndicateJob)

  const [screen, setScreen] = useState('intro') // 'intro' | 'race' | 'result'
  const [locked, setLocked] = useState(null) // { favorability, pressurePerTap, passiveSuspicionPerSec } - render mirror of lockedRef
  const [leverage, setLeverage] = useState(0) // render mirrors of the refs below
  const [suspicion, setSuspicion] = useState(0)
  const [cooldownFrac, setCooldownFrac] = useState(0) // 0 = ready to tap, 1 = just tapped (purely visual)
  const [resultData, setResultData] = useState(null)

  // Live values live in refs and are driven by a rAF loop, same
  // "live values in refs, state only for render" convention as
  // TradeMeter - state above is only a mirror so React can paint, the
  // resolve check itself always reads the true up-to-the-frame numbers
  // instead of a stale closure from the last render.
  const leverageRef = useRef(0)
  const suspicionRef = useRef(0)
  const lastTsRef = useRef(0)
  const lastTapTsRef = useRef(-Infinity)
  const rafRef = useRef(null)
  const resolvedRef = useRef(false)
  const lockedRef = useRef(null)

  const resolve = useCallback(
    (success) => {
      // Guards against the click handler and the rAF tick both trying to
      // resolve in the same frame (e.g. a tap pushes Leverage over the
      // target right as the loop's own check runs).
      if (resolvedRef.current) return
      resolvedRef.current = true
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      const res = applyCrimeOutcome({
        success,
        payout,
        notorietyIncreaseOnFail,
        wantedIncreaseOnFail,
        assetSeizureOnFail,
        jailChanceOnFail,
        // Both default to null/false when the stakes block omits them (every
        // pre-existing, unbranded action), which applyCrimeOutcome already
        // treats as "not a syndicate job" - see its own header comment.
        // recordSyndicateJobOutcome for success/fail fires INSIDE
        // applyCrimeOutcome itself; walkAway() below is the one outcome it
        // never produces, which is why that path calls declineSyndicateJob
        // directly instead.
        syndicateId,
        inHomeTurf,
      })
      // Reputation isn't one of applyCrimeOutcome's fields (see stakes shape
      // comment above) - applied directly here so callers who need a
      // reputation consequence don't lose it just because the shared
      // resolver doesn't know about it.
      if (!success && reputationDeltaOnFail) addReputation(reputationDeltaOnFail)
      setResultData({ success, res })
      setScreen('result')
    },
    [
      applyCrimeOutcome,
      addReputation,
      payout,
      notorietyIncreaseOnFail,
      wantedIncreaseOnFail,
      reputationDeltaOnFail,
      assetSeizureOnFail,
      jailChanceOnFail,
      syndicateId,
      inHomeTurf,
    ]
  )

  // Apply Pressure - the single input. Reads/writes refs directly so it
  // behaves identically whether it's invoked from the click handler or
  // the keydown handler below, with no stale-closure risk.
  const applyPressure = useCallback(() => {
    if (screen !== 'race' || resolvedRef.current || !lockedRef.current) return
    const now = performance.now()
    if (now - lastTapTsRef.current < MIN_TAP_INTERVAL_MS) return // universal rate limit, see header comment
    lastTapTsRef.current = now
    leverageRef.current += lockedRef.current.pressurePerTap
    suspicionRef.current += SUSPICION_PER_TAP
    setLeverage(leverageRef.current)
    setSuspicion(suspicionRef.current)
    if (leverageRef.current >= target) resolve(true)
    else if (suspicionRef.current >= suspicionCap) resolve(false)
  }, [screen, target, suspicionCap, resolve])

  // rAF loop - only runs during 'race'. Handles the passive suspicion
  // creep using real elapsed delta time (frame-rate independent, not a
  // fixed per-frame increment), the cooldown-sweep visual, and the
  // resolve check for the case where passive suspicion alone caps out
  // with no tap involved at all.
  useEffect(() => {
    if (screen !== 'race') return
    lastTsRef.current = performance.now()
    const tick = (now) => {
      // Clamped so a stalled tab can't dump one huge delta into the creep.
      // Chrome freezes rAF entirely in a backgrounded tab, so `now -
      // lastTs` on the first frame after the player alt-tabs back is the
      // whole hidden duration. Unclamped, a 30s tab-out would add
      // passiveSuspicionPerSec*30 (~180) in a single frame and instantly
      // bust an otherwise-winnable negotiation - costing the player the
      // energy already spent plus this action's notoriety/wanted/jail
      // consequences, for something they never did. 0.05 matches the same
      // guard WharfModal's reel loop uses. Effect: time spent with the tab
      // hidden simply doesn't count against the player.
      const dtSec = Math.min(0.05, (now - lastTsRef.current) / 1000)
      lastTsRef.current = now
      if (!resolvedRef.current && lockedRef.current) {
        suspicionRef.current += lockedRef.current.passiveSuspicionPerSec * dtSec
        setSuspicion(suspicionRef.current)
        const sinceTap = now - lastTapTsRef.current
        setCooldownFrac(clamp(0, 1, 1 - sinceTap / MIN_TAP_INTERVAL_MS))
        if (leverageRef.current >= target) {
          resolve(true)
        } else if (suspicionRef.current >= suspicionCap) {
          resolve(false)
        }
      }
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [screen, target, suspicionCap, resolve])

  // Space-to-tap. Only bound while the race is actually live, and torn
  // down the moment it isn't (screen change, unmount) - no lingering
  // global listener. preventDefault keeps Space from also scrolling the
  // page behind the modal.
  useEffect(() => {
    if (screen !== 'race') return
    const onKeyDown = (e) => {
      if (e.code === 'Space' || e.key === ' ') {
        e.preventDefault()
        applyPressure()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [screen, applyPressure])

  const begin = () => {
    if (player.energy < energyCost) return
    if (!spendEnergy(energyCost)) return
    const params = computeLockedParams(baseSuccessChance)
    lockedRef.current = params
    setLocked(params)
    leverageRef.current = 0
    suspicionRef.current = 0
    lastTapTsRef.current = -Infinity
    resolvedRef.current = false
    setLeverage(0)
    setSuspicion(0)
    setCooldownFrac(0)
    setResultData(null)
    setScreen('race')
  }

  // Walk away mid-race: a clean exit, matching VaultCrackModal's
  // walkAway - energy already spent stays spent, but applyCrimeOutcome
  // is never called, so no notoriety/wanted/seizure/jail consequence
  // fires. resolvedRef is set first so a race-condition rAF tick firing
  // right after can't sneak a result through.
  //
  // This IS the "declined/abandoned a job after accepting it" case
  // applyCrimeOutcome never produces on its own (walkAway is only reachable
  // from the 'race' screen, i.e. after begin() already spent the energy) -
  // so a branded action stamps the -1 walkAway standing hit here directly.
  // Unbranded actions (syndicateId null) call this with a no-op - see
  // declineSyndicateJob's own guard clause in useGameStore.js.
  const walkAway = () => {
    resolvedRef.current = true
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    lockedRef.current = null
    setLocked(null)
    setScreen('intro')
    if (syndicateId) declineSyndicateJob(syndicateId)
  }

  const leveragePct = target > 0 ? clamp(0, 100, (leverage / target) * 100) : 0
  const suspicionPct = suspicionCap > 0 ? clamp(0, 100, (suspicion / suspicionCap) * 100) : 0

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

      <h2 className="mb-2 text-xl font-bold text-amber-300">{title}</h2>

      {screen === 'intro' && (
        <div className="flex flex-col gap-3">
          <div className="border-2 border-amber-500/60 bg-[#0f1020] p-3">
            <p className="text-sm font-bold text-amber-300">{markName}</p>
            {markDescription && <p className="mt-1 text-xs text-gray-400">{markDescription}</p>}
          </div>
          <div className="grid grid-cols-2 gap-y-1 text-xs">
            <span className="uppercase tracking-widest text-gray-500">Energy Cost</span>
            <span className="text-right text-yellow-300">{energyCost}</span>
            <span className="uppercase tracking-widest text-gray-500">Payout</span>
            <span className="text-right text-green-400">${payout.toLocaleString()}</span>
            <span className="uppercase tracking-widest text-gray-500">Leverage Target</span>
            <span className="text-right text-cyan-300">{target}</span>
            <span className="uppercase tracking-widest text-gray-500">Suspicion Cap</span>
            <span className="text-right text-red-400">{suspicionCap}</span>
          </div>
          <button
            onClick={begin}
            disabled={player.energy < energyCost}
            className="w-full border-2 border-amber-400 py-1.5 text-sm font-bold uppercase tracking-widest text-amber-300 hover:bg-amber-400 hover:text-black disabled:opacity-30"
          >
            Begin
          </button>
        </div>
      )}

      {screen === 'race' && locked && (
        <div className="flex flex-col gap-3">
          <div>
            <div className="mb-0.5 flex items-center justify-between text-[10px] uppercase tracking-widest text-cyan-300">
              <span>Leverage</span>
              <span>
                {Math.floor(leverage)} / {target}
              </span>
            </div>
            <div className="h-5 w-full border-2 border-cyan-500 bg-[#0a0a16]">
              <div className="h-full bg-cyan-500 transition-[width] duration-75" style={{ width: `${leveragePct}%` }} />
            </div>
          </div>

          <div>
            <div className="mb-0.5 flex items-center justify-between text-[10px] uppercase tracking-widest text-red-400">
              <span>Suspicion</span>
              <span>
                {Math.floor(suspicion)} / {suspicionCap}
              </span>
            </div>
            <div className="h-5 w-full border-2 border-red-500 bg-[#0a0a16]">
              <div
                className={`h-full bg-red-600 transition-[width] duration-75 ${suspicionPct > 75 ? 'animate-pulse' : ''}`}
                style={{ width: `${suspicionPct}%` }}
              />
            </div>
          </div>

          <button
            onClick={applyPressure}
            className="relative w-full overflow-hidden border-4 border-amber-400 py-3 text-base font-bold uppercase tracking-widest text-amber-300 hover:bg-amber-400 hover:text-black"
          >
            {/* Cooldown sweep - purely visual feedback for the 220ms rate
                limit; applyPressure already no-ops during cooldown on its
                own, this dimming overlay just tells the player why a
                press didn't register. */}
            <span className="pointer-events-none absolute inset-0 bg-black/40" style={{ width: `${cooldownFrac * 100}%` }} />
            <span className="relative">{buttonLabel} (Space)</span>
          </button>

          <p className="text-center text-[10px] text-gray-500">
            +{locked.pressurePerTap} leverage / +{SUSPICION_PER_TAP} suspicion per press &middot; +{locked.passiveSuspicionPerSec}{' '}
            suspicion/sec passive
          </p>

          <button onClick={walkAway} className="w-full border-2 border-gray-500 py-1.5 text-xs text-gray-300 hover:bg-gray-700">
            Walk Away
          </button>
        </div>
      )}

      {screen === 'result' && resultData && (
        <div className="flex flex-col gap-2 border-2 border-amber-500 bg-[#0f1020] p-3 text-sm">
          <p className="text-center text-lg font-bold text-amber-300">{resultData.success ? 'Leverage Secured' : 'Blown'}</p>
          {resultData.success ? (
            <p className="text-center text-base font-bold text-green-400">+${resultData.res.payout.toLocaleString()}</p>
          ) : (
            <>
              <p className="text-center text-base font-bold text-red-400">{resultData.res.message}</p>
              <p className="text-center text-xs text-gray-400">
                Notoriety +{notorietyIncreaseOnFail} &middot; Wanted +{wantedIncreaseOnFail}
                {!!reputationDeltaOnFail && ` · Reputation ${reputationDeltaOnFail > 0 ? '+' : ''}${reputationDeltaOnFail}`}
                {resultData.res.fine > 0 && ` · Seized $${resultData.res.fine.toLocaleString()}`}
                {resultData.res.jailed && ' · Arrested'}
              </p>
            </>
          )}
          <div className="mt-1 flex gap-2">
            <button
              onClick={() => setScreen('intro')}
              className="flex-1 border-2 border-amber-400 py-1.5 text-sm font-bold text-amber-300 hover:bg-amber-400 hover:text-black"
            >
              Try Again
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
      <div className="glass-panel relative w-[480px] max-h-[85vh] overflow-y-auto border-4 border-amber-400 bg-[#1c1d3a] p-6 font-mono text-white">
        {body}
      </div>
    </div>
  )
}
