export function calculateAtonementCost(wantedLevel, notoriety, cash) {
  // Base cost is $1,000, scales with notoriety and wanted level
  const base = 1000
  const wantedMultiplier = Math.max(1, wantedLevel * 1.5)
  const notorietyMultiplier = 1 + (notoriety / 100)

  const cost = Math.floor(base * wantedMultiplier * notorietyMultiplier)
  // Cap at 25% of player cash if it's too high, or at least base
  const cap = Math.max(base, Math.floor(cash * 0.25))

  return Math.min(cost, cap)
}

// Energy blessing's cost is priced as a PERCENTAGE of current cash, not a
// flat number, and deliberately in the opposite direction from
// calculateAtonementCost's cap above (that one caps DOWN so a poor player
// can always afford it; this one scales UP so a rich player never can't
// feel it). A flat price - the Food Court snack's approach, see
// interactiveLocations.js - is right for a small top-up, but this is the
// "real" energy lever, meant to matter at every wealth level: cheap in
// absolute terms early ($1,000 cash -> $150, the floor), and a genuinely
// felt cost once rich ($500,000 cash -> $50,000), never trivial "pocket
// change" the way a flat price would eventually become.
export function calculateEnergyBlessingCost(cash) {
  return Math.max(150, Math.round(cash * 0.1))
}

// Healing Blessing's HP counterpart to the Energy Blessing above - same
// wealth-scaled shape (a felt percentage of current cash, never pocket
// change once rich, never out of reach when poor), since the Chapel treats
// HP and Energy as siblings: two resources it fully restores for a price
// that stays meaningful at every net worth, versus the Food Court/Underworld
// Hotel's flat-price small top-ups (interactiveLocations.js).
export function calculateHealingBlessingCost(cash) {
  return Math.max(150, Math.round(cash * 0.1))
}
