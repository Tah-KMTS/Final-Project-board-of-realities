// Throwaway verification harness (scratchpad, not shipped): composites the
// authored chapel map exactly the way tmxMapInterior.js draws it - same layer
// order, same tileset files, same frame->cell math, same flip flags - and
// saves a PNG so it can actually be LOOKED AT. Serves the pack assets over
// vite preview so the paths match the real app.
import { readFileSync } from 'fs'
import puppeteer from 'puppeteer'
import { CHAPEL_MAP, CHAPEL_MAP_TILESETS, CHAPEL_MAP_LAYERS } from '../../../../../../Desktop/Sasin/2026-07 Class 17 Generative AI and Social Media/Lecture 01/Claude/Final-Project-board-of-realities/src/game/packs/chapelInteriorMap.js'

const BASE = process.argv[2] // e.g. http://localhost:4173
const OUT = process.argv[3]
const SCALE = 3 // upscale so pixel art is legible in the saved PNG

const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] })
const page = await browser.newPage()
await page.setViewport({
  width: CHAPEL_MAP.cols * CHAPEL_MAP.tileW * SCALE,
  height: CHAPEL_MAP.rows * CHAPEL_MAP.tileH * SCALE,
})
page.on('console', (m) => console.log('[page]', m.text()))
await page.goto(BASE, { waitUntil: 'domcontentloaded' })

const result = await page.evaluate(
  async (map, tilesets, layers, base, scale) => {
    const canvas = document.createElement('canvas')
    canvas.width = map.cols * map.tileW * scale
    canvas.height = map.rows * map.tileH * scale
    canvas.id = 'shot'
    document.body.innerHTML = ''
    document.body.style.margin = '0'
    document.body.appendChild(canvas)
    const ctx = canvas.getContext('2d')
    ctx.imageSmoothingEnabled = false

    const images = {}
    const errors = []
    await Promise.all(
      Object.entries(tilesets).map(
        ([key, ts]) =>
          new Promise((res) => {
            const img = new Image()
            img.onload = () => {
              images[key] = img
              res()
            }
            img.onerror = () => {
              errors.push(`LOAD FAILED: ${ts.file}`)
              res()
            }
            img.src = `${base}/assets/packs/chapel-pixel-/Tiled_files/${ts.file}`
          })
      )
    )

    // Dimension check: the extracted cols/rows must match the real PNG, or
    // every frame index is off.
    const dimIssues = []
    for (const [key, ts] of Object.entries(tilesets)) {
      const img = images[key]
      if (!img) continue
      if (img.naturalWidth !== ts.cols * ts.cellW || img.naturalHeight !== ts.rows * ts.cellH) {
        dimIssues.push(`${ts.file}: real ${img.naturalWidth}x${img.naturalHeight} vs expected ${ts.cols * ts.cellW}x${ts.rows * ts.cellH}`)
      }
    }

    let drawn = 0
    for (const layer of layers) {
      for (const [col, row, base2, frame, flags] of layer.tiles) {
        const ts = tilesets[base2]
        const img = images[base2]
        if (!ts || !img) continue
        const sx = (frame % ts.cols) * ts.cellW
        const sy = Math.floor(frame / ts.cols) * ts.cellH
        const dx = col * map.tileW * scale
        const dy = row * map.tileH * scale
        const dw = map.tileW * scale
        const dh = map.tileH * scale
        ctx.save()
        if (flags & 1 || flags & 2) {
          ctx.translate(dx + dw / 2, dy + dh / 2)
          ctx.scale(flags & 1 ? -1 : 1, flags & 2 ? -1 : 1)
          ctx.drawImage(img, sx, sy, ts.cellW, ts.cellH, -dw / 2, -dh / 2, dw, dh)
        } else {
          ctx.drawImage(img, sx, sy, ts.cellW, ts.cellH, dx, dy, dw, dh)
        }
        ctx.restore()
        drawn++
      }
    }
    return { errors, dimIssues, drawn }
  },
  CHAPEL_MAP,
  CHAPEL_MAP_TILESETS,
  CHAPEL_MAP_LAYERS,
  BASE,
  SCALE
)

console.log('drawn tiles:', result.drawn)
if (result.errors.length) console.log('IMAGE ERRORS:\n  ' + result.errors.join('\n  '))
if (result.dimIssues.length) console.log('DIMENSION MISMATCHES:\n  ' + result.dimIssues.join('\n  '))
if (!result.errors.length && !result.dimIssues.length) console.log('all tilesets loaded at expected dimensions')

const el = await page.$('#shot')
await el.screenshot({ path: OUT })
console.log('wrote', OUT)
await browser.close()
