import { JAPAN_CITIES } from '../world/japanCities'

/**
 * Computes dynamic city migration & Government Agency HQ selection for all 76 agents.
 */
export function simulateTownMigration(agents, day, govState, wantedLevel) {
  const migrationLogs = []

  const updatedAgents = agents.map((agent) => {
    const copy = { ...agent }
    const rand = Math.random()

    // 1. Government Agents relocate to their respective Government Agency HQs
    if (copy.id === 'hoover' || copy.category?.includes('FBI')) {
      copy.currentCity = 'Osaka'
      copy.currentWorkHQ = 'FBI Federal Bureau Headquarters'
      return copy
    }
    if (copy.id === 'powell' || copy.category?.includes('Fed')) {
      copy.currentCity = 'Tokyo'
      copy.currentWorkHQ = 'Federal Reserve Central Bank HQ'
      return copy
    }
    if (copy.id === 'khan' || copy.category?.includes('FTC')) {
      copy.currentCity = 'Tokyo'
      copy.currentWorkHQ = 'FTC Antitrust Hearing Commission'
      return copy
    }
    if (copy.id === 'caplin' || copy.category?.includes('IRS')) {
      copy.currentCity = 'Kyoto'
      copy.currentWorkHQ = 'IRS Internal Revenue Building'
      return copy
    }
    if (copy.id === 'mcnamara' || copy.category?.includes('DOD')) {
      copy.currentCity = 'Sapporo'
      copy.currentWorkHQ = 'Pentagon / DOD Military Procurement HQ'
      return copy
    }
    if (copy.id === 'ruckelshaus' || copy.category?.includes('EPA')) {
      copy.currentCity = 'Sapporo'
      copy.currentWorkHQ = 'EPA Environmental Regulation Agency'
      return copy
    }

    // 2. Crime Syndicate Bosses migrate if Police Heat spikes
    if (copy.category?.includes('Crime') && wantedLevel >= 3) {
      if (copy.currentCity !== 'Sapporo') {
        copy.currentCity = 'Sapporo'
        copy.currentWorkHQ = 'Sapporo Alpine Safehouse'
        migrationLogs.push({
          id: `migration_${day}_${copy.id}`,
          day,
          text: `🚨 ${copy.name} fled to Sapporo Alpine Safehouse due to high FBI / Police Heat!`,
        })
      }
      return copy
    }

    // 3. Financial Titans migrate to their Character-Built Landmarks
    if (copy.id === 'jobs') copy.currentCity = 'Tokyo'
    else if (copy.id === 'musk') copy.currentCity = 'Tokyo'
    else if (copy.id === 'buffett') copy.currentCity = 'Kyoto'
    else if (copy.id === 'ford') copy.currentCity = 'Sapporo'
    else if (copy.id === 'carnegie') copy.currentCity = 'Sapporo'
    else if (copy.id === 'rockefeller') copy.currentCity = 'Sapporo'

    // Occasional migration based on financial market shifts
    if (rand < 0.08) {
      const targetCityObj = JAPAN_CITIES[Math.floor(rand * JAPAN_CITIES.length)]
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
