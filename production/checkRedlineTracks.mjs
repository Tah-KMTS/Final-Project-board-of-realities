// Validates Redline Rally's circuit geometry against the balance numbers the
// cars actually drive with.
//
// The tracks are Catmull-Rom loops through hand-placed control points, and
// hazards/pickups/decor are authored as { at, lat } offsets from the
// centreline. Both of those are easy to author and easy to get subtly wrong in
// ways that are invisible until you drive them:
//
//   * a control point nudged too far turns a corner into something no car can
//     hold at any speed
//   * a loop that passes back too close to itself makes the nearest-point
//     lookup ambiguous, and a car can have its lap progress teleport
//   * a decor tree authored at lat 90 on the narrow track is standing IN the
//     road, invisible to the collision system but drawn across the racing line
//
// Run: node production/checkRedlineTracks.mjs
import { buildCenterline, resolvePlacements } from '../src/features/arcade/redlineRallyEngine.js'
import { TRACKS, BALANCE as B } from '../src/features/arcade/redlineRallyTracks.js'

let failures = 0
const check = (ok, msg) => {
  console.log(`    ${ok ? 'ok  ' : 'FAIL'}  ${msg}`)
  if (!ok) failures += 1
}

// Speed a car can hold through curvature k, from the same relation the AI
// uses to pick its corner speed.
const speedAt = (k) => Math.sqrt(B.CORNER_GRIP / Math.max(k, 1e-6))

for (const track of TRACKS) {
  console.log(`\n  ${track.name}  (${track.surface}, half-width ${track.halfWidth})`)
  const cl = buildCenterline(track.points)

  // --- size and pacing -----------------------------------------------------
  // Average speed is estimated per sample from local curvature, capped at top
  // speed - a far better lap-time estimate than assuming flat out everywhere,
  // which would badly under-predict the twisty track.
  let timeFrames = 0
  for (let i = 0; i < cl.count; i++) {
    timeFrames += cl.ds / Math.min(B.TOP_SPEED, speedAt(cl.curv[i]))
  }
  const lapSec = timeFrames / 60
  const raceSec = lapSec * track.laps
  console.log(`      length ${Math.round(cl.total)}px, est lap ${lapSec.toFixed(1)}s,`
    + ` race ${raceSec.toFixed(0)}s over ${track.laps} laps`)
  check(lapSec > 12 && lapSec < 60, `lap time ${lapSec.toFixed(1)}s is in the 12-60s arcade band`)
  check(raceSec < 210, `whole race ${raceSec.toFixed(0)}s stays under 3.5 min`)

  // --- corners are driveable ----------------------------------------------
  let worstK = 0
  let worstI = 0
  for (let i = 0; i < cl.count; i++) if (cl.curv[i] > worstK) { worstK = cl.curv[i]; worstI = i }
  const slowest = speedAt(worstK)
  check(
    slowest > B.TOP_SPEED * 0.33,
    `tightest corner takes ${slowest.toFixed(2)}px/f `
    + `(${((slowest / B.TOP_SPEED) * 100).toFixed(0)}% of top) - not a dead stop`
  )
  // A corner whose radius is near the road width is a hairpin the car
  // physically cannot fit round - the inner edge of the road folds through
  // itself. The failure names the nearest control point, because that is what
  // has to move to fix it.
  const minRadius = 1 / Math.max(worstK, 1e-6)
  const wx = cl.xs[worstI], wy = cl.ys[worstI]
  let nearestCp = 0, nearestD = Infinity
  track.points.forEach((p, i) => {
    const d = Math.hypot(p.x - wx, p.y - wy)
    if (d < nearestD) { nearestD = d; nearestCp = i }
  })
  check(minRadius > track.halfWidth * 1.6,
    `tightest radius ${Math.round(minRadius)}px clears half-width ${track.halfWidth}`
    + ` (need > ${Math.round(track.halfWidth * 1.6)}; at ${Math.round(wx)},${Math.round(wy)}`
    + ` near control point ${nearestCp})`)

  // --- the loop never crowds itself ---------------------------------------
  // Compare every sample against every other sample that is far away ALONG
  // the track but might be close in space. Anything closer than two road
  // widths means the two stretches of tarmac overlap.
  const need = track.halfWidth * 2
  let worstGap = Infinity
  let worstAt = null
  for (let i = 0; i < cl.count; i += 2) {
    for (let j = i + 1; j < cl.count; j += 2) {
      // arc distance around the loop, both ways
      const arc = Math.min(Math.abs(i - j), cl.count - Math.abs(i - j)) * cl.ds
      if (arc < track.halfWidth * 6) continue // adjacent track, legitimately close
      const d = Math.hypot(cl.xs[i] - cl.xs[j], cl.ys[i] - cl.ys[j])
      if (d < worstGap) { worstGap = d; worstAt = [i, j] }
    }
  }
  check(worstGap > need,
    `closest non-adjacent stretches are ${Math.round(worstGap)}px apart `
    + `(need > ${Math.round(need)})${worstGap > need ? '' : ` at samples ${worstAt}`}`)

  // --- placements ----------------------------------------------------------
  const onRoadMargin = track.halfWidth - 12 // keep clear of the kerb
  for (const [label, list] of [['hazard', track.hazards], ['pickup', track.pickups]]) {
    const off = list.filter((p) => Math.abs(p.lat ?? 0) > onRoadMargin)
    check(off.length === 0,
      `every ${label} sits on the road (|lat| <= ${onRoadMargin})`
      + (off.length ? ` - ${off.length} off: ${off.map((p) => p.at).join(', ')}` : ''))
  }
  const decorTooClose = track.decor.filter(
    (d) => Math.abs(d.lat ?? 0) < track.halfWidth + 40
  )
  check(decorTooClose.length === 0,
    `all decor clears the road by 40px`
    + (decorTooClose.length ? ` - ${decorTooClose.length} too close` : ''))

  // Two hazards on top of each other is an unavoidable double hit.
  const hz = resolvePlacements(cl, track.hazards)
  let minHazGap = Infinity
  for (let i = 0; i < hz.length; i++) {
    for (let j = i + 1; j < hz.length; j++) {
      minHazGap = Math.min(minHazGap, Math.hypot(hz[i].x - hz[j].x, hz[i].y - hz[j].y))
    }
  }
  check(minHazGap > 90, `closest two hazards are ${Math.round(minHazGap)}px apart (need > 90)`)

  // --- the start grid fits -------------------------------------------------
  const rows = 1 + B.AI_TIERS.length
  const gridBack = (rows - 1) * B.GRID_STAGGER
  check(gridBack < cl.total * 0.1,
    `start grid (${gridBack}px deep) fits without wrapping the lap`)
  check(B.GRID_OFFSET + B.CAR_RADIUS < track.halfWidth,
    `grid cars (offset ${B.GRID_OFFSET} + radius ${B.CAR_RADIUS}) start on the road`)
}

console.log(failures ? `\n${failures} check(s) FAILED\n` : '\nall track checks passed\n')
process.exit(failures ? 1 : 0)
