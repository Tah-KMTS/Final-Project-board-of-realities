import { useGameStore } from '../../store/useGameStore'
import { RANK_GATE } from '../agents/syndicateStandingEngine'

// Shared Boss-tier gate chrome for the three Capital Syndicate signature jobs:
// Escobar's Air-Drop Route Planner (EscobarAirDropModal.jsx), Lansky's
// Offshore Audit (OffshoreAuditModal.jsx), and Lepke's Contract Deduction
// (ContractDeductionModal.jsx). All three share the exact same two
// preconditions - standing >= RANK_GATE.boss (66) with the job's syndicate,
// AND today's once-per-day-per-syndicate slot not already spent (see
// isBossJobAvailableToday/markBossJobAttempted in useGameStore.js) - so the
// gate chrome lives here once instead of being copy-pasted three times.
//
// IMPORTANT usage contract: mount this ONLY around the pre-commit briefing
// screen, never around the puzzle/minigame itself. Once the player commits
// (spends energy, calls markBossJobAttempted), `isBossJobAvailableToday`
// flips to false on the very next render - if the puzzle screens were still
// children of this gate, they'd be yanked out from under the player mid-run
// the instant the cooldown got stamped. Callers swap to rendering their
// puzzle screens in a sibling branch (outside this component) once committed
// - see any of the three modals above for the exact pattern.
//
// Renders `children` only when both gates pass; otherwise renders an
// informative locked/cooldown panel that teaches the player exactly what's
// missing, per the design brief ("show the actual current standing and the
// requirement, so the gate teaches the system rather than just refusing").
export default function BossJobGate({ syndicateId, jobLabel, borderClass = 'border-gray-500', textClass = 'text-gray-300', barClass = 'bg-gray-400', children }) {
  const standing = useGameStore((s) => s.getSyndicateStanding(syndicateId))
  const canAttemptToday = useGameStore((s) => s.isBossJobAvailableToday(syndicateId))

  if (standing < RANK_GATE.boss) {
    return (
      <div className={`flex flex-col gap-3 border-2 ${borderClass} bg-[#0f1020] p-4`}>
        <p className={`text-sm font-bold uppercase tracking-widest ${textClass}`}>{jobLabel} - Locked</p>
        <p className="text-xs text-gray-400">
          This is Boss-tier work - it isn't offered to anyone below {RANK_GATE.boss} standing with this syndicate.
          Keep running Capo/Underboss jobs for them to earn it.
        </p>
        <div className="h-2 w-full border border-gray-600 bg-gray-900">
          <div className={`h-full ${barClass}`} style={{ width: `${Math.max(0, Math.min(100, standing))}%` }} />
        </div>
        <p className="text-xs text-gray-400">
          Current standing: <span className="font-bold text-white">{standing}</span> / {RANK_GATE.boss} required
        </p>
      </div>
    )
  }

  if (!canAttemptToday) {
    return (
      <div className={`flex flex-col gap-3 border-2 ${borderClass} bg-[#0f1020] p-4`}>
        <p className={`text-sm font-bold uppercase tracking-widest ${textClass}`}>{jobLabel} - Already Run Today</p>
        <p className="text-xs text-gray-400">
          This crew only moves once a day, win or lose. Come back after you end the day.
        </p>
      </div>
    )
  }

  return children
}
