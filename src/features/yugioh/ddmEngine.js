// Simplified Dungeon Dice Monsters rules engine. Faithful to the spec's
// core loop (13x19 grid, Die Masters at 3 HP, a 5-type capped crest bank,
// 2+-matching-level summon rolls, die-net unfolding into permanent path
// tiles, movement/attack/defense crests, flat 1-damage direct Die Master
// hits) with a few pragmatic house rules disclosed alongside the code:
// monsters carry their own HP pool (not part of the source excerpt) so
// monster-vs-monster combat has a real resolution, and the "6-tile net"
// unfolds as a fixed plus-shaped cluster rather than the true hexomino
// variety, since the exact net shapes aren't specified.

import { generateCard } from './cardGenerator'

export const GRID_COLS = 13
export const GRID_ROWS = 19
export const CREST_TYPES = ['movement', 'attack', 'defense', 'spell']
export const CREST_CAP = 10
export const DIE_MASTER_MAX_HP = 3
export const DICE_POOL_LEVELS = [1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4]

export const PLAYER_DM = { col: 6, row: 17 }
export const OPPONENT_DM = { col: 6, row: 1 }

function inBounds(col, row) {
  return col >= 0 && col < GRID_COLS && row >= 0 && row < GRID_ROWS
}

function neighborsOf(col, row) {
  return [
    { col: col + 1, row }, { col: col - 1, row },
    { col, row: row + 1 }, { col, row: row - 1 },
  ].filter((p) => inBounds(p.col, p.row))
}

export function createInitialBoard() {
  const cells = {}
  const key = (c, r) => `${c},${r}`
  const seedPatch = (center) => {
    cells[key(center.col, center.row)] = 'path'
    for (const n of neighborsOf(center.col, center.row)) cells[key(n.col, n.row)] = 'path'
  }
  seedPatch(PLAYER_DM)
  seedPatch(OPPONENT_DM)
  return cells
}

export function createEmptyCrestBank() {
  return { movement: 0, attack: 0, defense: 0, spell: 0 }
}

export function rollDice(difficultyBonus = 0) {
  // Draw 3 dice from the conceptual 15-dice pool and resolve a face each.
  const results = []
  for (let i = 0; i < 3; i++) {
    const level = DICE_POOL_LEVELS[Math.floor(Math.random() * DICE_POOL_LEVELS.length)]
    const roll = Math.random()
    let face
    if (roll < 0.4 + difficultyBonus * 0.03) face = { type: 'summon', level }
    else if (roll < 0.55) face = { type: 'movement' }
    else if (roll < 0.75) face = { type: 'attack' }
    else if (roll < 0.9) face = { type: 'defense' }
    else face = { type: 'spell' }
    results.push(face)
  }
  return results
}

export function resolveRoll(bank, diceResults) {
  const summonCounts = {}
  const nextBank = { ...bank }
  let summonLevel = null

  for (const face of diceResults) {
    if (face.type === 'summon') {
      summonCounts[face.level] = (summonCounts[face.level] || 0) + 1
    } else {
      nextBank[face.type] = Math.min(CREST_CAP, nextBank[face.type] + 1)
    }
  }

  const qualifying = Object.entries(summonCounts).filter(([, count]) => count >= 2)
  if (qualifying.length > 0) {
    summonLevel = Math.max(...qualifying.map(([lvl]) => Number(lvl)))
  }

  return { nextBank, summonLevel }
}

export function generateMonster(owner, level) {
  // Reuse the card generator only for its name/lore - its ATK/DEF numbers
  // are scaled for 8000-LP Yu-Gi-Oh duels and would one-shot anything on
  // this board's much smaller HP scale (Die Master = 3 HP). DDM stats are
  // generated independently at a scale that keeps Defense crests relevant.
  const card = generateCard(level)
  const hp = 8 + level * 6
  const atk = 2 + level * 2 + Math.floor(Math.random() * 3)
  const def = 2 + level * 2 + Math.floor(Math.random() * 3)
  return {
    id: `${owner}_${Date.now()}_${Math.floor(Math.random() * 99999)}`,
    owner,
    level,
    name: card.name,
    atk,
    def,
    hp,
    maxHp: hp,
    col: null,
    row: null,
  }
}

export function findUnfoldCandidates(cells, owner) {
  const key = (c, r) => `${c},${r}`
  const ownedTiles = Object.entries(cells)
    .filter(([, v]) => v === owner || v === 'path')
    .map(([k]) => k)
  // Any path tile can be built from, since path tiles aren't owner-tagged
  // in this simplified model - both sides share the walkable network but
  // can only unfold from tiles within reach of their own Die Master side
  // of the board (rough halfway split keeps the two bases distinct).
  const halfwayRow = GRID_ROWS / 2
  const candidates = new Set()
  for (const tileKey of Object.keys(cells)) {
    const [c, r] = tileKey.split(',').map(Number)
    const onOwnerSide = owner === 'player' ? r >= halfwayRow - 3 : r <= halfwayRow + 3
    if (!onOwnerSide) continue
    for (const n of neighborsOf(c, r)) {
      const nKey = key(n.col, n.row)
      if (!cells[nKey]) candidates.add(nKey)
    }
  }
  return Array.from(candidates).map((k) => {
    const [col, row] = k.split(',').map(Number)
    return { col, row }
  })
}

export function unfoldNet(cells, center) {
  const nextCells = { ...cells }
  const key = (c, r) => `${c},${r}`
  nextCells[key(center.col, center.row)] = 'path'
  const spread = neighborsOf(center.col, center.row)
  // Fixed plus-shaped 6-tile net (center + up to 4 neighbors + one extra
  // step outward), standing in for the true hexomino die-net variety.
  for (const n of spread) {
    nextCells[key(n.col, n.row)] = 'path'
  }
  if (spread.length > 0) {
    const extra = neighborsOf(spread[0].col, spread[0].row).find((p) => !nextCells[key(p.col, p.row)])
    if (extra) nextCells[key(extra.col, extra.row)] = 'path'
  }
  return nextCells
}

export function isAdjacent(a, b) {
  return (Math.abs(a.col - b.col) === 1 && a.row === b.row) ||
    (Math.abs(a.row - b.row) === 1 && a.col === b.col)
}

export function computeDamage(attackerAtk, defenderDef, defenderSpentDefense) {
  return defenderSpentDefense ? Math.max(0, attackerAtk - defenderDef) : attackerAtk
}
