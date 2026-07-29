// Build-time parser: chapel-pixel- Tiled_files/Interior.tmx -> static JS data
// module. Throwaway (scratchpad), not shipped - matches the project's existing
// convention of generating/curating plain JS frame data rather than parsing XML
// at runtime (see chapelPixelTiles.js's header).
const fs = require('fs')
const path = require('path')

const TMX = process.argv[2]
const OUT = process.argv[3]
const xml = fs.readFileSync(TMX, 'utf8')

// ---- map header ----
const mapM = xml.match(/<map[^>]*width="(\d+)"[^>]*height="(\d+)"[^>]*tilewidth="(\d+)"[^>]*tileheight="(\d+)"/)
const mapW = +mapM[1], mapH = +mapM[2], tileW = +mapM[3], tileH = +mapM[4]

// ---- tilesets (all embedded in this file: firstgid + columns + <image>) ----
// Keyed by image basename, NOT by name= : the artist reused the name
// "Parishioner10" for several different tilesets, so name is not unique.
const tilesets = []
const tsRe = /<tileset firstgid="(\d+)"[^>]*tilewidth="(\d+)" tileheight="(\d+)" tilecount="(\d+)" columns="(\d+)">\s*<image source="([^"]+)" width="(\d+)" height="(\d+)"/g
let m
while ((m = tsRe.exec(xml))) {
  tilesets.push({
    firstgid: +m[1], tileW: +m[2], tileH: +m[3], tilecount: +m[4], columns: +m[5],
    image: m[6], imgW: +m[7], imgH: +m[8],
    base: path.basename(m[6], '.png'),
  })
}
tilesets.sort((a, b) => a.firstgid - b.firstgid)

function tilesetForGid(gid) {
  let found = null
  for (const ts of tilesets) if (ts.firstgid <= gid) found = ts
  return found
}

// ---- layers (order in file == draw order, bottom first) ----
const FLIP_H = 0x80000000, FLIP_V = 0x40000000, FLIP_D = 0x20000000
const layers = []
const layerRe = /<layer id="\d+" name="([^"]+)" width="\d+" height="\d+"[^>]*>([\s\S]*?)<\/layer>/g
while ((m = layerRe.exec(xml))) {
  const name = m[1]
  const body = m[2]
  const tiles = []
  // infinite map -> <chunk x= y= width= height=>CSV</chunk>
  const chunkRe = /<chunk x="(-?\d+)" y="(-?\d+)" width="(\d+)" height="(\d+)">([\s\S]*?)<\/chunk>/g
  let c
  while ((c = chunkRe.exec(body))) {
    const cx = +c[1], cy = +c[2], cw = +c[3]
    const vals = c[5].trim().split(',').map((s) => Number(s.trim()))
    for (let i = 0; i < vals.length; i++) {
      const raw = vals[i]
      if (!raw) continue
      const gid = raw & 0x1fffffff
      const ts = tilesetForGid(gid)
      if (!ts) continue
      tiles.push({
        x: cx + (i % cw),
        y: cy + Math.floor(i / cw),
        base: ts.base,
        id: gid - ts.firstgid, // local frame index within that tileset
        fh: !!(raw & FLIP_H),
        fv: !!(raw & FLIP_V),
        fd: !!(raw & FLIP_D),
      })
    }
  }
  layers.push({ name, tiles })
}

// ---- normalize coordinates so the drawn content starts at (0,0) ----
let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
for (const l of layers) for (const t of l.tiles) {
  if (t.x < minX) minX = t.x
  if (t.y < minY) minY = t.y
  if (t.x > maxX) maxX = t.x
  if (t.y > maxY) maxY = t.y
}
for (const l of layers) for (const t of l.tiles) { t.x -= minX; t.y -= minY }
const cols = maxX - minX + 1
const rows = maxY - minY + 1

// ---- only emit tilesets actually referenced ----
const used = new Set()
for (const l of layers) for (const t of l.tiles) used.add(t.base)
const usedTilesets = tilesets.filter((ts) => used.has(ts.base))
// dedupe by base (same image can appear as several tileset entries)
const byBase = new Map()
for (const ts of usedTilesets) if (!byBase.has(ts.base)) byBase.set(ts.base, ts)

// ---- report ----
console.log(`map ${mapW}x${mapH} @${tileW}x${tileH} -> content bounds ${cols}x${rows} (offset ${minX},${minY})`)
console.log(`layers (draw order):`)
for (const l of layers) console.log(`  ${String(l.tiles.length).padStart(4)}  ${l.name}`)
console.log(`tilesets used (${byBase.size}):`)
for (const [base, ts] of byBase) {
  const rowsInSheet = ts.imgH / ts.tileH
  console.log(`  ${base.padEnd(24)} ${ts.imgW}x${ts.imgH}  cols=${ts.columns} rows=${rowsInSheet} cell=${ts.tileW}x${ts.tileH} tilecount=${ts.tilecount}`)
}
const flipped = layers.flatMap((l) => l.tiles).filter((t) => t.fh || t.fv || t.fd)
console.log(`flipped tiles: ${flipped.length}`)

// ---- emit module ----
const lines = []
lines.push(`// GENERATED from public/assets/packs/chapel-pixel-/Tiled_files/Interior.tmx`)
lines.push(`// by a throwaway build-time script (not shipped) - do not hand-edit.`)
lines.push(`//`)
lines.push(`// This is the chapel pack ARTIST'S OWN authored room, i.e. the actual`)
lines.push(`// composition behind the marketing image used as our reference. It`)
lines.push(`// supersedes the previous hand-placed CHAPEL_TEMPLE_ROOM layout, which`)
lines.push(`// guessed furniture positions and crops and never matched.`)
lines.push(`//`)
lines.push(`// IMPORTANT - these tilesets resolve against the images in Tiled_files/,`)
lines.push(`// NOT the same-named ones under PNG/. They are genuinely different files:`)
lines.push(`// e.g. Tiled_files/Walls_Interior.png is 160x496 (31 rows) while`)
lines.push(`// PNG/Walls_Interior.png is 160x528 (33 rows), and the Parishioner/Monk`)
lines.push(`// sheets differ in both size and layout. Every frame index below is a`)
lines.push(`// local id into the Tiled_files/ image named in CHAPEL_MAP_TILESETS.`)
lines.push(`// Loading the PNG/ variant instead silently mis-crops everything.`)
lines.push(``)
lines.push(`export const CHAPEL_MAP = {`)
lines.push(`  cols: ${cols},`)
lines.push(`  rows: ${rows},`)
lines.push(`  tileW: ${tileW},`)
lines.push(`  tileH: ${tileH},`)
lines.push(`}`)
lines.push(``)
lines.push(`// key -> { file, cols, rows, cellW, cellH } (file is relative to`)
lines.push(`// /assets/packs/chapel-pixel-/Tiled_files/)`)
lines.push(`export const CHAPEL_MAP_TILESETS = {`)
for (const [base, ts] of byBase) {
  lines.push(`  '${base}': { file: '${path.basename(ts.image)}', cols: ${ts.columns}, rows: ${ts.imgH / ts.tileH}, cellW: ${ts.tileW}, cellH: ${ts.tileH} },`)
}
lines.push(`}`)
lines.push(``)
lines.push(`// Bottom-to-top draw order, exactly as authored in the .tmx.`)
lines.push(`// Each tile: [col, row, tilesetKey, localFrameId, flipFlags]`)
lines.push(`// flipFlags bit0 = flip horizontal, bit1 = flip vertical, bit2 = diagonal.`)
lines.push(`export const CHAPEL_MAP_LAYERS = [`)
for (const l of layers) {
  if (!l.tiles.length) continue
  lines.push(`  {`)
  lines.push(`    name: '${l.name}',`)
  lines.push(`    tiles: [`)
  for (const t of l.tiles) {
    const flags = (t.fh ? 1 : 0) | (t.fv ? 2 : 0) | (t.fd ? 4 : 0)
    lines.push(`      [${t.x}, ${t.y}, '${t.base}', ${t.id}, ${flags}],`)
  }
  lines.push(`    ],`)
  lines.push(`  },`)
}
lines.push(`]`)
lines.push(``)

fs.writeFileSync(OUT, lines.join('\n'))
console.log(`\nwrote ${OUT} (${lines.length} lines)`)
