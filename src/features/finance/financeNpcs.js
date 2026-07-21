export const FINANCE_NPCS = [
  {
    id: 'buffett',
    name: 'Warren Buffett',
    title: 'The Oracle',
    palette: { skin: '#f1c27d', hair: '#e0e0e0', outfit: '#333333', hairStyle: 'Short' },
    netWorth: 100000000000,
    bodyguardPower: 6,
  },
  {
    id: 'vanderbilt',
    name: 'Cornelius Vanderbilt',
    title: 'The Commodore',
    palette: { skin: '#e0ac69', hair: '#e0e0e0', outfit: '#5a3825', hairStyle: 'Long' },
    netWorth: 200000000000,
    bodyguardPower: 8,
  },
  {
    id: 'musk',
    name: 'Elon Musk',
    title: 'The Disruptor',
    palette: { skin: '#f1c27d', hair: '#1a1a1a', outfit: '#3f6fd6', hairStyle: 'Short' },
    netWorth: 250000000000,
    bodyguardPower: 10,
  },
]

export function getFinanceNpc(id) {
  return FINANCE_NPCS.find((n) => n.id === id)
}

export function generateBodyguardMonster(npc) {
  const hp = 80 + npc.bodyguardPower * 30
  const atk = 8 + npc.bodyguardPower * 3
  return {
    name: `${npc.name}'s Bodyguards`,
    maxHp: Math.round(hp),
    hp: Math.round(hp),
    attack: Math.round(atk),
  }
}

export function generateStreetTargetMonster() {
  return {
    name: 'Panicking Bystander',
    maxHp: 20,
    hp: 20,
    attack: 3,
  }
}

export function generateSwatSquad(wantedLevel) {
  const unit = wantedLevel >= 4 ? 'FBI Tactical Unit' : 'SWAT Squad'
  const scale = wantedLevel >= 4 ? 12 : 8
  const hp = 70 + scale * 12
  const atk = 9 + scale * 2.2
  return {
    name: unit,
    maxHp: Math.round(hp),
    hp: Math.round(hp),
    attack: Math.round(atk),
  }
}
