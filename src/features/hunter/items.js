export const USED_TAMPON = {
  id: 'used_tampon',
  name: 'A Piece of Used Tampon',
  type: 'weapon',
  description: 'It should not be this powerful. Nobody knows why.',
  stats: { STR: 40, AGI: 15, lifeSteal: 0.25, aura: true },
}

export const WEIRD_UMBRELLA = {
  id: 'weird_umbrella',
  name: 'The Weirdest Umbrella with the Most Unimaginative Name',
  type: 'artifact',
  description:
    'Closes any active dimensional rift from the outside, without entering, granting full raid rewards as if cleared.',
  stats: {},
  ability: 'instant_rift_clear',
}

export const SPRING_OF_NAZARICK = {
  id: 'spring_of_nazarick',
  name: 'Spring of Nazarick',
  type: 'quest',
  description: 'A dirt-cheap bottle of water that is secretly one of the rarest items in existence.',
  stats: {},
  requiredForFinalRaid: true,
}

export const RIFT_LOOT_TABLE = [
  { id: 'basic_sword', name: 'Basic Sword', stats: { STR: 3 }, weight: 40 },
  { id: 'leather_armor', name: 'Leather Armor', stats: { VIT: 3 }, weight: 40 },
  { id: 'focus_ring', name: 'Focus Ring', stats: { INT: 3 }, weight: 20 },
]

export function rollRiftLoot() {
  const totalWeight = RIFT_LOOT_TABLE.reduce((s, i) => s + i.weight, 0)
  let roll = Math.random() * totalWeight
  for (const item of RIFT_LOOT_TABLE) {
    roll -= item.weight
    if (roll <= 0) return item
  }
  return RIFT_LOOT_TABLE[0]
}
