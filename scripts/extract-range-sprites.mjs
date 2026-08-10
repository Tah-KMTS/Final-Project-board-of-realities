// One-off asset-processing script (not part of the shipped app) - chroma-keys
// out the white/magenta placeholder backgrounds the source screenshots were
// exported with, then auto-crops to the opaque bounding box so the result is
// a tight sprite PNG ready to drop into public/assets/packs/.
//
// Needs pngjs, which is deliberately NOT a project dependency (this script
// never runs in the shipped app) - before rerunning: npm install pngjs --no-save
//
// Usage: node scripts/extract-range-sprites.mjs
import { PNG } from 'pngjs'
import { readFileSync, writeFileSync, mkdirSync } from 'fs'
import path from 'path'

const SRC_DIR = 'C:\\Users\\Patty Lee\\Pictures\\Screenshots'
const OUT_DIR = 'public/assets/packs/shooting-range'

const JOBS = [
  { src: 'targethuman.png', out: 'target_civilian.png' },
  { src: 'shootingrange - Copy.png', out: 'target_crew.png' },
  { src: 'shootingrange.png', out: 'target_bullseye.png' },
  { src: 'playershooting.png', out: 'player_shooter.png' },
]

function isWhiteish(r, g, b) {
  return r > 240 && g > 240 && b > 240
}

// Vivid chroma magenta only (the artist's "put a shadow here" placeholder
// ellipses - R approx= B, G very low RELATIVE TO r/b, not just low in
// absolute terms). A flat "g < 60" cutoff also caught muted purple jacket
// shading that happened to sit near that boundary (g in the high 50s/low
// 60s on an r/b around 110) - the ratio check is what actually separates
// "true magenta" from "muted plum," regardless of how dark either is.
function isMagentaish(r, g, b) {
  return r > 90 && b > 90 && Math.abs(r - b) < 40 && g < r * 0.3 && g < b * 0.3
}

function keyOut(png) {
  const { width, height, data } = png
  for (let i = 0; i < width * height; i++) {
    const o = i * 4
    const r = data[o]
    const g = data[o + 1]
    const b = data[o + 2]
    if (isWhiteish(r, g, b) || isMagentaish(r, g, b)) {
      data[o + 3] = 0
    }
  }
}

function boundingBox(png) {
  const { width, height, data } = png
  let minX = width,
    minY = height,
    maxX = -1,
    maxY = -1
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const a = data[(y * width + x) * 4 + 3]
      if (a > 8) {
        if (x < minX) minX = x
        if (x > maxX) maxX = x
        if (y < minY) minY = y
        if (y > maxY) maxY = y
      }
    }
  }
  return { minX, minY, maxX, maxY }
}

function crop(png, box, pad = 2) {
  const minX = Math.max(0, box.minX - pad)
  const minY = Math.max(0, box.minY - pad)
  const maxX = Math.min(png.width - 1, box.maxX + pad)
  const maxY = Math.min(png.height - 1, box.maxY + pad)
  const w = maxX - minX + 1
  const h = maxY - minY + 1
  const out = new PNG({ width: w, height: h })
  PNG.bitblt(png, out, minX, minY, w, h, 0, 0)
  return out
}

mkdirSync(OUT_DIR, { recursive: true })

for (const job of JOBS) {
  const buf = readFileSync(path.join(SRC_DIR, job.src))
  const png = PNG.sync.read(buf)
  keyOut(png)
  const box = boundingBox(png)
  const cropped = crop(png, box)
  const outPath = path.join(OUT_DIR, job.out)
  writeFileSync(outPath, PNG.sync.write(cropped))
  console.log(job.src, '->', job.out, cropped.width, 'x', cropped.height)
}
