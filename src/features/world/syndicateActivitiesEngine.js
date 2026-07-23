/**
 * Fleshed-Out Crime Syndicates & Cartel Operations Engine.
 */

export const SYNDICATE_OPERATIONS_CATALOG = [
  {
    id: 'medellin',
    name: 'Medellin Cartel',
    boss: 'Pablo Escobar & Griselda Blanco',
    territory: 'Osaka Docks & Sapporo Jungle Docks',
    primaryNarcotic: 'Pure Medellin Cocaine',
    rackets: ['International Cocaine Refining', 'Air-Drop Logistics', 'Cartel Compound Defense'],
    specialPerk: 'Wholesale Cocaine Discount (-40% Cost) & Jungle Air-Drop Depots',
    dailyExtortionYield: 85000,
  },
  {
    id: 'chicago_outfit',
    name: 'Chicago Outfit',
    boss: 'Al Capone & Frank Nitti',
    territory: 'Osaka Commercial & Nightlife',
    primaryNarcotic: 'Bootleg Liquor & Contraband Spirits',
    rackets: ['Subterranean Speakeasy Hotels', 'Underground Gambling Vaults', 'Protection Tolls'],
    specialPerk: '+$45,000/day Protection Tolls & Police Bureau Bribes',
    dailyExtortionYield: 45000,
  },
  {
    id: 'national_syndicate',
    name: 'National Crime Syndicate',
    boss: 'Lucky Luciano & Meyer Lansky',
    territory: 'Tokyo Financial & Osaka Strip',
    primaryNarcotic: 'Pharmaceutical Contraband',
    rackets: ['Flamingo Casino Resorts', 'Offshore Skimming', 'Wall Street Stock Pools'],
    specialPerk: 'High-Stakes Casino Skimming Yields & Money Laundering',
    dailyExtortionYield: 75000,
  },
  {
    id: 'murder_inc',
    name: 'Murder, Inc.',
    boss: 'Bugsy Siegel & Albert Anastasia',
    territory: 'Osaka Dotonbori',
    primaryNarcotic: 'Untraceable Firearms',
    rackets: ['Contract Homicides', 'Executive Extortion', 'Enforcement Squads'],
    specialPerk: 'Hire Professional Hitmen for Discreet Unwitnessed Eliminations ($50,000)',
    dailyExtortionYield: 60000,
  },
  {
    id: 'five_families',
    name: 'Five Families Mob',
    boss: 'Frank Costello & Vito Genovese',
    territory: 'Tokyo Waterfront Docks',
    primaryNarcotic: 'Cargo Contraband',
    rackets: ['Labor Union Control', 'Cargo Theft', 'Smuggling Warehouses'],
    specialPerk: 'Dock Storage Vaults & Untraceable Arms Shipments',
    dailyExtortionYield: 50000,
  },
  {
    id: 'rothstein',
    name: 'Arnold Rothstein Syndicate',
    boss: 'Arnold Rothstein',
    territory: 'Kyoto Historic & Financial',
    primaryNarcotic: 'High-Stakes Loans',
    rackets: ['Fixed Sports Betting', 'Loan Sharking', 'Black Market Banking'],
    specialPerk: 'High-Limit Syndicate Loans ($500,000) & Fixed Market Odds',
    dailyExtortionYield: 55000,
  },
  {
    id: 'golden_triangle',
    name: 'Golden Triangle Cartel',
    boss: 'Asian Cartel Syndicate',
    territory: 'Kyoto & Sapporo Docks',
    primaryNarcotic: 'Golden Triangle Raw Opium',
    rackets: ['Opium Refining', 'Counterfeit Passports', 'Arcade Control'],
    specialPerk: 'Raw Opium Shipments & Counterfeit Passports (-2 Police Heat)',
    dailyExtortionYield: 65000,
  },
]

export function hireMurderIncHitman(targetName, playerCash) {
  const cost = 50000
  if (playerCash < cost) {
    return { success: false, reason: `Insufficient cash! Need $${cost.toLocaleString()} to retain Murder, Inc. Hitman.` }
  }
  return {
    success: true,
    cost,
    log: `💥 MURDER, INC. CONTRACT: Retained Bugsy Siegel's enforcement squad! Contract out on ${targetName}. Discreet elimination scheduled.`,
  }
}
