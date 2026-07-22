// Named DDM monster series with real crest-costed abilities, layered on top
// of the flavor-only cardGenerator-based monsters ddmEngine.generateMonster
// used before. Each ability's crestCost keys map onto ddmEngine's
// CREST_TYPES ('movement'|'attack'|'defense'|'spell'|'trap') - "Magic
// Crest" in the original design notes is this engine's 'spell' crest.
//
// This "Homage" set (below) has every ability fully wired end-to-end in
// DDMBoard.jsx/ddmAbilities.js. The three large 50-monster series
// (ddmDragonSeries.js, ddmMachineSeries.js, ddmMagicSeries.js) layer on
// top of it - most of their abilities route through the generic resolver
// in ddmEffectResolver.js, and any ability tagged `mechanic: 'not_implemented'`
// (or whose mechanic tag the resolver doesn't recognize) still summons and
// displays correctly, it just doesn't have a working action button yet -
// that's shown honestly in the UI rather than silently faked.

import { DRAGON_SERIES } from './ddmDragonSeries'
import { MACHINE_SERIES } from './ddmMachineSeries'
import { MAGIC_SERIES } from './ddmMagicSeries'

const HOMAGE_SERIES = [
  // --- Series 1: The Classic Homage ---
  {
    id: 'azure_spell_dragon',
    name: 'Azure Spell-Dragon',
    level: 4,
    hp: 40,
    atk: 30,
    def: 20,
    creatureType: 'Dragon',
    ability: {
      id: 'piercing_breath',
      name: 'Piercing Breath',
      crestCost: { spell: 2 },
      target: 'line', // any enemy monster sharing this monster's row or column
      description: 'Deals 10 damage to a monster in a straight line, ignoring Defense.',
    },
  },
  {
    id: 'mystic_blader',
    name: 'Mystic Blader',
    level: 2,
    hp: 20,
    atk: 10,
    def: 10,
    creatureType: 'Warrior',
    ability: {
      id: 'parry',
      name: 'Parry',
      crestCost: { defense: 1 },
      target: 'passive', // triggers automatically when this monster is attacked
      description: 'If attacked, roll a d6. On 4-6, negate all incoming damage.',
    },
  },
  {
    id: 'shadow_imp',
    name: 'Shadow Imp',
    level: 1,
    hp: 10,
    atk: 10,
    def: 10,
    creatureType: 'Fiend',
    ability: {
      id: 'detonate',
      name: 'Detonate',
      crestCost: { spell: 1 },
      target: 'self',
      description: 'Destroy this monster to deal 10 damage to all adjacent enemy monsters.',
    },
  },

  // --- Series 2: The Industrial Forge ---
  {
    id: 'furnace_colossus',
    name: 'Furnace Colossus',
    level: 4,
    hp: 50,
    atk: 20,
    def: 30,
    creatureType: 'Machine',
    ability: {
      id: 'meltdown',
      name: 'Meltdown',
      crestCost: { spell: 3 },
      target: 'self',
      description: 'Reduces the DEF of all enemy monsters within a 3-tile radius to 0 for one turn.',
    },
  },
  {
    id: 'turbine_harpy',
    name: 'Turbine Harpy',
    level: 3,
    hp: 20,
    atk: 20,
    def: 10,
    creatureType: 'Winged-Beast',
    ability: {
      id: 'gale_force',
      name: 'Gale Force',
      crestCost: { spell: 2 },
      // House rule: target must be adjacent (the engine has no general
      // line-targeting-at-range concept outside Piercing Breath's row/col
      // check) - pushed up to 3 tiles along that same axis.
      target: 'adjacent-enemy',
      description: 'Pushes a targeted adjacent enemy monster up to 3 tiles away in a straight line.',
    },
  },
  {
    id: 'pneumatic_golem',
    name: 'Pneumatic Golem',
    level: 2,
    hp: 20,
    atk: 10,
    def: 20,
    creatureType: 'Machine',
    ability: {
      id: 'pressure_blast',
      name: 'Pressure Blast',
      crestCost: { attack: 1 },
      target: 'passive', // triggers automatically on a kill made via normal Attack
      description: 'If this monster destroys an enemy in combat, the enemy controller loses 1 Movement Crest.',
    },
  },

  // --- Series 3: The Grid Sentinels ---
  {
    id: 'void_grid_aegis',
    name: 'Void-Grid Aegis',
    level: 3,
    hp: 30,
    atk: 10,
    def: 30,
    creatureType: 'Cyberse',
    ability: {
      id: 'firewall',
      name: 'Firewall',
      crestCost: { defense: 2 },
      target: 'adjacent-empty',
      description: 'Create an impassable energy barrier on an adjacent empty tile. Lasts two turns, has 20 HP.',
    },
  },
  {
    id: 'inner_champion',
    name: 'Inner Champion',
    level: 1,
    hp: 10,
    atk: 20,
    def: 0,
    creatureType: 'Beast-Warrior',
    ability: {
      id: 'hyper_focus',
      name: 'Hyper-Focus',
      crestCost: { spell: 1 },
      target: 'self',
      description: 'This monster gains +10 ATK until the end of the turn, but cannot move this turn.',
    },
  },
]

export const DDM_MONSTER_CATALOG = [...HOMAGE_SERIES, ...DRAGON_SERIES, ...MACHINE_SERIES, ...MAGIC_SERIES]

export function getCatalogMonstersByLevel(level) {
  return DDM_MONSTER_CATALOG.filter((m) => m.level === level)
}

export function pickCatalogMonster(level) {
  const options = getCatalogMonstersByLevel(level)
  if (options.length === 0) return null
  return options[Math.floor(Math.random() * options.length)]
}
