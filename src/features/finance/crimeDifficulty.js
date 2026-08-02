import { useGameStore } from '../../store/useGameStore'

export function clamp(min, max, v) {
  return Math.max(min, Math.min(max, v))
}

// Locked-at-start difficulty derivation shared by every skill-checked
// Underworld minigame (LeverageMeter and its 4 racket-specific siblings -
// LookoutWatchModal/FencesTableModal/CallCenterQTEModal/TheCircuitModal).
// Originally lived only in LeverageMeter.jsx; pulled out here so the 4 new
// minigames read the exact same formula instead of drifting into 4 subtly
// different copies. Same reads (stats.streetwise, notoriety,
// getEffectiveLuck()) and 0.05-0.95 clamp executeCrime's old flat
// coin-flip used - a build that would've had a high success chance gets an
// easier version of whatever this feeds into, never a guaranteed win; a bad
// build gets harder, never impossible. Callers compute this once, at the
// moment the player commits (spends energy), and never recompute mid-play.
export function computeFavorability(baseSuccessChance) {
  const state = useGameStore.getState()
  const streetwise = state.player.stats.streetwise ?? 5
  const effectiveLuck = state.getEffectiveLuck()
  return clamp(
    0.05,
    0.95,
    baseSuccessChance + streetwise * 0.02 - state.notoriety * 0.002 + (effectiveLuck - 5) * 0.01
  )
}
