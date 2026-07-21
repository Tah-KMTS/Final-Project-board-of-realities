const MONSTER_NAMES = [
  'Goblin Scout', 'Rift Wolf', 'Stone Golem', 'Shadow Wraith', 'Venom Spider',
  'Orc Berserker', 'Ice Elemental', 'Rift Wyvern',
]

export function generateMonster(difficulty) {
  const name = MONSTER_NAMES[Math.floor(Math.random() * MONSTER_NAMES.length)]
  const baseHp = 30 + difficulty * 18
  const baseAtk = 4 + difficulty * 2.2
  return {
    name,
    maxHp: Math.round(baseHp),
    hp: Math.round(baseHp),
    attack: Math.round(baseAtk),
  }
}

export function generateHunterPolice(wantedLevel) {
  const rank = wantedLevel >= 4 ? 'S-Rank' : 'A-Rank'
  const scale = wantedLevel >= 4 ? 14 : 10
  const hp = 60 + scale * 14
  const atk = 10 + scale * 2.5
  return {
    name: `${rank} Hunter Police Officer`,
    maxHp: Math.round(hp),
    hp: Math.round(hp),
    attack: Math.round(atk),
  }
}
