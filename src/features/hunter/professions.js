export const HUNTER_RANKS = ['E', 'D', 'C', 'B', 'A', 'S']

export const RANK_EXP_THRESHOLDS = {
  E: 0,
  D: 500,
  C: 1500,
  B: 3500,
  A: 7000,
  S: 15000,
}

// Standard professions - high spawn probability.
export const PROFESSIONS = [
  {
    id: 'fighter',
    name: 'Fighter',
    weight: 25,
    statFocus: ['STR', 'VIT'],
    skills: [
      { rank: 'E', name: 'Power Strike', effect: 'STR x1.2 on basic attack' },
      { rank: 'C', name: 'Iron Skin', effect: '+15% damage reduction' },
      { rank: 'A', name: 'Berserk', effect: 'STR x1.8 below 30% HP' },
    ],
  },
  {
    id: 'mage',
    name: 'Mage',
    weight: 20,
    statFocus: ['INT', 'PER'],
    skills: [
      { rank: 'E', name: 'Mana Bolt', effect: 'INT-scaled ranged damage' },
      { rank: 'C', name: 'Arcane Shield', effect: 'Absorbs next hit' },
      { rank: 'A', name: 'Meteor', effect: 'AoE INT x2.5 damage' },
    ],
  },
  {
    id: 'assassin',
    name: 'Assassin',
    weight: 20,
    statFocus: ['AGI', 'PER'],
    skills: [
      { rank: 'E', name: 'Backstab', effect: 'AGI-scaled crit chance +20%' },
      { rank: 'C', name: 'Shadow Step', effect: 'Guaranteed first strike' },
      { rank: 'A', name: 'Execute', effect: 'Instant kill below 15% HP' },
    ],
  },
  {
    id: 'tank',
    name: 'Tank',
    weight: 20,
    statFocus: ['VIT', 'STR'],
    skills: [
      { rank: 'E', name: 'Taunt', effect: 'Forces monster aggro' },
      { rank: 'C', name: 'Fortify', effect: '+25% max HP' },
      { rank: 'A', name: 'Unbreakable', effect: 'Survive lethal hit once per rift' },
    ],
  },
  {
    id: 'healer',
    name: 'Healer',
    weight: 14,
    statFocus: ['INT', 'VIT'],
    skills: [
      { rank: 'E', name: 'Minor Heal', effect: 'Restore 15% HP per turn' },
      { rank: 'C', name: 'Regeneration', effect: 'Passive HP regen' },
      { rank: 'A', name: "Sanctuary", effect: 'Negate one fatal blow' },
    ],
  },
  // Hidden overpowered profession - extremely low spawn weight, never picked
  // through the normal weighted roll; only unlocked via a randomized hidden
  // condition rolled once at the start of each playthrough.
  {
    id: 'shadow_monarch',
    name: 'Shadow Monarch',
    weight: 0,
    hidden: true,
    statFocus: ['STR', 'AGI', 'INT', 'VIT', 'PER'],
    skills: [
      { rank: 'E', name: 'Arise', effect: 'Resurrect one fallen monster as a shadow soldier' },
      { rank: 'S', name: 'Monarch\'s Domain', effect: 'All stats doubled once, upon death' },
    ],
  },
]

export function rollStartingProfession() {
  const rollable = PROFESSIONS.filter((p) => !p.hidden)
  const totalWeight = rollable.reduce((sum, p) => sum + p.weight, 0)
  let roll = Math.random() * totalWeight
  for (const profession of rollable) {
    roll -= profession.weight
    if (roll <= 0) return profession.id
  }
  return rollable[0].id
}

export function getProfession(id) {
  return PROFESSIONS.find((p) => p.id === id)
}

export function rankForExp(exp) {
  let currentRank = 'E'
  for (const rank of HUNTER_RANKS) {
    if (exp >= RANK_EXP_THRESHOLDS[rank]) currentRank = rank
  }
  return currentRank
}

// Shadow Monarch unlock conditions - one is chosen at random when a new game
// starts, and it changes every playthrough. The player is never told which
// condition is active; they must discover it through play.
export const SHADOW_MONARCH_CONDITIONS = [
  {
    id: 'flawless_rifts',
    description: 'Clear 3 rifts in a row without taking any damage',
    check: (progress) => progress.flawlessRiftStreak >= 3,
  },
  {
    id: 'monster_slaughter',
    description: 'Defeat 50 monsters total',
    check: (progress) => progress.monstersDefeated >= 50,
  },
  {
    id: 'near_death_survivor',
    description: 'Survive 5 combat turns at or below 5% HP',
    check: (progress) => progress.lowHpTurnsSurvived >= 5,
  },
  {
    id: 'solo_no_shop',
    description: 'Reach C-Rank without buying anything from the supermarket',
    check: (progress, state) =>
      state.player.exp >= RANK_EXP_THRESHOLDS.C && progress.itemsPurchased === 0,
  },
]

export function rollShadowMonarchCondition() {
  const index = Math.floor(Math.random() * SHADOW_MONARCH_CONDITIONS.length)
  return SHADOW_MONARCH_CONDITIONS[index].id
}

export function getShadowMonarchCondition(id) {
  return SHADOW_MONARCH_CONDITIONS.find((c) => c.id === id)
}
