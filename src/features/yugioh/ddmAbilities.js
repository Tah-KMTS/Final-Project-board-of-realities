// Pure resolver helpers for named-monster abilities (see
// ddmMonsterCatalog.js). Kept separate from DDMBoard.jsx's UI/state layer,
// mirroring how ddmEngine.js separates rules from presentation.

export function canAffordAbility(bank, crestCost) {
  return Object.entries(crestCost).every(([type, amt]) => (bank[type] || 0) >= amt)
}

export function spendCrests(bank, crestCost) {
  const next = { ...bank }
  for (const [type, amt] of Object.entries(crestCost)) next[type] = Math.max(0, next[type] - amt)
  return next
}

export function manhattanDistance(a, b) {
  return Math.abs(a.col - b.col) + Math.abs(a.row - b.row)
}

// Piercing Breath's "straight line" targeting: same row or same column,
// regardless of range (no line-of-sight/obstruction check - the engine has
// no terrain between monsters to obstruct with).
export function isInLine(a, b) {
  return a.col === b.col || a.row === b.row
}

export function isAdjacentPoint(a, b) {
  return (Math.abs(a.col - b.col) === 1 && a.row === b.row) ||
    (Math.abs(a.row - b.row) === 1 && a.col === b.col)
}

// Pushes `target` directly away from `caster` up to `steps` tiles, stopping
// at the board edge or the first occupied/blocked tile. Assumes caster and
// target start adjacent (Gale Force's targeting constraint), so there is
// exactly one axis of movement.
export function computeKnockback(caster, target, steps, gridCols, gridRows, isBlocked) {
  const dCol = Math.sign(target.col - caster.col)
  const dRow = Math.sign(target.row - caster.row)
  let { col, row } = target
  for (let i = 0; i < steps; i++) {
    const nc = col + dCol
    const nr = row + dRow
    if (nc < 0 || nc >= gridCols || nr < 0 || nr >= gridRows) break
    if (isBlocked(nc, nr)) break
    col = nc
    row = nr
  }
  return { col, row }
}

// Resolves a d6-based Parry check (Mystic Blader): true = damage negated.
export function rollParry() {
  return 1 + Math.floor(Math.random() * 6) >= 4
}

// Ability ids from the original 8-monster "Homage" set - each has its own
// bespoke handler in DDMBoard.jsx rather than routing through the generic
// mechanic resolver below.
export const BESPOKE_ABILITY_IDS = new Set([
  'detonate', 'hyper_focus', 'meltdown', 'firewall', 'piercing_breath', 'gale_force', 'parry', 'pressure_blast',
])

// Mechanic tags (from ddmDragonSeries.js / ddmMachineSeries.js /
// ddmMagicSeries.js) that DDMBoard.jsx's generic resolver actually
// implements. Anything else - including the explicit 'not_implemented' tag
// and any mechanic not listed here - still summons and displays correctly,
// it just doesn't get a working action button, so nothing is silently
// faked. See ddmDragonSeries.js's header comment for why: ~200 unique
// abilities can't all be hand-built and verified in one pass, so the
// tractable common patterns (damage, buffs/debuffs, freeze, poison,
// push/pull, crest manipulation, barriers, healing, shields, reflection)
// are wired for real, and the genuinely exotic ones (graveyard mechanics,
// mind control, dice-outcome rewriting, multi-turn banked effects,
// board-wide multi-target selection) are left visibly inert.
export const IMPLEMENTED_MECHANICS = new Set([
  'damage_target', 'damage_line', 'damage_radius', 'damage_all_enemies',
  'temp_def_buff', 'temp_atk_buff', 'perm_def_debuff', 'temp_atk_debuff',
  'freeze_target', 'freeze_adjacent', 'poison', 'push', 'pull_target',
  'crest_steal', 'crest_destroy', 'crest_gain', 'heal_target',
  'barrier_create', 'summon_clone', 'self_destruct_target', 'self_destruct_adjacent',
  'reflect_damage', 'silence', 'shield_next_hit',
])

export function isAbilityImplemented(ability) {
  if (!ability) return false
  if (BESPOKE_ABILITY_IDS.has(ability.id)) return true
  return IMPLEMENTED_MECHANICS.has(ability.mechanic)
}
