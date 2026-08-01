// Capital Syndicate - Per-Syndicate Standing Engine.
//
// Pure functions only (no zustand `set`/`get` in here) so useGameStore.js's
// actions can stay thin call-throughs, matching how templeEngine.js,
// governmentEngine.js, and moneyLaunderingEngine.js are already structured.
//
// The player is a NEUTRAL operator playing all 7 historical syndicates
// against each other - there is no single loyalty track. Standing is
// persistent-but-mutable (rises AND falls across a run), the same shape as
// world2.loanBalance, NOT a sticky one-way ladder like netWorthMilestones
// and NOT a timed buff like templeBlessing.
//
// v1 scope is the 7 Bosses only (see CRIME_SYNDICATES ids below) -
// Underboss/Capo tiers exist purely as world-presence flavor and are not
// separately tracked here.

import { CRIME_SYNDICATES } from '../government/crimeSyndicates'

// Canonical 7 syndicate ids, sourced from crimeSyndicates.js (the cleanup
// pass made that file the single source of truth) rather than re-listing
// them here, so this engine can never drift out of sync with it.
export const SYNDICATE_IDS = CRIME_SYNDICATES.map((s) => s.id)

export function clampStanding(value) {
  return Math.max(0, Math.min(100, value))
}

// --- Standing deltas (exact numbers from the design pass - do not rebalance) ---
//
// Pace rationale: 0->33 (Underboss gate) and 33->66 (Boss gate) each take
// ~4-5 jobs at +8/success (33/8 ~= 4.1), a little more if a failure or two
// knocks some progress back out along the way. Jobs cost 15-25 energy out of
// a 100/day energy budget, so each gate works out to roughly a day or two of
// focused play - enough to feel earned without locking a whole run around
// one syndicate.
export const STANDING_DELTA = {
  jobSuccess: 8,
  jobFailNoJail: -3,
  jobFailJail: -8,
  walkAway: -1, // declined/abandoned a job after accepting it
}

// --- Rivalry graph: EXACTLY these 3 pairs -----------------------------------
//
// Deliberately sparse rather than a full 21-edge matrix across all 7
// syndicates - most of these organizations simply never operated in the same
// market historically, and a denser graph would be unreadable to the player.
// Griselda Blanco's empire is the one syndicate with TWO rivals (both the
// Medellin Cartel and the National Syndicate), which is intentional per
// spec, not a bug - she made enemies on both the cartel side and the
// Commission side.
//
// Do NOT add a five_families <-> murder_inc edge. Murder, Inc. was the
// Commission's own contract-enforcement arm (see Lepke Buchalter's bio in
// syndicate.js - he filled hit orders FOR National Syndicate/Commission
// bosses); they were the same side, not rivals. Keeping the rivalry graph to
// these 3 legible feuds instead of inventing more is the point.
const RIVALRY_PAIRS = [
  ['medellin_cartel', 'griselda_empire'], // cocaine-era Miami/Colombia turf overlap
  ['chicago_outfit', 'speakeasy_syndicate'], // Prohibition-era liquor competitors
  ['national_syndicate', 'griselda_empire'], // The Commission vs. an independent operator
]

const RIVAL_IDS_BY_SYNDICATE = RIVALRY_PAIRS.reduce((map, [a, b]) => {
  ;(map[a] = map[a] || []).push(b)
  ;(map[b] = map[b] || []).push(a)
  return map
}, {})

export function getRivalIds(syndicateId) {
  return RIVAL_IDS_BY_SYNDICATE[syndicateId] || []
}

function outcomeDelta(outcomeType) {
  switch (outcomeType) {
    case 'success':
      return STANDING_DELTA.jobSuccess
    case 'failNoJail':
      return STANDING_DELTA.jobFailNoJail
    case 'failJail':
      return STANDING_DELTA.jobFailJail
    case 'walkAway':
      return STANDING_DELTA.walkAway
    default:
      return 0
  }
}

// "Job completion" (success OR either failure flavor) triggers the rivalry
// cascade; walking away from an accepted job is explicitly NOT a completion
// and never ripples out to rivals.
function isJobCompletion(outcomeType) {
  return outcomeType === 'success' || outcomeType === 'failNoJail' || outcomeType === 'failJail'
}

// Applies one job outcome's standing delta to `syndicateId`, cascades the
// -4 rivalry hit to its rival(s) on completion, and stamps
// lastInteractionDay for `syndicateId` (decay tracking - see
// applyStandingDecayTick below). Returns brand-new map objects; never
// mutates its inputs.
//
// Rivalry cascade deliberately does NOT stamp the rival's
// lastInteractionDay - it's a side-effect of MY job, not an interaction with
// the rival syndicate itself, so their own decay clock keeps running
// untouched.
export function applyStandingEvent(standingMap, lastInteractionMap, syndicateId, outcomeType, day) {
  const nextStanding = { ...standingMap }
  const nextInteraction = { ...lastInteractionMap }

  const delta = outcomeDelta(outcomeType)
  nextStanding[syndicateId] = clampStanding((nextStanding[syndicateId] || 0) + delta)
  nextInteraction[syndicateId] = day

  if (isJobCompletion(outcomeType)) {
    for (const rivalId of getRivalIds(syndicateId)) {
      // clampStanding floors at 0 on every individual mutation, so rivalry
      // cascade + decay landing in the same tick can never combine to push
      // a standing below 0 no matter what order they're applied in.
      nextStanding[rivalId] = clampStanding((nextStanding[rivalId] ?? 0) - 4)
    }
  }

  return { standing: nextStanding, lastInteractionDay: nextInteraction }
}

// Decay: -1 standing per 3 days of zero interaction with that syndicate,
// floor 0, only applied when standing > 0. Since lastInteractionDay is only
// ever stamped alongside a standing change (applyStandingEvent above), any
// syndicate with standing > 0 is guaranteed to have a lastInteractionDay, so
// there's no separate "decay applied through day N" bookkeeping needed:
// checking `daysSince % 3 === 0` on every endDay() tick naturally fires
// exactly once per 3rd day since the last interaction, no more, no less.
export function applyStandingDecayTick(standingMap, lastInteractionMap, nextDay) {
  const decayed = { ...standingMap }
  for (const id of SYNDICATE_IDS) {
    const standing = decayed[id] || 0
    if (standing <= 0) continue
    const lastDay = lastInteractionMap[id]
    if (lastDay == null) continue // defensive: standing > 0 with no recorded interaction shouldn't happen
    const daysSince = nextDay - lastDay
    if (daysSince > 0 && daysSince % 3 === 0) {
      decayed[id] = Math.max(0, standing - 1)
    }
  }
  return decayed
}

// --- Rank gates --------------------------------------------------------------
// Capo content is available from standing 0 (the starting tier). Centralized
// here so nothing else in the codebase hardcodes the 33/66 thresholds.
export const RANK_GATE = { underboss: 33, boss: 66 }

export function getUnlockedRankTier(standing) {
  if (standing >= RANK_GATE.boss) return 'boss'
  if (standing >= RANK_GATE.underboss) return 'underboss'
  return 'capo'
}

// --- Territory effects -------------------------------------------------------
// Territory data is read from CRIME_SYNDICATES (crimeSyndicates.js), never
// invented here.
export function getSyndicateTerritory(syndicateId) {
  return CRIME_SYNDICATES.find((s) => s.id === syndicateId)?.territory ?? null
}

// Territory strings are "District Name - Subarea" (e.g. "Underground
// District - West"). Callers may pass either the exact territory string or
// just the district-name prefix (e.g. "Underground District") - both count
// as home turf.
export function isHomeTurf(syndicateId, currentLocation) {
  if (!currentLocation) return false
  const territory = getSyndicateTerritory(syndicateId)
  if (!territory) return false
  return territory === currentLocation || territory.split(' - ')[0] === currentLocation
}

// Home-turf payout multiplier: up to +50% at standing 100.
export function getHomeTurfPayoutMultiplier(standing) {
  return 1 + clampStanding(standing) / 200
}

// Home-turf bail/atonement discount multiplier: up to -40% at standing 100.
// Multiply calculateAtonementCost()'s result by this - never add/subtract a
// flat amount, so it composes correctly with the existing wanted/notoriety
// scaling and cash-cap already inside calculateAtonementCost.
export function getHomeTurfBailDiscountMultiplier(standing) {
  return 1 - clampStanding(standing) / 250
}

// Jail-chance reduction contributed by home-turf standing, to be SUBTRACTED
// from applyCrimeOutcome's existing jailChance formula. At standing 100 on
// your own turf that's -0.2 off the jail chance.
//
// CRITICAL BALANCE CONSTRAINT: standing may reduce payout multiplier, bail
// cost, and jail *chance* only. It must NEVER reduce wantedIncreaseOnFail or
// notorietyIncreaseOnFail - heat has to keep accumulating on every failed
// job regardless of standing, or a maxed-out syndicate relationship becomes
// a risk-free money printer that can also never gain a Wanted level. This
// function is intentionally standalone (not wired into addWantedLevel/
// addNotoriety anywhere) - do not "helpfully" extend its reach into those.
export function getHomeTurfJailChanceReduction(standing, inHomeTurf) {
  return inHomeTurf ? clampStanding(standing) * 0.002 : 0
}

// Hostile-turf rival-encounter chance per job: scales with the player's
// standing with the syndicate whose turf this is (a well-known operator gets
// noticed on someone else's turf). Clamped to [0.05, 0.5] so it's never a
// sure thing and never a total non-event.
export function getRivalEncounterChance(standingWithTurfOwner) {
  return Math.max(0.05, Math.min(0.5, 0.05 + clampStanding(standingWithTurfOwner) * 0.004))
}
