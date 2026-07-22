// Flavor-tier buildings for the Commercial, Underground, and Government &
// Cultural Districts. These are deliberately lightweight (no mini-games,
// no new systems) - each is a data-driven config consumed by
// DistrictBuildingModal.jsx, wired to the same cash/wantedLevel/reputation
// primitives the rest of Capital Syndicate already uses.

export const DISTRICT_BUILDINGS_CONFIG = {
  // --- Commercial District ---
  casino: {
    title: 'Neon Dragon Casino',
    district: 'Commercial District',
    borderClass: 'border-pink-400',
    textClass: 'text-pink-300',
    flavor: 'Chips clatter under buzzing neon dragons. The house always has an edge — but so do you, tonight.',
    actions: [{ label: 'Place a $100 Bet', cost: 100, gamble: true, cashDelta: 200 }],
  },
  arcade: {
    title: 'Pixel Palace Arcade',
    district: 'Commercial District',
    borderClass: 'border-cyan-400',
    textClass: 'text-cyan-300',
    flavor: 'Retro cabinets hum next to VR pods. Locals come here to be seen as much as to play.',
    actions: [
      {
        label: 'Play a Round & Mingle ($10)',
        cost: 10,
        reputationDelta: 2,
        resultText: 'You rack up a high score. People notice.',
      },
    ],
  },
  hotel: {
    title: 'Capital Suites Hotel',
    district: 'Commercial District',
    borderClass: 'border-amber-300',
    textClass: 'text-amber-200',
    flavor: 'Marble lobby, silent staff, rooms that cost more per night than most people make in a week.',
    actions: [
      {
        label: 'Book the Penthouse ($150)',
        cost: 150,
        reputationDelta: 3,
        resultText: 'You wake up refreshed, and you look the part of old money.',
      },
    ],
  },

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
  plasticSurgeryClinic: {
    title: 'Plastic Surgery Clinic',
    district: 'Underground District',
    borderClass: 'border-teal-400',
    textClass: 'text-teal-300',
    flavor: 'A clean, quiet clinic that asks very few questions and keeps excellent secrets.',
    actions: [
      {
        label: 'Get a New Face ($5,000)',
        cost: 5000,
        wantedDelta: -2,
        resultText: 'Nobody recognizes you anymore. The heat drops.',
      },
    ],
  },

  // --- Government & Cultural District ---
  parliament: {
    title: 'Parliament Hall',
    district: 'Government & Cultural District',
    borderClass: 'border-indigo-400',
    textClass: 'text-indigo-300',
    flavor: 'Marble columns and cameras. Every favor here is a transaction, just dressed up nicer.',
    actions: [
      {
        label: 'Make a Campaign Donation ($2,000)',
        cost: 2000,
        reputationDelta: 8,
        resultText: 'Your name gets mentioned favorably on the floor.',
      },
    ],
  },
  park: {
    title: 'Serenity Park',
    district: 'Government & Cultural District',
    borderClass: 'border-green-400',
    textClass: 'text-green-300',
    flavor: 'A rare patch of real grass between the towers. Even predators need a place to breathe.',
    actions: [
      {
        label: 'Take a Quiet Walk (Free)',
        reputationDelta: 1,
        resultText: 'The city feels a little kinder from here.',
      },
    ],
  },
  temple: {
    title: 'Whispering Temple',
    district: 'Government & Cultural District',
    borderClass: 'border-slate-300',
    textClass: 'text-slate-200',
    flavor: 'Incense smoke curls past old stone. Even the most ruthless traders come here to feel forgiven.',
    actions: [
      {
        label: 'Seek Atonement (Free)',
        wantedDelta: -1,
        resultText: 'The monks nod. Some of the noise around you quiets.',
      },
    ],
  },
}
