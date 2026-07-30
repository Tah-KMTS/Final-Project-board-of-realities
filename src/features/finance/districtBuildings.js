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
  crimeAlley: {
    title: 'Crime Alley',
    district: 'Underground District',
    borderClass: 'border-red-500',
    textClass: 'text-red-400',
    flavor: 'Broken neon signs and worse intentions. Nobody official comes down here.',
    actions: [
      { label: 'Shake Down a Local (+$400)', cashDelta: 400, wantedDelta: 1, reputationDelta: -2 },
    ],
  },
  blackMarket: {
    title: 'Black Market',
    district: 'Underground District',
    borderClass: 'border-purple-500',
    textClass: 'text-purple-300',
    flavor: 'Everything has a price down here, and nobody asks where it came from.',
    actions: [
      { label: 'Fence Stolen Goods (+$800)', cashDelta: 800, wantedDelta: 2, reputationDelta: -3 },
    ],
  },
  callCenterOps: {
    title: 'Call Center Ops',
    district: 'Underground District',
    borderClass: 'border-yellow-500',
    textClass: 'text-yellow-300',
    flavor: "Rows of headsets and scripted lies. 'Ma'am, this is about your car's extended warranty.'",
    actions: [
      { label: 'Run a Scam Script (+$1,200)', cashDelta: 1200, wantedDelta: 2, reputationDelta: -4 },
    ],
  },

  // --- Government & Cultural District ---
  // Parliament Hall and Serenity Park's entries were removed in Phase 4 for
  // the same reason as Hotel above - neither building is one of the 14
  // spec'd main-building categories.
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
