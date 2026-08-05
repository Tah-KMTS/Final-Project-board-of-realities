// Pure combat-logic module for PoliceFightModal.jsx (the Punch/Kick/Use
// Weapon/Special Move submenu reached from PoliceStopModal's Fight choice).
// Split out of the component file for the same Fast-Refresh reason
// financeSkirmishEngine.js documents: no non-component export may share a
// file with a component export.
//
// Deliberately NOT financeSkirmishEngine's stamina/counter/matchup system -
// that engine is shared by the general street-fight/bodyguard skirmishes
// (see FinanceSkirmishModal.jsx's own header comment) and stays untouched.
// This is a simpler, always-hits model built specifically around the four
// named moves requested for a police confrontation: Punch and Kick are
// flat damage-range rolls, Use Weapon rolls the player's actual equipped
// weapon damage (see toolsWeaponsCatalog.js's getCombatWeapon), and Special
// Move is a two-turn commitment - one turn spent winding up (no damage,
// and the officer still gets a free hit in, so charging is a real risk),
// the next turn auto-unleashing for meaningfully more damage than Kick.
// The officer has no move choice of its own - it just swings every turn -
// this is a deliberately simpler AI than financeSkirmishEngine's read-
// probability system, matching how much less depth the request asked for
// on the enemy side specifically (the ask was about reworking the
// PLAYER's options, not making the officer smarter).

export const PUNCH_DAMAGE_RANGE = [10, 16]
export const KICK_DAMAGE_RANGE = [16, 24]
export const UNLEASH_DAMAGE_RANGE = [30, 42]
// Officer's per-turn damage varies +/-20% around generateSwatSquad's
// `attack` stat, so two turns against the same squad don't deal identical
// damage back to back.
const OFFICER_DAMAGE_VARIANCE = 0.2

function rollInRange([lo, hi]) {
  return Math.round(lo + Math.random() * (hi - lo))
}

export function rollPunchDamage() {
  return rollInRange(PUNCH_DAMAGE_RANGE)
}

export function rollKickDamage() {
  return rollInRange(KICK_DAMAGE_RANGE)
}

export function rollUnleashDamage() {
  return rollInRange(UNLEASH_DAMAGE_RANGE)
}

export function rollOfficerDamage(officerAttack) {
  const factor = 1 - OFFICER_DAMAGE_VARIANCE + Math.random() * (OFFICER_DAMAGE_VARIANCE * 2)
  return Math.max(1, Math.round(officerAttack * factor))
}
