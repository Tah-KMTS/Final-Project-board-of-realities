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
// Phase 2 building consolidation: buffettHQ/vanderbiltHQ/muskHQ/
// howardMarksHQ/appleHQ -> businessCenter; cryptoExchange -> folded into
// stockExchange (a Crypto tab, not its own building any more); irsHQ/fbiHQ
// -> governmentBuilding; arcade -> folded into casino; crimeAlley/
// blackMarket/callCenterOps/speakeasyHotel -> underworld. Map overhaul
// Phase 4 (14-main-building-category trim): fordRougeComplex/
// carnegieSteelMill/standardOilRefinery/pentagonDodHQ/epaHQ -> industrialZone
// (the 5 industrialists/regulators share one hub the same way the Phase 2
// consolidations work - see IndustrialZoneModal.jsx); parliament/hotel/park/
// dockVaults/teaHouse/machiyaEstate/zenGarden/silkMarket/sakeBrewery/
// artisanShop/dotonboriArcade/fishMarket/takoyakiStand/sapporoBrewery/
// alpineLodge/corporateOffice/vcHub are deleted outright with no replacement
// - none of those 17 map to one of the spec's 14 main-building categories.
// Mirror any future change to FINANCE_BUILDING_DEFS here too (see house-rule
// comment above).
const REAL_BUILDING_IDS = [
  'stockExchange', 'businessCenter', 'governmentBuilding',
  'bank', 'realEstateAgency', 'temple',
  'casino', 'underworld', 'industrialZone', 'trainStation',
]

// Crime members plausibly frequent underworld-facing venues rather than the
// full public building list. crimeAlley/blackMarket/speakeasyHotel are all
// the same physical 'underworld' building now (Phase 2 consolidation) - one
// entry, not three duplicates of the same id. dockVaults/dotonboriArcade
// (Phase 4: both deleted, no replacement) used to round this pool out to 3
// underworld-adjacent venues; underworld alone is still correct here since
// it already absorbed every crime-flavored building this pool could have
// pointed to.
const CRIME_FALLBACK_POOL = ['underworld']

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
    // Swarm fix: was 60% socialite / 30% regular / 10% homebody, which put
    // ~30 characters (all 10 Presidents/Fed Chairmen/FTC Chairmen) almost
    // entirely "out" at once during business hours (socialite's homeAffinity
    // floor is near 0) - the other half of what caused the building
    // pile-ups alongside the missing WORK_BUILDING_OVERRIDES above. Public
    // figures still skew visible, just not near-universally so.
    const r = h % 10
    return r < 4 ? 'socialite' : r < 8 ? 'regular' : 'homebody'
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
// Phase 2 consolidation repointed every entry that used to reference one of
// the 13 deleted single-tenant building ids at whichever hub absorbed it
// (businessCenter/underworld/governmentBuilding), keeping each character's
// remaining 2nd/3rd fallback slot unchanged unless that slot was ALSO a
// deleted id, in which case it's replaced with a sensible still-real
// building rather than left dangling. Map overhaul Phase 4 repeats the same
// treatment for the 5 industrialists/regulators (repointed to the new
// industrialZone hub - see IndustrialZoneModal.jsx) and for every entry that
// referenced one of the 17 buildings deleted outright in this pass (no
// absorbing hub exists for those, so each slot is swapped for a still-real
// building in the same rough spirit as what was lost - e.g. a cultural/
// leisure slot becomes another cultural/leisure-ish still-real building
// where one exists, otherwise a plausible civic/financial fallback);
// duplicate entries created by two old ids collapsing onto the same new one
// (e.g. two industrialist buildings both becoming 'industrialZone') are
// deduped down to a single slot rather than repeated.
const WORK_BUILDING_OVERRIDES = {
  jobs: ['businessCenter', 'stockExchange'],
  musk: ['businessCenter', 'stockExchange'],
  huang: ['stockExchange', 'businessCenter', 'governmentBuilding'],
  buffett: ['businessCenter', 'bank', 'realEstateAgency'],
  munger: ['temple', 'bank', 'businessCenter'],
  graham: ['temple', 'realEstateAgency', 'businessCenter'],
  templeton: ['temple', 'bank', 'governmentBuilding'],
  capone: ['underworld', 'casino', 'trainStation'],
  luciano: ['underworld', 'trainStation', 'casino'],
  soros: ['underworld', 'bank'],
  livermore: ['underworld', 'stockExchange'],
  ford: ['industrialZone', 'trainStation'],
  carnegie: ['industrialZone', 'bank'],
  rockefeller: ['industrialZone', 'trainStation'],
  vanderbilt: ['businessCenter', 'trainStation', 'industrialZone'],
  gates: ['stockExchange', 'governmentBuilding', 'businessCenter'],
  bezos: ['stockExchange', 'businessCenter', 'bank'],
  son: ['stockExchange', 'businessCenter'],
  icahn: ['stockExchange', 'governmentBuilding', 'businessCenter'],
  dalio: ['bank', 'temple', 'governmentBuilding'],
  simons: ['stockExchange', 'bank'],
  lynch: ['businessCenter', 'realEstateAgency', 'bank'],
  walker: ['bank', 'casino', 'underworld'],
  jpmorgan: ['stockExchange', 'bank', 'businessCenter'],
  escobar: ['trainStation', 'underworld', 'casino'],
  howardmarks: ['businessCenter', 'stockExchange'],
  caplin: ['governmentBuilding', 'realEstateAgency'],
  hoover: ['governmentBuilding', 'underworld'],
  mcnamara: ['industrialZone', 'trainStation'],
  ruckelshaus: ['industrialZone', 'governmentBuilding'],
  douglas_sec: ['stockExchange', 'bank'],
  levitt_sec: ['stockExchange', 'bank'],
  kennedy_sec: ['stockExchange', 'bank'],
  mueller: ['governmentBuilding', 'underworld'],
  andrews: ['governmentBuilding', 'realEstateAgency'],
  marshall: ['industrialZone', 'trainStation'],

  // Swarm fix: the 30 US Presidents/Federal Reserve Chairmen/FTC Chairmen
  // (governmentRoster.js) had NO entries here, so every one of them fell
  // through to fallbackWorkBuildings()'s flat REAL_BUILDING_IDS pool - the
  // same undifferentiated 10-building list every other uncovered character
  // draws from. Combined with isPublicFacingCategory skewing 60% of them
  // 'socialite' (business-hours homeAffinity floor near 0), that's what put
  // Presidents and Fed Chairmen visually piling onto the casino/real-estate
  // agency in practice - not a rendering bug, a scheduling one. Each entry
  // below is picked for thematic fit (a president's stated
  // executivePriority, a Fed chair's policyBias, an FTC chair's bias/
  // description) and, as a group, deliberately spread across most of the 10
  // real buildings rather than left to converge on whichever one wins the
  // hash lottery.
  washington: ['bank', 'governmentBuilding'],
  lincoln: ['industrialZone', 'governmentBuilding'],
  fdr: ['governmentBuilding', 'bank', 'stockExchange'],
  jfk: ['stockExchange', 'businessCenter'],
  reagan: ['businessCenter', 'realEstateAgency'],
  tr: ['governmentBuilding', 'industrialZone'],
  jefferson: ['realEstateAgency', 'temple'],
  eisenhower: ['industrialZone', 'trainStation'],
  obama: ['governmentBuilding', 'stockExchange'],
  clinton: ['stockExchange', 'businessCenter'],

  volcker: ['bank', 'governmentBuilding'],
  greenspan: ['stockExchange', 'realEstateAgency'],
  bernanke: ['stockExchange', 'bank'],
  yellen: ['bank', 'governmentBuilding'],
  powell: ['stockExchange', 'bank'],
  eccles: ['governmentBuilding', 'industrialZone'],
  martin: ['bank', 'stockExchange'],
  burns: ['bank', 'businessCenter'],
  miller: ['stockExchange', 'industrialZone'],
  meyer: ['bank', 'governmentBuilding'],

  khan: ['businessCenter', 'governmentBuilding'],
  ramirez: ['businessCenter', 'bank'],
  simons_ftc: ['stockExchange', 'businessCenter'],
  // muris's own description ("targets Underground call center scams and
  // illicit criminal money laundering") is a direct, already-real reason to
  // send him to the 'underworld' building - enforcement, not a night out.
  muris: ['underworld', 'governmentBuilding'],
  pertschuk: ['businessCenter', 'governmentBuilding'],
  // kirkpatrick's description ("illegal syndicate stock pools") is the same
  // kind of direct tie-in.
  kirkpatrick: ['stockExchange', 'underworld'],
  kovacic: ['governmentBuilding', 'businessCenter'],
  majoras: ['realEstateAgency', 'businessCenter'],
  leibowitz: ['businessCenter', 'underworld'],
  // pitofsky's description names Rockefeller Oil and Carnegie Steel by
  // name - both now folded into industrialZone (see rockefeller/carnegie
  // above), so this is a direct continuity match, not a guess.
  pitofsky: ['industrialZone', 'governmentBuilding'],
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
