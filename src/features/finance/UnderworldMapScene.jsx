import { useEffect, useRef, useState } from 'react'
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
// The illustration reads as two horizontal levels: an upper walkway in
// front of Black Market / Call Center Ops / Crime Alley's stairwell / the
// Speakeasy bar, and a lower walkway in front of Gun Store / Boss Jobs /
// Standing & Services, linked by the open shaft under the main doors.
// ROOMS below encodes exactly that layout in the image's own native pixel
// coordinates - mapped by hand against a coordinate-grid overlay of the
// source art (see production/ for the grid crops), not guessed - and
// LANE_Y/CONNECTOR encode the two walk lines and the one x-range where the
// player can move between them.
export const IMAGE_URL = '/assets/packs/underworld-interior/underworld_interior.png'
export const NATIVE_W = 3344
export const NATIVE_H = 1248

const LANE_Y = { upper: 760, lower: 1120 }
const CONNECTOR = { x0: 1480, x1: 1900 }
const PLAYER_MIN_X = 40
const PLAYER_MAX_X = NATIVE_W - 40
const WALK_SPEED = 720 // native px/sec

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
// right rows are ever shown here (this scene is pure left-right movement,
// never up/down-facing) at a target on-screen height close to the source
// illustration's own painted characters (~50px tall at this scene's SCALE),
// not the sheet's native 65px overworld size. SPRITE_W/H are rounded to
// whole pixels (and SHEET_W/H derived FROM those rounded values, not
// computed independently) so every frame's background-position lands on an
// exact pixel boundary every frame - the visible "shaking while walking"
// bug was this sprite sub-pixel-sampling itself each frame as player.x's
// float value scaled to a fractional CSS pixel position.
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

// `onEnter(tabId)` is called both on a direct room click (instant, for
// mouse/touch users - no walking required) and on Enter/E while standing in
// a room's zone (for the keyboard-walk path this component's own header
// comment describes).
export default function UnderworldMapScene({ onEnter }) {
  const [player, setPlayer] = useState({ x: 900, lane: 'upper', facing: 'right' })
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
  const playerRef = useRef(player)
  const keysRef = useRef(new Set())
  const rafRef = useRef(null)
  const lastAtRef = useRef(performance.now())
  const nearRoomIdRef = useRef(null)
  const prevEnterHeldRef = useRef(false)

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
    playerRef.current = player
  }, [player])

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

  useEffect(() => {
    if (!bgReady) return
    lastAtRef.current = performance.now()
    const tick = (now) => {
      const dt = Math.min(0.05, (now - lastAtRef.current) / 1000)
      lastAtRef.current = now
      const p = playerRef.current

      const left = keysRef.current.has('ArrowLeft') || keysRef.current.has('KeyA')
      const right = keysRef.current.has('ArrowRight') || keysRef.current.has('KeyD')
      const up = keysRef.current.has('ArrowUp') || keysRef.current.has('KeyW')
      const down = keysRef.current.has('ArrowDown') || keysRef.current.has('KeyS')

      const inputX = (right ? 1 : 0) - (left ? 1 : 0)
      if (inputX !== 0) {
        p.x = clamp(PLAYER_MIN_X, PLAYER_MAX_X, p.x + inputX * WALK_SPEED * dt)
        p.facing = inputX > 0 ? 'right' : 'left'
      }

      const inConnector = p.x >= CONNECTOR.x0 && p.x <= CONNECTOR.x1
      if (inConnector) {
        if (up && p.lane === 'lower') p.lane = 'upper'
        else if (down && p.lane === 'upper') p.lane = 'lower'
      }

      const nearRoom = ROOMS.find((r) => r.lane === p.lane && p.x >= r.x0 && p.x <= r.x1)
      if (nearRoom && nearRoom.id !== nearRoomIdRef.current) playClickSound()
      nearRoomIdRef.current = nearRoom ? nearRoom.id : null

      const enterHeld = keysRef.current.has('Enter') || keysRef.current.has('KeyE')
      if (enterHeld && !prevEnterHeldRef.current && nearRoom) {
        playDoorSound()
        onEnter(nearRoom.id)
      }
      prevEnterHeldRef.current = enterHeld

      setPlayer({ ...p })
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [onEnter, bgReady])

  const nearRoom = ROOMS.find((r) => r.lane === player.lane && player.x >= r.x0 && player.x <= r.x1)

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
          const isNear = nearRoom?.id === r.id
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
            has even started.
            snapToDevicePixel (not a plain Math.round) - a whole CSS pixel
            still isn't a whole DEVICE pixel on Windows' common 125%/150%
            display-scaling presets, and this pixelated sprite shimmers on
            that sub-device-pixel remainder even when its CSS position is
            already integer. See that function's own comment above. */}
        {bgReady && <div
          className="pointer-events-none absolute left-0 top-0"
          style={{
            transform: `translate3d(${snapToDevicePixel(player.x * SCALE - SPRITE_W / 2)}px, ${snapToDevicePixel(LANE_Y[player.lane] * SCALE - SPRITE_H)}px, 0)`,
            willChange: 'transform',
          }}
        >
          <div
            style={{
              width: SPRITE_W,
              height: SPRITE_H,
              backgroundImage: `url(${PLAYER_REAL_SPRITE.path})`,
              backgroundSize: `${SPRITE_SHEET_W}px ${SPRITE_SHEET_H}px`,
              backgroundPosition: `-${WALK_FRAME * SPRITE_W}px -${SPRITE_FACING_ROW[player.facing] * SPRITE_H}px`,
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

        {/* Anchored to the ROOM's fixed center x (not player.x) and well
            above the sprite's head - it used to track the player's exact x
            every frame, which both jittered along with the walk-shake fix
            above and drifted around as you shuffled inside a wide room like
            Call Center Ops instead of reading as "you're in this room." */}
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
        Arrow keys / WASD to walk, Up/Down near the doors to change level, Enter or click a room to go in.
      </p>
    </div>
  )
}
