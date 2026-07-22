// Duel AI per the GDD's Module 7: threat/lethal evaluation, archetype
// behavior flags, and target-priority filtering. Pragmatic implementation
// (not a full minimax/search) - good enough to make duels feel directed
// rather than random, consistent with the AI depth already built for DDM.

import { getCard } from './cardDatabase'

export function assessThreat(aiState, playerState) {
  const playerAtk = playerState.monsterZone.reduce((sum, slot) => {
    if (!slot || slot.position !== 'attack') return sum
    return sum + (getCard(slot.cardId)?.Base_ATK || 0)
  }, 0)
  return playerAtk > aiState.lp
}

export function checkLethal(aiState, playerState) {
  const aiAtk = aiState.monsterZone.reduce((sum, slot) => {
    if (!slot) return sum
    return sum + (getCard(slot.cardId)?.Base_ATK || 0)
  }, 0)
  return aiAtk >= playerState.lp
}

// Decide how a just-summoned monster should be placed, given the
// archetype's behavior flag and current board threat level.
export function decideSummonPosition(behavior, underThreat) {
  if (behavior === 'Aggressive_Aggro') return 'attack'
  if (behavior === 'Unpredictable_Luck') return Math.random() < 0.5 ? 'attack' : 'defense'
  // Balanced_Tactical
  return underThreat ? 'defense' : 'attack'
}

// Pick the best monster card in hand to summon: highest ATK for aggro,
// highest DEF-leaning pick when threatened for tactical/luck decks.
export function pickMonsterToSummon(hand, behavior, underThreat) {
  const monsterIds = hand.filter((id) => getCard(id)?.Primary_Type === 'Monster')
  if (monsterIds.length === 0) return null
  const cards = monsterIds.map((id) => ({ id, card: getCard(id) }))
  if (behavior === 'Aggressive_Aggro' || !underThreat) {
    cards.sort((a, b) => b.card.Base_ATK - a.card.Base_ATK)
  } else {
    cards.sort((a, b) => b.card.Base_DEF - a.card.Base_DEF)
  }
  return cards[0].id
}

// Targeting priority: 1) destroy a monster that threatens lethal next turn
// (highest ATK enemy attack-position monster the AI can beat), 2) target
// lowest DEF among defense-position monsters to punish through defense,
// 3) otherwise the highest-ATK legal target.
export function pickAttackTarget(attackerCard, defenderMonsterZone) {
  const targets = defenderMonsterZone
    .map((slot, idx) => (slot ? { idx, slot, card: getCard(slot.cardId) } : null))
    .filter(Boolean)
  if (targets.length === 0) return null

  const winnableAttackTargets = targets.filter((t) => t.slot.position === 'attack' && attackerCard.Base_ATK > t.card.Base_ATK)
  if (winnableAttackTargets.length > 0) {
    winnableAttackTargets.sort((a, b) => b.card.Base_ATK - a.card.Base_ATK)
    return winnableAttackTargets[0].idx
  }

  const defenseTargets = targets.filter((t) => t.slot.position === 'defense')
  if (defenseTargets.length > 0) {
    defenseTargets.sort((a, b) => a.card.Base_DEF - b.card.Base_DEF)
    return defenseTargets[0].idx
  }

  targets.sort((a, b) => b.card.Base_ATK - a.card.Base_ATK)
  return targets[0].idx
}
