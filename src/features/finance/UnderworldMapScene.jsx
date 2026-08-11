import { useCallback, useEffect, useRef, useState } from 'react'
import { playDoorSound, playClickSound } from '../../audio/sfx'
import { PLAYER_REAL_SPRITE } from '../../game/packs/playerRealSprite'

// Walkable hub for the Underworld building - the actual reference
// illustration (public/assets/packs/underworld-interior/underworld_interior.png,
// a 3344x1248 cutaway) is used directly as the room background, the same
// "real image + a small React/CSS walker" technique CrimeAlleyHeistModal.jsx
// already established for Crime Alley's alley_bg.png (see that file's own
// header comment: "Phaser is reserved for the persistent overworld map
// only, never a job minigame" - this hub lives inside UnderworldModal, not
// the Phaser world, for the same reason). The player marker is the SAME
// real-art sheet the overworld uses (packs/playerRealSprite.js) sliced with
// plain CSS background-position instead of Phaser's spritesheet loader (this
// is a DOM scene, not a Phaser one) - drawn here instead of a generic marker
// so the character walking through this room is recognizably the player,
// not an unrelated dot.
//
// The illustration reads as two horizontal levels - an upper walkway in
// front of Black Market / Call Center Ops / Crime Alley's stairwell / the
// Speakeasy bar, and a lower walkway in front of Gun Store / Boss Jobs /
// Standing & Services - each with real (if narrow) floor DEPTH, not a
// single painted line, linked by an open shaft under the main doors. BANDS
// below gives the player real 2D room within each walkway's own floor strip
// (measured by hand against a coordinate-grid overlay of the source art,
// not guessed) instead of pinning them to one fixed y per level - see
// movement's own comment for exactly how those bands interact with the
// connecting shaft. ROOMS encodes the same layout in the image's own native
// pixel coordinates.
export const IMAGE_URL = '/assets/packs/underworld-interior/underworld_interior.png'
export const NATIVE_W = 3344
export const NATIVE_H = 1248

// Real floor depth per level (native px), not a single line - see the
// movement comment in the tick loop below for how these combine with
// CONNECTOR to give the player actual 2D freedom instead of a 1D lane.
const BANDS = {
  upper: { y0: 660, y1: 800 },
  lower: { y0: 960, y1: 1160 },
}
// Retained for anything that still wants "the" y of a level (room labels,
// the enter prompt) - the vertical midpoint of that level's own floor band.
const LANE_Y = { upper: (BANDS.upper.y0 + BANDS.upper.y1) / 2, lower: (BANDS.lower.y0 + BANDS.lower.y1) / 2 }
const CONNECTOR = { x0: 1480, x1: 1900 }
const PLAYER_MIN_X = 40
const PLAYER_MAX_X = NATIVE_W - 40
const WALK_SPEED = 720 // native px/sec, along either axis

// Which floor band a y-value currently belongs to - used both to clamp
// movement (see the tick loop) and to decide which level's ROOMS/ambient
// prompt apply, replacing the old explicit player.lane field now that y is
// continuous rather than one of two fixed values.
const BAND_MID = (BANDS.upper.y1 + BANDS.lower.y0) / 2
function bandOf(y) {
  return y < BAND_MID ? 'upper' : 'lower'
}

// tabId below matches UnderworldModal.jsx's tab ids exactly, so onEnter can
// hand straight to selectTab() with no translation layer. Exported so
// UnderworldModal.jsx can crop the same source illustration to a room's own
// rect for its "still inside this room" content banner - one coordinate
// table, not two copies to keep in sync.
// `bannerY` (optional, native-coord y): where UnderworldModal.jsx's
// RoomBanner should vertically center its crop of this room. Only set where
// the default (the room rect's own vertical midpoint) crops out the room's
// actual sign/counter - confirmed by rendering: crimeAlley's midpoint
// (465) landed entirely on the bare stairwell/brick wall below its neon
// sign (the sign sits at y~195-250, near the TOP of its 130-800 range,
// not the middle - a narrow room reads very differently than a wide one).
// blackMarket's sign+shopkeeper counter sit low in its range (~430-700)
// for the same reason in reverse. Every room without an override here was
// checked too and the default already captures its sign/counter fine.
export const ROOMS = [
  { id: 'blackMarket', label: 'Black Market', lane: 'upper', x0: 40, x1: 1150, y0: 130, y1: 800, bannerY: 560 },
  { id: 'callCenterOps', label: 'Call Center Ops', lane: 'upper', x0: 1200, x1: 2200, y0: 130, y1: 800 },
  { id: 'crimeAlley', label: 'Crime Alley', lane: 'upper', x0: 2380, x1: 2660, y0: 130, y1: 800, bannerY: 320 },
  { id: 'speakeasy', label: 'Speakeasy Hotel', lane: 'upper', x0: 2850, x1: 3320, y0: 130, y1: 800, bannerY: 420 },
  { id: 'gunStore', label: 'Gun Store', lane: 'lower', x0: 860, x1: 1410, y0: 800, y1: 1248 },
  { id: 'bossJobs', label: 'Boss Jobs', lane: 'lower', x0: 1910, x1: 2340, y0: 800, y1: 1248 },
  { id: 'standing', label: 'Standing & Services', lane: 'lower', x0: 2460, x1: 3150, y0: 800, y1: 1248 },
]

const DISPLAY_W = 1120
const SCALE = DISPLAY_W / NATIVE_W
const DISPLAY_H = Math.round(NATIVE_H * SCALE)

function clamp(min, max, v) {
  return Math.min(max, Math.max(min, v))
}

// Rounding a moving transform to the nearest whole CSS pixel (see the
// player-sprite comment below) only guarantees a stable pixel grid when
// devicePixelRatio is exactly 1. On Windows' extremely common 125%/150%
// display-scaling presets, a whole CSS pixel still lands on a FRACTIONAL
// device pixel, and this sprite is drawn with image-rendering:pixelated -
// each frame's slightly different sub-device-pixel offset gets upscaled
// with a slightly different aliasing pattern, which reads as the sprite
// shimmering/shaking in place even though its CSS position is already a
// clean integer. Snapping to the nearest 1/dpr instead puts every frame on
// the SAME physical pixel boundary regardless of the OS scale factor -
// dpr=1 (scaling off) makes this identical to a plain Math.round.
function snapToDevicePixel(v) {
  const dpr = (typeof window !== 'undefined' && window.devicePixelRatio) || 1
  return Math.round(v * dpr) / dpr
}

// Player sprite sizing - packs/playerRealSprite.js is a 2-col (walk step) x
// 4-row (down/up/left/right) grid of cellW x cellH cells. Only the left/
// right rows are ever shown here (up/down input now MOVES the player - see
// the tick loop - but there is no up/down-facing art in this cut, so
// vertical-only movement keeps whichever left/right pose was last faced,
// same convention a lot of 2D games with side-view-only sprites use) at a
// target on-screen height close to the source illustration's own painted
// characters (~50px tall at this scene's SCALE), not the sheet's native
// 65px overworld size. SPRITE_W/H are rounded to whole pixels (and
// SHEET_W/H derived FROM those rounded values, not computed independently)
// so every frame's background-position lands on an exact pixel boundary
// every frame - the visible "shaking while walking" bug was this sprite
// sub-pixel-sampling itself each frame as player.x's float value scaled to
// a fractional CSS pixel position.
const SPRITE_FACING_ROW = { left: 2, right: 3 }
const SPRITE_TARGET_H = 56
const SPRITE_SCALE = SPRITE_TARGET_H / PLAYER_REAL_SPRITE.cellH
const SPRITE_W = Math.round(PLAYER_REAL_SPRITE.cellW * SPRITE_SCALE)
const SPRITE_H = Math.round(PLAYER_REAL_SPRITE.cellH * SPRITE_SCALE)
const SPRITE_SHEET_W = SPRITE_W * 2
const SPRITE_SHEET_H = SPRITE_H * 4
// Only ever the FIRST of the sheet's two walk-step columns - measured
// directly against the asset (see the pixel-diff check in the header
// comment above) and confirmed the second column is the first shifted down
// by an exact 1 native px, a "walk bob" authored for the overworld's larger
// scale. Alternating it here at 140ms read as the sprite shaking in place
// rather than walking, so this scene holds a single still pose instead.
const WALK_FRAME = 0

function spriteBackgroundPosition(facing) {
  return `-${WALK_FRAME * SPRITE_W}px -${SPRITE_FACING_ROW[facing] * SPRITE_H}px`
}

// `onEnter(tabId)` is called both on a direct room click (instant, for
// mouse/touch users - no walking required) and on Enter/E while standing in
// a room's zone (for the keyboard-walk path this component's own header
// comment describes).
export default function UnderworldMapScene({ onEnter }) {
  // Position lives in a ref, NOT React state - see the tick loop's own
  // comment for why. `nearRoomId` is the only thing about the player that
  // actually needs to trigger a re-render (the room highlight border + the
  // "[Enter] Label" prompt), and it only changes on an ENTER/LEAVE
  // transition, not every frame.
  const posRef = useRef({ x: 900, y: LANE_Y.upper, facing: 'right' })
  const [nearRoomId, setNearRoomId] = useState(null)
  // The reported "shakes on first walk, then stable" pattern is the exact
  // signature of a large-image decode hitch, not a positioning bug (already
  // fixed transform-based positioning wouldn't explain a ONE-TIME cold-start
  // stutter) - underworld_interior.png is a real ~8.5MB photo-scale
  // illustration (3344x1248), and a browser's first decode of an image that
  // size is real main-thread work that can land on top of - and visibly
  // stall - the player's first few rAF-driven movement frames. Once decoded,
  // the bitmap is cached and every later visit this session is instant,
  // matching "more stable after the first time" precisely. Gating the
  // interactive scene behind `bgReady` (decoded via an off-DOM Image().decode()
  // call, not just the <img> tag's own passive/async load) forces that decode
  // work to finish BEFORE the player can move at all, so it can never
  // overlap with - and stutter - the walk animation.
  const [bgReady, setBgReady] = useState(false)
  const keysRef = useRef(new Set())
  const rafRef = useRef(null)
  const lastAtRef = useRef(performance.now())
  const nearRoomIdRef = useRef(null)
  const prevEnterHeldRef = useRef(false)
  // Imperative handles for the hot 60fps path - the wrapper's transform
  // (position) and the inner sprite's background-position (facing) are
  // written directly to the DOM every frame instead of through React state.
  // A React state update on every rAF tick means a full component
  // re-render 60 times a second - recomputing nearRoom, remapping all 7
  // ROOMS buttons, rebuilding style objects - purely to move one already-
  // GPU-composited div. That's real, avoidable main-thread cost stacked
  // on top of whatever else the tab is doing, and it was a second,
  // independent source of the exact "walking here looks laggy" complaint
  // this scene has already had one performance pass for (see
  // OverworldScene.js's heavySimSuspended). Only nearRoomId (above) still
  // goes through setState, because the room highlight/prompt genuinely
  // need a re-render - and that only fires on an ENTER/LEAVE edge, not
  // every frame.
  const wrapElRef = useRef(null)
  const spriteElRef = useRef(null)

  useEffect(() => {
    let cancelled = false
    const img = new Image()
    img.src = IMAGE_URL
    const markReady = () => {
      if (!cancelled) setBgReady(true)
    }
    if (img.decode) {
      img.decode().then(markReady).catch(markReady) // still show the scene if decode() itself isn't supported/fails - a slow first paint beats a stuck loading screen
    } else {
      img.onload = markReady
      img.onerror = markReady
    }
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const onKeyDown = (e) => {
      if (
        ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'KeyA', 'KeyD', 'KeyW', 'KeyS', 'Enter', 'KeyE'].includes(
          e.code
        )
      ) {
        e.preventDefault()
        keysRef.current.add(e.code)
      }
    }
    const onKeyUp = (e) => keysRef.current.delete(e.code)
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      keysRef.current = new Set()
    }
  }, [])

  // Paints the current posRef position/facing straight onto the DOM nodes -
  // called every tick (position always) and once up front (so the sprite
  // doesn't sit at a stale (0,0) for a frame before the loop's first tick).
  const paint = useCallback(() => {
    const p = posRef.current
    if (wrapElRef.current) {
      wrapElRef.current.style.transform = `translate3d(${snapToDevicePixel(p.x * SCALE - SPRITE_W / 2)}px, ${snapToDevicePixel(p.y * SCALE - SPRITE_H)}px, 0)`
    }
    if (spriteElRef.current) {
      spriteElRef.current.style.backgroundPosition = spriteBackgroundPosition(p.facing)
    }
  }, [])

  useEffect(() => {
    if (!bgReady) return
    paint()
    lastAtRef.current = performance.now()
    const tick = (now) => {
      const dt = Math.min(0.05, (now - lastAtRef.current) / 1000)
      lastAtRef.current = now
      const p = posRef.current

      const left = keysRef.current.has('ArrowLeft') || keysRef.current.has('KeyA')
      const right = keysRef.current.has('ArrowRight') || keysRef.current.has('KeyD')
      const up = keysRef.current.has('ArrowUp') || keysRef.current.has('KeyW')
      const down = keysRef.current.has('ArrowDown') || keysRef.current.has('KeyS')

      const inputX = (right ? 1 : 0) - (left ? 1 : 0)
      const inputY = (down ? 1 : 0) - (up ? 1 : 0)
      if (inputX !== 0 || inputY !== 0) {
        // Real 2D movement, not a single horizontal lane - normalized so a
        // diagonal hold isn't sqrt(2) faster than a straight one.
        const mag = Math.hypot(inputX, inputY) || 1
        const nx = clamp(PLAYER_MIN_X, PLAYER_MAX_X, p.x + (inputX / mag) * WALK_SPEED * dt)
        let ny = p.y + (inputY / mag) * WALK_SPEED * dt

        // Vertical range depends on whether the CANDIDATE x sits inside the
        // shaft between the two levels: inside it, y is free to roam the
        // whole gap between the levels (walking up/down the connecting
        // opening in the art - see CONNECTOR/BANDS above); outside it,
        // y is clamped to the CURRENT level's own floor band, so leaving
        // the shaft mid-transit doesn't leave the player standing in front
        // of a wall/ceiling that the illustration never drew as floor.
        // Current level is derived from y BEFORE this frame's move so a
        // player already at the shaft's edge doesn't get judged by where
        // they're about to end up.
        if (nx >= CONNECTOR.x0 && nx <= CONNECTOR.x1) {
          ny = clamp(BANDS.upper.y0, BANDS.lower.y1, ny)
        } else {
          const band = BANDS[bandOf(p.y)]
          ny = clamp(band.y0, band.y1, ny)
        }

        p.x = nx
        p.y = ny
        if (inputX !== 0) p.facing = inputX > 0 ? 'right' : 'left'
      }

      const currentBand = bandOf(p.y)
      const nearRoom = ROOMS.find((r) => r.lane === currentBand && p.x >= r.x0 && p.x <= r.x1)
      const nearRoomIdNow = nearRoom ? nearRoom.id : null
      if (nearRoomIdNow !== nearRoomIdRef.current) {
        if (nearRoomIdNow) playClickSound()
        nearRoomIdRef.current = nearRoomIdNow
        setNearRoomId(nearRoomIdNow) // the only per-transition (not per-frame) React update
      }

      const enterHeld = keysRef.current.has('Enter') || keysRef.current.has('KeyE')
      if (enterHeld && !prevEnterHeldRef.current && nearRoom) {
        playDoorSound()
        onEnter(nearRoom.id)
      }
      prevEnterHeldRef.current = enterHeld

      paint()
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [onEnter, bgReady, paint])

  const nearRoom = ROOMS.find((r) => r.id === nearRoomId) || null

  return (
    <div className="flex flex-col items-center gap-2">
      <div
        className="relative mx-auto overflow-hidden border-2 border-gray-700 bg-black"
        style={{ width: DISPLAY_W, height: DISPLAY_H, maxWidth: '100%' }}
      >
        <img
          src={IMAGE_URL}
          alt="The Underworld"
          draggable={false}
          className="pointer-events-none absolute left-0 top-0 select-none"
          style={{ width: DISPLAY_W, height: DISPLAY_H }}
        />

        {!bgReady && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/70 text-xs uppercase tracking-widest text-gray-400">
            Loading...
          </div>
        )}

        {bgReady && ROOMS.map((r) => {
          const isNear = nearRoomId === r.id
          return (
            <button
              key={r.id}
              onClick={() => {
                playDoorSound()
                onEnter(r.id)
              }}
              title={r.label}
              className={`absolute border-2 transition-colors ${
                isNear ? 'border-yellow-400 bg-yellow-400/10' : 'border-transparent hover:border-white/40 hover:bg-white/5'
              }`}
              style={{
                left: r.x0 * SCALE,
                top: r.y0 * SCALE,
                width: (r.x1 - r.x0) * SCALE,
                height: (r.y1 - r.y0) * SCALE,
              }}
            />
          )
        })}

        {/* Positioned via `transform: translate3d`, not `left`/`top` - the
            previous whole-pixel-rounded left/top fix (see git history)
            reduced but didn't fully kill the shake the user kept reporting.
            left/top are LAYOUT properties: the browser reflows the page
            every single frame this updates (60/sec) and, per multiple
            confirmed reports, still visibly shimmered on this pixelated
            sprite even with integer values. `transform` is composited
            directly on the GPU with no layout pass at all, which is both
            the standard fix for this exact class of "technically integer
            but still jittery" animation artifact and just the correct tool
            for a value that changes every rAF frame - not a guess. Percent-
            based centering (translateX(-50%)) is still avoided for the same
            reason as before (SPRITE_W=25 is odd), so the half-width offset
            stays folded into the rounded translate value itself. Hidden
            until bgReady - no point showing the player standing at the
            default spawn position before the movement loop it's tied to
            has even started. transform/backgroundPosition are written
            imperatively via wrapElRef/spriteElRef in paint() above, not as
            React style props - see that ref's own comment for why. */}
        {bgReady && <div ref={wrapElRef} className="pointer-events-none absolute left-0 top-0" style={{ willChange: 'transform' }}>
          <div
            ref={spriteElRef}
            style={{
              width: SPRITE_W,
              height: SPRITE_H,
              backgroundImage: `url(${PLAYER_REAL_SPRITE.path})`,
              backgroundSize: `${SPRITE_SHEET_W}px ${SPRITE_SHEET_H}px`,
              imageRendering: 'pixelated',
            }}
          />
          <div
            className="rounded-full bg-black/50"
            style={{
              width: Math.round(SPRITE_W * 0.7),
              height: 4,
              marginLeft: Math.round((SPRITE_W - Math.round(SPRITE_W * 0.7)) / 2),
              filter: 'blur(1px)',
            }}
          />
        </div>}

        {/* Anchored to the ROOM's fixed center x (not the player's) and well
            above where the sprite's head sits - it used to track the
            player's exact x every frame, which both jittered along with
            the walk-shake fix above and drifted around as you shuffled
            inside a wide room like Call Center Ops instead of reading as
            "you're in this room." Only re-renders on nearRoomId's own
            ENTER/LEAVE transitions now (see the tick loop), same as the
            highlight borders above. */}
        {bgReady && nearRoom && (
          <div
            className="pointer-events-none absolute -translate-x-1/2 whitespace-nowrap rounded border border-yellow-400 bg-black/80 px-2 py-1 text-xs font-bold text-yellow-300"
            style={{
              left: Math.round(((nearRoom.x0 + nearRoom.x1) / 2) * SCALE),
              top: Math.round(LANE_Y[nearRoom.lane] * SCALE - SPRITE_H - 26),
            }}
          >
            [Enter] {nearRoom.label}
          </div>
        )}
      </div>
      <p className="text-center text-[10px] text-gray-500">
        Arrow keys / WASD to walk - the doors between the two floors are the open gap under the main sign. Enter or
        click a room to go in.
      </p>
    </div>
  )
}
