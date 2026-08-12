import { useEffect, useRef, useState } from 'react'

// A self-contained, playable air-hockey minigame launched by the Pixel Palace
// Arcade's air-hockey table (OverworldScene's airHockey zone -> WorldScreen's
// 'arcadeGame' branch). Purely for fun - no cash/reputation stakes. Mouse (or
// touch) drives the bottom mallet; an easy bot defends the top. First to 3.
//
// The whole game lives in one <canvas> driven by requestAnimationFrame; React
// state is only used for the header score and the win/lose overlay, so the
// physics loop never fights React re-renders. onClose matches every other
// overworld modal (WorldScreen.closeModal -> emits 'resumeScene').

const W = 320
const H = 480
const WIN_SCORE = 3
const GOAL_W = 120
const PUCK_R = 10
const MALLET_R = 22
const MAX_PUCK = 7.6 // top speed - a touch slower than before for control
const BOT_SPEED = 2.3 // easy: a slow, beatable defender
const RESTITUTION = 0.9 // <1 = a natural, non-springy bounce off a mallet
const MAX_MALLET_V = 15 // cap the mallet speed the puck can "feel" so a fast
// mouse flick imparts a firm hit, not a chaotic launch
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v)

export default function AirHockeyModal({ onClose }) {
  const canvasRef = useRef(null)
  const gameRef = useRef(null)
  const [scoreP, setScoreP] = useState(0)
  const [scoreB, setScoreB] = useState(0)
  const [over, setOver] = useState(null) // null | 'win' | 'lose'

  // Build (or rebuild) the game state.
  const newGame = () => ({
    puck: { x: W / 2, y: H / 2, vx: 0, vy: 0 },
    player: { x: W / 2, y: H - 70, vx: 0, vy: 0 },
    bot: { x: W / 2, y: 70, vx: 0, vy: 0 },
    pointer: { x: W / 2, y: H - 70 },
    sp: 0,
    sb: 0,
    stuck: 0, // frames the puck has been near-motionless (anti-deadlock)
    botHalf: 0, // frames the puck has camped on the bot's half (anti-camp)
    phase: 'serve', // 'serve' | 'play' | 'over'
    serveTimer: 60,
    serveTo: 'player', // who the puck drifts toward after the countdown
  })

  const resetGame = () => {
    gameRef.current = newGame()
    setScoreP(0)
    setScoreB(0)
    setOver(null)
  }

  useEffect(() => {
    gameRef.current = newGame()
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    let raf

    const toLocal = (clientX, clientY) => {
      const r = canvas.getBoundingClientRect()
      return {
        x: ((clientX - r.left) / r.width) * W,
        y: ((clientY - r.top) / r.height) * H,
      }
    }
    const onMove = (e) => {
      const p = e.touches ? e.touches[0] : e
      const { x, y } = toLocal(p.clientX, p.clientY)
      gameRef.current.pointer = { x, y }
      if (e.cancelable) e.preventDefault()
    }
    canvas.addEventListener('pointermove', onMove)
    canvas.addEventListener('touchmove', onMove, { passive: false })

    const serveAfterGoal = (g, scoredOn) => {
      g.puck.x = W / 2
      g.puck.y = H / 2
      g.puck.vx = 0
      g.puck.vy = 0
      g.phase = 'serve'
      g.serveTimer = 45
      g.serveTo = scoredOn // puck will drift toward whoever just conceded
    }

    // Smooth puck<->mallet response. Works in the mallet's frame of reference
    // (relative velocity along the contact normal) so a moving paddle imparts
    // its momentum naturally, instead of the old "reflect + bolt-on velocity"
    // that could fling the puck erratically. `mvx/mvy` are the mallet's
    // already-clamped velocities.
    const resolveMallet = (g, m, mvx, mvy) => {
      const dx = g.puck.x - m.x
      const dy = g.puck.y - m.y
      let d = Math.hypot(dx, dy)
      const min = PUCK_R + MALLET_R
      if (d >= min) return
      if (d === 0) d = 0.01
      const nx = dx / d
      const ny = dy / d
      // rest the puck exactly on the mallet's surface (no overlap jitter)
      g.puck.x = m.x + nx * min
      g.puck.y = m.y + ny * min
      // elastic bounce only if the puck is actually moving into the mallet
      const relN = (g.puck.vx - mvx) * nx + (g.puck.vy - mvy) * ny
      if (relN < 0) {
        const j = -(1 + RESTITUTION) * relN
        g.puck.vx += j * nx
        g.puck.vy += j * ny
      }
      // never let it die flush against the paddle
      const outN = g.puck.vx * nx + g.puck.vy * ny
      if (outN < 1.4) {
        g.puck.vx += nx * (1.4 - outN)
        g.puck.vy += ny * (1.4 - outN)
      }
    }

    const update = () => {
      const g = gameRef.current
      if (!g) return

      // --- player mallet follows the pointer, clamped to the bottom half ---
      const px = clamp(g.pointer.x, MALLET_R, W - MALLET_R)
      const py = clamp(g.pointer.y, H / 2 + MALLET_R, H - MALLET_R)
      g.player.vx = px - g.player.x
      g.player.vy = py - g.player.y
      g.player.x = px
      g.player.y = py

      // --- easy bot: a goalie. It holds a line near its own goal and slides
      // to track the puck's x. It only lunges to clear the puck when the puck
      // is in a safe "strike zone" (well inside its half but NOT jammed into a
      // corner). Because it never chases into the corners, it can't pin the
      // puck against a wall the way the old chase-the-puck bot did.
      const homeY = H * 0.15
      const inCorner = g.puck.y < H * 0.24 && (g.puck.x < W * 0.18 || g.puck.x > W * 0.82)
      let tx = clamp(g.puck.x, MALLET_R + 4, W - MALLET_R - 4)
      let ty = homeY
      if (!inCorner && g.puck.y > H * 0.2 && g.puck.y < H * 0.48) {
        // strike: slip just behind the puck (goal side) and push it back down
        ty = clamp(g.puck.y - MALLET_R, homeY, H / 2 - MALLET_R - 4)
      } else if (inCorner) {
        // never follow the puck into the corner - guard the goal mouth instead
        tx = clamp(g.puck.x, W * 0.32, W * 0.68)
        ty = homeY
      }
      const bdx = tx - g.bot.x
      const bdy = ty - g.bot.y
      const bd = Math.hypot(bdx, bdy) || 1
      const step = Math.min(BOT_SPEED, bd)
      g.bot.vx = (bdx / bd) * step
      g.bot.vy = (bdy / bd) * step
      g.bot.x = clamp(g.bot.x + g.bot.vx, MALLET_R, W - MALLET_R)
      g.bot.y = clamp(g.bot.y + g.bot.vy, MALLET_R, H / 2 - MALLET_R)

      if (g.phase === 'serve') {
        g.serveTimer -= 1
        if (g.serveTimer <= 0) {
          g.phase = 'play'
          const dir = g.serveTo === 'player' ? 1 : -1
          g.puck.vx = (Math.random() - 0.5) * 3
          g.puck.vy = dir * 3.2
        }
        return
      }
      if (g.phase !== 'play') return

      // Clamp the mallet velocities the puck is allowed to feel, so a fast
      // mouse flick gives a firm-but-controlled hit rather than a chaotic one.
      const pmvx = clamp(g.player.vx, -MAX_MALLET_V, MAX_MALLET_V)
      const pmvy = clamp(g.player.vy, -MAX_MALLET_V, MAX_MALLET_V)
      const bmvx = clamp(g.bot.vx, -MAX_MALLET_V, MAX_MALLET_V)
      const bmvy = clamp(g.bot.vy, -MAX_MALLET_V, MAX_MALLET_V)

      // light table friction, applied once per frame
      g.puck.vx *= 0.998
      g.puck.vy *= 0.998

      // --- continuous (sub-stepped) integration ---
      // Advance the puck in steps no bigger than ~half its radius so it can
      // never tunnel through a mallet or wall in a single frame - that
      // tunneling was the source of the "weird"/warpy hits. Walls and both
      // mallets are resolved every sub-step.
      const speed0 = Math.hypot(g.puck.vx, g.puck.vy)
      const steps = Math.max(1, Math.min(8, Math.ceil(speed0 / (PUCK_R * 0.6))))
      let scored = null
      for (let i = 0; i < steps; i++) {
        g.puck.x += g.puck.vx / steps
        g.puck.y += g.puck.vy / steps

        if (g.puck.x - PUCK_R < 0) {
          g.puck.x = PUCK_R
          g.puck.vx = Math.abs(g.puck.vx)
        } else if (g.puck.x + PUCK_R > W) {
          g.puck.x = W - PUCK_R
          g.puck.vx = -Math.abs(g.puck.vx)
        }

        if (g.puck.y - PUCK_R < 0) {
          if (Math.abs(g.puck.x - W / 2) < GOAL_W / 2) { scored = 'player'; break }
          g.puck.y = PUCK_R
          g.puck.vy = Math.abs(g.puck.vy)
        }
        if (g.puck.y + PUCK_R > H) {
          if (Math.abs(g.puck.x - W / 2) < GOAL_W / 2) { scored = 'bot'; break }
          g.puck.y = H - PUCK_R
          g.puck.vy = -Math.abs(g.puck.vy)
        }

        resolveMallet(g, g.player, pmvx, pmvy)
        resolveMallet(g, g.bot, bmvx, bmvy)
      }

      if (scored === 'player') {
        g.sp += 1
        setScoreP(g.sp)
        if (g.sp >= WIN_SCORE) { g.phase = 'over'; setOver('win') } else serveAfterGoal(g, 'bot')
        return
      }
      if (scored === 'bot') {
        g.sb += 1
        setScoreB(g.sb)
        if (g.sb >= WIN_SCORE) { g.phase = 'over'; setOver('lose') } else serveAfterGoal(g, 'player')
        return
      }

      const sp = Math.hypot(g.puck.vx, g.puck.vy)
      if (sp > MAX_PUCK) {
        g.puck.vx *= MAX_PUCK / sp
        g.puck.vy *= MAX_PUCK / sp
      }

      // Anti-deadlock: if the puck loses its pace (a slow puck loitering in a
      // corner) for ~0.35s, roll it off toward centre so play resumes. Fires
      // faster now that the goalie bot no longer keeps corner pucks jittering.
      if (sp < 1.2) g.stuck += 1
      else g.stuck = 0
      if (g.stuck > 20) {
        const towardCenterX = (W / 2 - g.puck.x) * 0.05
        // bias downward so a freed puck heads back into open play, not the wall
        g.puck.vx = towardCenterX + (Math.random() - 0.5) * 1.5
        g.puck.vy = g.puck.y < H / 2 ? 3.4 : -3.4
        g.stuck = 0
      }

      // Anti-camp: the easy bot can trap the puck against its own wall with
      // just enough residual motion to dodge the speed check above. If the
      // puck stays on the bot's half for ~2.5s, punt it back to the player so
      // rallies actually happen.
      if (g.puck.y < H / 2) g.botHalf += 1
      else g.botHalf = 0
      if (g.botHalf > 90) {
        g.puck.vx = (W / 2 - g.puck.x) * 0.03 + (Math.random() - 0.5) * 2
        g.puck.vy = 5 // downward, toward the player
        g.botHalf = 0
      }
    }

    const draw = () => {
      const g = gameRef.current
      ctx.clearRect(0, 0, W, H)
      // playfield
      ctx.fillStyle = '#0e1b33'
      ctx.fillRect(0, 0, W, H)
      // neon border
      ctx.strokeStyle = '#00e5ff'
      ctx.lineWidth = 3
      ctx.strokeRect(2, 2, W - 4, H - 4)
      // centre line + circle
      ctx.strokeStyle = 'rgba(0,229,255,0.55)'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(0, H / 2)
      ctx.lineTo(W, H / 2)
      ctx.stroke()
      ctx.beginPath()
      ctx.arc(W / 2, H / 2, 46, 0, Math.PI * 2)
      ctx.stroke()
      // goal mouths
      ctx.fillStyle = 'rgba(0,229,255,0.9)'
      ctx.fillRect(W / 2 - GOAL_W / 2, 0, GOAL_W, 5)
      ctx.fillStyle = 'rgba(255,47,185,0.9)'
      ctx.fillRect(W / 2 - GOAL_W / 2, H - 5, GOAL_W, 5)

      // puck
      ctx.beginPath()
      ctx.arc(g.puck.x, g.puck.y, PUCK_R, 0, Math.PI * 2)
      ctx.fillStyle = '#ffe066'
      ctx.shadowColor = '#ffe066'
      ctx.shadowBlur = 12
      ctx.fill()
      ctx.shadowBlur = 0

      // mallets (bot cyan on top, player magenta on bottom)
      const mallet = (m, color) => {
        ctx.beginPath()
        ctx.arc(m.x, m.y, MALLET_R, 0, Math.PI * 2)
        ctx.fillStyle = color
        ctx.shadowColor = color
        ctx.shadowBlur = 14
        ctx.fill()
        ctx.shadowBlur = 0
        ctx.beginPath()
        ctx.arc(m.x, m.y, MALLET_R * 0.55, 0, Math.PI * 2)
        ctx.fillStyle = '#0e1b33'
        ctx.fill()
      }
      mallet(g.bot, '#00e5ff')
      mallet(g.player, '#ff2fb9')

      // serve countdown flash
      if (g.phase === 'serve') {
        ctx.fillStyle = 'rgba(255,255,255,0.85)'
        ctx.font = 'bold 34px monospace'
        ctx.textAlign = 'center'
        ctx.fillText(String(Math.ceil(g.serveTimer / 15)), W / 2, H / 2 - 60)
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
    }
  }, [])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
      <div className="glass-panel w-[380px] border-4 border-cyan-400 bg-[#0a0f1c] p-5 text-center font-mono text-white">
        <p className="mb-0.5 text-[10px] uppercase tracking-[0.3em] text-pink-400">Game Center</p>
        <h2 className="mb-1 text-xl font-bold tracking-widest text-cyan-300" style={{ textShadow: '0 0 10px #00e5ff' }}>
          🏒 AIR HOCKEY
        </h2>
        <p className="mb-3 text-[10px] text-gray-400">Easy Bot · First to {WIN_SCORE}</p>

        <div className="mb-3 flex items-center justify-center gap-4 text-sm font-bold">
          <span className="text-pink-300">YOU {scoreP}</span>
          <span className="text-gray-600">:</span>
          <span className="text-cyan-300">{scoreB} BOT</span>
        </div>

        <div className="relative mx-auto" style={{ width: W }}>
          <canvas
            ref={canvasRef}
            width={W}
            height={H}
            className="block w-full touch-none rounded"
            style={{ background: '#0e1b33', maxWidth: '100%', cursor: 'none' }}
          />
          {over && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded bg-black/75">
              <p className="text-2xl font-bold" style={{ color: over === 'win' ? '#ffe066' : '#ff6ad5' }}>
                {over === 'win' ? '🏆 YOU WIN!' : 'BOT WINS'}
              </p>
              <button
                onClick={resetGame}
                className="border-2 border-cyan-400 px-4 py-1.5 text-sm font-bold text-cyan-200 hover:bg-cyan-400/10"
              >
                Play Again
              </button>
            </div>
          )}
        </div>

        <p className="mt-3 text-[10px] text-gray-500">Move your paddle with the mouse — guard the pink goal, sink the cyan one.</p>

        <button
          onClick={onClose}
          className="mt-3 w-full border-2 border-gray-500 py-2 text-sm font-bold hover:bg-white/10"
        >
          Leave the Table
        </button>
      </div>
    </div>
  )
}
