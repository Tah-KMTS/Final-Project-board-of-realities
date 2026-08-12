import { useEffect, useRef } from 'react'
import { hash, r } from '../../features/cutscene/panelKit'

// Title-screen backdrop: a two-layer neon skyline silhouette, drawn on a
// small canvas and scaled up with `image-rendering: pixelated` - the same
// "draw it, don't import a .png" approach panelKit.js uses for the
// cutscenes (see that file's header), just parameterized on the container's
// own width/height instead of the cutscene's fixed 480x270 panel, since
// this backdrop has to fill whatever viewport the title screen is on.
// hash/r are reused verbatim from panelKit (both already width-agnostic);
// skyline() itself isn't, since it loops against panelKit's fixed PANEL_W,
// so it's re-implemented here taking width as a parameter instead.
const RES_W = 384 // internal draw width - low enough to read as chunky pixel art once stretched

function drawSkylineLayer(ctx, width, yBase, seed, color, litColor, litChance) {
  let x = -10
  let i = 0
  while (x < width + 10) {
    const w = 18 + Math.floor(hash(seed + i * 3.7) * 22)
    const h = 30 + Math.floor(hash(seed + i * 7.3) * 70)
    r(ctx, x, yBase - h, w, h, color)
    for (let wy = yBase - h + 5; wy < yBase - 5; wy += 8) {
      for (let wx = x + 3; wx < x + w - 4; wx += 7) {
        if (hash(seed + wx * 1.7 + wy * 3.1) < litChance) r(ctx, wx, wy, 2, 3, litColor)
      }
    }
    x += w + 3
    i += 1
  }
}

export default function WelcomeSkyline() {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')

    const draw = () => {
      const aspect = window.innerWidth / Math.max(1, window.innerHeight)
      const resH = Math.round(RES_W / aspect)
      canvas.width = RES_W
      canvas.height = resH
      ctx.clearRect(0, 0, RES_W, resH)

      // Far, dim silhouette - fixed seed so it doesn't reshuffle every
      // resize, just like panelKit's own skyline stays stable across
      // repaints (see its own comment on `hash`).
      drawSkylineLayer(ctx, RES_W, resH * 0.62, 11, '#181a34', '#3a3d6b', 0.12)
      // Mid row, brighter with more lit windows - reads as the actual
      // financial district the game takes place in.
      drawSkylineLayer(ctx, RES_W, resH * 0.78, 47, '#12132a', '#f8d97a', 0.22)
      // Close foreground row, taller and denser, anchored past the bottom
      // edge (yBase > resH) so it reads as buildings the "camera" is
      // standing among rather than a skyline seen from a distance - this is
      // what fills the lower half instead of leaving it flat black (a
      // previous version faded straight to solid black there, which just
      // reproduced the "big empty void" look this backdrop was meant to fix).
      drawSkylineLayer(ctx, RES_W, resH * 1.08, 83, '#0d0e20', '#f8d97a', 0.16)

      // Light vignette only, not a hard fade - darkens toward the bottom for
      // button-text contrast without blacking the art out entirely, so the
      // close row above stays visible (if dim) all the way to the edge.
      const fade = ctx.createLinearGradient(0, resH * 0.5, 0, resH)
      fade.addColorStop(0, 'rgba(10,11,24,0)')
      fade.addColorStop(1, 'rgba(10,11,24,0.72)')
      ctx.fillStyle = fade
      ctx.fillRect(0, 0, RES_W, resH)
    }

    draw()
    // Resize redraws at the new aspect ratio rather than just CSS-stretching
    // the old canvas, so the skyline never looks squashed on an unusual
    // window shape.
    window.addEventListener('resize', draw)
    return () => window.removeEventListener('resize', draw)
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none absolute inset-0 h-full w-full"
      style={{ imageRendering: 'pixelated' }}
      aria-hidden="true"
    />
  )
}
