// Procedural monster/card generator - every card is combinatorially unique
// (name, stats, lore, DDM crest) rather than pulling from a fixed card pool.

const PREFIXES = [
  'Frost', 'Iron', 'Void', 'Ember', 'Storm', 'Bone', 'Gale', 'Rust', 'Gloom', 'Solar',
  'Shadow', 'Coral', 'Ash', 'Thorn', 'Onyx', 'Nova',
]
const CREATURES = [
  'Basilisk', 'Widow', 'Golem', 'Wyrm', 'Harpy', 'Chimera', 'Revenant', 'Colossus',
  'Sentinel', 'Phantom', 'Gargoyle', 'Kraken', 'Griffin', 'Wraith', 'Behemoth', 'Sphinx',
]
const LORE_TEMPLATES = [
  (n) => `${n} was sealed away for a thousand years before Duelists dared summon it again.`,
  (n) => `Legends say ${n} guards a treasure that turns to ash if claimed unfairly.`,
  (n) => `${n} answers only to Duelists who have lost something they loved.`,
  (n) => `Few have seen ${n} and lived to draw a card again.`,
  (n) => `${n} was forged in the same fire that first split the Shadow Realm from our own.`,
]
const CREST_SHAPES = ['circle', 'triangle', 'square', 'star', 'diamond']
const CREST_COLORS = ['#e63946', '#457b9d', '#2a9d8f', '#f4a261', '#9d4edd']

function randInt(min, max) {
  return min + Math.floor(Math.random() * (max - min + 1))
}

export function generateCard(tier = 1) {
  const prefix = PREFIXES[randInt(0, PREFIXES.length - 1)]
  const creature = CREATURES[randInt(0, CREATURES.length - 1)]
  const name = `${prefix} ${creature}`
  const power = tier * 400 + randInt(0, 400)
  const atk = power + randInt(-100, 200)
  const def = power + randInt(-200, 100)
  const lore = LORE_TEMPLATES[randInt(0, LORE_TEMPLATES.length - 1)](name)
  const crest = {
    shape: CREST_SHAPES[randInt(0, CREST_SHAPES.length - 1)],
    color: CREST_COLORS[randInt(0, CREST_COLORS.length - 1)],
  }
  return {
    id: `${name}_${Date.now()}_${randInt(0, 99999)}`,
    name,
    atk: Math.max(100, atk),
    def: Math.max(100, def),
    lore,
    crest,
  }
}

export function generateDeck(count, tier = 1) {
  return Array.from({ length: count }, () => generateCard(tier))
}

export const STARTER_DECK = [
  { id: 'starter_1', name: 'Rookie Swordsman', atk: 1200, def: 1000, lore: 'Every Duelist starts somewhere.', crest: { shape: 'circle', color: '#457b9d' } },
  { id: 'starter_2', name: 'Rookie Spellcaster', atk: 900, def: 1400, lore: 'Every Duelist starts somewhere.', crest: { shape: 'square', color: '#2a9d8f' } },
  { id: 'starter_3', name: 'Rookie Beast', atk: 1400, def: 900, lore: 'Every Duelist starts somewhere.', crest: { shape: 'triangle', color: '#f4a261' } },
]

export const YUGI_DECK = [
  { id: 'yugi_1', name: 'Dark Magician', atk: 2500, def: 2100, lore: "Yugi's ace since day one.", crest: { shape: 'star', color: '#9d4edd' } },
  { id: 'yugi_2', name: 'Blue-Eyes White Dragon (borrowed)', atk: 3000, def: 2500, lore: 'Not really his, but he plays it anyway.', crest: { shape: 'diamond', color: '#457b9d' } },
  { id: 'yugi_3', name: 'Exodia Fragment', atk: 1000, def: 1000, lore: 'One fifth of an instant win.', crest: { shape: 'circle', color: '#e63946' } },
]

export function generatePrehistoricDeck(powerLevel) {
  return generateDeck(3, Math.max(1, Math.round(powerLevel)))
}

export function generateFauxDisneyDeck() {
  const names = ['Singing Chimera', 'Enchanted Basilisk', 'Storybook Wraith']
  return names.map((name, i) => ({
    id: `cynn_${i}`,
    name,
    atk: 1800 + randInt(-200, 400),
    def: 1600 + randInt(-200, 400),
    lore: `${name} hums show tunes before it devours you.`,
    crest: { shape: CREST_SHAPES[i % CREST_SHAPES.length], color: '#f4a261' },
  }))
}
