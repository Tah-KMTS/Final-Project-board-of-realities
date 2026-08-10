// Flavor-tier buildings for the Commercial, Underground, and Government &
// Cultural Districts. These are deliberately lightweight (no mini-games,
// no new systems) - each is a data-driven config consumed by
// DistrictBuildingModal.jsx, wired to the same cash/wantedLevel/reputation
// primitives the rest of Capital Syndicate already uses.

export const DISTRICT_BUILDINGS_CONFIG = {
  // --- Commercial District ---
  // Casino and Arcade used to be flat one-action stubs routed through this
  // shared config + DistrictBuildingModal. They've since grown real
  // minigames (see src/features/casino and src/features/arcade) and now get
  // their own dedicated modals wired directly in WorldScreen.jsx, so their
  // entries were removed from here rather than left as dead duplicates.
  // Hotel's entry (Capital Suites Hotel) was removed in Phase 4 - the
  // building itself isn't one of the 14 spec'd main-building categories and
  // was deleted from FINANCE_BUILDING_DEFS along with 16 other buildings.

  // --- Underground District ---
  // These three used to be a single-button `{ cashDelta, wantedDelta,
  // reputationDelta }` action resolved by DistrictBuildingModal's flat
  // `Math.random() < 0.5` coin flip. Retrofitted onto LeverageMeter (the
  // shared dual-meter negotiation minigame - see LeverageMeter.jsx): a
  // `type: 'leverage'` action hands its `leverage` block straight through
  // as LeverageMeter props/stakes instead of running through the old
  // cashDelta/wantedDelta runAction() path. Payouts ($400/$800/$1,200) and
  // the wanted/reputation hits are carried over unchanged onto
  // wantedIncreaseOnFail/reputationDeltaOnFail - same numbers, now paid
  // only on a lost negotiation instead of unconditionally. `target` scales
  // with payout (50 -> 85 -> 120) so the higher-value actions are the
  // longer races, and `baseSuccessChance` scales down accordingly (0.65 ->
  // 0.55 -> 0.45) so bigger scores stay meaningfully riskier even for a
  // skilled build. No assetSeizureOnFail/jailChanceOnFail - these petty
  // crimes never had a cash-seizure or jail consequence before, and this
  // is a mechanic swap, not a rebalance.
  // Syndicate branding pass (see src/features/agents/syndicateStandingEngine.js
  // and src/data/syndicate.js): Crime Alley -> five_families. Lucky Luciano
  // (syndicateId 'five_families' in crimeSyndicates.js) is literally embedded
  // in this same tab (see UnderworldModal.jsx's crimeAlley case, which renders
  // <NamedNpcModal npcId="luciano" /> right alongside this action) - the
  // strongest possible justification, a direct data fact rather than a bio
  // inference. inHomeTurf is false: five_families' territory is "Commercial
  // District - Docks" (crimeSyndicates.js), but this building sits in the
  // Underground District - a real mismatch, not an ambiguous case, so no
  // home-turf payout/bail/jail bonus applies here.
  crimeAlley: {
    title: 'Crime Alley',
    district: 'Underground District',
    borderClass: 'border-red-500',
    textClass: 'text-red-400',
    flavor: 'Broken neon signs and worse intentions. Nobody official comes down here.',
    actions: [
      {
        type: 'leverage',
        // Which racket-specific minigame component DistrictBuildingModal
        // renders instead of the shared LeverageMeter (see
        // MINIGAME_COMPONENTS there) - the 4 Underworld actions each got
        // their own distinct mechanic in the same pass that added this
        // field; stakes/payout/risk numbers below are untouched (mechanic
        // swap, not a rebalance - see game-designer's scoping notes).
        // Was briefly 'shootingRange' (ShootingRangeModal.jsx) for a literal
        // shooting-gallery minigame here, then 'lookoutWatch'
        // (LookoutWatchModal.jsx, a Safe/Hot reaction game) after the range
        // moved to GunStoreModal.jsx's "Test-Fire Range" tab. Now
        // 'crimeAlleyHeist' (CrimeAlleyHeistModal.jsx) - a real stealth/
        // combat side-view heist (walk/crouch/hide/loot/fight against 4
        // patrol guards) replacing the abstract reaction-timer entirely.
        // payout/target/suspicionCap/baseSuccessChance are gone - this
        // mechanic pays out per-crate via addCash live during the run
        // instead of one lump sum on a meter filling, so there's no single
        // "payout" stake to carry; see CrimeAlleyHeistModal.jsx's own header
        // comment for the full stakes split (its fixed numbers - heat
        // thresholds, guard speeds/cone, HP, loot range - live as constants
        // in that file, not threaded through this stakes object).
        //
        // wantedIncreaseOnFail/jailChanceOnFail were dropped from here (the
        // job used to carry both) at the user's explicit request: the deep
        // Underworld is framed as shielded from police by the syndicate's
        // own protection - losing a fight down here gets you thrown out and
        // costs the run's take plus standing with the Family
        // (notoriety/reputation, both kept), not an arrest. That's a real,
        // deliberate difference from every OTHER criminal action in the
        // game (which still carry Wanted/jail), scoped to this one job -
        // not a precedent to copy onto other Underworld actions without the
        // same explicit call.
        minigame: 'crimeAlleyHeist',
        label: 'Rob The Stashes',
        leverage: {
          title: 'Crime Alley Heist',
          markName: "Luciano's Back-Lot Stash",
          markDescription:
            "The Five Families stash their overflow cash in crates down this alley, watched by a few hired guards. Slip past them, crack the crates, and get out - or fight your way through if you get made.",
          buttonLabel: 'Run The Job',
          stakes: {
            energyCost: 20,
            notorietyIncreaseOnFail: 1,
            reputationDeltaOnFail: -3,
            syndicateId: 'five_families',
            inHomeTurf: false,
          },
        },
      },
    ],
  },
  // Black Market -> medellin_cartel. Of the two remaining candidates left
  // over after five_families/murder_inc/national_syndicate/speakeasy_syndicate
  // are claimed elsewhere (medellin_cartel vs. griselda_empire - see
  // syndicate.js), the Medellin Syndicate's whole specialty is moving
  // physical contraband through hidden smuggling channels (Escobar's "Global
  // Narcotic Smuggling," Gaviria's air-drop logistics, Ochoa's
  // banking/shipping fronts) - a much closer fit for "goods that fell off a
  // truck" than the Griselda Empire's nightclub-extortion/turf-dominance
  // specialty. It also happens to be a genuine home-turf match: medellin_cartel's
  // territory is "Underground District - Docks" (crimeSyndicates.js), whose
  // district prefix ("Underground District") matches this building's district
  // exactly - see isHomeTurf() in syndicateStandingEngine.js.
  blackMarket: {
    title: 'Black Market',
    district: 'Underground District',
    borderClass: 'border-purple-500',
    textClass: 'text-purple-300',
    flavor: 'Everything has a price down here, and nobody asks where it came from.',
    actions: [
      // Swapped from 'fencesTable' (FencesTableModal.jsx, a haggling
      // ladder - the file's still here, just no longer wired to anything)
      // to 'lockpick' (LockpickModal.jsx, a real-time lockpick/safe-cracker)
      // at the user's explicit request. Mechanic swap, not a rebalance -
      // target/suspicionCap/baseSuccessChance are gone (LockpickModal.jsx
      // doesn't use a favorability roll, see its own header comment) but
      // every stake that still applies (payout, energyCost, the fail
      // consequences, syndicateId/inHomeTurf) carries over unchanged, same
      // convention crimeAlley's own swap to CrimeAlleyHeistModal used.
      {
        type: 'leverage',
        minigame: 'lockpick',
        label: 'Crack The Safe',
        leverage: {
          title: 'Crack The Safe',
          markName: 'A Fence Who Asks No Questions',
          markDescription: "He's got a lockbox in the back he can't be seen opening himself. Yours if you can crack it quietly.",
          buttonLabel: 'Pick The Lock',
          stakes: {
            payout: 800,
            notorietyIncreaseOnFail: 0,
            wantedIncreaseOnFail: 2,
            reputationDeltaOnFail: -3,
            assetSeizureOnFail: 0,
            jailChanceOnFail: 0,
            energyCost: 18,
            syndicateId: 'medellin_cartel',
            inHomeTurf: true,
          },
        },
      },
    ],
  },
  // Call Center Ops is deliberately left UNBRANDED (no syndicateId). The only
  // candidate left after the assignments above is griselda_empire, and none
  // of her bios (Blanco's nightclub/turf-war rackets, Osvaldo's boat/truck
  // transport, Dixon's venue extortion - see syndicate.js) have anything to
  // do with remote telephone/boiler-room fraud. Forcing that mapping just to
  // brand all 7 syndicates would be exactly the "bad mapping to use up the
  // roster" the standing system's design pass explicitly warned against -
  // an honest gap is better than an invented one. Behavior is unchanged from
  // before this pass: applyCrimeOutcome/declineSyndicateJob both no-op when
  // stakes.syndicateId is absent.
  callCenterOps: {
    title: 'Call Center Ops',
    district: 'Underground District',
    borderClass: 'border-yellow-500',
    textClass: 'text-yellow-300',
    flavor: "Rows of headsets and scripted lies. 'Ma'am, this is about your car's extended warranty.'",
    actions: [
      // Swapped from 'callCenterQte' (CallCenterQTEModal.jsx - still here,
      // just no longer wired) to 'signalIntercept' (SignalInterceptModal.jsx,
      // a real-time keypad-QTE + frequency-tuning dual-task) at the user's
      // explicit request. Mechanic swap, not a rebalance - same reasoning
      // as blackMarket's lockpick swap above, see this file's own header
      // comment: target/suspicionCap/baseSuccessChance drop out (no
      // favorability roll in the new mechanic), everything else unchanged.
      {
        type: 'leverage',
        minigame: 'signalIntercept',
        label: 'Run a Scam Script',
        leverage: {
          title: 'Run a Scam Script',
          markName: 'Whoever Picked Up',
          markDescription: 'Scripted lies down a headset. The longest con of the three - keep the mark on the line without spooking them.',
          buttonLabel: 'Patch In',
          stakes: {
            payout: 1200,
            notorietyIncreaseOnFail: 0,
            wantedIncreaseOnFail: 2,
            reputationDeltaOnFail: -4,
            assetSeizureOnFail: 0,
            jailChanceOnFail: 0,
            energyCost: 25,
          },
        },
      },
    ],
  },

  // --- Government & Cultural District ---
  // Parliament Hall and Serenity Park's entries were removed in Phase 4 for
  // the same reason as Hotel above - neither building is one of the 14
  // spec'd main-building categories.
  // NOTE: this entry is currently unreachable dead config, not a live carve-out
  // to preserve. WorldScreen.jsx explicitly excludes id === 'temple' from the
  // DistrictBuildingModal branch and routes it to the dedicated
  // src/features/temple/TempleModal.jsx instead (its own Seek
  // Atonement/Chapel Blessing/Embezzle buttons, none of which read this
  // config). Left in place rather than deleted since cleaning up dead config
  // wasn't part of the Leverage retrofit this comment describes - but it IS
  // the answer to "does anything besides the three Underground actions use
  // this generic gamble-free flat-action shape": no live building does. If a
  // future flat-priced-transaction building ever does reuse this shape, the
  // `cost`/`wantedDelta`/`resultText` fields below (no `type: 'leverage'`)
  // are exactly the "don't force it through the meter" shape to copy.
  temple: {
    title: 'Whispering Temple',
    district: 'Government & Cultural District',
    borderClass: 'border-slate-300',
    textClass: 'text-slate-200',
    flavor: 'Incense smoke curls past old stone. Even the most ruthless traders come here to feel forgiven.',
    actions: [
      {
        label: 'Seek Atonement ($1,000)',
        cost: 1000,
        wantedDelta: -1,
        resultText: 'The monks nod. Some of the noise around you quiets.',
      },
    ],
  },
}
