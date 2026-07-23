/**
 * Cartel Narcotics Trade & Illicit Substance System Database & Engine.
 */

export const NARCOTICS_DATABASE = [
  {
    id: 'medellin_cocaine',
    name: 'Pure Medellin Cocaine Brick',
    supplier: 'Pablo Escobar & Griselda Blanco (Medellin Cartel)',
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
    supplier: 'Asian Crime Syndicate (Osaka Docks)',
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
