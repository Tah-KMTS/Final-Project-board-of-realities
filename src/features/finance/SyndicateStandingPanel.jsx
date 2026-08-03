import { useGameStore } from '../../store/useGameStore'
import { CRIME_SYNDICATES } from '../government/crimeSyndicates'
import { getRivalIds, RANK_GATE } from '../agents/syndicateStandingEngine'

// Read-only v1 display: 7 syndicates, current standing, current unlocked
// rank tier, and (if any) rivals - so the player can see the consequences of
// playing all 7 against each other without this becoming a second
// mini-game. No actions live here; standing itself only moves via
// recordSyndicateJobOutcome/declineSyndicateJob calls elsewhere (syndicate
// job flows) and passive decay (endDay()).
const TIER_LABEL = { capo: 'Capo', underboss: 'Underboss', boss: 'Boss' }
const TIER_COLOR = { capo: 'text-gray-400', underboss: 'text-amber-300', boss: 'text-red-400' }

export default function SyndicateStandingPanel() {
  const syndicateStanding = useGameStore((s) => s.world2.syndicateStanding) || {}
  const getSyndicateRankTier = useGameStore((s) => s.getSyndicateRankTier)

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-gray-400">
        Your reputation with each of the 7 syndicates - a neutral operator can climb every ladder at once, but rivals
        notice when you're doing well with their enemies. Underboss content unlocks at {RANK_GATE.underboss} standing,
        Boss storylines at {RANK_GATE.boss}.
      </p>

      <div className="flex flex-col gap-2">
        {CRIME_SYNDICATES.map((syn) => {
          const standing = syndicateStanding[syn.id] || 0
          const tier = getSyndicateRankTier(syn.id)
          const rivals = getRivalIds(syn.id)
            .map((rivalId) => CRIME_SYNDICATES.find((s) => s.id === rivalId)?.name || rivalId)

          return (
            <div key={syn.id} className="border-2 border-gray-700 bg-black/30 p-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white">{syn.name}</span>
                <span className={`text-xs font-bold uppercase tracking-wider ${TIER_COLOR[tier]}`}>
                  {TIER_LABEL[tier]}
                </span>
              </div>
              <div className="mt-1 h-2 w-full border border-gray-600 bg-gray-900">
                <div
                  className="h-full bg-red-500"
                  style={{ width: `${Math.max(0, Math.min(100, standing))}%` }}
                />
              </div>
              <div className="mt-1 flex items-center justify-between text-xs text-gray-400">
                <span>{standing}/100 - {syn.territory}</span>
                {rivals.length > 0 && <span className="text-red-400">Rival: {rivals.join(', ')}</span>}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
