import { useEffect, useRef, useState } from 'react'

// Turbo Racer - the go-kart arcade game launched by the Pixel Palace Arcade's
// sit-down driving cabinet (OverworldScene's arcadeCabinet zone -> WorldScreen's
// 'arcadeGame' branch, id 'turboRacer'). An original top-down endless racer in
// the spirit of an arcade driving cabinet: steer a go-kart down a neon highway,
// dodge oncoming karts and barrels, and the road keeps getting faster. Purely
// for fun - no cash/reputation stakes. Everything is drawn from Phaser-free
// canvas primitives (the project's no-external-assets rule), so there are no
// image files. onClose matches every overworld modal (WorldScreen.closeModal).

const W = 320
const H = 480
const ROAD_L = 52
const ROAD_R = 268
const LANES = [88, 160, 232] // lane centre x's
const KART_W = 34
const KART_H = 48
const PLAYER_Y = H - 66
const START_SPEED = 3.2
const MAX_SPEED = 8.6
const ACCEL = 0.0011 // speed gained per frame
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v)
const BEST_KEY = 'turboRacerBest'

export default function TurboRacerModal({ onClose }) {
  const canvasRef = useRef(null)
  const gameRef = useRef(null)
  const [score, setScore] = useState(0)
  const [best, setBest] = useState(() => {
    const v = Number(localStorage.getItem(BEST_KEY))
    return Number.isFinite(v) ? v : 0
  })
  const [over, setOver] = useState(false)

  const newGame = () => ({
    kartX: LANES[1],
    targetX: LANES[1],
    steer: 0, // keyboard steer: -1 / 0 / +1
    speed: START_SPEED,
    dist: 0, // raw distance, shown /10 as "metres"
    scroll: 0, // for scrolling road markings
    obstacles: [], // { x, y, lane, w, h, kind, color }
    spawnTimer: 30,
    phase: 'play', // 'play' | 'over'
  })

  const resetGame = () => {
    gameRef.current = newGame()
    setScore(0)
    setOver(false)
  }

  useEffect(() => {
    gameRef.current = newGame()
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    let raf

    const toLocalX = (clientX) => {
      const r = canvas.getBoundingClientRect()
      return ((clientX - r.left) / r.width) * W
    }
    const onMove = (e) => {
      const p = e.touches ? e.touches[0] : e
      gameRef.current.targetX = clamp(toLocalX(p.clientX), ROAD_L + KART_W / 2, ROAD_R - KART_W / 2)
      if (e.cancelable) e.preventDefault()
    }
    const onKey = (down) => (e) => {
      const k = e.key
      if (k === 'ArrowLeft' || k === 'a' || k === 'A') { gameRef.current.steer = down ? -1 : 0; e.preventDefault() }
      else if (k === 'ArrowRight' || k === 'd' || k === 'D') { gameRef.current.steer = down ? 1 : 0; e.preventDefault() }
    }
    const kd = onKey(true)
    const ku = onKey(false)
    canvas.addEventListener('pointermove', onMove)
    canvas.addEventListener('touchmove', onMove, { passive: false })
    window.addEventListener('keydown', kd)
    window.addEventListener('keyup', ku)

    const spawn = (g) => {
      // pick 1-2 lanes to block, never all three, so there's always a gap
      const lanesFree = [0, 1, 2]
      const blockCount = g.speed > 6 ? 2 : 1
      const blocked = []
      for (let i = 0; i < blockCount; i++) {
        const idx = Math.floor(Math.random() * lanesFree.length)
        blocked.push(lanesFree.splice(idx, 1)[0])
      }
      for (const lane of blocked) {
        const kind = Math.random() < 0.7 ? 'kart' : 'barrel'
        const palette = ['#ff2fb9', '#00e5ff', '#ffe066', '#39ff88', '#ff8a3d']
        g.obstacles.push({
          lane,
          x: LANES[lane],
          y: -KART_H,
          w: kind === 'kart' ? KART_W : 26,
          h: kind === 'kart' ? KART_H : 30,
          kind,
          color: palette[Math.floor(Math.random() * palette.length)],
        })
      }
    }

    const update = () => {
      const g = gameRef.current
      if (!g || g.phase !== 'play') return

      g.speed = Math.min(MAX_SPEED, g.speed + ACCEL)
      g.dist += g.speed
      g.scroll = (g.scroll + g.speed) % 40

      // steering: pointer sets targetX directly; keys nudge it
      if (g.steer !== 0) g.targetX = clamp(g.targetX + g.steer * 5.5, ROAD_L + KART_W / 2, ROAD_R - KART_W / 2)
      g.kartX += (g.targetX - g.kartX) * 0.25 // smooth follow

      // obstacles
      g.spawnTimer -= 1
      if (g.spawnTimer <= 0) {
        spawn(g)
        // spawn interval tightens as speed rises, but stays dodgeable
        g.spawnTimer = clamp(Math.round(60 - g.speed * 4), 16, 60)
      }
      for (const o of g.obstacles) o.y += g.speed + (o.kind === 'kart' ? 1.2 : 0) // rival karts drift a touch faster
      g.obstacles = g.obstacles.filter((o) => o.y < H + 40)

      // collision (shrunk hitboxes for fairness)
      const px = g.kartX, py = PLAYER_Y
      const pad = 5
      for (const o of g.obstacles) {
        if (
          Math.abs(px - o.x) < (KART_W + o.w) / 2 - pad &&
          Math.abs(py - o.y) < (KART_H + o.h) / 2 - pad
        ) {
          g.phase = 'over'
          const finalM = Math.floor(g.dist / 10)
          setScore(finalM)
          setOver(true)
          if (finalM > best) {
            setBest(finalM)
            try { localStorage.setItem(BEST_KEY, String(finalM)) } catch { /* ignore */ }
          }
          return
        }
      }

      if (Math.floor(g.dist / 10) !== score) setScore(Math.floor(g.dist / 10))
    }

    // --- drawing ---
    const drawKart = (cx, cy, w, h, body, facing) => {
      // facing: 1 = pointing up (player), -1 = pointing down (oncoming rival)
      const hw = w / 2, hh = h / 2
      ctx.save()
      ctx.translate(cx, cy)
      ctx.scale(1, facing)
      // shadow
      ctx.fillStyle = 'rgba(0,0,0,0.35)'
      ctx.beginPath(); ctx.ellipse(0, hh - 2, hw + 2, 6, 0, 0, Math.PI * 2); ctx.fill()
      // wheels
      ctx.fillStyle = '#0c0f16'
      const wheel = (x, y) => { ctx.beginPath(); ctx.roundRect(x - 5, y - 8, 10, 16, 3); ctx.fill() }
      wheel(-hw + 2, -hh + 12); wheel(hw - 2, -hh + 12)
      wheel(-hw + 2, hh - 12); wheel(hw - 2, hh - 12)
      // chassis
      ctx.fillStyle = body
      ctx.beginPath(); ctx.roundRect(-hw + 4, -hh + 6, w - 8, h - 12, 6); ctx.fill()
      // nose (front, narrower)
      ctx.beginPath(); ctx.moveTo(-hw + 9, -hh + 8); ctx.lineTo(hw - 9, -hh + 8); ctx.lineTo(hw - 13, -hh + 1); ctx.lineTo(-hw + 13, -hh + 1); ctx.closePath(); ctx.fill()
      // cockpit
      ctx.fillStyle = '#0e1320'
      ctx.beginPath(); ctx.roundRect(-hw + 9, -6, w - 18, 18, 4); ctx.fill()
      // driver helmet
      ctx.fillStyle = facing > 0 ? '#ffe066' : '#e6ecff'
      ctx.beginPath(); ctx.arc(0, 0, 6, 0, Math.PI * 2); ctx.fill()
      ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(-5, -2, 10, 3) // visor
      // headlights hint at the front
      ctx.fillStyle = 'rgba(255,255,255,0.8)'
      ctx.fillRect(-hw + 7, -hh + 2, 4, 2); ctx.fillRect(hw - 11, -hh + 2, 4, 2)
      ctx.restore()
    }

    const drawBarrel = (cx, cy, w, h, color) => {
      ctx.fillStyle = 'rgba(0,0,0,0.35)'
      ctx.beginPath(); ctx.ellipse(cx, cy + h / 2 - 1, w / 2 + 2, 5, 0, 0, Math.PI * 2); ctx.fill()
      ctx.fillStyle = color
      ctx.beginPath(); ctx.roundRect(cx - w / 2, cy - h / 2, w, h, 5); ctx.fill()
      ctx.fillStyle = 'rgba(255,255,255,0.85)'
      ctx.fillRect(cx - w / 2, cy - h / 2 + 6, w, 4)
      ctx.fillRect(cx - w / 2, cy + h / 2 - 10, w, 4)
    }

    const draw = () => {
      const g = gameRef.current
      // grass / verge
      ctx.fillStyle = '#0a1a12'
      ctx.fillRect(0, 0, W, H)
      // road
      ctx.fillStyle = '#14161f'
      ctx.fillRect(ROAD_L, 0, ROAD_R - ROAD_L, H)
      // neon curbs (scrolling dashes down each edge)
      for (let y = -40 + (g.scroll % 40); y < H; y += 40) {
        ctx.fillStyle = (Math.floor((y + g.scroll) / 40) % 2 === 0) ? '#ff2fb9' : '#f2f2f2'
        ctx.fillRect(ROAD_L - 6, y, 6, 20)
        ctx.fillStyle = (Math.floor((y + g.scroll) / 40) % 2 === 0) ? '#00e5ff' : '#f2f2f2'
        ctx.fillRect(ROAD_R, y, 6, 20)
      }
      // dashed lane lines
      ctx.fillStyle = 'rgba(255,255,255,0.5)'
      for (const lx of [124, 196]) {
        for (let y = -40 + (g.scroll % 40); y < H; y += 40) ctx.fillRect(lx - 2, y, 4, 22)
      }

      // obstacles
      for (const o of g.obstacles) {
        if (o.kind === 'kart') drawKart(o.x, o.y, o.w, o.h, o.color, -1)
        else drawBarrel(o.x, o.y, o.w, o.h, o.color)
      }
      // player kart
      drawKart(g.kartX, PLAYER_Y, KART_W, KART_H, '#ff5a1f', 1)

      // speed streaks near the top for a sense of pace
      ctx.strokeStyle = 'rgba(255,255,255,0.10)'
      ctx.lineWidth = 2
      for (let i = 0; i < 4; i++) {
        const sx = ROAD_L + 20 + i * 55
        const sy = (g.scroll * 4 + i * 90) % H
        ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx, sy + 18); ctx.stroke()
      }
    }

    const loop = () => {
      update()
      draw()
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)

    return () => {
      cancelAnimationFrame(raf)
      canvas.removeEventListener('pointermove', onMove)
      canvas.removeEventListener('touchmove', onMove)
      window.removeEventListener('keydown', kd)
      window.removeEventListener('keyup', ku)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
      <div className="glass-panel w-[380px] border-4 border-cyan-400 bg-[#0a0f1c] p-5 text-center font-mono text-white">
        <p className="mb-0.5 text-[10px] uppercase tracking-[0.3em] text-pink-400">Game Center</p>
        <h2 className="mb-1 text-xl font-bold tracking-widest text-cyan-300" style={{ textShadow: '0 0 10px #00e5ff' }}>
          🏎️ TURBO RACER
        </h2>
        <p className="mb-3 text-[10px] text-gray-400">ゲームセンター</p>

        <div className="mb-3 flex items-center justify-center gap-5 text-sm font-bold">
          <span className="text-yellow-300">{score} m</span>
          <span className="text-gray-500 text-[11px]">BEST {best} m</span>
        </div>

        <div className="relative mx-auto" style={{ width: W }}>
          <canvas
            ref={canvasRef}
            width={W}
            height={H}
            className="block w-full touch-none rounded"
            style={{ background: '#0a1a12', maxWidth: '100%', cursor: 'none' }}
          />
          {over && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded bg-black/75">
              <p className="text-3xl font-bold text-pink-400" style={{ textShadow: '0 0 10px #ff2fb9' }}>CRASH!</p>
              <p className="text-sm text-yellow-200">{score} m{score >= best && score > 0 ? ' · NEW BEST!' : ''}</p>
              <button
                onClick={resetGame}
                className="border-2 border-cyan-400 px-4 py-1.5 text-sm font-bold text-cyan-200 hover:bg-cyan-400/10"
              >
                Race Again
              </button>
            </div>
          )}
        </div>

        <p className="mt-3 text-[10px] text-gray-500">Steer with the mouse or ← → / A D · dodge the traffic · the road speeds up.</p>

        <button
          onClick={onClose}
          className="mt-3 w-full border-2 border-gray-500 py-2 text-sm font-bold hover:bg-white/10"
        >
          Step Away from the Cabinet
        </button>
      </div>
    </div>
  )
}
