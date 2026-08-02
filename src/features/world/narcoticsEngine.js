/**
 * Cartel Narcotics Trade & Illicit Substance System Database & Engine.
 *
 * Data-consistency note (attribution pass): supplier strings here previously
 * carried the same "3 sources of truth" bug already fixed in
 * src/features/world/syndicateActivitiesEngine.js. Cross-checked against the
 * canonical roster in src/data/syndicate.js:
 *
 *  - `medellin_cocaine` used to credit 'Pablo Escobar & Griselda Blanco
 *    (Medellin Cartel)', conflating two separate organizations - Escobar
 *    heads medellin_cartel, but Blanco heads her own griselda_empire
 *    (Commercial District - Nightlife) per syndicate.js/crimeSyndicates.js.
 *    Corrected to Escobar's actual canonical second, Gustavo Gaviria
 *    (Underboss, medellin_cartel), matching medellin_cartel's Boss+Underboss
 *    pairing everywhere else in the codebase.
 *  - `raw_opium` used to credit a generic, unnamed 'Asian Crime Syndicate
 *    (Osaka Docks)' - the only supplier in this file without a real named
 *    figure, unlike its six peers. Reassigned to Vito Genovese, the Five
 *    Families' actual Underboss, whose syndicate.js bio explicitly covers
 *    "wholesale narcotics shipments arriving on European freighters" and a
 *    waterfront/drug distribution empire - a direct historical match for an
 *    opium/heroin supply line, unlike an invented placeholder syndicate.
 *  No prices, yields, margins, or buffs were changed - this is a naming/
 *  attribution correction only.
 */

export const NARCOTICS_DATABASE = [
  {
    id: 'medellin_cocaine',
    name: 'Pure Medellin Cocaine Brick',
    supplier: 'Pablo Escobar & Gustavo Gaviria (Medellin Cartel)',
    wholesalePrice: 3500,
    resalePrice: 8000,
    profitMargin: '+128% Resale Profit Margin',
    buff: '+25% Combat Damage & +30% Movement Speed for 3 Days',
    type: 'illicit',
  },
  {
    id: 'blue_meth',
    name: 'High-Purity Blue Methamphetamine',
    supplier: 'Underground Chemical Lab (Sapporo)',
    wholesalePrice: 2000,
    resalePrice: 5500,
    profitMargin: '+175% Resale Profit Margin',
    buff: 'Restores 100% Energy & Stamina',
    type: 'illicit',
  },
  {
    id: 'raw_opium',
    name: 'Golden Triangle Raw Opium Crate',
    supplier: 'Vito Genovese (Five Families - Waterfront Narcotics Network)',
    wholesalePrice: 4000,
    resalePrice: 10000,
    profitMargin: '+150% Resale Profit Margin',
    buff: 'High Value Syndicate Contraband',
    type: 'illicit',
  },
  {
    id: 'painkillers',
    name: 'Pharmaceutical Grade Painkillers',
    supplier: 'Hospital ER Pharmacy',
    wholesalePrice: 150,
    resalePrice: 400,
    profitMargin: 'Medical Grade',
    buff: 'Restores +40 HP Instantly',
    type: 'pharmaceutical',
  },
]

export function calculateCartelResale(narcoticId, quantity) {
  const item = NARCOTICS_DATABASE.find((n) => n.id === narcoticId) || NARCOTICS_DATABASE[0]
  const cost = item.wholesalePrice * quantity
  const payout = item.resalePrice * quantity
  const profit = payout - cost

  // DEA Interdiction Risk Check (20% chance)
  const deaBusted = Math.random() < 0.2
  return {
    item,
    quantity,
    cost,
    payout,
    profit,
    deaBusted,
  }
}
