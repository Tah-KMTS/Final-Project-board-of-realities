import { useState } from 'react'
import DistrictBuildingModal from './DistrictBuildingModal'
import NamedNpcModal from './NamedNpcModal'
import InteractiveLocationModal from '../world/InteractiveLocationModal'
import LeverageActionPanel from './LeverageActionPanel'
import SyndicateStandingPanel from './SyndicateStandingPanel'
import EscobarAirDropModal from './EscobarAirDropModal'
import OffshoreAuditModal from './OffshoreAuditModal'
import ContractDeductionModal from './ContractDeductionModal'
import { useGameStore } from '../../store/useGameStore'
import { RANK_GATE } from '../agents/syndicateStandingEngine'

// The Speakeasy Hotel tab's one skill-checked criminal action: a bootleg &
// protection squeeze with Al Capone. Before this, chicago_outfit had no
// branded action anywhere in the game - unlike its rival speakeasy_syndicate
// (Hoover's bribe in GovernmentBuildingModal.jsx), it had no way to climb
// toward its own Boss gate at all. Capone is the exact right mark for it,
// not an inference: syndicate.js lists his syndicateId as 'chicago_outfit'
// and his specialty verbatim as "Bootleg Speakeasy & Extortion Squeeze," and
// his bio's night-block schedule entry is literally set at "Subterranean
// Green Mill Speakeasy... collecting 20% extortion cuts from club owners" -
// this tab (the Speakeasy Hotel) is his own venue by name.
//
// Kept in the same street-tier shape as Crime Alley/Black Market/Call
// Center Ops (districtBuildings.js) rather than the Boss-tier shape
// (Hoover/McNamara/Vanderbilt) for the same reason as Griselda's Nightclub
// Dues action (see ConcertHallTab.jsx): this is a street-level racket, not
// a federal-scale operation, so notoriety stays low and there's no asset
// seizure on a failed run. Priced at the top of the "lower-middle" band the
// design brief called for (above Call Center Ops' $1,200, below Hoover's
// $1,500) since Capone is a syndicate Boss collecting personally, not a
// street-level fence - and baseSuccessChance continues that tier's
// established downward slope from Call Center Ops' 0.45 to reflect the
// bigger ask. A small jailChanceOnFail (absent from the three cheaper
// street actions) reflects that a blown squeeze against Capone's own crew
// draws real police attention, not just an angry mark.
//
// IMPORTANT: this action is added ALONGSIDE the existing speakeasy_club
// whiskey-shop InteractiveLocationModal below (buy bootleg whiskey for
// energy / -1 wanted), not in place of it - same "append, don't replace"
// pattern LeverageActionPanel was built for (see that file's own header
// comment, and IndustrialZoneModal.jsx/BusinessCenterModal.jsx/
// GovernmentBuildingModal.jsx for precedent). Do not remove the whiskey shop.
const CAPONE_SQUEEZE_STAKES = {
  target: 128,
  suspicionCap: 100,
  payout: 1350,
  notorietyIncreaseOnFail: 1,
  wantedIncreaseOnFail: 2,
  reputationDeltaOnFail: -5,
  assetSeizureOnFail: 0,
  jailChanceOnFail: 0.05,
  energyCost: 22,
  baseSuccessChance: 0.44,
  syndicateId: 'chicago_outfit',
  // inHomeTurf is true: chicago_outfit's territory is "Underground District -
  // West" (crimeSyndicates.js), and the Underworld building this tab lives in
  // is explicitly labeled "Underground District" (see this modal's own
  // header below) - a real district-prefix match per isHomeTurf(), the same
  // strength of match Hoover's and Vanderbilt's home-turf bonuses use.
  inHomeTurf: true,
}

// The 3 Boss-tier signature jobs (see EscobarAirDropModal.jsx/
// OffshoreAuditModal.jsx/ContractDeductionModal.jsx for the mechanics) all
// live behind one "Boss Jobs" tab here per the design brief's explicit
// preference, rather than being scattered across the three separate
// district building modals each syndicate's Capo/Underboss content already
// lives in. Each entry shows current standing against the RANK_GATE.boss
// requirement right on the menu card, before the player even opens the job -
// BossJobGate.jsx repeats the same information inside each job's own
// briefing screen once opened, so the gate teaches the system at both
// touchpoints.
const BOSS_JOBS = [
  {
    id: 'escobar',
    syndicateId: 'medellin_cartel',
    name: 'Air-Drop Route Planner',
    boss: 'Pablo Escobar',
    borderClass: 'border-orange-600',
    textClass: 'text-orange-300',
    barClass: 'bg-orange-500',
  },
  {
    id: 'lansky',
    syndicateId: 'national_syndicate',
    name: 'Offshore Audit',
    boss: 'Meyer Lansky',
    borderClass: 'border-slate-500',
    textClass: 'text-slate-200',
    barClass: 'bg-slate-400',
  },
  {
    id: 'lepke',
    syndicateId: 'murder_inc',
    name: 'Contract Deduction',
    boss: 'Lepke Buchalter',
    borderClass: 'border-zinc-500',
    textClass: 'text-zinc-200',
    barClass: 'bg-zinc-400',
  },
]

function BossJobsMenu({ onSelect }) {
  const syndicateStanding = useGameStore((s) => s.world2.syndicateStanding) || {}

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs text-gray-400">
        Boss-tier work, offered directly by the syndicate's top man once you've earned it (standing {RANK_GATE.boss}+).
        One job per syndicate per day.
      </p>
      {BOSS_JOBS.map((job) => {
        const standing = syndicateStanding[job.syndicateId] || 0
        const locked = standing < RANK_GATE.boss
        return (
          <button
            key={job.id}
            onClick={() => onSelect(job.id)}
            className={`flex flex-col items-start gap-1 border-2 ${job.borderClass} bg-[#0f1020] p-3 text-left hover:bg-white/5`}
          >
            <div className="flex w-full items-center justify-between">
              <span className={`text-sm font-bold ${job.textClass}`}>{job.name}</span>
              <span className={`text-xs font-bold uppercase tracking-widest ${locked ? 'text-gray-500' : 'text-green-400'}`}>
                {locked ? 'Locked' : 'Available'}
              </span>
            </div>
            <span className="text-xs text-gray-400">{job.boss}</span>
            <span className="text-xs text-gray-500">
              Standing {standing} / {RANK_GATE.boss} required
            </span>
          </button>
        )
      })}
    </div>
  )
}

// Building consolidation (Phase 2): Black Market + Call Center Ops + Crime
// Alley (Lucky Luciano) + Speakeasy Hotel (Al Capone) used to be 4 separate
// standalone buildings on the map. They're now one physical building
// ('underworld' in OverworldScene.js's FINANCE_BUILDING_DEFS) with a tab per
// former tenant - same TABS pattern as CasinoModal.jsx.
//
// Crime Alley used to independently trigger BOTH DistrictBuildingModal (via
// WorldScreen.jsx's DISTRICT_BUILDING_IDS branch) AND NamedNpcModal (via the
// npcId branch) stacked on top of each other at once, because the building
// def carried both an id DistrictBuildingModal keyed on and an npcId
// NamedNpcModal keyed on - two independent JSX conditions in WorldScreen.jsx
// both matching the same activeModal. That's deliberately NOT reproduced
// here: the Crime Alley tab below composes both pieces of content in one
// tab body instead of leaving them stacked.
const TABS = [
  { id: 'blackMarket', label: 'Black Market' },
  { id: 'callCenterOps', label: 'Call Center Ops' },
  { id: 'crimeAlley', label: 'Crime Alley' },
  { id: 'speakeasy', label: 'Speakeasy Hotel' },
  { id: 'bossJobs', label: 'Boss Jobs' },
  // Read-only Standing display (v1 scope: 7 Bosses only) - see
  // src/features/agents/syndicateStandingEngine.js for the underlying model.
  { id: 'standing', label: 'Standing' },
]

export default function UnderworldModal({ onClose }) {
  const [tab, setTab] = useState('blackMarket')
  // Which Boss job (if any) is currently open within the Boss Jobs tab -
  // null shows BossJobsMenu instead. Reset whenever the player leaves the
  // tab entirely so switching away and back always starts at the menu.
  const [bossJobSelection, setBossJobSelection] = useState(null)

  const selectTab = (id) => {
    setTab(id)
    if (id !== 'bossJobs') setBossJobSelection(null)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="glass-panel w-[640px] border-4 border-red-500 bg-[#1c1d3a] p-6 font-mono text-white">
        <p className="mb-1 text-xs uppercase tracking-widest text-gray-500">Underground District</p>
        <h2 className="mb-2 text-xl font-bold text-red-400">The Underworld</h2>
        <p className="mb-3 text-xs text-gray-400">
          Fenced goods, boiler-room scams, back-alley shakedowns, and Prohibition-era bootlegging, all under one roof
          nobody official ever checks.
        </p>

        <div className="mb-3 flex flex-wrap gap-2">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => selectTab(t.id)}
              className={`border-2 px-3 py-1 text-xs font-bold ${
                tab === t.id ? 'border-red-500 bg-red-500/20 text-red-300' : 'border-gray-600 text-gray-400 hover:border-gray-400'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="mb-4 max-h-[460px] overflow-y-auto">
          {tab === 'blackMarket' && <DistrictBuildingModal buildingId="blackMarket" embedded />}
          {tab === 'callCenterOps' && <DistrictBuildingModal buildingId="callCenterOps" embedded />}
          {tab === 'crimeAlley' && (
            <div className="flex flex-col gap-4">
              <DistrictBuildingModal buildingId="crimeAlley" embedded />
              <div className="border-t-2 border-gray-700 pt-4">
                <p className="mb-2 text-xs uppercase tracking-widest text-gray-500">Also lurking here</p>
                <NamedNpcModal npcId="luciano" embedded />
              </div>
            </div>
          )}
          {tab === 'speakeasy' && (
            <>
              <InteractiveLocationModal locationId="speakeasy_club" embedded />
              <LeverageActionPanel
                accentBorderClass="border-red-500"
                teaser="Capone doesn't run the tables himself, but the club's take owes him a cut every night regardless. Somebody has to go collect it in person."
                buttonLabel="Run the Squeeze"
                leverage={{
                  title: 'Bootleg & Protection Squeeze',
                  markName: "Al Capone's Club Circuit",
                  markDescription:
                    "Green Mill's owner is stalling on this week's cut, and two smaller joints down the block are watching to see if it costs him anything. Make an example, quietly.",
                  buttonLabel: 'Apply The Squeeze',
                  stakes: CAPONE_SQUEEZE_STAKES,
                }}
              />
            </>
          )}
          {tab === 'bossJobs' && (
            bossJobSelection == null ? (
              <BossJobsMenu onSelect={setBossJobSelection} />
            ) : (
              <div className="flex flex-col gap-3">
                <button
                  onClick={() => setBossJobSelection(null)}
                  className="self-start border-2 border-gray-600 px-2 py-1 text-xs uppercase tracking-widest text-gray-400 hover:bg-gray-700"
                >
                  Back to Boss Jobs
                </button>
                {bossJobSelection === 'escobar' && (
                  <EscobarAirDropModal embedded onClose={() => setBossJobSelection(null)} />
                )}
                {bossJobSelection === 'lansky' && (
                  <OffshoreAuditModal embedded onClose={() => setBossJobSelection(null)} />
                )}
                {bossJobSelection === 'lepke' && (
                  <ContractDeductionModal embedded onClose={() => setBossJobSelection(null)} />
                )}
              </div>
            )
          )}
          {tab === 'standing' && <SyndicateStandingPanel />}
        </div>

        <button onClick={onClose} className="w-full border-4 border-gray-500 py-2 font-bold hover:bg-gray-500">
          Leave the Underworld
        </button>
      </div>
    </div>
  )
}
