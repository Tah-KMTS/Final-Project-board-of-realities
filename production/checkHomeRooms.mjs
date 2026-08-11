// Walkability check for the 87 character homes' bespoke interior rooms.
//
// Same reason checkPrisonRooms.mjs exists: these rooms are hand-authored
// masks with furniture placed at measured, often FRACTIONAL coordinates, and
// the failure that matters isn't visual - it's a room the player drops into
// and cannot move in, or one whose desk/exit they cannot reach.
//
// Parses HOME_ROOM_STYLES out of OverworldScene.js so it cannot drift from
// what the game actually builds, mirrors homeDoorTile/homeTileIsWall/
// blockHomePropFootprint exactly, floods from the tile the player is dropped
// on, and asserts the desk and the exit are reachable.
//
// Run: node production/checkHomeRooms.mjs
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const src = fs.readFileSync(path.join(ROOT, 'src/game/scenes/OverworldScene.js'), 'utf8')

function sliceObject(name) {
  const start = src.indexOf(`const ${name} = {`) + `const ${name} = `.length
  let depth = 0
  for (let i = start; i < src.length; i += 1) {
    if (src[i] === '{') depth += 1
    else if (src[i] === '}') {
      depth -= 1
      if (depth === 0) return src.slice(start, i + 1)
    }
  }
  throw new Error(`could not slice ${name}`)
}

// eslint-disable-next-line no-new-func
const STYLES = new Function(`return ${sliceObject('HOME_ROOM_STYLES')}`)()

const NON_BLOCKING = new Set(
  [...src.matchAll(/const HOME_PROP_NON_BLOCKING = new Set\(\[([^\]]*)\]/g)]
    .flatMap((m) => [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1]))
)

// --- mirrors of the scene's own geometry helpers ---
const maskAt = (def, c, r) => {
  if (c < 0 || r < 0 || c >= def.cols || r >= def.rows) return false
  if (!def.mask) return true
  return def.mask[r][c] === '#'
}
const rectHasTile = (rc, c, r) => c >= rc.c0 && c <= rc.c1 && r >= rc.r0 && r <= rc.r1
const isWall = (def, c, r) => {
  if (!maskAt(def, c, r)) return false
  if (r < (def.wallBandRows ?? 1)) return true
  if (def.partitions && def.partitions.some((p) => rectHasTile(p, c, r))) return true
  return (
    !maskAt(def, c - 1, r) || !maskAt(def, c + 1, r)
    || !maskAt(def, c, r - 1) || !maskAt(def, c, r + 1)
  )
}
const isFloor = (def, c, r) => maskAt(def, c, r) && !isWall(def, c, r)

const doorTile = (def) => {
  const mid = Math.floor(def.cols / 2)
  for (let row = def.rows - 1; row >= 0; row--) {
    for (let d = 0; d <= def.cols; d++) {
      for (const col of [mid - d, mid + d]) {
        if (isFloor(def, col, row)) return { col, row }
      }
    }
  }
  return { col: mid, row: def.rows - 2 }
}

// `round` mirrors the fix under test: the scene currently passes prop rows
// through unrounded, and home props are authored at fractional rows, so the
// keys it writes ("3,10.61") can never match an integer tile lookup.
function propBlocked(def, round) {
  const blocked = new Set()
  for (const p of def.props) {
    if (NON_BLOCKING.has(p.id)) continue
    const c0 = Math.round(p.col - p.tileWidth / 2)
    const c1 = Math.max(c0, Math.round(p.col + p.tileWidth / 2 - 1))
    const r = round ? Math.round(p.row) : p.row
    for (let c = c0; c <= c1; c++) {
      blocked.add(`${c},${Math.max(0, r - 1)}`)
      blocked.add(`${c},${r}`)
    }
  }
  return blocked
}

let failures = 0
const fail = (m) => { console.log(`  FAIL ${m}`); failures += 1 }
const ok = (m) => console.log(`  ok   ${m}`)

const ROUND = process.argv.includes('--rounded')
console.log(ROUND
  ? 'prop rows ROUNDED (proposed fix)\n'
  : 'prop rows AS SHIPPED (fractional)\n')

for (const [style, def] of Object.entries(STYLES)) {
  console.log(`${style} -> ${def.zoneId} (${def.cols}x${def.rows})`)

  if (def.mask) {
    const bad = def.mask.filter((r) => r.length !== def.cols)
    if (def.mask.length !== def.rows) fail(`mask has ${def.mask.length} rows, expected ${def.rows}`)
    else if (bad.length) fail(`${bad.length} mask row(s) are not ${def.cols} wide`)
  }

  const blocked = propBlocked(def, ROUND)
  const key = (c, r) => `${c},${r}`
  const door = doorTile(def)
  // the scene explicitly frees the door tile so the exit is never sealed
  blocked.delete(key(door.col, door.row))

  const standable = (c, r) => isFloor(def, c, r) && !blocked.has(key(c, r))

  if (!isFloor(def, door.col, door.row)) {
    fail(`door/spawn (${door.col},${door.row}) is not floor`)
    continue
  }
  ok(`door/spawn (${door.col},${door.row}) standable`)

  const seen = new Set([key(door.col, door.row)])
  const queue = [[door.col, door.row]]
  while (queue.length) {
    const [c, r] = queue.pop()
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nc = c + dc
      const nr = r + dr
      if (!standable(nc, nr) || seen.has(key(nc, nr))) continue
      seen.add(key(nc, nr))
      queue.push([nc, nr])
    }
  }

  const totalFloor = (() => {
    let n = 0
    for (let r = 0; r < def.rows; r++) for (let c = 0; c < def.cols; c++) if (standable(c, r)) n++
    return n
  })()

  if (seen.size <= 1) fail(`player is BOXED IN at the door - 1 reachable tile`)
  else if (seen.size < totalFloor) {
    console.log(`  warn ${seen.size}/${totalFloor} standable tiles reachable (${totalFloor - seen.size} cut off)`)
  } else ok(`all ${seen.size} standable tiles reachable`)

  if (def.deskRect) {
    let hit = false
    for (let r = def.deskRect.r0 - 1; r <= def.deskRect.r1 + 1 && !hit; r++) {
      for (let c = def.deskRect.c0 - 1; c <= def.deskRect.c1 + 1 && !hit; c++) {
        if (seen.has(key(c, r))) hit = true
      }
    }
    if (hit) ok('desk reachable')
    else fail('desk NOT reachable from the door')
  }
  console.log('')
}

console.log(failures ? `FAILED (${failures})` : 'PASS')
process.exit(failures ? 1 : 0)
