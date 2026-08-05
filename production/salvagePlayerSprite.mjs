// Salvage pipeline for the player's real-art sprite.
//
//   node production/salvagePlayerSprite.mjs
//
// Reads the four hand-supplied direction stills from
// public/assets/packs/player/raw/ (gitignored - see .gitignore) and emits
// ONE game-ready sheet at public/assets/packs/player/processed/player.png
// in exactly the layout src/game/packs/npcRealSprites.js already defines:
// a 2-column x 4-row grid, columns being the two walk steps and rows being
// down / up / left / right. That keeps the player on the same contract as
// every other real-art actor instead of inventing a second one.
//
// The raws need real work before they are usable:
//
//  1. THEY ARE NOT PNGs. front/back/right are JPEGs with a .png extension,
//     so they have no alpha at all and their "flat" grey background is
//     actually thousands of slightly different greys with ringing around
//     every edge. Hence a tolerance-based flood fill rather than an exact
//     colour match.
//
//  2. BACKGROUND. Removed by flooding inward from the border, the same
//     trick npcRealSprites.js documents: a plain grey threshold would punch
//     holes in the character's own grey/white shoes, but interior greys are
//     not connected to the border so they survive.
//
//  3. GROUND LINE. Every still is drawn standing on a black rule that spans
//     the full width, and back.png has a solid black band under it. Neither
//     is grey, so the flood leaves both behind - and they cannot simply be
//     flooded as "dark", because the character's feet touch that line and
//     its black outline is one connected network around the whole body, so
//     the fill would eat the sprite. They are cut by row instead: any row
//     that is opaque across more than half the image is scenery, never the
//     character (his widest row, the shoulders, is under 40%).
//
//  4. SIZE. Normalised so the standing pose is 64px tall - what every other
//     actor in this game is (procedural NPCs are a 12x16 grid of 4px units;
//     the old hand-authored player art was 44x80 at scale 0.8). All four
//     directions are scaled by the SAME factor, derived from the front
//     view, and bottom-aligned on a shared baseline, so he neither changes
//     height nor bobs as he turns.
//
//  5. WALK. The source is one still per direction - there is no second walk
//     pose anywhere in it. Rather than fabricate limb movement (the mistake
//     npcRealSprites.js's header calls out for the police sheet), step 1 is
//     the same art raised 1px: a walk bob. It reads as footfall without
//     inventing anatomy that was never drawn.
//
// Decoding/compositing runs inside headless Chrome via puppeteer (already a
// devDependency) because it decodes JPEG and PNG alike and gives a real
// canvas to work on - no image-processing dependency is added to the project.

import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { createRequire } from 'node:module'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..')
const RAW = resolve(ROOT, 'public/assets/packs/player/raw')
const OUT = resolve(ROOT, 'public/assets/packs/player/processed/player.png')

// Row order is npcRealSprites.js's FACING_ROW: down, up, left, right.
const SOURCES = [
  { facing: 'down', file: 'front.png' },
  { facing: 'up', file: 'back.png' },
  { facing: 'left', file: 'left.png' },
  { facing: 'right', file: 'right.png' },
]

const TARGET_H = 64 // standing height of every actor in this game
const BG_TOLERANCE = 46 // generous: the JPEG greys are far from uniform
const SCENERY_ROW_FRACTION = 0.5 // a row opaque past this is the ground rule
const ALPHA_CUTOFF = 128
const BOB_PX = 1 // step-1 lift, see note 5

const require = createRequire(import.meta.url)
const puppeteer = require(resolve(ROOT, 'node_modules/puppeteer'))

function dataUrl(file) {
  const p = resolve(RAW, file)
  if (!existsSync(p)) throw new Error(`missing raw source: ${p}`)
  // Extension lies on three of the four; the browser sniffs the real type,
  // so the declared mime here only has to be an image type it will probe.
  return `data:image/png;base64,${readFileSync(p).toString('base64')}`
}

for (const s of SOURCES) s.url = dataUrl(s.file)

const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] })
const page = await browser.newPage()
await page.goto('about:blank')

const result = await page.evaluate(
  async (sources, cfg) => {
    const load = (url) =>
      new Promise((res, rej) => {
        const img = new Image()
        img.onload = () => res(img)
        img.onerror = () => rej(new Error('decode failed'))
        img.src = url
      })

    const ctxOf = (w, h) => {
      const c = document.createElement('canvas')
      c.width = w
      c.height = h
      const x = c.getContext('2d', { willReadFrequently: true })
      x.imageSmoothingEnabled = false
      return [c, x]
    }

    // --- per-source: key out the grey, cut the scenery, crop to the body ---
    const prepared = []
    for (const src of sources) {
      const img = await load(src.url)
      const w = img.naturalWidth
      const h = img.naturalHeight
      const [, ctx] = ctxOf(w, h)
      ctx.drawImage(img, 0, 0)
      const id = ctx.getImageData(0, 0, w, h)
      const d = id.data

      // Background colour sampled from a corner, not assumed.
      const bg = [d[0], d[1], d[2]]
      const isBg = (i) =>
        Math.abs(d[i] - bg[0]) + Math.abs(d[i + 1] - bg[1]) + Math.abs(d[i + 2] - bg[2]) <
        cfg.BG_TOLERANCE * 3

      // Flood from every border pixel inward (note 2).
      const seen = new Uint8Array(w * h)
      const stack = []
      const push = (x, y) => {
        if (x < 0 || y < 0 || x >= w || y >= h) return
        const p = y * w + x
        if (seen[p]) return
        if (!isBg(p * 4)) return
        seen[p] = 1
        stack.push(p)
      }
      for (let x = 0; x < w; x += 1) {
        push(x, 0)
        push(x, h - 1)
      }
      for (let y = 0; y < h; y += 1) {
        push(0, y)
        push(w - 1, y)
      }
      while (stack.length) {
        const p = stack.pop()
        const x = p % w
        const y = (p / w) | 0
        push(x + 1, y)
        push(x - 1, y)
        push(x, y + 1)
        push(x, y - 1)
      }
      for (let p = 0; p < w * h; p += 1) if (seen[p]) d[p * 4 + 3] = 0

      // Cut full-width scenery rows: the ground rule and back.png's black
      // band survive the flood because they are not grey (note 3).
      for (let y = 0; y < h; y += 1) {
        let opaque = 0
        for (let x = 0; x < w; x += 1) if (d[(y * w + x) * 4 + 3] > cfg.ALPHA_CUTOFF) opaque += 1
        if (opaque > w * cfg.SCENERY_ROW_FRACTION) {
          for (let x = 0; x < w; x += 1) d[(y * w + x) * 4 + 3] = 0
        }
      }

      // Bounding box of what's left.
      let minX = w
      let minY = h
      let maxX = -1
      let maxY = -1
      for (let y = 0; y < h; y += 1) {
        for (let x = 0; x < w; x += 1) {
          if (d[(y * w + x) * 4 + 3] > cfg.ALPHA_CUTOFF) {
            if (x < minX) minX = x
            if (x > maxX) maxX = x
            if (y < minY) minY = y
            if (y > maxY) maxY = y
          }
        }
      }
      if (maxX < 0) throw new Error(`${src.file}: nothing survived background removal`)

      const bw = maxX - minX + 1
      const bh = maxY - minY + 1
      const [cropCanvas, cropCtx] = ctxOf(bw, bh)
      cropCtx.putImageData(id, -minX, -minY)
      prepared.push({ facing: src.facing, file: src.file, canvas: cropCanvas, w: bw, h: bh })
    }

    // --- one shared scale, derived from the front view (note 4) ---
    const front = prepared.find((p) => p.facing === 'down')
    const scale = cfg.TARGET_H / front.h

    for (const p of prepared) {
      const sw = Math.max(1, Math.round(p.w * scale))
      const sh = Math.max(1, Math.round(p.h * scale))
      // Area-average down (imageSmoothing ON for the minify only) then
      // re-harden alpha, so edges stay crisp but flat colour areas don't
      // pick up JPEG speckle from a single nearest-neighbour sample.
      const [dc, dx] = ctxOf(sw, sh)
      dx.imageSmoothingEnabled = true
      dx.imageSmoothingQuality = 'high'
      dx.drawImage(p.canvas, 0, 0, sw, sh)
      const sid = dx.getImageData(0, 0, sw, sh)
      for (let i = 3; i < sid.data.length; i += 4) {
        sid.data[i] = sid.data[i] > cfg.ALPHA_CUTOFF ? 255 : 0
      }
      dx.putImageData(sid, 0, 0)
      p.small = dc
      p.sw = sw
      p.sh = sh
    }

    // --- cell size + sheet assembly ---
    const cellW = Math.max(...prepared.map((p) => p.sw)) + 2 // 1px breathing room
    const cellH = Math.max(...prepared.map((p) => p.sh)) + cfg.BOB_PX
    const [sheet, sx] = ctxOf(cellW * 2, cellH * 4)

    const ROW = { down: 0, up: 1, left: 2, right: 3 }
    for (const p of prepared) {
      const row = ROW[p.facing]
      const ox = Math.round((cellW - p.sw) / 2) // centred horizontally
      const oy = cellH - p.sh // bottom-aligned: one shared baseline
      for (let step = 0; step < 2; step += 1) {
        const lift = step === 1 ? cfg.BOB_PX : 0
        sx.drawImage(p.small, step * cellW + ox, row * cellH + oy - lift)
      }
    }

    return {
      dataUrl: sheet.toDataURL('image/png'),
      cellW,
      cellH,
      scale,
      frames: prepared.map((p) => ({ facing: p.facing, file: p.file, src: `${p.w}x${p.h}`, out: `${p.sw}x${p.sh}` })),
    }
  },
  SOURCES.map((s) => ({ facing: s.facing, file: s.file, url: s.url })),
  { TARGET_H, BG_TOLERANCE, SCENERY_ROW_FRACTION, ALPHA_CUTOFF, BOB_PX }
)

await browser.close()

writeFileSync(OUT, Buffer.from(result.dataUrl.split(',')[1], 'base64'))

console.log('wrote', OUT)
console.log('cell', `${result.cellW}x${result.cellH}`, '| sheet', `${result.cellW * 2}x${result.cellH * 4}`)
console.log('scale', result.scale.toFixed(4))
for (const f of result.frames) console.log(` ${f.facing.padEnd(6)} ${f.file.padEnd(11)} ${f.src} -> ${f.out}`)
console.log('\nPaste these into src/game/packs/playerRealSprite.js:')
console.log(`  cellW: ${result.cellW}, cellH: ${result.cellH}`)
