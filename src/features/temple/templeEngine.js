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
