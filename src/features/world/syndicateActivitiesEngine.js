/**
 * Fleshed-Out Crime Syndicates & Cartel Operations Engine.
 *
 * Data-consistency note (re-keying pass): this catalog used to be an
 * independent list that only loosely tracked the canonical 7 syndicates
 * defined in src/data/syndicate.js (SYNDICATE_MEMBERS) and
 * src/features/government/crimeSyndicates.js (CRIME_SYNDICATES) - the two
 * files agentRegistry/characterDispositions/townMigrationEngine actually key
 * off of. It has now been remapped so all three sources agree:
 *
 *  - `id` fields now match the 7 canonical syndicate IDs exactly
 *    (chicago_outfit, five_families, national_syndicate, medellin_cartel,
 *    griselda_empire, murder_inc, speakeasy_syndicate). 'medellin' ->
 *    'medellin_cartel' and 'rothstein' -> 'speakeasy_syndicate' were the two
 *    renames; the other five ids already matched canon.
 *  - `boss` fields were previously scrambled Boss+Underboss pairs pulled
 *    from the WRONG syndicates (e.g. this file listed Bugsy Siegel - the
 *    National Crime Syndicate's Underboss - as a Murder, Inc. boss, and
 *    Lucky Luciano - the Five Families' own Boss - as a National Crime
 *    Syndicate boss). Every pairing below was re-checked against
 *    syndicate.js and corrected to that syndicate's actual Boss & Underboss.
 *  - `territory` fields used an unrelated Osaka/Tokyo/Kyoto/Sapporo city
 *    naming scheme left over from an earlier draft. They've been replaced
 *    with the District names each syndicate actually holds per
 *    syndicate.js/crimeSyndicates.js (Underground/Commercial/Financial/
 *    Government & Cultural District), matching what world-presence and heat
 *    simulation already use elsewhere.
 *  - The 8th entry, "Golden Triangle Cartel" (fronted by a generic, unnamed
 *    "Asian Cartel Syndicate" boss with no bio anywhere in canon), has been
 *    removed rather than fixed - there is no such syndicate in
 *    SYNDICATE_MEMBERS/CRIME_SYNDICATES and inventing one would just
 *    recreate the same 3-sources-of-truth problem. Its two flavorful
 *    rackets ("Opium Refining" / "Counterfeit Passports") were folded into
 *    the Medellin Syndicate's entry below as an absorbed smuggling route,
 *    since narco-trafficking + smuggling is squarely that syndicate's
 *    specialty (see Escobar/Gaviria's "Global Narcotic Smuggling" bios).
 *    Medellin's existing payout/perk numbers were left untouched - only the
 *    rackets list gained an entry - so this is additive, not a rebalance.
 *  - Griselda Blanco was previously mentioned only as a second "boss" name
 *    bolted onto the Medellin entry, even though she runs her own
 *    syndicate (griselda_empire) per canon. She now gets her own catalog
 *    entry like every other Boss, with Medellin's entry reverted to just
 *    its actual Boss & Underboss (Escobar & Gaviria).
 */

export const SYNDICATE_OPERATIONS_CATALOG = [
  {
    id: 'medellin_cartel',
    name: 'Medellin Syndicate',
    boss: 'Pablo Escobar & Gustavo Gaviria',
    territory: 'Underground District - Docks',
    primaryNarcotic: 'Pure Medellin Cocaine',
    // 'Counterfeit Passport Network' absorbed from the removed Golden
    // Triangle Cartel entry - fits Escobar/Gaviria's smuggling specialty.
    rackets: ['International Cocaine Refining', 'Air-Drop Logistics', 'Cartel Compound Defense', 'Counterfeit Passport Network'],
    specialPerk: 'Wholesale Cocaine Discount (-40% Cost) & Jungle Air-Drop Depots',
    dailyExtortionYield: 85000,
  },
  {
    id: 'chicago_outfit',
    name: 'Chicago Outfit',
    boss: 'Al Capone & Frank Nitti',
    territory: 'Underground District - West',
    primaryNarcotic: 'Bootleg Liquor & Contraband Spirits',
    rackets: ['Subterranean Speakeasy Hotels', 'Underground Gambling Vaults', 'Protection Tolls'],
    specialPerk: '+$45,000/day Protection Tolls & Police Bureau Bribes',
    dailyExtortionYield: 45000,
  },
  {
    id: 'national_syndicate',
    name: 'National Crime Syndicate',
    // Was 'Lucky Luciano & Meyer Lansky' - Luciano is the Five Families'
    // Boss, not this syndicate's. Corrected to Lansky's actual Underboss.
    boss: 'Meyer Lansky & Bugsy Siegel',
    territory: 'Financial District - Vaults',
    primaryNarcotic: 'Pharmaceutical Contraband',
    rackets: ['Flamingo Casino Resorts', 'Offshore Skimming', 'Wall Street Stock Pools'],
    specialPerk: 'High-Stakes Casino Skimming Yields & Money Laundering',
    dailyExtortionYield: 75000,
  },
  {
    id: 'murder_inc',
    name: 'Murder, Inc.',
    // Was 'Bugsy Siegel & Albert Anastasia' - Siegel belongs to the
    // National Crime Syndicate. Corrected to Murder Inc.'s actual Boss.
    boss: 'Lepke Buchalter & Albert Anastasia',
    territory: 'Underground District - Alleyways',
    primaryNarcotic: 'Untraceable Firearms',
    rackets: ['Contract Homicides', 'Executive Extortion', 'Enforcement Squads'],
    specialPerk: 'Hire Professional Hitmen for Discreet Unwitnessed Eliminations ($50,000)',
    dailyExtortionYield: 60000,
  },
  {
    id: 'five_families',
    name: 'Five Families (Luciano Family)',
    // Was 'Frank Costello & Vito Genovese' - Costello is this syndicate's
    // Capo, not its Boss. Corrected to lead with the actual Boss, Luciano.
    boss: 'Lucky Luciano & Vito Genovese',
    territory: 'Commercial District - Docks',
    primaryNarcotic: 'Cargo Contraband',
    rackets: ['Labor Union Control', 'Cargo Theft', 'Smuggling Warehouses'],
    specialPerk: 'Dock Storage Vaults & Untraceable Arms Shipments',
    dailyExtortionYield: 50000,
  },
  {
    // Previously appeared only as a second "boss" bolted onto the Medellin
    // entry ('Pablo Escobar & Griselda Blanco'), even though she runs her
    // own syndicate. Given her own catalog entry to match canon.
    id: 'griselda_empire',
    name: 'Griselda Empire',
    boss: 'Griselda Blanco & Osvaldo Trujillo',
    territory: 'Commercial District - Nightlife',
    primaryNarcotic: 'Miami-Grade Cocaine Powder',
    rackets: ['Nightclub Extortion Rings', 'Custom Smuggling Luggage', 'Speedboat Cocaine Runs'],
    specialPerk: 'Motorcycle Drive-By Enforcement & Hidden-Compartment Luggage Smuggling',
    dailyExtortionYield: 70000,
  },
  {
    // Was id 'rothstein' - renamed to the canonical syndicate id used by
    // crimeSyndicates.js/agentRegistry (Rothstein is this syndicate's Boss,
    // not the syndicate's own id).
    id: 'speakeasy_syndicate',
    name: 'The Speakeasy Syndicate',
    boss: 'Arnold Rothstein & Waxey Gordon',
    territory: 'Government & Cultural District',
    primaryNarcotic: 'High-Stakes Loans',
    rackets: ['Fixed Sports Betting', 'Loan Sharking', 'Black Market Banking'],
    specialPerk: 'High-Limit Syndicate Loans ($500,000) & Fixed Market Odds',
    dailyExtortionYield: 55000,
  },
  // NOTE: The 8th entry that used to live here, 'golden_triangle' /
  // "Golden Triangle Cartel" fronted by a generic unnamed "Asian Cartel
  // Syndicate" boss, has been removed - it was never one of the canonical
  // 7 syndicates in syndicate.js/crimeSyndicates.js. Its usable content was
  // folded into the Medellin Syndicate entry above. If any old save data
  // ever referenced this id directly, treat it as unknown/absorbed rather
  // than crashing (see SyndicateOperationsModal.jsx, which only ever reads
  // this catalog live and never persists an id, so no save migration is
  // needed for THIS list specifically).
]

export function hireMurderIncHitman(targetName, playerCash) {
  const cost = 50000
  if (playerCash < cost) {
    return { success: false, reason: `Insufficient cash! Need $${cost.toLocaleString()} to retain Murder, Inc. Hitman.` }
  }
  return {
    success: true,
    cost,
    // Was "Bugsy Siegel's enforcement squad" - Siegel is the National
    // Crime Syndicate's Underboss, not Murder, Inc.'s. Corrected to
    // Murder, Inc.'s actual Boss.
    log: `💥 MURDER, INC. CONTRACT: Retained Lepke Buchalter's enforcement squad! Contract out on ${targetName}. Discreet elimination scheduled.`,
  }
}
