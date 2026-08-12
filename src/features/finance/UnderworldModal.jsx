import { useCallback, useState } from 'react'
import DistrictBuildingModal from './DistrictBuildingModal'
import InteractiveLocationModal from '../world/InteractiveLocationModal'
import LeverageActionPanel from './LeverageActionPanel'
import TheCircuitModal from './TheCircuitModal'
import SyndicateStandingPanel from './SyndicateStandingPanel'
import EscobarAirDropModal from './EscobarAirDropModal'
import OffshoreAuditModal from './OffshoreAuditModal'
import ContractDeductionModal from './ContractDeductionModal'
import GunStoreModal from '../world/GunStoreModal'
import UnderworldMapScene, { ROOMS, IMAGE_URL, NATIVE_W, NATIVE_H } from './UnderworldMapScene'
import { useGameStore } from '../../store/useGameStore'
import { RANK_GATE } from '../agents/syndicateStandingEngine'

// Matches the non-map panel's inner content width (w-[640px] minus the
// p-6/24px padding on each side, see the panel className below) - the
// default for every tab except callCenterOps, which gets its own wider
// panel (WIDE_PANEL_W below) so SignalInterceptModal.jsx's console (CRT +
// keypad + slider) has room to read as a real horizontal control panel
// instead of a cramped, scrolling column - the user's own explicit request
// after seeing it packed into the narrow default width.
const BANNER_W = 592
const WIDE_BANNER_W = 856 // WIDE_PANEL_W (900) minus the same 48px padding
const BANNER_H = 150

// A room's own tab used to swap straight to a flat dark panel with no
// visual link back to the room you just walked into (UnderworldMapScene.jsx)
// - jarring, like you'd left the building entirely rather than opened a
// door inside it. This crops the SAME source illustration to that room's
// own rect (ROOMS, shared with the map scene so the two never drift out of
// sync) and shows it as a banner above the room's actual content, so the
// tab still visually reads as "inside this specific room." The crop is
// vertically centered on the room's own rect rather than pinned to its top
// - a room's most recognizable feature (its sign, its counter) usually
// isn't right at the top wall.
function RoomBanner({ roomId, width = BANNER_W }) {
  const room = ROOMS.find((r) => r.id === roomId)
  if (!room) return null

  const scale = width / (room.x1 - room.x0)
  const bgW = NATIVE_W * scale
  const bgH = NATIVE_H * scale
  const cropCenterY = room.bannerY ?? room.y0 + (room.y1 - room.y0) / 2
  const bannerNativeH = BANNER_H / scale
  const bgPosX = -(room.x0 * scale)
  const bgPosY = -((cropCenterY - bannerNativeH / 2) * scale)

  return (
    <div
      className="relative mb-3 border-2 border-gray-700"
      style={{
        width,
        height: BANNER_H,
        backgroundImage: `url(${IMAGE_URL})`,
        backgroundSize: `${bgW}px ${bgH}px`,
        backgroundPosition: `${bgPosX}px ${bgPosY}px`,
        backgroundRepeat: 'no-repeat',
      }}
    >
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 h-10"
        style={{ background: 'linear-gradient(to bottom, transparent, #1c1d3a)' }}
      />
    </div>
  )
}

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
// here. Black Market and Crime Alley's tabs are DistrictBuildingModal-only
// now - a NamedNpcModal composition under each (Ochoa, newly added this
// pass; Luciano, pre-existing) was removed at the user's request.
// onOpenPhone/onEndDay - see CasinoModal.jsx's identical header comment for
// why these exist: FinanceStatusBar's own Phone/End Day buttons are covered
// by any `fixed inset-0` modal, and a long Underworld session (walking the
// map hub between rackets) is exactly the kind of session where backing all
// the way out just to check the phone or end the day was a real reported
// annoyance.
export default function UnderworldModal({ onClose, initialTab = 'map', onOpenPhone, onEndDay }) {
  const [tab, setTab] = useState(initialTab)
  // Which Boss job (if any) is currently open within the Boss Jobs tab -
  // null shows BossJobsMenu instead. Reset whenever the player leaves the
  // tab entirely so switching away and back always starts at the menu.
  const [bossJobSelection, setBossJobSelection] = useState(null)

  // useCallback, not a plain function: this is passed straight through to
  // UnderworldMapScene.jsx as its `onEnter` prop, which sits in that
  // component's per-frame movement effect's dependency array. An unstable
  // reference here would tear down and rebuild that effect (and reset its
  // rAF loop) on every UnderworldModal re-render, not just when the id
  // it's called with actually changes - a real, independent source of
  // walking-here-looks-laggy on top of what that file's own perf comments
  // already cover.
  const selectTab = useCallback((id) => {
    setTab(id)
    if (id !== 'bossJobs') setBossJobSelection(null)
  }, [])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div
        className={`glass-panel max-h-[92vh] overflow-y-auto overflow-x-hidden border-4 border-red-500 bg-[#1c1d3a] p-6 font-mono text-white ${
          // The map tab needs real width to keep the source illustration's
          // signage legible (see UnderworldMapScene.jsx's DISPLAY_W).
          // callCenterOps gets its own wider panel too (WIDE_BANNER_W above
          // is sized to match) - SignalInterceptModal.jsx's CRT+keypad+
          // slider console read as cramped and needed to horizontally
          // scroll inside the original 640px width, per direct user report.
          // Every other tab keeps that original 640px panel unchanged.
          //
          // max-h-[92vh] + overflow-y-auto live on THIS outer panel (not
          // just the inner content div below) so the whole modal - title,
          // room banner, "Back" button, action content, AND the "Leave the
          // Underworld" button - scrolls together as one unit on short
          // screens. Previously only the inner content div capped/scrolled
          // at 72vh; on a viewport shorter than about 900px the outer panel
          // (a `fixed inset-0` overlay, which page-level scroll can never
          // reach) had no cap of its own, so its header and Leave button
          // could get pushed off both the top and bottom of the screen
          // simultaneously with no way to scroll to either - reported by
          // the user as a horizontal+vertical scrollbar cutting off the
          // Call Center Ops tab even at 100% zoom.
          tab === 'map'
            ? 'w-[1180px] max-w-[95vw]'
            : tab === 'callCenterOps'
              ? 'w-[900px] max-w-[95vw]'
              : 'w-[640px]'
        }`}
      >
        {(onOpenPhone || onEndDay) && (
          <div className="absolute right-4 top-4 flex gap-2">
            {onOpenPhone && (
              <button
                onClick={onOpenPhone}
                className="border-2 border-violet-500/70 bg-violet-500/10 px-2 py-1 text-xs font-bold text-violet-300 hover:bg-violet-500/30"
              >
                Phone
              </button>
            )}
            {onEndDay && (
              <button
                onClick={onEndDay}
                className="border-2 border-fuchsia-400/70 bg-fuchsia-500/10 px-2 py-1 text-xs font-bold text-fuchsia-200 hover:bg-fuchsia-500/30"
              >
                End Day
              </button>
            )}
          </div>
        )}

        <p className="mb-1 text-xs uppercase tracking-widest text-gray-500">Underground District</p>
        <h2 className="mb-2 text-xl font-bold text-red-400">The Underworld</h2>
        <p className="mb-3 text-xs text-gray-400">
          Fenced goods, boiler-room scams, back-alley shakedowns, and Prohibition-era bootlegging, all under one roof
          nobody official ever checks.
        </p>

        {/* No direct-jump tab buttons any more - the point of the walkable
            hub (UnderworldMapScene.jsx) is that every racket is reached by
            actually walking to it in the room, not by clicking a menu.
            The only way back OUT of a room's content is this single button,
            which returns to the map (not to any other room) - same
            "walk there yourself" principle applies leaving as entering. */}
        {tab !== 'map' && (
          <>
            <RoomBanner roomId={tab} width={tab === 'callCenterOps' ? WIDE_BANNER_W : BANNER_W} />
            <button
              onClick={() => selectTab('map')}
              className="mb-3 border-2 border-gray-600 px-3 py-1 text-xs font-bold text-gray-400 hover:border-gray-400"
            >
              ← Back to the Underworld
            </button>
          </>
        )}

        {/* No max-height/scroll of its own any more - the outer panel div
            above now caps and scrolls the whole modal as one unit (see its
            comment). This nested div used to also cap+scroll at 72vh,
            which meant a tall tab's own "Leave the Underworld" button sat
            OUTSIDE this scroller and could still end up unreachable when
            the outer panel had no cap of its own; two independent scroll
            regions in one modal was also just confusing UX (which one do
            you scroll to see more?). Kept as a plain wrapper div (not
            removed outright) since every tab branch below still needs a
            single container to render into. */}
        <div className="mb-4">
          {tab === 'map' && <UnderworldMapScene onEnter={selectTab} />}
          {tab === 'blackMarket' && <DistrictBuildingModal buildingId="blackMarket" embedded />}
          {tab === 'callCenterOps' && <DistrictBuildingModal buildingId="callCenterOps" embedded />}
          {tab === 'crimeAlley' && <DistrictBuildingModal buildingId="crimeAlley" embedded />}
          {tab === 'speakeasy' && (
            <>
              <InteractiveLocationModal locationId="speakeasy_club" embedded />
              <LeverageActionPanel
                accentBorderClass="border-red-500"
                teaser="Capone doesn't run the tables himself, but the club's take owes him a cut every night regardless. Somebody has to go collect it in person."
                buttonLabel="Run the Squeeze"
                component={TheCircuitModal}
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
          {tab === 'gunStore' && <GunStoreModal embedded />}
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
