// Labubu-style blind-box collectibles for Pixel Palace Arcade's claw
// machine. Rarer figures are drawn far less often and are worth more if the
// player later sells them (see the "Sell" action added to InventoryModal).
// Names are original/parodic, not references to any real toy line.

export const RARITY_TIERS = [
  { id: 'common', label: 'Common', baseWeight: 60, sellValue: 15 },
  { id: 'uncommon', label: 'Uncommon', baseWeight: 28, sellValue: 40 },
  { id: 'rare', label: 'Rare', baseWeight: 10, sellValue: 120 },
  { id: 'legendary', label: 'Legendary', baseWeight: 2, sellValue: 400 },
]

// Grabs with better timing (see ClawMachine.jsx) reweight the odds toward
// this table instead of the base one - still no guarantees, just better
// odds, same "reweight a probability distribution, don't fake a physical
// claw arm" honesty as the rest of the project's simplified minigames.
export const GOOD_GRAB_WEIGHTS = { common: 25, uncommon: 35, rare: 28, legendary: 12 }

const NAMES_BY_TIER = {
  common: ['Nug Buddy', 'Static Bun', 'Grumble Pup', 'Lil Smog', 'Doodle Fang'],
  uncommon: ['Moonlit Nug', 'Chrome Bun', 'Glitch Pup', 'Neon Smog', 'Velvet Fang'],
  rare: ['Prismatic Nug', 'Void Bun', 'Thunder Pup', 'Aurora Smog', 'Obsidian Fang'],
  legendary: ['Celestial Nug (1/1 Foil)', 'Singularity Bun (1/1 Foil)', "Dragon's Fang (1/1 Foil)"],
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)]
}

function weightedTier(weights) {
  const total = Object.values(weights).reduce((a, b) => a + b, 0)
  let r = Math.random() * total
  for (const tier of RARITY_TIERS) {
    const w = weights[tier.id] ?? 0
    if (r < w) return tier
    r -= w
  }
  return RARITY_TIERS[0]
}

// `grabQuality` is 0..1 (how centered the claw-machine timing stop was);
// linearly blends the base (bad) odds toward the good-grab table.
export function rollCollectible(grabQuality = 0) {
  const q = Math.max(0, Math.min(1, grabQuality))
  const blended = {}
  for (const tier of RARITY_TIERS) {
    blended[tier.id] = tier.baseWeight * (1 - q) + GOOD_GRAB_WEIGHTS[tier.id] * q
  }
  const tier = weightedTier(blended)
  const name = pick(NAMES_BY_TIER[tier.id])
  return {
    id: `collectible_${Date.now()}_${Math.floor(Math.random() * 1e6)}`,
    name,
    rarity: tier.id,
    sellValue: tier.sellValue,
    description: `A blind-box vinyl figure from the Pixel Palace claw machine. Rarity: ${tier.label}.`,
    type: 'collectible',
  }
}
