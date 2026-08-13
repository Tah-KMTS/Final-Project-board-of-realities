// Static sanity check on the Third Rail cabinet's level geometry
// (src/features/arcade/runAndGunLevels.js), in the same spirit as
// checkMapLayout.mjs and checkPrisonRooms.mjs: the levels are a wall of
// hand-typed tile coordinates, and the failure mode for a wrong number is an
// enemy hovering in mid-air or a pit that literally cannot be jumped - both
// of which are tedious to find by playing and trivial to find by arithmetic.
//
// It imports the real level data rather than re-describing it, so it cannot
// drift from what the game actually loads.
//
// Run: node production/checkRunNGunLevels.mjs
import { LEVELS, BALANCE as B, TILE, VIEW_W, WALL_PROPS } from '../src/features/arcade/runAndGunLevels.js'

let failures = 0
let warnings = 0
const fail = (msg) => { console.error(`  FAIL  ${msg}`); failures += 1 }
const warn = (msg) => { console.warn(`  warn  ${msg}`); warnings += 1 }

// A jump lasts 2*|JUMP_V|/GRAVITY frames (up then back down to the same
// height) and covers RUN_SPEED px/frame horizontally the whole time.
const AIRTIME = (2 * Math.abs(B.JUMP_V)) / B.GRAVITY
const JUMP_RANGE = AIRTIME * B.RUN_SPEED
// Peak height, for checking that raised platforms are actually reachable.
const JUMP_HEIGHT = (B.JUMP_V * B.JUMP_V) / (2 * B.GRAVITY)

console.log(`Jump: ${AIRTIME.toFixed(0)} frames airtime, ${JUMP_RANGE.toFixed(0)}px range, ${JUMP_HEIGHT.toFixed(0)}px peak (${(JUMP_HEIGHT / TILE).toFixed(1)} tiles)\n`)

for (const lv of LEVELS) {
  console.log(`${lv.id} - ${lv.name}`)
  const solids = lv.solids.map((s) => ({ ...s, x0: s.c, x1: s.c + s.w - 1, top: s.r }))

  // 1. Every ground-standing entity must actually have a solid under it.
  // Spawn puts an entity's feet at (r + 1) * TILE, so the solid it stands on
  // must have its top edge at exactly row r + 1.
  const standing = [
    ...lv.enemies.map((e) => ({ what: `enemy ${e.type}`, c: e.c, r: e.r })),
    ...(lv.boss ? [{ what: 'BOSS', c: lv.boss.c, r: lv.boss.r }] : []),
  ]
  for (const en of standing) {
    const under = solids.find((s) => s.top === en.r + 1 && en.c >= s.x0 && en.c <= s.x1)
    if (!under) fail(`${en.what} at col ${en.c} row ${en.r} has no floor at row ${en.r + 1} - it would spawn in mid-air`)
  }

  // 2. Pits between consecutive ground runs must be jumpable. Only the
  // lowest row of solids counts as "ground" - floating platforms are meant
  // to have space under them.
  const groundRow = Math.max(...solids.map((s) => s.top))
  const ground = solids.filter((s) => s.top === groundRow).sort((a, b) => a.x0 - b.x0)
  for (let i = 0; i < ground.length - 1; i += 1) {
    const gapTiles = ground[i + 1].x0 - ground[i].x1 - 1
    if (gapTiles <= 0) continue
    const gapPx = gapTiles * TILE
    if (gapPx >= JUMP_RANGE) {
      fail(`pit at cols ${ground[i].x1 + 1}-${ground[i + 1].x0 - 1} is ${gapPx}px, jump range is only ${JUMP_RANGE.toFixed(0)}px`)
    } else if (gapPx > JUMP_RANGE * 0.8) {
      warn(`pit at cols ${ground[i].x1 + 1}-${ground[i + 1].x0 - 1} is ${gapPx}px, ${((gapPx / JUMP_RANGE) * 100).toFixed(0)}% of max jump - very tight`)
    }
  }

  // 3. Raised platforms must be reachable from something below them.
  for (const s of solids) {
    if (s.top === groundRow) continue
    const below = solids
      .filter((o) => o.top > s.top && o.x1 >= s.x0 - 6 && o.x0 <= s.x1 + 6)
      .sort((a, b) => a.top - b.top)[0]
    if (!below) { fail(`platform at col ${s.c} row ${s.r} has nothing beneath it to jump from`); continue }
    const rise = (below.top - s.top) * TILE
    if (rise > JUMP_HEIGHT) {
      fail(`platform at col ${s.c} row ${s.r} is ${rise}px above the surface below it, jump peak is ${JUMP_HEIGHT.toFixed(0)}px`)
    }
  }

  // 3b. Physical props must rest on a solid. They're anchored by their bottom
  // edge at (r + 1) * TILE, so that has to line up with the top of a solid
  // spanning their column - otherwise crates and street lamps hover in the
  // air, or stand over a pit. Wall-mounted props are exempt by definition.
  for (const pr of lv.props) {
    if (WALL_PROPS.has(pr.key)) continue
    const bottom = (pr.r + 1) * TILE
    const rest = solids.find((s) => pr.c >= s.x0 && pr.c <= s.x1 && s.top * TILE === bottom)
    if (!rest) {
      const over = solids.find((s) => pr.c >= s.x0 && pr.c <= s.x1)
      fail(over
        ? `prop ${pr.key} at col ${pr.c} row ${pr.r} floats ${over.top * TILE - bottom}px above the surface below it`
        : `prop ${pr.key} at col ${pr.c} row ${pr.r} stands over a pit - nothing beneath it`)
    }
  }

  // 4. Solids must stay inside the level box.
  for (const s of solids) {
    if (s.c < 0 || s.x1 >= lv.widthTiles) fail(`solid at col ${s.c} w${s.w} runs past the level width (${lv.widthTiles})`)
    if (s.r + s.h > lv.heightTiles) fail(`solid at col ${s.c} row ${s.r} h${s.h} runs past the level height (${lv.heightTiles})`)
  }

  // 5. The level must be wider than the viewport, or the camera clamp makes
  // the whole "scrolling shooter" premise moot.
  if (lv.widthTiles * TILE <= VIEW_W) fail(`level is ${lv.widthTiles * TILE}px wide, narrower than the ${VIEW_W}px viewport`)

  // 6. A non-boss level ends by walking off the right edge, so its last
  // ground run has to actually reach that edge.
  if (!lv.boss) {
    const last = ground[ground.length - 1]
    if (last.x1 < lv.widthTiles - 2) fail(`level ends at col ${lv.widthTiles - 1} but the last floor stops at col ${last.x1} - the exit is over a pit`)
  }

  const counts = lv.enemies.reduce((m, e) => ({ ...m, [e.type]: (m[e.type] || 0) + 1 }), {})
  console.log(`  ${lv.solids.length} solids, ${lv.props.length} props, enemies: ${JSON.stringify(counts)}${lv.boss ? ' + boss' : ''}`)
  console.log(`  width ${lv.widthTiles} tiles (${((lv.widthTiles * TILE) / VIEW_W).toFixed(1)} screens)\n`)
}

// Boss fight length, the number most likely to be wrong by an order of
// magnitude (see BOSS_HP's own comment for the derivation).
const dpsCeiling = (B.BULLET_DMG / B.FIRE_COOLDOWN) * 60
const effective = dpsCeiling * 0.45
console.log(`Boss: ${B.BOSS_HP}hp vs ~${effective.toFixed(1)} effective dmg/sec -> ~${(B.BOSS_HP / effective).toFixed(0)}s fight`)
if (B.BOSS_HP / effective < 20) warn('boss dies in under 20s - that is a big trooper, not a boss')
if (B.BOSS_HP / effective > 120) warn('boss fight over 2 minutes - likely a bullet sponge')

console.log(failures === 0 ? `\nOK - no geometry errors (${warnings} warning(s))` : `\n${failures} error(s), ${warnings} warning(s)`)
process.exit(failures === 0 ? 0 : 1)
