import { JAPAN_CITIES } from '../world/japanCities'
import { getDisposition } from './characterDispositions'
import { getHomeBuildingDef } from '../world/characterHomeBuildings'

// A fleeing character has to be meaningfully "over the line" to go to
// ground, and heat has to drop meaningfully below that same line before
// they resurface - the gap between the two (rather than one shared
// threshold) is what stops a character flickering between fled/returned on
// every tick when heat is hovering right at the edge.
const FLEE_HEAT_THRESHOLD = 0.55
const RETURN_HEAT_THRESHOLD = 0.3

const DISTRICT_TO_CITY = {
  'Tokyo District': 'Tokyo',
  'Kyoto District': 'Kyoto',
  'Osaka District': 'Osaka',
  'Sapporo District': 'Sapporo',
}

// Financial Titans with a signature landmark - kept from the original file's
// flavor (not part of this rewrite's fugitive-heat mechanic).
const TITAN_HOME_CITY = {
  jobs: 'Tokyo',
  musk: 'Tokyo',
  buffett: 'Kyoto',
  ford: 'Sapporo',
  carnegie: 'Sapporo',
  rockefeller: 'Sapporo',
}

function findSyndicateForAgent(agent, govState) {
  const syndicates = govState?.crimeSyndicatesState || []
  if (agent.syndicateId) {
    const bySyndicateId = syndicates.find((s) => s.id === agent.syndicateId)
    if (bySyndicateId) return bySyndicateId
  }
  return (
    syndicates.find(
      (s) => s.boss?.id === agent.id || s.underboss?.id === agent.id || s.capo?.id === agent.id
    ) || null
  )
}

// Mirrors the heatByCharacter normalization useGameStore.js's endDay()
// already applies before handing heat to worldPresenceEngine.js (heatLevel
// is the 0-2 range governmentEngine.js's daily tick now actually simulates -
// see that file), plus a smaller spillover from the player's own
// wantedLevel so a hot player pushes every syndicate's fugitives closer to
// the run threshold even on a day their own syndicate's heat hasn't caught
// up yet.
function combinedFugitiveHeat(syndicate, wantedLevel) {
  const syndicateHeat = syndicate ? Math.max(0, Math.min(1, (syndicate.heatLevel || 0) / 2)) : 0
  const wantedSpill = Math.max(0, Math.min(1, (wantedLevel || 0) / 5))
  return Math.max(0, Math.min(1, syndicateHeat * 0.75 + wantedSpill * 0.25))
}

// Real, per-character fugitive behavior for the 21 Crime Syndicate members.
// Relocates a fleeing member to THEIR OWN hideout building (home_<id>, see
// characterHomeBuildings.js) rather than the old shared hardcoded
// 'Sapporo Alpine Safehouse' string, and actually un-flees them once heat
// cools - worldPresenceEngine.js (the source of truth for "where is this
// character") already holes crime characters up at this exact same
// homeBuildingId as heat rises, so the location named in these logs can
// never disagree with where the character actually shows up on the map.
function simulateCrimeFugitive(agent, day, govState, wantedLevel, migrationLogs) {
  const disposition = getDisposition(agent.id)
  const copy = { ...agent }
  if (!disposition || !disposition.isCrime) return copy

  const syndicate = findSyndicateForAgent(agent, govState)
  const heat = combinedFugitiveHeat(syndicate, wantedLevel)
  const wasFleeing = !!agent.isFleeing
  const nowFleeing = wasFleeing ? heat > RETURN_HEAT_THRESHOLD : heat >= FLEE_HEAT_THRESHOLD

  const hideout = getHomeBuildingDef(agent.id)
  const hideoutLabel = hideout ? hideout.label : `${agent.name} Hideout`

  copy.isFleeing = nowFleeing
  copy.hideoutBuildingId = disposition.homeBuildingId

  if (nowFleeing && !wasFleeing) {
    copy.currentCity = DISTRICT_TO_CITY[disposition.district] || copy.currentCity
    copy.currentWorkHQ = hideoutLabel
    migrationLogs.push({
      id: `migration_flee_${day}_${agent.id}`,
      day,
      text: `🚨 ${agent.name} has gone to ground at ${hideoutLabel} as ${syndicate ? syndicate.name : 'the law'} draws heat!`,
    })
  } else if (!nowFleeing && wasFleeing) {
    copy.currentWorkHQ = syndicate ? syndicate.territory : agent.homeBase
    migrationLogs.push({
      id: `migration_return_${day}_${agent.id}`,
      day,
      text: `✅ ${agent.name} has resurfaced from ${hideoutLabel} now that the heat has cooled off.`,
    })
  }

  return copy
}

/**
 * Computes dynamic city migration & fugitive relocation for all agents.
 * Crime Syndicate members get real, per-character fugitive behavior (see
 * simulateCrimeFugitive above) driven by their own syndicate's heatLevel
 * (governmentEngine.js) combined with the player's wantedLevel, including an
 * actual un-flee once heat drops. Everyone else keeps the original file's
 * lighter city-assignment flavor.
 */
export function simulateTownMigration(agents, day, govState, wantedLevel) {
  const migrationLogs = []

  const updatedAgents = agents.map((agent) => {
    const disposition = getDisposition(agent.id)

    if (disposition?.isCrime) {
      return simulateCrimeFugitive(agent, day, govState, wantedLevel, migrationLogs)
    }

    const copy = { ...agent }

    // Government Agency chairs actually present in the master registry
    // (buildMasterAgentRegistry only rosters Presidents/Fed/FTC - the 12
    // FAMOUS_AGENCY_LEADERS ids such as hoover/caplin/mcnamara/ruckelshaus
    // used by the old id-specific branches here never appear in `agents`,
    // so those branches were dead code) relocate to their real HQ.
    if (copy.category === 'Federal Reserve Chairman') {
      copy.currentCity = 'Tokyo'
      copy.currentWorkHQ = 'Federal Reserve Central Bank HQ'
      return copy
    }
    if (copy.category === 'FTC Antitrust Chair') {
      copy.currentCity = 'Tokyo'
      copy.currentWorkHQ = 'FTC Antitrust Hearing Commission'
      return copy
    }

    // Financial Titans migrate to their character-built landmark city.
    if (TITAN_HOME_CITY[copy.id]) copy.currentCity = TITAN_HOME_CITY[copy.id]

    // Occasional migration based on financial market shifts.
    if (Math.random() < 0.08) {
      const targetCityObj = JAPAN_CITIES[Math.floor(Math.random() * JAPAN_CITIES.length)]
      copy.currentCity = targetCityObj.name.split(' ')[0]
      migrationLogs.push({
        id: `migration_${day}_${copy.id}`,
        day,
        text: `✈️ ${copy.name} relocated operations to ${targetCityObj.name}.`,
      })
    }

    return copy
  })

  return {
    updatedAgents,
    migrationLogs,
  }
}
