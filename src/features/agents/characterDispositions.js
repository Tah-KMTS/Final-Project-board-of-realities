// Derives a pure, deterministic behavior profile for every character in
// getAllCharacters() from signals that already exist elsewhere (finance
// archetype, crime-syndicate traits/aggression, government category,
// biography fidelity). No new lore, no Math.random - a later worker layers
// actual runtime "is this NPC home or out" behavior (heat, time-of-day, etc.)
// on top of the static tier/fields exported here.

import { getAllCharacters } from './characterLookup'
import { FINANCE_NPCS } from '../finance/financeNpcs'
import { CRIME_SYNDICATES } from '../government/crimeSyndicates'
import { SYNDICATE_MEMBERS_BY_ID } from '../../data/syndicate'
import { CHARACTER_BIOGRAPHIES } from './characterBiographies'

export const DISPOSITION_TIERS = ['recluse', 'homebody', 'regular', 'socialite', 'fugitive']

// House rule: FINANCE_BUILDING_DEFS lives in src/game/scenes/OverworldScene.js,
// which imports Phaser and cannot load outside a browser/canvas context (this
// module has to run in plain Node). The id list below is hand-copied from
// that array purely so workBuildingIds can reference real building ids - if a
// building is ever added, renamed, or removed there, mirror the change here
// too.
// Map flattening: this used to be 4 district-keyed pools (BUILDINGS_BY_DISTRICT)
// that fallbackWorkBuildings() picked from based on a character's home
// district. The map is one flat pool now (see OverworldScene.js's header
// comment above FINANCE_BUILDING_DEFS), so this is one flat list too -
// mirrors CRIME_FALLBACK_POOL below, which was already a single global pool.
const REAL_BUILDING_IDS = [
  'stockExchange', 'buffettHQ', 'vanderbiltHQ', 'muskHQ', 'howardMarksHQ', 'appleHQ',
  'cryptoExchange', 'corporateOffice', 'vcHub', 'bank', 'realEstateAgency', 'parliament',
  'irsHQ', 'teaHouse', 'machiyaEstate', 'zenGarden', 'silkMarket',
  'sakeBrewery', 'artisanShop', 'hotel', 'park', 'temple',
  'casino', 'arcade', 'speakeasyHotel', 'fbiHQ', 'dotonboriArcade',
  'fishMarket', 'takoyakiStand', 'crimeAlley', 'blackMarket', 'callCenterOps', 'dockVaults',
  'fordRougeComplex', 'carnegieSteelMill', 'standardOilRefinery', 'pentagonDodHQ',
  'epaHQ', 'sapporoBrewery', 'alpineLodge', 'trainStation',
]

// Crime members plausibly frequent underworld-facing venues rather than the
// full public building list.
const CRIME_FALLBACK_POOL = ['crimeAlley', 'blackMarket', 'dockVaults', 'speakeasyHotel', 'dotonboriArcade']

const FINANCE_NPC_BY_ID = new Map(FINANCE_NPCS.map((n) => [n.id, n]))

const AGGRESSION_BY_ID = new Map()
for (const syndicate of CRIME_SYNDICATES) {
  for (const role of ['boss', 'underboss', 'capo']) {
    AGGRESSION_BY_ID.set(syndicate[role].id, syndicate[role].aggression)
  }
}

const LOW_PROFILE_MARKERS = ['low-profile', 'shadow-operator', 'silent operator', 'discreet', 'reclusive', 'secretive', 'paranoid']
const HIGH_VISIBILITY_MARKERS = ['publicity-seeker', 'flamboyant', 'charismatic', 'showman']

function matchesAny(traits, markers) {
  return (traits || []).some((trait) => {
    const t = trait.toLowerCase()
    return markers.some((marker) => t.includes(marker))
  })
}

function hashId(id) {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0
  return h
}

const PUBLIC_FACING_CATEGORIES = new Set(['US President', 'Federal Reserve Chairman', 'FTC Chairman'])

function isPublicFacingCategory(category) {
  return PUBLIC_FACING_CATEGORIES.has(category) || /Leader$/.test(category || '')
}

// Aggression >= 0.8 is this file's read of "high aggression" from
// crimeSyndicates.js - no other threshold is implied by the source data, so
// this is the one deliberate cutoff choice in the crime branch below.
const HIGH_AGGRESSION_THRESHOLD = 0.8

function deriveTier(character, ctx) {
  if (ctx.isCrime) {
    return ctx.lowProfile || ctx.aggression >= HIGH_AGGRESSION_THRESHOLD ? 'fugitive' : 'regular'
  }

  const h = hashId(character.id)

  if (isPublicFacingCategory(ctx.category)) {
    const r = h % 10
    return r < 6 ? 'socialite' : r < 9 ? 'regular' : 'homebody'
  }

  if (ctx.archetype === 'tech_disruptor') {
    return h % 3 === 2 ? 'regular' : 'socialite'
  }

  if (ctx.archetype === 'value_investor' || ctx.archetype === 'sovereign_banker') {
    return h % 3 === 0 ? 'recluse' : 'homebody'
  }

  // monopolist / macro_speculator / corporate_raider / any other titan:
  // none of these archetypes has an explicit skew instruction, so the tier
  // falls to an id-seeded (deterministic, non-Math.random) spread across the
  // remaining tiers rather than defaulting every one of them to 'regular'.
  const r = h % 4
  if (r === 0) return 'homebody'
  if (r === 1) return 'socialite'
  if (r === 2) return 'recluse'
  return 'regular'
}

const TIER_BASE = {
  recluse: { sociability: 0.12, homeAffinity: 0.88 },
  homebody: { sociability: 0.32, homeAffinity: 0.72 },
  regular: { sociability: 0.55, homeAffinity: 0.5 },
  socialite: { sociability: 0.85, homeAffinity: 0.22 },
  fugitive: { sociability: 0.4, homeAffinity: 0.35 },
}

function clamp01(n) {
  return Math.max(0, Math.min(1, n))
}

function deriveSociabilityAndAffinity(tier, character, fidelity, syndicateSignals) {
  const base = TIER_BASE[tier]
  const h = hashId(`${character.id}:jitter`)
  const jitter = ((h % 17) / 16 - 0.5) * 0.16 // deterministic +/-0.08 spread, no Math.random
  let sociability = base.sociability + jitter
  let homeAffinity = base.homeAffinity - jitter * 0.6

  // fidelity (characterBiographies.js) is a romance axis, used only as a
  // weak deterministic tiebreak per the spec - never the primary visibility
  // signal above. Faithful/loyal types nudge toward staying home; flirtation
  // flags nudge toward being out more.
  if (fidelity) {
    const f = fidelity.toLowerCase()
    if (f.includes('faithful') || f.includes('loyal')) homeAffinity += 0.03
    else if (f.includes('romance risk') || f.includes('flirt')) sociability += 0.03
  }

  // Trait-level nuance layered on top of the tier's base numbers, not a
  // replacement for it: a fugitive-tier boss with a Flamboyant/Charismatic
  // trait (e.g. Capone) still runs hot on the wanted mechanic, but is a bit
  // more likely to be seen out than a fugitive who also carries a
  // low-profile trait (e.g. Lansky).
  if (syndicateSignals) {
    if (syndicateSignals.highVisibility) sociability += 0.05
    if (syndicateSignals.lowProfile) sociability -= 0.05
  }

  return { sociability: clamp01(sociability), homeAffinity: clamp01(homeAffinity) }
}

// Characters with a real HQ already in FINANCE_BUILDING_DEFS and/or a
// bespoke TITAN_ROUTINES schedule: use the buildings they're already
// scripted to visit on the live map, so this file's "plausible" buildings
// never disagree with what the overworld actually shows them doing.
const WORK_BUILDING_OVERRIDES = {
  jobs: ['appleHQ', 'stockExchange', 'muskHQ'],
  musk: ['muskHQ', 'appleHQ'],
  huang: ['stockExchange', 'appleHQ', 'parliament'],
  buffett: ['machiyaEstate', 'teaHouse', 'hotel'],
  munger: ['temple', 'machiyaEstate', 'teaHouse'],
  graham: ['zenGarden', 'hotel', 'teaHouse'],
  templeton: ['park', 'machiyaEstate', 'irsHQ'],
  capone: ['speakeasyHotel', 'dotonboriArcade', 'dockVaults'],
  luciano: ['speakeasyHotel', 'dockVaults', 'dotonboriArcade'],
  soros: ['blackMarket', 'speakeasyHotel', 'fishMarket'],
  livermore: ['blackMarket', 'dockVaults', 'speakeasyHotel'],
  ford: ['fordRougeComplex', 'carnegieSteelMill', 'alpineLodge'],
  carnegie: ['carnegieSteelMill', 'standardOilRefinery', 'alpineLodge'],
  rockefeller: ['standardOilRefinery', 'fordRougeComplex', 'trainStation'],
  vanderbilt: ['trainStation', 'sapporoBrewery', 'fordRougeComplex'],
  gates: ['stockExchange', 'parliament', 'appleHQ'],
  bezos: ['stockExchange', 'muskHQ', 'bank'],
  son: ['stockExchange', 'appleHQ', 'muskHQ'],
  icahn: ['stockExchange', 'parliament', 'corporateOffice'],
  dalio: ['machiyaEstate', 'park', 'irsHQ'],
  simons: ['stockExchange', 'bank', 'cryptoExchange'],
  lynch: ['teaHouse', 'silkMarket', 'machiyaEstate'],
  walker: ['fishMarket', 'dotonboriArcade', 'speakeasyHotel'],
  jpmorgan: ['stockExchange', 'bank', 'corporateOffice'],
  escobar: ['dockVaults', 'speakeasyHotel', 'dotonboriArcade'],
  howardmarks: ['howardMarksHQ', 'stockExchange'],
  caplin: ['irsHQ', 'hotel'],
  hoover: ['fbiHQ', 'crimeAlley'],
  mcnamara: ['pentagonDodHQ', 'trainStation'],
  ruckelshaus: ['epaHQ', 'carnegieSteelMill'],
  douglas_sec: ['stockExchange', 'bank'],
  levitt_sec: ['stockExchange', 'bank'],
  kennedy_sec: ['stockExchange', 'bank'],
  mueller: ['fbiHQ', 'crimeAlley'],
  andrews: ['irsHQ', 'hotel'],
  marshall: ['pentagonDodHQ', 'trainStation'],
}

function fallbackWorkBuildings(character, isCrime) {
  const pool = isCrime ? CRIME_FALLBACK_POOL : REAL_BUILDING_IDS
  const count = 1 + (hashId(character.id) % 3) // 1..3, deterministic per character
  // Deterministic stand-in for "pick `count` distinct buildings this person
  // plausibly uses": rank the pool by a per-(character,building) hash and
  // take the top `count`, rather than Math.random.
  return pool
    .map((buildingId) => ({ buildingId, key: hashId(`${character.id}:${buildingId}`) }))
    .sort((a, b) => a.key - b.key)
    .slice(0, count)
    .map((entry) => entry.buildingId)
}

function buildProfile(character) {
  const financeMeta = FINANCE_NPC_BY_ID.get(character.id)
  const syndicateMeta = SYNDICATE_MEMBERS_BY_ID[character.id]
  const aggression = AGGRESSION_BY_ID.get(character.id) || 0
  const fidelity = (CHARACTER_BIOGRAPHIES[character.id] || {}).fidelity

  const isCrime = String(character.category || '').startsWith('Crime')
  const archetype = financeMeta ? financeMeta.archetype : null
  const lowProfile = syndicateMeta ? matchesAny(syndicateMeta.traits, LOW_PROFILE_MARKERS) : false
  const highVisibility = syndicateMeta ? matchesAny(syndicateMeta.traits, HIGH_VISIBILITY_MARKERS) : false

  const tier = deriveTier(character, { isCrime, lowProfile, aggression, archetype, category: character.category })
  const { sociability, homeAffinity } = deriveSociabilityAndAffinity(tier, character, fidelity, { lowProfile, highVisibility })

  const workBuildingIds = WORK_BUILDING_OVERRIDES[character.id]
    ? WORK_BUILDING_OVERRIDES[character.id].slice(0, 3)
    : fallbackWorkBuildings(character, isCrime)

  return {
    id: character.id,
    name: character.name,
    tier,
    homeBuildingId: `home_${character.id}`,
    sociability,
    homeAffinity,
    travelRange: workBuildingIds.length,
    isCrime,
    workBuildingIds,
  }
}

const PROFILES_BY_ID = new Map(getAllCharacters().map((c) => [c.id, buildProfile(c)]))

export function getDisposition(characterId) {
  return PROFILES_BY_ID.get(characterId) || null
}

export function getAllDispositions() {
  return Array.from(PROFILES_BY_ID.values())
}

// Exported for the sibling characterHomeBuildings.js module and for tests -
// not part of the spec'd public API but cheap to expose rather than forcing
// callers to re-derive the same duplicated id list.
export { REAL_BUILDING_IDS }
