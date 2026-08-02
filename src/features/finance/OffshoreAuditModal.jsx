import { useState } from 'react'
import { useGameStore } from '../../store/useGameStore'
import BossJobGate from './BossJobGate'
import LeverageMeter from './LeverageMeter'

// Lansky's Offshore Audit - National Crime Syndicate Boss-tier signature job.
// NO NEW MECHANIC: this is a reskin of the existing dual-meter LeverageMeter
// minigame (see LeverageMeter.jsx's own header for how the Leverage-vs-
// Suspicion race actually works) via its existing title/markName/
// markDescription/buttonLabel/stakes props. LeverageMeter.jsx itself is not
// touched by this file in any way.
//
// SHIPPED SINGLE-ROUND ONLY, per the design brief: the designer's
// multi-round push-your-luck variant is explicitly deferred, because
// chaining rounds would require adding a "Continue to next round" path onto
// LeverageMeter's result screen - a shared component now used by 6 other
// actions (Crime Alley, Black Market, Call Center Ops, plus the other two
// syndicate-branded buildings). That result-screen contract is NOT modified
// here.
//
// One honest simplification worth flagging: LeverageMeter's own "Try Again"
// button (on its result screen) still lets the player re-run the race
// multiple times within one open sitting of THIS modal - that isn't
// re-blocked here, because doing so would mean reaching into LeverageMeter's
// result screen, which is exactly the contract this task says not to touch.
// It's bounded instead by the energy economy (each retry re-spends the
// job's 30 energy out of a ~100/day budget, so ~3 tries max) - the same soft
// limit VaultCrackModal's own unlimited "Back to Tier Select" already relies
// on. What the once-per-day gate below actually closes off is the real
// grind vector: closing this modal (or ending the day) and reopening for a
// second free run at today's job - see BossJobGate/markBossJobAttempted.
// `embedded` mirrors DistrictBuildingModal/LeverageMeter's convention: skip
// the outer fixed overlay + own X button when a wrapping hub modal (the
// "Boss Jobs" tab of UnderworldModal.jsx) already supplies both.
export default function OffshoreAuditModal({ onClose, embedded = false }) {
  const [accepted, setAccepted] = useState(false)
  const markBossJobAttempted = useGameStore((s) => s.markBossJobAttempted)

  // The "locked at start" commitment point for this job: accepting the
  // briefing stamps today's cooldown and swaps to rendering LeverageMeter
  // directly (a sibling branch, NOT nested inside BossJobGate - see that
  // component's own header for why nesting the live minigame under a
  // reactively-gated wrapper would yank it out from under the player the
  // instant the cooldown gets stamped).
  const beginAudit = () => {
    markBossJobAttempted('national_syndicate')
    setAccepted(true)
  }

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

        <p className="mb-1 text-xs uppercase tracking-widest text-gray-500">National Crime Syndicate - Boss Job</p>
        <h2 className="mb-2 text-xl font-bold text-slate-200">Offshore Audit</h2>

        {!accepted ? (
          <BossJobGate
            syndicateId="national_syndicate"
            jobLabel="Offshore Audit"
            borderClass="border-slate-500"
            textClass="text-slate-200"
            barClass="bg-slate-400"
          >
            <div className="flex flex-col gap-3">
              <div className="border-2 border-slate-500/60 bg-[#0f1020] p-3">
                <p className="text-sm font-bold text-slate-200">Meyer Lansky, "The Mob Accountant"</p>
                <p className="mt-1 text-xs text-gray-400">
                  "We are bigger than U.S. Steel if we keep the numbers precise." Lansky wants the Swiss count-room
                  ledgers quietly re-balanced before the Syndicate's own internal auditors get to them first. Bugsy
                  Siegel is running interference upstairs, but that only buys so much time.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-y-1 text-xs">
                <span className="uppercase tracking-widest text-gray-500">Energy Cost</span>
                <span className="text-right text-yellow-300">30</span>
                <span className="uppercase tracking-widest text-gray-500">Payout</span>
                <span className="text-right text-green-400">$10,000</span>
              </div>
              <button
                onClick={beginAudit}
                className="w-full border-2 border-slate-400 py-1.5 text-sm font-bold uppercase tracking-widest text-slate-200 hover:bg-slate-400 hover:text-black"
              >
                Accept the Audit
              </button>
            </div>
          </BossJobGate>
        ) : (
          <LeverageMeter
            embedded
            onClose={onClose}
            title="Offshore Audit"
            markName='Meyer Lansky, "The Mob Accountant"'
            markDescription="Swiss count-room ledgers, shell-company wire transfers, Siegel running cover upstairs. Falsify the balance sheet before the Syndicate's own internal auditors close the books."
            buttonLabel="Falsify The Ledger"
            stakes={{
              target: 65,
              suspicionCap: 85,
              payout: 10000,
              energyCost: 30,
              baseSuccessChance: 0.5,
              notorietyIncreaseOnFail: 25,
              wantedIncreaseOnFail: 2,
              assetSeizureOnFail: 0.2,
              jailChanceOnFail: 0.12,
              syndicateId: 'national_syndicate',
            }}
          />
        )}
    </>
  )

  if (embedded) return body

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="glass-panel relative w-[480px] max-h-[85vh] overflow-y-auto border-4 border-slate-400 bg-[#1c1d3a] p-6 font-mono text-white">
        {body}
      </div>
    </div>
  )
}
