/**
 * Water Body Swimming Engine & Stat-Based Fatigue / Drowning Mechanics.
 */

export function calculateSwimmingTick(currentFatigue, playerEndurance = 1, inDeepWater = true) {
  // Endurance reduces fatigue drain rate (up to 60% reduction)
  const enduranceFactor = Math.max(0.4, 1 - (playerEndurance - 1) * 0.05)
  const fatigueIncrease = inDeepWater ? 8 * enduranceFactor : 4 * enduranceFactor

  const nextFatigue = Math.min(100, currentFatigue + fatigueIncrease)
  const isHypothermic = nextFatigue >= 80
  const isDrowning = nextFatigue >= 100

  let healthDamage = 0
  let statusMessage = '🏊 Swimming smoothly across water body.'

  if (isDrowning) {
    healthDamage = 15
    statusMessage = '🚨 DROWNING WARNING: Fatigue at 100%! Suffering severe water asphyxiation (-15 HP/sec)!'
  } else if (isHypothermic) {
    healthDamage = 5
    statusMessage = '🥶 HYPOTHERMIA ALERT: Cold water fatigue high (80%+)! Swim to shore quickly (-5 HP/sec)!'
  }

  return {
    nextFatigue,
    isHypothermic,
    isDrowning,
    healthDamage,
    statusMessage,
  }
}
