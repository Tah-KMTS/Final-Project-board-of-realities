// Walkability check for the two prison rooms.
//
// The rooms are hand-authored tile masks with sealed cells in them, so the
// failure that actually matters isn't visual - it's a room the player can't
// get out of, or an interactable they can't reach. Being locked in a cell
// with no reachable guard desk is unrecoverable: the holding cell has no
// plain "exit to overworld", by design, so bail/bribe and the escape corridor
// are the ONLY two ways out.
//
// Parses PRISON_ROOMS out of OverworldScene.js (same reason as
// compare_prison_rooms.py: it can't drift from what the game builds), floods
// from the spawn tile, and asserts every interactable is standable-adjacent.
//
// Run: node production/checkPrisonRooms.mjs
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
const ROOMS = new Function(`return ${sliceObject('PRISON_ROOMS')}`)()
const WALKABLE = new Set(['s', 'd', 'f', 'c'])

// Mirrors PRISON_PROP_NON_BLOCKING in the scene.
const NON_BLOCKING = new Set(
  [...src.matchAll(/const PRISON_PROP_NON_BLOCKING = new Set\(\[([^\]]*)\]/g)]
    .flatMap((m) => [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1]))
)

// Mirrors placePrisonProp's footprint: a prop blocks its own tile row and the
// row above, across its rounded width. Checking the mask alone would miss a
// desk or bed parked on the only route to something.
function propBlocked(def) {
  const blocked = new Set()
  for (const p of def.props) {
    if (NON_BLOCKING.has(p.id)) continue
    const c0 = Math.round(p.col - p.tileWidth / 2)
    const c1 = Math.max(c0, Math.round(p.col + p.tileWidth / 2 - 1))
    for (let c = c0; c <= c1; c += 1) {
      blocked.add(`${c},${Math.max(0, p.row - 1)}`)
      blocked.add(`${c},${p.row}`)
    }
  }
  return blocked
}

let failures = 0
const fail = (m) => { console.log(`  FAIL ${m}`); failures += 1 }
const ok = (m) => console.log(`  ok   ${m}`)

for (const [id, def] of Object.entries(ROOMS)) {
  console.log(`\n${id} (${def.cols}x${def.rows})`)

  // every mask row must be exactly cols wide, or the whole grid silently skews
  const bad = def.mask.filter((r) => r.length !== def.cols)
  if (def.mask.length !== def.rows) fail(`mask has ${def.mask.length} rows, expected ${def.rows}`)
  else if (bad.length) fail(`${bad.length} mask row(s) are not ${def.cols} wide`)
  else ok(`mask is ${def.cols}x${def.rows}`)

  const rawAt = (c, r) =>
    (c < 0 || r < 0 || r >= def.rows || c >= def.cols ? '.' : def.mask[r][c])
  const blocked = propBlocked(def)
  const key = (c, r) => `${c},${r}`
  // a tile is standable only if the mask allows it AND no prop occupies it
  const at = (c, r) => (blocked.has(key(c, r)) ? '#' : rawAt(c, r))

  // flood from spawn
  const seen = new Set()
  const start = def.spawn
  if (!WALKABLE.has(at(start.col, start.row))) {
    fail(`spawn (${start.col},${start.row}) is '${rawAt(start.col, start.row)}'`
      + `${blocked.has(key(start.col, start.row)) ? ' and has a prop on it' : ''}, not standable`)
  } else {
    ok(`spawn (${start.col},${start.row}) is standable`)
    const queue = [[start.col, start.row]]
    seen.add(key(start.col, start.row))
    while (queue.length) {
      const [c, r] = queue.pop()
      for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nc = c + dc
        const nr = r + dr
        if (!WALKABLE.has(at(nc, nr)) || seen.has(key(nc, nr))) continue
        seen.add(key(nc, nr))
        queue.push([nc, nr])
      }
    }
  }

  // a rect is reachable if any walkable tile inside it, or orthogonally
  // touching it, was reached from spawn
  const reaches = (rect) => {
    for (let r = rect.r0 - 1; r <= rect.r1 + 1; r += 1) {
      for (let c = rect.c0 - 1; c <= rect.c1 + 1; c += 1) {
        if (seen.has(key(c, r))) return true
      }
    }
    return false
  }

  if (def.deskRect) {
    if (reaches(def.deskRect)) ok('warden desk reachable from spawn')
    else fail('warden desk NOT reachable from spawn (jail would be unescapable)')
  }
  if (def.exitRect) {
    if (reaches(def.exitRect)) ok('exit door reachable from spawn')
    else fail('exit door NOT reachable from spawn')
  }
  for (const [i, col] of (def.checkpointCols || []).entries()) {
    const rect = { c0: col, r0: 4, c1: col, r1: 4 }
    if (reaches(rect)) ok(`checkpoint ${i + 1}/4 (col ${col}) reachable`)
    else fail(`checkpoint ${i + 1}/4 (col ${col}) NOT reachable`)
  }

  // props must stand on a tile that exists in the room. col/row are allowed
  // to be fractional so a prop can sit where the reference puts it rather
  // than snapping to the grid, so round before indexing the mask.
  for (const p of def.props) {
    if (at(Math.round(p.col), Math.round(p.row)) === '.') {
      fail(`prop ${p.id} at (${p.col},${p.row}) is outside the room`)
    }
  }
  ok(`${def.props.length} props all inside the room`)
  console.log(`  ${seen.size} tiles reachable from spawn`)
}

console.log(failures ? `\nFAILED (${failures})` : '\nPASS')
process.exit(failures ? 1 : 0)
