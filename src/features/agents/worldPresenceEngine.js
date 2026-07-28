// Single source of truth for "where is character X right now". Both the
// Phaser sprites (via a later worker's OverworldScene call-site) and the
// text-based modals (via dynamicScheduleEngine.js's adapter, see that file)
// read resolvePresence()/simulateWorldPresence() so a character's on-map
// position and their modal's location text can never disagree - both are
// just different renderings of the exact same resolved buildingId.
//
// Pure + deterministic: resolvePresence(id, ctx) is a pure function of its
// arguments. No Math.random anywhere in this file - every "random" choice
// is drawn from a mulberry32 PRNG seeded from a hash of
// (runSeed, characterId, day, timeBlockIndex), so the same inputs always
// reproduce the same output (required for save/load + the determinism
// verification), while different runSeeds (one per new game) fan out into
// different, but still in-character, daily behavior.

import { getDisposition } from './characterDispositions'
import { getHomeBuildingDef } from '../world/characterHomeBuildings'

export const TIME_BLOCKS = [
  { key: 'morning', label: 'Morning (8:00 AM)' },
  { key: 'midday', label: 'Midday (12:00 PM)' },
  { key: 'afternoon', label: 'Afternoon (4:00 PM)' },
  { key: 'night', label: 'Night (8:00 PM)' },
  { key: 'midnight', label: 'Midnight (12:00 AM)' },
]

// House rule: the 41 non-home building labels live in FINANCE_BUILDING_DEFS
// inside src/game/scenes/OverworldScene.js, which imports Phaser and cannot
// load in plain Node (this engine has to run there too, for tests and for
// any future server-side use). characterDispositions.js already hand-copies
// that file's building *ids* for the same reason (see its own house-rule
// comment); this is the matching hand-copy of their *labels*, kept in the
// same district grouping so the two lists are easy to diff against each
// other and against OverworldScene.js by eye. If a building is ever added,
// renamed, or removed there, mirror the change in both places.
const BUILDING_LABELS = {
  // Tokyo District
  stockExchange: 'Tokyo Stock Exchange',
  buffettHQ: 'Biffle Tower',
  vanderbiltHQ: 'Vanderbilt Rail Co.',
  muskHQ: 'Rusk Industries',
  howardMarksHQ: 'Oaktree Cycle Capital',
  appleHQ: 'Apple Glass HQ',
  cryptoExchange: 'Crypto HQ',
  corporateOffice: 'Corporate Holdings',
  vcHub: 'Venture Capital Hub',
  bank: 'Bank & Realty Office',
  realEstateAgency: 'Real Estate Agency',
  parliament: 'Parliament Hall',
  // Kyoto District
  irsHQ: 'IRS Internal Revenue',
  teaHouse: 'Cherry Coke Tea House',
  machiyaEstate: 'Machiya Executive Estate',
  zenGarden: 'Zen Rock Garden',
  silkMarket: 'Silk & Kimono Market',
  sakeBrewery: 'Fushimi Sake Brewery',
  artisanShop: 'Kiyomizu Artisan Shop',
  hotel: 'Ryokan Mountain Inn',
  park: 'Serenity Park',
  temple: 'Whispering Temple Chapel',
  // Osaka District
  casino: 'Neon Dragon Casino',
  arcade: 'Pixel Palace Arcade',
  speakeasyHotel: 'Chicago Speakeasy Hotel',
  fbiHQ: 'FBI Headquarters',
  dotonboriArcade: 'Dotonbori Merchant Arcade',
  fishMarket: 'Kuromon Fish Market',
  takoyakiStand: 'Takoyaki Street Food',
  crimeAlley: 'Crime Alley',
  blackMarket: 'Black Market',
  callCenterOps: 'Call Center Ops',
  dockVaults: 'Dock Underground Vaults',
  // Sapporo District
  fordRougeComplex: 'Ford River Rouge Complex',
  carnegieSteelMill: 'Homestead Steel Mill',
  standardOilRefinery: 'Standard Oil Refinery',
  pentagonDodHQ: 'Pentagon Procurement HQ',
  epaHQ: 'EPA Regulation Agency',
  sapporoBrewery: 'Alpine Snow Brewery',
  alpineLodge: 'Mount Yotei Alpine Lodge',
  trainStation: '🚆 Central Train Station',
}

function clamp01(n) {
  return Math.max(0, Math.min(1, n))
}

// FNV-1a style string hash -> 32-bit unsigned int, used only to turn the
// (runSeed, characterId, day, timeBlockIndex) key into a mulberry32 seed.
function hashString(str) {
  let h = 2166136261 >>> 0
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 16777619) >>> 0
  }
  return h >>> 0
}

// mulberry32: small, fast, deterministic PRNG. Given the same seed it always
// produces the same sequence, which is exactly what "pure given the same
// inputs" requires - Math.random() can never be used here because it isn't
// reproducible across calls/sessions.
function mulberry32(seed) {
  let t = seed >>> 0
  return function next() {
    t = (t + 0x6d2b79f5) >>> 0
    let r = Math.imul(t ^ (t >>> 15), 1 | t)
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296
  }
}

function makeRng(runSeed, characterId, day, timeBlockIndex) {
  const key = `${runSeed}|${characterId}|${day}|${timeBlockIndex}`
  return mulberry32(hashString(key))
}

function normalizeBlockIndex(index) {
  const n = Number.isFinite(index) ? Math.trunc(index) : 0
  return ((n % TIME_BLOCKS.length) + TIME_BLOCKS.length) % TIME_BLOCKS.length
}

// Every one of the 88 characters in characterDispositions.js has a real
// disposition, so this fallback should never actually trigger for a live
// roster id - it exists purely so a stray/unknown id degrades to "sits at
// their own (still real) home building" instead of throwing or returning a
// null buildingId.
function fallbackDisposition(characterId) {
  return {
    id: characterId,
    name: characterId,
    tier: 'regular',
    homeBuildingId: `home_${characterId}`,
    district: 'Tokyo District',
    sociability: 0.5,
    homeAffinity: 0.5,
    travelRange: 0,
    isCrime: false,
    workBuildingIds: [],
  }
}

// Personality -> probability of being AT HOME this block. Tier sets a floor/
// ceiling that encodes the hard requirements (recluses overwhelmingly home,
// socialites rarely home during business hours, fugitives holed up under
// heat); the continuous homeAffinity/sociability numbers (already unique per
// character - see characterDispositions.js's per-id jitter) shift the exact
// value within that band so no two characters of the same tier behave
// identically. Night/Midnight always resolves to a materially higher home
// probability than the business blocks, by construction, which is what
// makes "visit their home at night to find them" a meaningful mechanic.
function homeProbability(disposition, timeBlockIndex, heat) {
  const { tier, homeAffinity, sociability, isCrime } = disposition
  const isNightBlock = timeBlockIndex >= 3 // night (3), midnight (4)

  let business = clamp01(0.1 + homeAffinity * 0.55 - sociability * 0.2)
  let night = clamp01(0.55 + homeAffinity * 0.35 - sociability * 0.1)

  if (tier === 'recluse') {
    business = Math.max(business, 0.85)
    night = Math.max(night, 0.95)
  } else if (tier === 'homebody') {
    business = Math.max(business, 0.5)
    night = Math.max(night, 0.88)
  } else if (tier === 'socialite') {
    business = Math.min(business, 0.28)
    night = Math.max(night, 0.7)
  } else if (tier === 'fugitive') {
    business = Math.max(business, 0.5)
    night = Math.max(night, 0.85)
  }

  // Crime characters pull further home as heat rises (wantedLevel and/or a
  // per-character override) - a hunted fugitive holes up at their hideout
  // (their homeBuildingId) almost exclusively rather than roaming.
  if (isCrime) {
    business = clamp01(business + heat * 0.45)
    night = clamp01(night + heat * 0.25)
  }

  return isNightBlock ? night : business
}

// Recluses and characters under heat are harder for the intel/gossip system
// (a later worker's concern) to pin down - being tucked away at home also
// leaks less than being out in public regardless of tier.
function rollDiscoverable(disposition, atHome, heat, rng) {
  let leakChance = 0.7
  if (disposition.tier === 'recluse') leakChance -= 0.35
  if (disposition.isCrime) leakChance -= 0.25 * (0.5 + heat)
  if (atHome) leakChance -= 0.15
  return rng() < clamp01(leakChance)
}

const HOME_ACTIONS = [
  'Resting at home',
  'Keeping to themselves indoors',
  'Handling personal matters at home',
  'Laying low for the day',
]
const HIDEOUT_ACTIONS = [
  'Lying low at the hideout',
  'Waiting out the heat indoors',
  'Keeping off the streets for now',
]
const WORK_ACTIONS = [
  'Conducting daily business',
  'Meeting with associates',
  'Attending to work matters',
  "Out managing the day's affairs",
]
const CRIME_WORK_ACTIONS = [
  "Running the day's rackets",
  'Meeting with associates on the street',
  'Overseeing territory operations',
  'Collecting from local businesses',
]

function pickAction(disposition, atHome, heat, rng) {
  let pool
  if (atHome) {
    pool = disposition.isCrime && heat > 0.5 ? HIDEOUT_ACTIONS : HOME_ACTIONS
  } else {
    pool = disposition.isCrime ? CRIME_WORK_ACTIONS : WORK_ACTIONS
  }
  return pool[Math.floor(rng() * pool.length)]
}

const TIER_THOUGHTS = {
  recluse: ['Prefers the quiet of home to the noise of the city.', "Doesn't see the need to be seen."],
  homebody: ['Happiest close to home.', 'Keeps business brief and heads back.'],
  regular: ["Focused on today's agenda.", 'Taking things one day at a time.'],
  socialite: ['Thrives on being seen and known.', 'Always working the room.'],
  fugitive: ['Watching every shadow for a tail.', 'Trusts no one further than necessary.'],
}

function pickThought(disposition, heat, rng) {
  if (disposition.isCrime && heat > 0.6) return 'Feels the heat closing in and is keeping a low profile.'
  const pool = TIER_THOUGHTS[disposition.tier] || TIER_THOUGHTS.regular
  return pool[Math.floor(rng() * pool.length)]
}

function labelForBuilding(buildingId, characterId, homeBuildingId) {
  if (buildingId === homeBuildingId) {
    const def = getHomeBuildingDef(characterId)
    return def ? def.label : buildingId
  }
  return BUILDING_LABELS[buildingId] || buildingId
}

/**
 * Resolves a single character's current building, display text, and
 * discoverability for one (day, timeBlockIndex) instant. Pure/deterministic:
 * see the module house-rule comment above.
 */
export function resolvePresence(characterId, ctx = {}) {
  const disposition = getDisposition(characterId) || fallbackDisposition(characterId)
  const timeBlockIndex = normalizeBlockIndex(ctx.timeBlockIndex)
  const day = Number.isFinite(ctx.day) ? ctx.day : 1
  const runSeed = ctx.runSeed ?? 0
  const wantedLevel = Number.isFinite(ctx.wantedLevel) ? ctx.wantedLevel : 0
  const heat = clamp01(
    (ctx.heatByCharacter && ctx.heatByCharacter[characterId] != null
      ? ctx.heatByCharacter[characterId]
      : disposition.isCrime
        ? wantedLevel / 5
        : 0)
  )

  const rng = makeRng(runSeed, characterId, day, timeBlockIndex)

  const homeProb = homeProbability(disposition, timeBlockIndex, heat)
  let atHome = rng() < homeProb
  let buildingId

  if (atHome || disposition.workBuildingIds.length === 0) {
    buildingId = disposition.homeBuildingId
    atHome = true
  } else {
    const idx = Math.floor(rng() * disposition.workBuildingIds.length)
    buildingId = disposition.workBuildingIds[idx]
  }

  const discoverable = rollDiscoverable(disposition, atHome, heat, rng)
  const action = pickAction(disposition, atHome, heat, rng)
  const thought = pickThought(disposition, heat, rng)
  const location = labelForBuilding(buildingId, characterId, disposition.homeBuildingId)

  return {
    characterId,
    buildingId,
    atHome,
    location,
    action,
    thought,
    discoverable,
  }
}

/**
 * Batch form of resolvePresence - same contract, one call per id.
 */
export function simulateWorldPresence(characterIds, ctx = {}) {
  return characterIds.map((characterId) => resolvePresence(characterId, ctx))
}
