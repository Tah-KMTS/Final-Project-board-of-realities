import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useGameStore } from '../../store/useGameStore'
import {
  playClickSound, playPurchaseSound, playVictorySound, playDefeatSound,
  playSmashSound, playQuestCompleteSound,
} from '../../audio/sfx'
import {
  VIEW_W, VIEW_H, IMAGES, SHEETS, TRACKS, CAR_DRAW_W, BALANCE as B,
} from './redlineRallyTracks'
import { createRace, step, standings, carDamageFrame } from './redlineRallyEngine'

// Redline Rally - the Game Center's lap-circuit racer (OverworldScene's
// arcadeCabinet zone -> WorldScreen's 'arcadeGame' branch, id 'redlineRally').
// redlineRallyEngine.js owns the simulation and never touches the DOM; this
// file owns the canvas, the input, and the money.
//
// createPortal to document.body for the same reason the other cabinets do it:
// a `fixed inset-0` nested inside an ancestor with backdrop-filter would pin
// itself to that panel instead of the viewport.
//
// Money: unlike Third Rail - which lost its entry fee when the arcade refactor
// deleted the ArcadeModal that used to charge it, and now pays out for free -
// this cabinet charges its OWN fee, right here, at the moment a race starts.
// Keeping the charge and the payout in one component means no future
// restructuring of the arcade can separate them.

const STEP_MS = 1000 / 60
// rAF stops in a backgrounded tab; without a cap the accumulated time comes
// back as hundreds of catch-up steps in one frame.
const MAX_STEPS_PER_FRAME = 5

const KEY_MAP = {
  ArrowUp: 'throttle', KeyW: 'throttle',
  ArrowDown: 'brake', KeyS: 'brake',
  ArrowLeft: 'left', KeyA: 'left',
  ArrowRight: 'right', KeyD: 'right',
  Space: 'boost', ShiftLeft: 'boost', KeyJ: 'boost',
}

// Kerb bands, stroked wider than the road and painted under it. These are the
// mean opaque colour of the pack's own Road_Side strips (measured, not
// eyeballed) - the strips themselves are horizontal 256px tiles that would
// tile in both axes if used as a stroke pattern, so the colour is lifted from
// them instead and the shape comes from the stroke.
const KERB_COLOR = { tarmac: '#b9b8b4', dirt: '#735c45' }
const KERB_WIDTH = 13

const CAM_LOOKAHEAD = 74 // world px ahead of the car the camera leans toward
const CAM_EASE = 0.12

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error(`failed to load ${url}`))
    img.src = url
  })
}

async function loadAssets() {
  const entries = Object.entries(IMAGES)
  const imgs = await Promise.all(entries.map(([, url]) => loadImage(url)))
  const out = {}
  entries.forEach(([key], i) => { out[key] = imgs[i] })
  return out
}

// The centreline as a Path2D, built once per race. Stroking this at
// halfWidth*2 IS the road - see redlineRallyEngine.js's header for why the
// track is a curve rather than the pack's corner tiles.
function buildTrackPath(cl) {
  const path = new Path2D()
  path.moveTo(cl.xs[0], cl.ys[0])
  for (let i = 1; i < cl.count; i++) path.lineTo(cl.xs[i], cl.ys[i])
  path.closePath()
  return path
}

function drawSprite(ctx, img, x, y, w, angle = 0) {
  const h = w * (img.height / img.width)
  ctx.save()
  ctx.translate(x, y)
  if (angle) ctx.rotate(angle)
  ctx.drawImage(img, -w / 2, -h / 2, w, h)
  ctx.restore()
}

function drawCar(ctx, assets, car) {
  const spec = SHEETS[car.carArt]
  const img = assets[car.carArt]
  if (!spec || !img) return
  const frame = carDamageFrame(car, spec.frames)
  const w = CAR_DRAW_W
  const h = w * (spec.fh / spec.fw)

  ctx.save()
  ctx.translate(car.x, car.y)
  // Pack cars are drawn nose-up, so a heading of 0 (pointing along +x) needs
  // a quarter turn. Heading is continuous, which is why the 5 sprite frames
  // could be spent on damage instead of on fixed steering angles.
  ctx.rotate(car.heading + Math.PI / 2)

  // Nitro flame out the back while boosting.
  if (car.boosting && assets.fx_nitro) {
    const nf = SHEETS.fx_nitro
    const frameIdx = Math.floor(car.id * 3 + (Date.now() / 45)) % nf.frames
    const fw = w * 0.42
    const fh = fw * (nf.fh / nf.fw)
    ctx.drawImage(
      assets.fx_nitro, frameIdx * nf.fw, 0, nf.fw, nf.fh,
      -fw / 2, h * 0.34, fw, fh
    )
  }

  ctx.drawImage(img, frame * spec.fw, 0, spec.fw, spec.fh, -w / 2, -h / 2, w, h)
  ctx.restore()

  // Off-road dust / spin smoke, drawn unrotated so it reads as ground haze.
  if ((car.offRoad || car.spin > 0) && assets.fx_smoke) {
    const sm = SHEETS.fx_smoke
    const idx = Math.floor(Date.now() / 70 + car.id) % sm.frames
    ctx.save()
    ctx.globalAlpha = 0.55
    ctx.drawImage(assets.fx_smoke, idx * sm.fw, 0, sm.fw, sm.fh,
      car.x - 16, car.y - 14, 32, 28)
    ctx.restore()
  }
}

function drawHud(ctx, race, place) {
  const p = race.player
  ctx.save()
  ctx.font = 'bold 13px monospace'
  ctx.textBaseline = 'top'

  // lap + position, top-left on a dark plate so it reads over any surface
  ctx.fillStyle = 'rgba(6,10,20,0.62)'
  ctx.fillRect(8, 8, 132, 42)
  ctx.fillStyle = '#ffe066'
  ctx.fillText(`LAP ${Math.min(p.lap + 1, race.laps)}/${race.laps}`, 16, 14)
  ctx.fillStyle = place === 1 ? '#39ff88' : '#ffffff'
  ctx.fillText(`POS ${place}/${race.cars.length}`, 16, 31)

  // nitro + hp bars, bottom-left
  const barW = 128
  const bx = 12
  const by = VIEW_H - 42
  ctx.fillStyle = 'rgba(6,10,20,0.62)'
  ctx.fillRect(bx - 4, by - 6, barW + 8, 38)

  ctx.fillStyle = '#8899aa'
  ctx.font = 'bold 9px monospace'
  ctx.fillText('NITRO', bx, by - 4)
  ctx.fillStyle = '#12202e'
  ctx.fillRect(bx, by + 6, barW, 7)
  ctx.fillStyle = p.boosting ? '#ffd166' : '#00e5ff'
  ctx.fillRect(bx, by + 6, barW * (p.nitro / B.NITRO_MAX), 7)

  ctx.fillStyle = '#8899aa'
  ctx.fillText('HULL', bx, by + 16)
  ctx.fillStyle = '#2a1418'
  ctx.fillRect(bx, by + 26, barW, 7)
  const hpFrac = p.hp / B.MAX_HP
  ctx.fillStyle = hpFrac > 0.5 ? '#39ff88' : hpFrac > 0.25 ? '#ffb74d' : '#ff5470'
  ctx.fillRect(bx, by + 26, barW * hpFrac, 7)

  // countdown / GO
  if (race.phase === 'countdown') {
    const n = Math.ceil(race.countdown / B.COUNTDOWN_TICK)
    ctx.textAlign = 'center'
    ctx.font = 'bold 64px monospace'
    ctx.fillStyle = n <= 1 ? '#39ff88' : '#ffe066'
    ctx.fillText(n <= 1 ? 'GO' : String(n), VIEW_W / 2, VIEW_H / 2 - 40)
    ctx.textAlign = 'left'
  }
  ctx.restore()
}

function render(ctx, race, assets, cam, patterns) {
  const track = race.track
  const cl = race.cl

  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.clearRect(0, 0, VIEW_W, VIEW_H)

  const shakeX = race.shake > 0 ? (Math.random() - 0.5) * 5 : 0
  const shakeY = race.shake > 0 ? (Math.random() - 0.5) * 5 : 0
  ctx.translate(-cam.x + shakeX, -cam.y + shakeY)

  // Ground. The pattern is set inside the translated space, so the texture is
  // pinned to the world and scrolls with the camera rather than sliding under
  // it - the thing that sells motion in a top-down racer.
  ctx.fillStyle = patterns.ground
  ctx.fillRect(cam.x - 8, cam.y - 8, VIEW_W + 16, VIEW_H + 16)

  // Road: kerb band under, textured road over.
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  ctx.strokeStyle = KERB_COLOR[track.surface] ?? '#b9b8b4'
  ctx.lineWidth = track.halfWidth * 2 + KERB_WIDTH * 2
  ctx.stroke(race.trackPath)
  ctx.strokeStyle = patterns.road
  ctx.lineWidth = track.halfWidth * 2
  ctx.stroke(race.trackPath)

  // Start/finish gantry across the line at s = 0.
  if (assets.finish_banner) {
    drawSprite(ctx, assets.finish_banner, cl.xs[0], cl.ys[0],
      track.halfWidth * 2.1, cl.tang[0] + Math.PI / 2)
  }

  for (const d of race.decor) {
    const img = assets[d.kind]
    if (img) drawSprite(ctx, img, d.x, d.y, img.width)
  }
  for (const h of race.hazards) {
    const key = h.kind === 'jump' ? 'jump_pad' : h.kind === 'oil' ? 'oil' : 'barrel'
    const img = assets[key]
    if (img) drawSprite(ctx, img, h.x, h.y, img.width, h.kind === 'jump' ? h.angle + Math.PI / 2 : 0)
  }
  for (const p of race.pickups) {
    if (p.taken > 0) continue
    const img = assets[p.kind === 'nitro' ? 'pickup_nitro' : 'pickup_hp']
    if (!img) continue
    // Gentle bob so pickups read as collectable rather than as scenery.
    const bob = Math.sin(Date.now() / 260 + p.x * 0.01) * 2.5
    drawSprite(ctx, img, p.x, p.y + bob, img.width * 0.62)
  }

  for (const car of race.cars) drawCar(ctx, assets, car)

  ctx.setTransform(1, 0, 0, 1, 0, 0)
}

function placeLabel(n) {
  return ['1st', '2nd', '3rd', '4th'][n - 1] ?? `${n}th`
}

export default function RedlineRallyModal({ onClose }) {
  const canvasRef = useRef(null)
  const raceRef = useRef(null)
  const assetsRef = useRef(null)
  const camRef = useRef({ x: 0, y: 0 })
  const inputRef = useRef({ throttle: false, brake: false, left: false, right: false, boost: false })
  const paidRef = useRef(false)

  const cash = useGameStore((s) => s.cash)
  const addCash = useGameStore((s) => s.addCash)

  const [status, setStatus] = useState('loading') // loading | error | select | racing | result
  const [result, setResult] = useState(null) // { place, payout, laps, hp }

  useEffect(() => {
    let cancelled = false
    loadAssets()
      .then((a) => { if (!cancelled) { assetsRef.current = a; setStatus('select') } })
      .catch((err) => {
        if (cancelled) return
        console.error('Redline Rally failed to load its art pack:', err)
        setStatus('error')
      })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    const down = (ev) => {
      const slot = KEY_MAP[ev.code]
      if (!slot) return
      ev.preventDefault() // arrows/space would scroll the page underneath
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

  // Charge once per race, credit once per race. paidRef guards the fee
  // against a double-click on a track card.
  const startRace = useCallback((trackIndex) => {
    if (paidRef.current || cash < B.ENTRY_FEE) return
    paidRef.current = true
    addCash(-B.ENTRY_FEE)
    playPurchaseSound()

    const race = createRace(trackIndex, {
      boost: playClickSound,
      hit: playSmashSound,
      pickup: playClickSound,
      spin: playSmashSound,
      lap: playClickSound,
      finish: playVictorySound,
      countdown: playClickSound,
      engine: () => {},
    })
    race.trackPath = buildTrackPath(race.cl)
    raceRef.current = race
    camRef.current = { x: race.player.x - VIEW_W / 2, y: race.player.y - VIEW_H / 2 }
    setResult(null)
    setStatus('racing')
  }, [cash, addCash])

  // The race loop. Fixed 60Hz simulation, decoupled from rAF, drawing once
  // per animation frame.
  useEffect(() => {
    if (status !== 'racing') return undefined
    const canvas = canvasRef.current
    const assets = assetsRef.current
    if (!canvas || !assets) return undefined
    const ctx = canvas.getContext('2d')

    const race = raceRef.current
    const patterns = {
      road: ctx.createPattern(assets[race.track.surface === 'dirt' ? 'road_dirt' : 'road_tarmac'], 'repeat'),
      ground: ctx.createPattern(assets[race.track.ground], 'repeat'),
    }

    let raf = 0
    let last = performance.now()
    let acc = 0
    let done = false

    const frame = (now) => {
      raf = requestAnimationFrame(frame)
      acc += now - last
      last = now
      let steps = 0
      while (acc >= STEP_MS && steps < MAX_STEPS_PER_FRAME) {
        const i = inputRef.current
        step(race, {
          steer: (i.left ? -1 : 0) + (i.right ? 1 : 0),
          throttle: i.throttle ? 1 : 0,
          brake: i.brake ? 1 : 0,
          boost: i.boost,
        })
        acc -= STEP_MS
        steps += 1
      }
      if (acc > STEP_MS * MAX_STEPS_PER_FRAME) acc = 0

      // camera: ease toward the car, leaning the way it is pointing
      const p = race.player
      const tx = p.x + Math.cos(p.heading) * CAM_LOOKAHEAD - VIEW_W / 2
      const ty = p.y + Math.sin(p.heading) * CAM_LOOKAHEAD - VIEW_H / 2
      camRef.current.x += (tx - camRef.current.x) * CAM_EASE
      camRef.current.y += (ty - camRef.current.y) * CAM_EASE

      render(ctx, race, assets, camRef.current, patterns)
      drawHud(ctx, race, standings(race).indexOf(p) + 1)

      if (!done && race.phase === 'finished' && race.phaseTimer > 40) {
        done = true
        const place = race.player.place
        const payout = B.PLACE_PAYOUT[place - 1] ?? 0
        if (payout > 0) addCash(payout)
        if (place === 1) playQuestCompleteSound()
        else if (place === 4) playDefeatSound()
        setResult({
          place,
          payout,
          hp: race.player.hp,
          bestLap: race.player.lapTimes.length
            ? Math.min(...race.player.lapTimes) / 60
            : null,
          order: standings(race).map((c) => ({
            id: c.id,
            place: c.place,
            name: c.isPlayer ? 'YOU' : (c.aiTier?.name ?? 'RIVAL'),
            isPlayer: c.isPlayer,
          })),
        })
        setStatus('result')
      }
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [status, addCash])

  const canAfford = cash >= B.ENTRY_FEE

  let body
  if (status === 'loading' || status === 'error') {
    body = (
      <div className="flex h-full items-center justify-center">
        <p className={status === 'error' ? 'text-red-400' : 'text-gray-300'}>
          {status === 'error'
            ? 'This cabinet is out of order - its art pack failed to load.'
            : 'Loading Redline Rally...'}
        </p>
      </div>
    )
  } else if (status === 'select') {
    body = (
      <div className="mx-auto flex h-full max-w-3xl flex-col justify-center p-6">
        <h2 className="mb-1 text-2xl font-extrabold tracking-widest text-amber-300">REDLINE RALLY</h2>
        <p className="mb-4 text-xs text-gray-400">
          Three laps, four cars, one line that works. Arrows or WASD to drive, Space for nitro.
          Entry ${B.ENTRY_FEE} - finish {placeLabel(1)} for ${B.PLACE_PAYOUT[0]}, {placeLabel(2)} for
          ${B.PLACE_PAYOUT[1]}, {placeLabel(3)} for ${B.PLACE_PAYOUT[2]}. Last place pays nothing.
        </p>
        <div className="grid gap-3 sm:grid-cols-3">
          {TRACKS.map((t, i) => (
            <button
              key={t.id}
              onClick={() => startRace(i)}
              disabled={!canAfford}
              className="border-2 border-cyan-400/70 bg-black/40 p-3 text-left transition hover:bg-cyan-400/10 disabled:opacity-30"
            >
              <div className="flex items-baseline justify-between">
                <span className="font-bold text-cyan-300">{t.name}</span>
                <span className="text-[10px] text-gray-500">{'★'.repeat(t.difficulty)}</span>
              </div>
              <div className="mt-1 text-[10px] uppercase tracking-wider text-gray-500">
                {t.surface} · {t.laps} laps
              </div>
              <p className="mt-2 text-[11px] leading-snug text-gray-400">{t.blurb}</p>
            </button>
          ))}
        </div>
        {!canAfford && (
          <p className="mt-3 text-xs text-red-400">
            You need ${B.ENTRY_FEE} to put a credit in. You have ${cash.toLocaleString()}.
          </p>
        )}
        <button onClick={onClose} className="mt-5 self-start text-xs text-gray-500 hover:text-gray-300">
          Walk away
        </button>
      </div>
    )
  } else {
    const podium = result && result.place <= 3
    body = (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-4">
        <canvas
          ref={canvasRef}
          width={VIEW_W}
          height={VIEW_H}
          className="border-2 border-cyan-400/50 bg-black"
          style={{ imageRendering: 'pixelated', width: VIEW_W, height: VIEW_H }}
        />
        {status === 'result' && result && (
          <div className="w-[512px] border-2 border-amber-300/70 bg-[#0b0f1c] p-4">
            <p className={`text-center text-xl font-extrabold ${podium ? 'text-amber-300' : 'text-gray-400'}`}>
              {podium ? `${placeLabel(result.place)} PLACE` : 'OFF THE PODIUM'}
            </p>
            <div className="mt-2 space-y-1 text-xs">
              {result.order.map((c) => (
                <div
                  key={c.id}
                  className={`flex justify-between ${c.isPlayer ? 'font-bold text-cyan-300' : 'text-gray-500'}`}
                >
                  <span>{placeLabel(c.place)}  {c.name}</span>
                  {c.isPlayer && <span>hull {result.hp}%</span>}
                </div>
              ))}
            </div>
            <p className="mt-3 text-center text-sm">
              {result.payout > 0
                ? <span className="font-bold text-green-400">+${result.payout.toLocaleString()}</span>
                : <span className="text-red-400">No payout - you lost your ${B.ENTRY_FEE} credit.</span>}
              {result.bestLap && (
                <span className="ml-3 text-[11px] text-gray-500">
                  best lap {result.bestLap.toFixed(1)}s
                </span>
              )}
            </p>
            <div className="mt-3 flex justify-center gap-2">
              <button
                onClick={() => { paidRef.current = false; setStatus('select') }}
                className="border-2 border-cyan-400 px-3 py-1 text-xs font-bold text-cyan-300 hover:bg-cyan-400 hover:text-black"
              >
                Another Credit (${B.ENTRY_FEE})
              </button>
              <button
                onClick={onClose}
                className="border-2 border-gray-600 px-3 py-1 text-xs font-bold text-gray-400 hover:bg-gray-600 hover:text-black"
              >
                Walk Away
              </button>
            </div>
          </div>
        )}
      </div>
    )
  }

  return createPortal(
    <div className="fixed inset-0 z-[60] bg-black/85 text-white">{body}</div>,
    document.body
  )
}
