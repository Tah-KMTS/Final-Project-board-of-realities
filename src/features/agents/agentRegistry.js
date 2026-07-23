import { FINANCE_NPCS } from '../finance/financeNpcs'
import { CRIME_SYNDICATES } from '../government/crimeSyndicates'
import { PRESIDENTS_ROSTER, FED_CHAIRMEN_ROSTER, FTC_CHAIRMEN_ROSTER } from '../government/governmentRoster'

/**
 * Master Registry of all 76 Individual Autonomous Agents across 5 Factions.
 */
export function buildMasterAgentRegistry() {
  const registry = []

  // 1. 25 Financial Titans
  FINANCE_NPCS.forEach((npc) => {
    registry.push({
      id: npc.id,
      name: npc.name,
      category: 'Financial Titan',
      title: npc.title,
      personality: npc.archetype || 'Tycoon',
      netWorth: npc.netWorth,
      homeBase: npc.id === 'buffett' ? 'Omaha Suburban House' : `${npc.name}'s Executive Estate`,
      favoriteHangout: npc.id === 'buffett' ? "McDonald's & Cherry Coke Diner" : npc.id === 'jobs' ? 'Apple Design Lab' : 'Wall Street Penthouse',
      vehicle: npc.id === 'musk' ? 'Cyber Roadster' : npc.id === 'ford' ? 'Model T Vintage Sedan' : 'Executive Limousine',
      currentLocation: 'Financial District',
      currentAction: 'Reviewing Investment Portfolio',
      thoughtProcess: 'Analyzing market risk vs compound return potential.',
    })
  })

  // 2. 21 Crime Syndicate Members (7 Bosses, 7 Underbosses, 7 Capos)
  CRIME_SYNDICATES.forEach((syndicate) => {
    // Boss
    registry.push({
      id: syndicate.boss.id,
      name: syndicate.boss.name,
      category: 'Crime Syndicate Boss',
      title: syndicate.boss.title,
      personality: 'Ruthless Syndicate Boss',
      syndicateId: syndicate.id,
      homeBase: `${syndicate.name} Fortress`,
      favoriteHangout: 'Underground Speakeasy Club',
      vehicle: 'Armored V8 Sedan',
      currentLocation: syndicate.territory,
      currentAction: 'Managing Syndicate Extortion Rackets',
      thoughtProcess: 'Maintaining turf dominance and checking police payoffs.',
    })
    // Underboss
    registry.push({
      id: syndicate.underboss.id,
      name: syndicate.underboss.name,
      category: 'Crime Syndicate Underboss',
      title: syndicate.underboss.title,
      personality: 'Syndicate Enforcer',
      syndicateId: syndicate.id,
      homeBase: `${syndicate.name} Safehouse`,
      favoriteHangout: 'Docks Warehouse',
      vehicle: 'Blacked-out Coupe',
      currentLocation: syndicate.territory,
      currentAction: 'Enforcing Turf Taxes',
      thoughtProcess: 'Collecting weekly dues from local merchants.',
    })
    // Capo
    registry.push({
      id: syndicate.capo.id,
      name: syndicate.capo.name,
      category: 'Crime Syndicate Capo',
      title: syndicate.capo.title,
      personality: 'Syndicate Lieutenant',
      syndicateId: syndicate.id,
      homeBase: 'Neighborhood Apartment',
      favoriteHangout: 'Back-Alley Speakeasy',
      vehicle: 'Street Cruiser',
      currentLocation: syndicate.territory,
      currentAction: 'Guarding Territory Borders',
      thoughtProcess: 'Watching for rival syndicate incursions.',
    })
  })

  // 3. 10 US Presidents
  PRESIDENTS_ROSTER.forEach((pres) => {
    registry.push({
      id: pres.id,
      name: pres.name,
      category: 'Presidential Candidate / Leader',
      title: pres.party,
      personality: 'Statesman Leader',
      homeBase: 'Presidential Residence',
      favoriteHangout: 'Government Executive Office',
      vehicle: 'Presidential Motorcade',
      currentLocation: 'Government District',
      currentAction: 'Drafting Executive Orders & Economic Policy',
      thoughtProcess: `Prioritizing ${pres.platform} for the public good.`,
    })
  })

  // 4. 10 Federal Reserve Chairmen
  FED_CHAIRMEN_ROSTER.forEach((fed) => {
    registry.push({
      id: fed.id,
      name: fed.name,
      category: 'Federal Reserve Chairman',
      title: fed.title,
      personality: 'Monetary Central Banker',
      homeBase: 'Suburban Villa',
      favoriteHangout: 'Federal Reserve Vault & Boardroom',
      vehicle: 'Central Bank Sedan',
      currentLocation: 'Government District - Central Bank',
      currentAction: 'Monitoring Inflation Metrics & Target Rates',
      thoughtProcess: `Evaluating policy stance (${fed.policyBias}).`,
    })
  })

  // 5. 10 FTC Chairmen / Regulators
  FTC_CHAIRMEN_ROSTER.forEach((ftc) => {
    registry.push({
      id: ftc.id,
      name: ftc.name,
      category: 'FTC Antitrust Chair',
      title: ftc.title,
      personality: 'Antitrust Regulator',
      homeBase: 'Capitol Townhouse',
      favoriteHangout: 'FTC Hearing Chamber',
      vehicle: 'Government Inspection Vehicle',
      currentLocation: 'Government District - FTC HQ',
      currentAction: 'Reviewing Monopoly & Corporate Merger Filings',
      thoughtProcess: `Investigating ${ftc.bias}.`,
    })
  })

  return registry
}
