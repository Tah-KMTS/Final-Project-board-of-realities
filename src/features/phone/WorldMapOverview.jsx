import { useEffect, useRef } from 'react'
import { FINANCE_BUILDINGS, FINANCE_V_STREETS, FINANCE_H_STREETS, MAP_COLS, MAP_ROWS } from '../../game/scenes/OverworldScene'

// Static top-down schematic of the Capital Syndicate mega-map - orientation
// only, no click-to-travel (per the user's explicit ask). Deliberately a
// data-only React/canvas component, not a live Phaser camera zoom-out: the
// layout is already precomputed, Phaser-free plain JS
// (FINANCE_BUILDINGS/FINANCE_V_STREETS/FINANCE_H_STREETS/MAP_COLS/MAP_ROWS,
// exported from OverworldScene.js specifically so it CAN be read without a
// running canvas - see that export's own header comment), and
// REACHABLE_BLOCK_IDS = ['finance'] means there's exactly one static layout
// to ever show. A live camera trick would cost real draw calls rendering
// ~100+ building/home sprites at reduced scale for zero animated content,
// and would only work while OverworldScene is actually mounted - this
// works from anywhere, including the Phone, for free.
// px per tile - MAP_COLS=86 -> ~430px wide canvas, wider than the phone
// frame's ~330px usable content width. Deliberately NOT shrunk to fit -
// the parent container below already scrolls (overflow-auto), and at the
// smaller scale this used to render at, adjacent hub buildings' labels
// (several sit in the same horizontal band) overlapped into unreadable
// clutter. A bit of horizontal scrolling is the better trade for actually
// being able to read "Underworld"/"Bank"/etc. rather than a smaller map
// that fits without scrolling but reads as illegible smudges.
const SCALE = 5

const HEX = (n) => `#${n.toString(16).padStart(6, '0')}`

export default function WorldMapOverview() {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const dpr = window.devicePixelRatio || 1
    const width = MAP_COLS * SCALE
    const height = MAP_ROWS * SCALE
    canvas.width = width * dpr
    canvas.height = height * dpr
    canvas.style.width = `${width}px`
    canvas.style.height = `${height}px`
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    ctx.fillStyle = '#0a3d1f'
    ctx.fillRect(0, 0, width, height)

    ctx.fillStyle = '#3a3a3a'
    for (const row of FINANCE_H_STREETS) ctx.fillRect(0, row * SCALE, width, SCALE)
    for (const col of FINANCE_V_STREETS) ctx.fillRect(col * SCALE, 0, SCALE, height)

    for (const b of FINANCE_BUILDINGS) {
      const x = b.tiles.c0 * SCALE
      const y = b.tiles.r0 * SCALE
      const w = (b.tiles.c1 - b.tiles.c0 + 1) * SCALE
      const h = (b.tiles.r1 - b.tiles.r0 + 1) * SCALE
      ctx.fillStyle = HEX(b.color)
      ctx.fillRect(x, y, w, h)
    }

    // Labels only for the ~10 named hub buildings (no `kind`) - the ~88
    // character home/hideout rects (kind: 'home'|'hideout') render as small
    // uncaptioned colored blocks so labels don't turn into unreadable
    // clutter at this scale.
    ctx.font = '8px monospace'
    ctx.fillStyle = '#ffffff'
    ctx.textAlign = 'center'
    for (const b of FINANCE_BUILDINGS) {
      if (b.kind) continue
      const cx = ((b.tiles.c0 + b.tiles.c1 + 1) / 2) * SCALE
      const topY = b.tiles.r0 * SCALE - 2
      ctx.fillText(b.label.replace(/^[^\w]+/, ''), cx, Math.max(7, topY))
    }
  }, [])

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="mb-2 shrink-0">
        <div className="text-sm font-bold text-cyan-300">Capital Syndicate Mega-Map</div>
        <div className="text-xs text-gray-500">Orientation only - walk there yourself.</div>
      </div>
      {/* overflow-auto + no max-w on the canvas is deliberate: the canvas
          (430px wide at SCALE=5) is wider than this phone frame's ~330px
          usable content width, and letting it scroll at full pixel size
          keeps building labels readable - a max-w-full canvas would get
          shrunk right back down by the browser and undo the whole point of
          rendering at a bigger scale in the first place. */}
      <div className="flex-1 overflow-auto rounded border border-gray-700 bg-black p-2">
        <canvas ref={canvasRef} />
      </div>
      <div className="mt-2 flex shrink-0 flex-wrap gap-x-3 gap-y-1 text-[10px] text-gray-400">
        <span><span className="inline-block h-2 w-2 bg-[#3a3a3a] align-middle" /> Road</span>
        <span><span className="inline-block h-2 w-2 bg-purple-700 align-middle" /> Hub building</span>
        <span><span className="inline-block h-2 w-2 bg-yellow-700 align-middle" /> Residence / hideout</span>
      </div>
    </div>
  )
}
