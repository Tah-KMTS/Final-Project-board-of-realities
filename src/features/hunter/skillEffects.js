// Wires the profession skill flavor text in professions.js into actual
// combat behavior. Each profession's E/C/A-rank skill names/effects were
// previously display-only - this module is the single place that turns
// them into real numbers, reinterpreted where needed to fit RiftCombatModal's
// existing 1-player-vs-1-monster turn shape (no multi-target board, no
// per-monster targeting), documented per-skill below.
//
// Rank gating: a skill is active once the player's current hunterRank is at
// or above the skill's listed rank (professions.js `skills[].rank`).

import { HUNTER_RANKS } from './professions'

function rankIndex(rank) {
  const i = HUNTER_RANKS.indexOf(rank)
  return i === -1 ? 0 : i
}

export function hasRank(hunterRank, requiredRank) {
  return rankIndex(hunterRank) >= rankIndex(requiredRank)
}

// --- Attack damage multiplier ---------------------------------------------
// Fighter (Power Strike/Berserk) and Assassin (Backstab crit) get an
// always-relevant multiplier on their own basic attack. Mage's Mana
// Bolt/Meteor are handled separately (Meteor is a distinct once-per-fight
// action button, not a passive multiplier - see getMeteorDamage below).
export function getAttackMultiplier(professionId, hunterRank, player, isFirstHitThisFight) {
  let multiplier = 1

  if (professionId === 'fighter') {
    const hpPct = player.hp / player.maxHp
    // Berserk (A) supersedes Power Strike (E) once both are active and the
    // player is actually low - no reason to stack two damage buffs.
    if (hasRank(hunterRank, 'A') && hpPct <= 0.3) multiplier = 1.8
    else if (hasRank(hunterRank, 'E')) multiplier = 1.2
  }

  if (professionId === 'assassin') {
    if (hasRank(hunterRank, 'E') && Math.random() < 0.2) multiplier *= 2 // Backstab crit
    // Shadow Step (C): "guaranteed first strike" reinterpreted as a bonus
    // on the fight's opening hit, since the player already always acts
    // first in this turn order - there's no real "first strike" race to win.
    if (hasRank(hunterRank, 'C') && isFirstHitThisFight) multiplier *= 1.5
  }

  return multiplier
}

// --- Incoming damage reduction ---------------------------------------------
export function getDamageReduction(professionId, hunterRank) {
  if (professionId === 'fighter' && hasRank(hunterRank, 'C')) return 0.15 // Iron Skin
  if (professionId === 'tank' && hasRank(hunterRank, 'E')) return 0.1 // Taunt (reinterpreted as innate sturdiness)
  return 0
}

// --- Healer passive heal-per-turn -------------------------------------------
// Applied once at the start of each of the player's attack actions.
export function getPreTurnHealPct(professionId, hunterRank) {
  if (professionId !== 'healer') return 0
  if (hasRank(hunterRank, 'C')) return 0.2 // Regeneration supersedes Minor Heal
  if (hasRank(hunterRank, 'E')) return 0.15 // Minor Heal
  return 0
}

// --- Assassin Execute (A) ---------------------------------------------------
export function checkExecute(professionId, hunterRank, monsterHp, monsterMaxHp) {
  if (professionId !== 'assassin' || !hasRank(hunterRank, 'A')) return false
  return monsterHp > 0 && monsterHp / monsterMaxHp <= 0.15
}

// --- Survive-a-lethal-hit skills (Tank Unbreakable / Healer Sanctuary) -----
// Both are once-per-rift-encounter; the caller tracks the "already used"
// flag locally (RiftCombatModal state) since it only needs to last one fight.
export function getLethalSaveEffect(professionId, hunterRank, alreadyUsed) {
  if (alreadyUsed) return null
  if (professionId === 'tank' && hasRank(hunterRank, 'A')) return { type: 'unbreakable', surviveHp: 1 }
  if (professionId === 'healer' && hasRank(hunterRank, 'A')) {
    return { type: 'sanctuary', healPct: 0.3 }
  }
  return null
}

// --- Mage Meteor (A) - a once-per-fight burst action, not a passive -------
// Real DDM-style AoE doesn't map onto this 1-monster combat shape, so it's
// reinterpreted as a big single-target nova the player can trigger manually.
export function canCastMeteor(professionId, hunterRank, alreadyCast) {
  return professionId === 'mage' && hasRank(hunterRank, 'A') && !alreadyCast
}

export function getMeteorDamage(player) {
  return Math.max(1, Math.round(player.stats.INT * 2.5))
}

// --- Shadow Monarch Arise (E) -----------------------------------------------
// True "resurrect a fallen monster as a summoned ally" doesn't fit this
// combat shape (the fight ends the moment a monster is defeated). Arise is
// reinterpreted as a passive: the spectral soldier still fights briefly
// after the kill, so victories grant bonus rewards.
export function getAriseRewardMultiplier(professionId) {
  return professionId === 'shadow_monarch' ? 1.5 : 1
}

// --- Tank Fortify (C) - permanent, applied once via the store -------------
export function shouldGrantFortify(professionId, hunterRank) {
  return professionId === 'tank' && hasRank(hunterRank, 'C')
}
