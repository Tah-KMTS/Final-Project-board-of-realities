import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useGameStore } from '../../store/useGameStore'
import {
  playGunshotSound, playHitSound, playTakeDamageSound,
  playSmashSound, playVictorySound, playDefeatSound,
} from '../../audio/sfx'
import {
  VIEW_W, VIEW_H, TILE, SHEETS, IMAGES, ENEMY_ANIM, BALANCE as B, LEVELS,
} from './runAndGunLevels'
import { createGame, step, playerAnimFrame, PLAYER, clamp } from './runAndGunEngine'

// The engine is DOM-free and takes its sound as an injected bag (see its own
// header); this is where the real effects get plugged in.
const SFX = {
  shoot: playGunshotSound,
  hit: playHitSound,
  hurt: playTakeDamageSound,
  die: playDefeatSound,
  boom: playSmashSound,
  win: playVictorySound,
}

// "Third Rail" - a 2-level run-and-gun cabinet for the Pixel Palace Arcade,
// built on the vacaroxa Generic Run n Gun art pack.
//
// Three files: runAndGunLevels.js is the level data and all tuning,
// runAndGunEngine.js is the DOM-free simulation, and this is the shell -
// asset loading, canvas rendering, keyboard input and the payout.
//
// One <canvas> driven by requestAnimationFrame, exactly like AirHockeyModal.jsx
// and TurboRacerModal.jsx - deliberately NOT Phaser. Phaser in this codebase is
// reserved for the persistent overworld map (src/game/), a rule
// CrimeAlleyHeistModal.jsx states outright and every arcade minigame so far has
// followed. React state here holds only what the HUD and the end-of-run
// overlays display, so the simulation never re-renders the component.
//
// createPortal to document.body for the same reason FerrumWingsModal.jsx does
// it: this can be launched from ArcadeModal while that is embedded in
// CasinoModal's Arcade tab, whose `.glass-panel` sets backdrop-filter - which
// per spec makes it the containing block for fixed-position descendants, so an
// un-portalled `fixed inset-0` would pin itself to that scrolling panel
// instead of the viewport.
//
// Money: ArcadeModal charges the entry fee before mounting this (the "pay to
// start" convention every minigame here uses); this credits the score-scaled
// payout itself when a run ends, matching FerrumWingsModal.jsx's split.

// The simulation runs at a fixed 60Hz step and never scales by real dt, so a
// slow frame makes the game briefly slow rather than teleporting bodies
// through walls - the usual trade, and the right one for a game whose
// collision is swept only along one axis at a time.
const STEP_MS = 1000 / 60
// If the tab is backgrounded, rAF stops; on return the accumulated time would
// otherwise be replayed as hundreds of catch-up steps at once. Cap it.
const MAX_STEPS_PER_FRAME = 5

// --- asset loading ---------------------------------------------------------
function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    // Surfaced to the player as a load failure rather than silently drawing
    // nothing - a missing tile here would otherwise read as an invisible
    // floor you fall straight through.
    img.onerror = () => reject(new Error(`failed to load ${url}`))
    img.src = url
  })
}

async function loadAssets() {
  const sheetEntries = Object.entries(SHEETS)
  const imageEntries = Object.entries(IMAGES)
  const [sheetImgs, imageImgs] = await Promise.all([
    Promise.all(sheetEntries.map(([, s]) => loadImage(s.url))),
    Promise.all(imageEntries.map(([, url]) => loadImage(url))),
  ])
  const sheets = {}
  sheetEntries.forEach(([key, spec], i) => { sheets[key] = { ...spec, img: sheetImgs[i] } })
  const images = {}
  imageEntries.forEach(([key], i) => { images[key] = imageImgs[i] })
  return { sheets, images }
}


// --- rendering -------------------------------------------------------------
function drawSheetFrame(ctx, sheet, frame, dx, dy, flip, scale = 1) {
  const col = frame % sheet.cols
  const row = Math.floor(frame / sheet.cols)
  const sw = sheet.fw
  const sh = sheet.fh
  const dw = sw * scale
  const dh = sh * scale
  ctx.save()
  if (flip) {
    ctx.translate(Math.round(dx + dw), Math.round(dy))
    ctx.scale(-1, 1)
    ctx.drawImage(sheet.img, col * sw, row * sh, sw, sh, 0, 0, dw, dh)
  } else {
    ctx.drawImage(sheet.img, col * sw, row * sh, sw, sh, Math.round(dx), Math.round(dy), dw, dh)
  }
  ctx.restore()
}

function drawParallax(ctx, assets, g) {
  const { def } = g.level
  for (const layer of def.bg) {
    const img = assets.images[layer.key]
    if (!img) continue
    const offset = -(g.cam * layer.factor) % img.width
    // Two copies side by side is enough to cover the viewport at any offset
    // because every backdrop in this pack is at least as wide as VIEW_W.
    for (let x = offset - img.width; x < VIEW_W; x += img.width) {
      ctx.drawImage(img, Math.round(x), layer.y)
    }
  }
}

function drawSolids(ctx, assets, g) {
  const fill = assets.images[g.level.def.fill]
  const cap = assets.images[g.level.def.cap]
  for (const s of g.level.solids) {
    const sx = s.x - g.cam
    if (sx > VIEW_W || sx + s.w < 0) continue
    // Fill the whole rect, then lay the cap over its top row. Drawing fill
    // under the cap (rather than skipping the top row) is what lets a cap
    // tile have transparent pixels - see process_run_n_gun.py's note.
    for (let y = 0; y < s.h; y += TILE) {
      for (let x = 0; x < s.w; x += TILE) {
        ctx.drawImage(fill, Math.round(sx + x), Math.round(s.y + y))
      }
    }
    for (let x = 0; x < s.w; x += TILE) {
      ctx.drawImage(cap, Math.round(sx + x), Math.round(s.y))
    }
  }
}

function drawProps(ctx, assets, g) {
  for (const pr of g.level.props) {
    const img = assets.images[pr.key]
    if (!img) continue
    const x = pr.c * TILE - g.cam
    if (x > VIEW_W || x + img.width < 0) continue
    // Props are anchored by their BOTTOM on the given row, so a tall prop
    // and a short one placed on the same row both sit on the same line.
    ctx.drawImage(img, Math.round(x), Math.round((pr.r + 1) * TILE - img.height))
  }
}

function drawEnemies(ctx, assets, g) {
  for (const en of g.level.enemies) {
    const sheet = assets.sheets[en.type]
    const anim = ENEMY_ANIM[en.type]
    const x = en.x - g.cam
    if (x > VIEW_W + 80 || x + en.w < -80) continue

    let frame
    if (en.dying > 0) {
      frame = anim.death[Math.min(anim.death.length - 1, Math.floor(en.dying / 8))]
    } else if (en.type === 'sniper' && en.telegraph > 0) {
      // Flash between aim and fire frames as the wind-up completes - this
      // IS the tell the player is meant to react to, so it has to be visible.
      frame = en.telegraph < 14 && Math.floor(en.anim / 4) % 2 ? anim.shoot[0] : anim.idle[0]
    } else if (en.type === 'rpg' && en.cool > B.RPG_FIRE_EVERY - 24) {
      frame = anim.shoot[Math.min(anim.shoot.length - 1, Math.floor((B.RPG_FIRE_EVERY - en.cool) / 6))]
    } else if (en.type === 'ar' && Math.abs(en.vx) > 0.01) {
      frame = anim.walk[Math.floor(en.anim / 5) % anim.walk.length]
    } else {
      frame = anim.idle[Math.floor(en.anim / 12) % anim.idle.length]
    }

    // Body is narrower than the frame, so centre the art on it.
    // Every sprite in this pack is drawn facing RIGHT (verified by locating
    // the muzzle flash relative to the body centroid on each sheet), so the
    // flip is for facing LEFT - same convention as drawPlayer below. Getting
    // this backwards renders every enemy shooting over its own shoulder.
    const dw = sheet.fw * en.scale
    const dx = en.x + en.w / 2 - dw / 2 - g.cam
    const dy = en.y + en.h - en.foot * en.scale
    drawSheetFrame(ctx, sheet, frame, dx, dy, en.face < 0, en.scale)
  }
}

function drawPlayer(ctx, assets, g, input, firing) {
  const p = g.player
  // Blink through invulnerability so the state is legible.
  if (p.iframes > 0 && p.dead === 0 && Math.floor(p.iframes / 4) % 2) return
  const spec = playerAnimFrame(p, input, firing)
  const usePose = typeof spec === 'object' && spec !== null
  const sheet = usePose ? assets.sheets.playerPose : assets.sheets.player
  const frame = usePose ? spec.pose : spec
  const dx = p.x + p.w / 2 - sheet.fw / 2 - g.cam
  const dy = p.y + p.h - PLAYER.foot
  drawSheetFrame(ctx, sheet, frame, dx, dy, p.face < 0)
}

function drawBullets(ctx, assets, g) {
  for (const b of g.bullets) {
    const x = b.x - g.cam
    if (x < -20 || x > VIEW_W + 20) continue
    if (b.sprite) {
      const sheet = assets.sheets[b.sprite.sheet]
      drawSheetFrame(ctx, sheet, b.sprite.frame, x - sheet.fw / 2, b.y - sheet.fh / 2, b.vx < 0)
    } else {
      // The player's own rifle round has no sprite in the pack, so it's a
      // drawn tracer - deliberately bright, since it has to stay readable
      // against both the near-black subway and the busy orange sky.
      ctx.fillStyle = '#ffe27a'
      ctx.fillRect(Math.round(x), Math.round(b.y), b.w, b.h)
      ctx.fillStyle = 'rgba(255,180,60,0.55)'
      ctx.fillRect(Math.round(x - b.vx), Math.round(b.y - b.vy), b.w, b.h)
    }
  }
}

function drawBooms(ctx, assets, g) {
  const sheet = assets.sheets.boom
  for (const x of g.booms) {
    const frame = Math.min(sheet.cols - 1, Math.floor(x.t / 3))
    const dw = sheet.fw * x.scale
    drawSheetFrame(ctx, sheet, frame, x.x - dw / 2 - g.cam, x.y - (sheet.fh * x.scale) / 2, false, x.scale)
  }
}

function render(ctx, assets, g, input, firing) {
  ctx.clearRect(0, 0, VIEW_W, VIEW_H)
  ctx.fillStyle = g.level.def.id === 'subway' ? '#0d1310' : '#2b1b1f'
  ctx.fillRect(0, 0, VIEW_W, VIEW_H)
  drawParallax(ctx, assets, g)
  drawProps(ctx, assets, g)
  drawSolids(ctx, assets, g)
  drawEnemies(ctx, assets, g)
  drawBullets(ctx, assets, g)
  drawPlayer(ctx, assets, g, input, firing)
  drawBooms(ctx, assets, g)

  // Boss health bar, drawn in-canvas rather than in the React HUD because it
  // should only exist while the boss is actually on screen.
  const boss = g.level.enemies.find((en) => en.boss && en.dying === 0)
  if (boss && boss.x - g.cam < VIEW_W) {
    const w = VIEW_W - 80
    ctx.fillStyle = 'rgba(0,0,0,0.6)'
    ctx.fillRect(40, 12, w, 8)
    ctx.fillStyle = '#e8483f'
    ctx.fillRect(41, 13, (w - 2) * Math.max(0, boss.hp / boss.maxHp), 6)
    ctx.strokeStyle = '#ffb703'
    ctx.lineWidth = 1
    ctx.strokeRect(40.5, 12.5, w - 1, 7)
  }
}

// --- component -------------------------------------------------------------
const KEY_MAP = {
  ArrowLeft: 'left', KeyA: 'left',
  ArrowRight: 'right', KeyD: 'right',
  ArrowUp: 'up', KeyW: 'up',
  ArrowDown: 'down', KeyS: 'down',
  Space: 'jump', KeyJ: 'fire', KeyZ: 'fire', KeyX: 'jump',
}

// Payout, credited here rather than by the caller - the same split
// FerrumWingsModal.jsx uses: ArcadeModal.jsx charges the entry fee up front,
// and the cabinet itself pays out once it knows how the run went.
//
// SCORE_RATE is deliberately NOT FerrumWings' 0.08. That rate is calibrated
// to that game's own score scale; this cabinet's maximum realistic run is
// about 9,000 points (every enemy on both levels, both clear bonuses, both
// no-damage bonuses), so reusing 0.08 would pay a perfect run ~720. At 0.12 a
// flawless full clear lands ~1,330, just under the cap, and a partial run
// that dies in sector 2 pays a few hundred - real partial credit without
// making a bail-out as good as finishing.
const SCORE_RATE = 0.12
const VICTORY_BONUS = 250
const MAX_PAYOUT = 1400

function computePayout(score, outcome) {
  const base = Math.max(0, score) * SCORE_RATE + (outcome === 'victory' ? VICTORY_BONUS : 0)
  return Math.round(clamp(base, 0, MAX_PAYOUT))
}

export default function RunAndGunModal({ onClose }) {
  const canvasRef = useRef(null)
  const gameRef = useRef(null)
  const assetsRef = useRef(null)
  const inputRef = useRef({ left: false, right: false, up: false, down: false, jump: false, fire: false })
  const reportedRef = useRef(false)

  const addCash = useGameStore((s) => s.addCash)
  const [status, setStatus] = useState('loading') // 'loading' | 'error' | 'title' | 'play' | 'over' | 'won'
  const [hud, setHud] = useState({ hp: B.PLAYER_HP, lives: B.PLAYER_LIVES, score: 0, level: 1 })
  const [finalScore, setFinalScore] = useState(0)
  const [payout, setPayout] = useState(0)

  // Pay out exactly once per mount. The Start button only appears on the
  // title screen of a fresh mount, so a player wanting another run has to
  // close and relaunch - which charges another entry fee. Without this
  // guard a single fee could be turned into repeated payouts.
  const report = useCallback((outcome, score) => {
    if (reportedRef.current) return
    reportedRef.current = true
    const cash = computePayout(score, outcome)
    setPayout(cash)
    if (cash > 0) addCash(cash)
  }, [addCash])

  useEffect(() => {
    let cancelled = false
    loadAssets()
      .then((a) => { if (!cancelled) { assetsRef.current = a; setStatus('title') } })
      .catch((err) => {
        if (cancelled) return
        console.error('Third Rail failed to load its art pack:', err)
        setStatus('error')
      })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    const down = (ev) => {
      const slot = KEY_MAP[ev.code]
      if (!slot) return
      // Stop arrows/space from scrolling the page underneath the cabinet.
      ev.preventDefault()
      inputRef.current[slot] = true
    }
    const up = (ev) => {
      const slot = KEY_MAP[ev.code]
      if (!slot) return
      ev.preventDefault()
      inputRef.current[slot] = false
    }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
    }
  }, [])

  const startRun = () => {
    gameRef.current = createGame(0, null, SFX)
    reportedRef.current = false
    setHud({ hp: B.PLAYER_HP, lives: B.PLAYER_LIVES, score: 0, level: 1 })
    setStatus('play')
  }

  useEffect(() => {
    if (status !== 'play') return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    ctx.imageSmoothingEnabled = false

    let raf = 0
    let last = performance.now()
    let acc = 0

    const loop = (now) => {
      const g = gameRef.current
      const assets = assetsRef.current
      if (!g || !assets) return
      acc += now - last
      last = now
      let steps = 0
      while (acc >= STEP_MS && steps < MAX_STEPS_PER_FRAME) {
        acc -= STEP_MS
        steps += 1
        step(g, inputRef.current)

        if (g.phase === 'levelClear' && g.phaseTimer > 90) {
          const next = g.levelIndex + 1
          if (next < LEVELS.length) {
            gameRef.current = createGame(next, {
              hp: g.player.hp, lives: g.lives, score: g.score, tookDamage: false,
            }, SFX)
          } else {
            // Clearing the LAST level is a win. Today the last level ends in
            // a boss (which sets 'won' itself) so this is unreachable, but
            // without it, reordering the levels or dropping the boss would
            // strand the player on the level-clear screen with no way out
            // but the Leave button - and no payout.
            g.phase = 'won'
            g.phaseTimer = 0
          }
        }
      }
      if (acc > STEP_MS * MAX_STEPS_PER_FRAME) acc = 0

      const live = gameRef.current
      const firing = inputRef.current.fire && live.player.cool > B.FIRE_COOLDOWN - 5
      render(ctx, assets, live, inputRef.current, firing)

      setHud((h) => {
        const nx = { hp: live.player.hp, lives: live.lives, score: live.score, level: live.levelIndex + 1 }
        return (h.hp === nx.hp && h.lives === nx.lives && h.score === nx.score && h.level === nx.level) ? h : nx
      })

      if (live.phase === 'over' || live.phase === 'won') {
        setFinalScore(live.score)
        report(live.phase === 'won' ? 'victory' : 'defeat', live.score)
        setStatus(live.phase)
        return
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [status, report])

  const body = (
    <div className="flex h-full w-full flex-col items-center justify-center bg-black/95 p-3 font-mono">
      <div className="mb-2 flex w-full max-w-[992px] items-center justify-between text-xs">
        <span className="font-bold text-orange-300">THIRD RAIL</span>
        {status === 'play' && (
          <span className="flex gap-4 text-cyan-200">
            <span>SECTOR {hud.level}/{LEVELS.length}</span>
            <span className="text-red-300">{'♥'.repeat(Math.max(0, hud.hp))}</span>
            <span>LIVES {hud.lives}</span>
            <span className="text-yellow-200">{hud.score.toLocaleString()}</span>
          </span>
        )}
        <button onClick={onClose} className="border border-gray-600 px-2 py-1 text-gray-300 hover:bg-gray-700">
          Leave
        </button>
      </div>

      <div className="relative w-full max-w-[992px]" style={{ aspectRatio: `${VIEW_W} / ${VIEW_H}` }}>
        <canvas
          ref={canvasRef}
          width={VIEW_W}
          height={VIEW_H}
          className="h-full w-full border-2 border-orange-500/60 bg-black"
          style={{ imageRendering: 'pixelated' }}
        />

        {status !== 'play' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/85 text-center">
            {status === 'loading' && <p className="text-sm text-cyan-300">Loading cabinet...</p>}
            {status === 'error' && (
              <p className="max-w-sm px-4 text-sm text-red-400">
                This cabinet&apos;s art pack failed to load. Check the console for the exact file.
              </p>
            )}
            {status === 'title' && (
              <>
                <h2 className="mb-1 text-2xl font-bold text-orange-400">THIRD RAIL</h2>
                <p className="mb-4 text-xs text-gray-400">Two sectors. One rifle. Clear the surface.</p>
                <div className="mb-4 text-[11px] leading-relaxed text-gray-300">
                  <p>MOVE <span className="text-cyan-300">A/D</span> or <span className="text-cyan-300">arrows</span> &nbsp;|&nbsp; JUMP <span className="text-cyan-300">Space</span> &nbsp;|&nbsp; FIRE <span className="text-cyan-300">J</span></p>
                  <p className="mt-1">Hold <span className="text-cyan-300">Up</span> to aim high, <span className="text-cyan-300">Down</span> to crouch, <span className="text-cyan-300">Down</span> in the air to shoot beneath you.</p>
                </div>
                <button
                  onClick={startRun}
                  className="border-2 border-orange-400 px-6 py-2 text-sm font-bold text-orange-300 hover:bg-orange-400 hover:text-black"
                >
                  Start
                </button>
              </>
            )}
            {(status === 'over' || status === 'won') && (
              <>
                <h2 className={`mb-1 text-2xl font-bold ${status === 'won' ? 'text-emerald-400' : 'text-red-400'}`}>
                  {status === 'won' ? 'SURFACE CLEARED' : 'GAME OVER'}
                </h2>
                <p className="mb-1 text-sm text-yellow-200">Score {finalScore.toLocaleString()}</p>
                <p className="mb-4 text-sm font-bold text-emerald-300">Payout ${payout.toLocaleString()}</p>
                <p className="mb-4 max-w-xs px-4 text-[11px] text-gray-400">
                  Your cut has been credited. Another run costs a fresh token.
                </p>
                <button
                  onClick={onClose}
                  className="border-2 border-gray-400 px-6 py-2 text-sm font-bold text-gray-200 hover:bg-gray-400 hover:text-black"
                >
                  Cash Out
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )

  return createPortal(
    <div className="fixed inset-0 z-[60]">{body}</div>,
    document.body
  )
}
