// Applies collected inventory items' stats/abilities to actual gameplay.
// Previously `inventory` only ever grew (items pushed on pickup) and was
// never read anywhere else - no UI showed it, and item.stats/item.ability
// had no mechanical effect. This module is the read side of that data.

const STAT_KEYS = ['STR', 'AGI', 'INT', 'VIT', 'PER']

export function getInventoryStatBonus(inventory) {
  const bonus = { STR: 0, AGI: 0, INT: 0, VIT: 0, PER: 0 }
  for (const item of inventory) {
    if (!item?.stats) continue
    for (const key of STAT_KEYS) {
      if (typeof item.stats[key] === 'number') bonus[key] += item.stats[key]
    }
  }
  return bonus
}

// Sums lifeSteal fractions across items that have one (e.g. the Used
// Tampon's 0.25), capped so multiple lifesteal items can't trivialize
// combat by fully refilling HP every hit.
export function getInventoryLifeSteal(inventory) {
  const total = inventory.reduce((sum, item) => sum + (item?.stats?.lifeSteal || 0), 0)
  return Math.min(0.6, total)
}

// Items with `aura: true` grant a small flat damage-reduction aura.
export function getInventoryAuraReduction(inventory) {
  const auraCount = inventory.filter((item) => item?.stats?.aura).length
  return Math.min(0.3, auraCount * 0.05)
}

export function findConsumableByAbility(inventory, ability) {
  return inventory.find((item) => item?.ability === ability) || null
}
