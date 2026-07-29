// Boots the REAL game in headless Chromium, clicks through the menu to the
// overworld, and screenshots the canvas. This is the loop that was missing
// when the terrain batching was "optimised" twice from inspection alone and
// broke the ground both times: build+lint green proves the code compiles, not
// that anything renders.
//
// Usage:
//   npx vite preview --port 4173
//   node production/probeGame.mjs [out.png] [waitMs]
import puppeteer from 'puppeteer'

const OUT = process.argv[2] || 'probe.png'
const EXTRA_WAIT = Number(process.argv[3] || 6000)

const browser = await puppeteer.launch({
  headless: true,
  args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-webgl'],
})
const page = await browser.newPage()
await page.setViewport({ width: 1280, height: 800 })

const errors = []
page.on('pageerror', (e) => errors.push('PAGEERROR ' + e.message))
page.on('console', (m) => { if (m.type() === 'error') errors.push('CONSOLE ' + m.text()) })

await page.goto('http://localhost:4173', { waitUntil: 'networkidle2' })
await new Promise((r) => setTimeout(r, 2500))

// The game opens on a menu; walk it until a canvas exists.
for (let step = 0; step < 8; step++) {
  const clicked = await page.evaluate(() => {
    if (document.querySelector('canvas')) return 'CANVAS'
    const wants = ['new game', 'start', 'continue', 'begin', 'confirm', 'next', 'play', 'enter']
    const els = [...document.querySelectorAll('button, [role=button], a')]
    for (const w of wants) {
      const el = els.find((e) => (e.innerText || '').trim().toLowerCase().includes(w))
      if (el) { el.click(); return (el.innerText || '').trim().slice(0, 40) }
    }
    return null
  })
  if (clicked === 'CANVAS') break
  await new Promise((r) => setTimeout(r, 2500))
}
await new Promise((r) => setTimeout(r, EXTRA_WAIT))

const info = await page.evaluate(() => {
  const c = document.querySelector('canvas')
  return c ? { canvas: true, w: c.width, h: c.height } : { canvas: false }
})

// Rough frame-rate sample, so a performance change can be measured rather
// than asserted.
const fps = await page.evaluate(
  () =>
    new Promise((res) => {
      let frames = 0
      const t0 = performance.now()
      const tick = () => {
        frames++
        if (performance.now() - t0 < 2000) requestAnimationFrame(tick)
        else res(Math.round((frames * 1000) / (performance.now() - t0)))
      }
      requestAnimationFrame(tick)
    })
)

console.log(JSON.stringify({ ...info, fps, errors: errors.slice(0, 6) }))
await page.screenshot({ path: OUT })
console.log('wrote', OUT)
await browser.close()
