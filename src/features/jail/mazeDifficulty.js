// Single tuning knob shared by all four jailMaze checkpoint minigames (see
// JailMazeMinigame.jsx and its four segment components). `d` is the 0..1
// number returned by useGameStore.js's getMazeSegmentDifficulty - the exact
// same evadeChance the old coin-flip used, just inverted. Retuning any
// segment's difficulty curve only ever means editing a case here; nothing
// downstream should hardcode its own scaling off `d`.
//
// IMPORTANT: `d` only ever reaches this function and the params it returns.
// It is never compared against Math.random() anywhere - the minigame
// components decide pass/fail from the player's actual input (timing,
// keypresses, hold/release), and that boolean is what gets handed to
// attemptMazeSegment(segmentIndex, playerSucceeded). If you're reading this
// because someone wants to "simplify" a segment back to a dice roll: don't -
// that's the exact bug this file replaced.
const clamp = (min, max, value) => Math.max(min, Math.min(max, value))

export function difficultyToParams(segmentIndex, d) {
  switch (segmentIndex) {
    // Segment 0 - Cell Block Corridor: one-shot timed press into a sweeping
    // blind spot. Higher difficulty = narrower zone, faster sweep.
    case 0:
      return {
        zoneWidth: clamp(0.12, 0.3, 0.3 - d * 0.2),
        sweepPeriodMs: clamp(800, 1400, 1400 - d * 700),
      }
    // Segment 1 - Exercise Yard: arrow-key sequence. Higher difficulty =
    // longer sequence, tighter per-press window.
    case 1:
      return {
        length: Math.round(3 + d * 3), // 3-6 presses
        perPressWindowMs: Math.round(1100 - d * 500),
      }
    // Segment 2 - Fence Line: hold-and-release power meter. Higher
    // difficulty = narrower target band.
    case 2:
      return {
        zoneWidth: clamp(0.1, 0.28, 0.28 - d * 0.16),
      }
    // Segment 3 - Final Stretch: alternating-key mash. Higher difficulty =
    // more alternations required, less time to do it in.
    case 3:
      return {
        targetAlternations: Math.round(8 + d * 10), // 8-18
        timeBudgetMs: Math.round(6000 - d * 1500),
      }
    default:
      return {}
  }
}
