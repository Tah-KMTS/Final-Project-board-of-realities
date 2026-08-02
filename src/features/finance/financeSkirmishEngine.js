// Pure combat-logic module for FinanceSkirmishModal.jsx (the 4-choice
// Attack/Heavy/Guard/Dodge skirmish engine). Split out of the component
// file specifically so no non-component value is ever exported alongside
// the default component export - mixing the two in one file breaks Vite's
// React Fast Refresh ("only-export-components" / "export is incompatible"
// invalidation), forcing a full module-graph reload on every edit instead
// of a live-patch. Nothing in here touches React.

export const MOVE_LABELS = {
  attack: 'Attack',
  heavy: 'Heavy Strike',
  guard: 'Guard',
  dodge: 'Dodge',
}

// Read-probability table for the police AI, keyed by Wanted Level (1-5).
// Underworld street fights reuse the exact same AI function with
// readProbability=0 (see the spec: "this is just the police AI's read
// probability at a fixed 0%") rather than a separate code path.
const POLICE_READ_PROBABILITY = { 1: 0.2, 2: 0.35, 3: 0.5, 4: 0.65, 5: 0.8 }

export function getPoliceReadProbability(wantedLevel) {
  return POLICE_READ_PROBABILITY[wantedLevel] ?? (wantedLevel >= 5 ? 0.8 : 0)
}

// Pure damage-matrix resolver. Returns raw (pre-Counter-Boost) damage dealt
// to each side plus whether either side newly arms a Counter Boost this
// turn. dmg1 = raw damage side1 receives (i.e. dealt BY side2), dmg2 = raw
// damage side2 receives (dealt BY side1) - matches the exact table in the
// spec, one branch per matchup.
export function resolveMatchup(move1, move2) {
  if (move1 === move2) {
    if (move1 === 'heavy') return { dmg1: 20, dmg2: 20, arm1: false, arm2: false, knockdown: true }
    return { dmg1: 0, dmg2: 0, arm1: false, arm2: false }
  }
  if (move1 === 'attack' && move2 === 'heavy') return { dmg1: 0, dmg2: 15, arm1: false, arm2: false }
  if (move1 === 'heavy' && move2 === 'attack') return { dmg1: 15, dmg2: 0, arm1: false, arm2: false }
  if (move1 === 'heavy' && move2 === 'guard') return { dmg1: 0, dmg2: 25, arm1: false, arm2: false }
  if (move1 === 'guard' && move2 === 'heavy') return { dmg1: 25, dmg2: 0, arm1: false, arm2: false }
  // Guard Counter: a Guard that beats an Attack isn't just a free block any
  // more - it reflects 5 chip damage onto the attacker and staggers them
  // (stun1/stun2, consumed by the caller the same way Exhaustion Stagger's
  // stun is - see computeAttackStreakPenalty below) so a blocked attacker
  // can't just throw the same Attack again next turn for free.
  if (move1 === 'guard' && move2 === 'attack') return { dmg1: 0, dmg2: 5, arm1: false, arm2: false, stun2: true }
  if (move1 === 'attack' && move2 === 'guard') return { dmg1: 5, dmg2: 0, arm1: false, arm2: false, stun1: true }
  if (move1 === 'dodge' && move2 === 'attack') return { dmg1: 0, dmg2: 0, arm1: true, arm2: false }
  if (move1 === 'attack' && move2 === 'dodge') return { dmg1: 0, dmg2: 0, arm1: false, arm2: true }
  if (move1 === 'dodge' && move2 === 'heavy') return { dmg1: 0, dmg2: 0, arm1: true, arm2: false }
  if (move1 === 'heavy' && move2 === 'dodge') return { dmg1: 0, dmg2: 0, arm1: false, arm2: true }
  // Guard vs Dodge (either order): Guard wins, baits the dodge. Any Counter
  // Boost the Dodge side was carrying is wasted here too - handled by the
  // caller simply not re-arming it (arm=false) and the "consume every turn
  // regardless of landing" rule already covers the fizzle.
  return { dmg1: 0, dmg2: 0, arm1: false, arm2: false }
}

// Stamina/whiff-fatigue cost for a single side's chosen move this turn.
// Heavy/Dodge always cost 1 (that's the price of selecting them, gated by
// affordability before selection). Guard is always free. Attack is free
// when it wins or clashes, costs 1 when it loses (vs Guard/Dodge) - unless
// the attacker is already at 0 stamina, in which case they take 5 HP chip
// damage ("Overextended, exposed") instead of a stamina cost they can't pay.
export function payMoveCost(move, opponentMove, staminaBefore) {
  if (move === 'heavy' || move === 'dodge') {
    return { staminaAfterCost: staminaBefore - 1, chipDamage: 0, whiffed: false }
  }
  if (move === 'attack') {
    const lost = opponentMove === 'guard' || opponentMove === 'dodge'
    if (!lost) return { staminaAfterCost: staminaBefore, chipDamage: 0, whiffed: false }
    if (staminaBefore <= 0) return { staminaAfterCost: 0, chipDamage: 5, whiffed: true }
    return { staminaAfterCost: staminaBefore - 1, chipDamage: 0, whiffed: false }
  }
  // guard
  return { staminaAfterCost: staminaBefore, chipDamage: 0, whiffed: false }
}

// AI counter table: what the AI plays when it successfully "reads" the
// player's previous turn's move (see spec table). Falls back to whatever
// stamina-safe response is specified when the ideal counter isn't
// affordable.
export function counterFor(playerLastMove, aiStamina) {
  switch (playerLastMove) {
    case 'attack':
      return aiStamina >= 1 ? 'dodge' : 'guard'
    case 'heavy':
      return 'attack'
    case 'guard':
      return aiStamina >= 1 ? 'heavy' : 'attack'
    case 'dodge':
      return 'guard'
    default:
      return null
  }
}

// Anti-spam: repeating Attack costs escalating extra Stamina on top of
// whatever payMoveCost already charges for losing, and from the 3rd
// consecutive use onward staggers the spammer - the same "stunned entering
// next turn, damage dealt zeroed once" flag Guard Counter's stun1/stun2
// sets, so the caller only needs one stun-handling code path. Streak is
// purely about repeated MOVE CHOICE, independent of whether Attack won or
// lost that turn; playing anything else resets it to 0.
const STREAK_STAMINA_THRESHOLD = 2
const STAGGER_THRESHOLD = 3

export function computeAttackStreakPenalty(move, streakBefore) {
  if (move !== 'attack') return { newStreak: 0, extraStaminaCost: 0, staggered: false }
  const newStreak = streakBefore + 1
  return {
    newStreak,
    extraStaminaCost: newStreak >= STREAK_STAMINA_THRESHOLD ? 1 : 0,
    staggered: newStreak >= STAGGER_THRESHOLD,
  }
}

export function pickAiMove({ turnNumber, lastPlayerMove, aiStamina, readProbability }) {
  const affordable = ['attack', 'guard', ...(aiStamina >= 1 ? ['heavy', 'dodge'] : [])]
  if (turnNumber > 1 && lastPlayerMove && Math.random() < readProbability) {
    const countered = counterFor(lastPlayerMove, aiStamina)
    if (countered) return { move: countered, wasRead: true }
  }
  return { move: affordable[Math.floor(Math.random() * affordable.length)], wasRead: false }
}
