// Core Yu-Gi-Oh-style duel engine for Domino City: a real phase state
// machine (Draw -> Standby -> Main1 -> Battle -> Main2 -> End) over
// Deck/Hand/Monster Zone(5)/Spell-Trap Zone(5)/Graveyard/Field Spell zones,
// per the GDD's Module 6. Pure state-transition helpers here; DominoDuelModal.jsx
// owns the React state and calls these. Effect resolution lives in
// duelEffects.js so this file stays about turn structure, not card text.

import { getCard } from './cardDatabase'

export const PHASES = ['draw', 'standby', 'main1', 'battle', 'main2', 'end']
export const STARTING_LP = 8000
export const HAND_LIMIT = 6
export const ZONE_SIZE = 5

export function shuffle(list) {
  const arr = [...list]
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

export function createDuelPlayerState(deckCardIds) {
  return {
    deck: shuffle(deckCardIds),
    hand: [],
    monsterZone: Array(ZONE_SIZE).fill(null), // { cardId, position: 'attack'|'defense', faceDown }
    spellTrapZone: Array(ZONE_SIZE).fill(null), // { cardId, faceDown }
    graveyard: [],
    lp: STARTING_LP,
    normalSummonUsed: false,
  }
}

// Returns { hand, deck, deckOut } - deckOut true means this player just lost
// (had to draw from an empty deck).
export function drawCards(state, count) {
  let { deck, hand } = state
  let deckOut = false
  for (let i = 0; i < count; i++) {
    if (deck.length === 0) {
      deckOut = true
      break
    }
    hand = [...hand, deck[0]]
    deck = deck.slice(1)
  }
  return { hand, deck, deckOut }
}

export function findEmptyZoneSlot(zone) {
  return zone.findIndex((slot) => slot === null)
}

// Attacker's monster-zone entry vs a defender monster-zone entry (or null
// for a direct attack). Returns { attackerDestroyed, defenderDestroyed,
// lpDamageToDefender, lpDamageToAttacker }.
export function resolveBattle(attackerEntry, attackerCard, defenderEntry, defenderCard) {
  if (!defenderEntry) {
    return { attackerDestroyed: false, defenderDestroyed: false, lpDamageToDefender: attackerCard.Base_ATK, lpDamageToAttacker: 0 }
  }
  const atk = attackerCard.Base_ATK
  if (defenderEntry.position === 'attack') {
    const def = defenderCard.Base_ATK
    if (atk > def) return { attackerDestroyed: false, defenderDestroyed: true, lpDamageToDefender: atk - def, lpDamageToAttacker: 0 }
    if (atk < def) return { attackerDestroyed: true, defenderDestroyed: false, lpDamageToDefender: 0, lpDamageToAttacker: def - atk }
    return { attackerDestroyed: true, defenderDestroyed: true, lpDamageToDefender: 0, lpDamageToAttacker: 0 }
  }
  // Defense position: DEF is compared, no LP damage either way unless attacker wins.
  const def = defenderCard.Base_DEF
  if (atk > def) return { attackerDestroyed: false, defenderDestroyed: true, lpDamageToDefender: 0, lpDamageToAttacker: 0 }
  if (atk < def) return { attackerDestroyed: false, defenderDestroyed: false, lpDamageToDefender: 0, lpDamageToAttacker: def - atk }
  return { attackerDestroyed: false, defenderDestroyed: false, lpDamageToDefender: 0, lpDamageToAttacker: 0 }
}

// End Phase hand-limit check: returns the indices to discard (player picks
// which if over the limit - AI just discards from the end).
export function excessHandCount(hand) {
  return Math.max(0, hand.length - HAND_LIMIT)
}

export function totalMonsterAtk(state) {
  return state.monsterZone.reduce((sum, slot) => {
    if (!slot || slot.position !== 'attack') return sum
    const card = getCard(slot.cardId)
    return sum + (card?.Base_ATK || 0)
  }, 0)
}

export function nextPhase(phase) {
  const idx = PHASES.indexOf(phase)
  return PHASES[(idx + 1) % PHASES.length]
}
