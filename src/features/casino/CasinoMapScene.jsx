import { useCallback, useEffect, useRef, useState } from 'react'
import { playDoorSound, playClickSound } from '../../audio/sfx'
import { PLAYER_REAL_SPRITE } from '../../game/packs/playerRealSprite'

// Walkable floor for the Casino - the actual reference illustration
// (public/assets/packs/casino-interior/casino_interior.png, a 2048x2048
// casino+arcade floor) replaces the old flat pink "Casino Floor" Phaser prop
// (buildCasinoInteriorZone in OverworldScene.js, now unreachable/deleted -
// see that file's own header comment). Same "real image + a small React/CSS
// walker" technique UnderworldMapScene.jsx already established, at the
// user's explicit request to walk up to the 777 slot machine instead of a
// plain building box, and later to walk this floor freely rather than
// along one fixed line (see WALK_Y_MIN/MAX below - unlike Underworld's
// two-level cutaway, this crop is one open floor with real depth, so it
// gets a full 2D walkable rectangle instead of a lane+shaft layout).
// Walking up and pressing Enter/E opens the SAME full tab bar as before,
// it's just reached by walking instead of an instant building click.
//
// The source image is square (2048x2048) - the whole thing is shown now (at
// the user's explicit request for "the full one, not the cropped image"),
// not just the mid band this used to crop down to. CROP is kept as a named
// rect (rather than deleted) purely because every other constant below
// (WALK/HOTSPOT/the background-position math) is already expressed relative
// to it - with it covering the full 0..2048 square those all still work
// unchanged, they just now cover the entire picture: the top signage/arcade
// archway band, the full floor (which actually keeps going another ~600px
// past the old crop's bottom edge - a second blackjack table and more
// slot machines/NPCs down by a red-carpet entrance that the crop used to
// hide entirely), all the way down.
export const IMAGE_URL = '/assets/packs/casino-interior/casino_interior.png'
const NATIVE_SIZE = 2048
const CROP = { x0: 0, y0: 0, x1: 2048, y1: 2048 }

const DISPLAY_W = 1040
const SCALE = DISPLAY_W / (CROP.x1 - CROP.x0)
const DISPLAY_H = Math.round((CROP.y1 - CROP.y0) * SCALE)

// Real 2D walkable rectangle (native image coords, full-picture space -
// same space CROP/the hotspot rect below are measured in), not a single
// line - the floor's swirl-pattern carpet is open from just below the
// arcade archway/monster-mouth signage (y0=700 keeps the player off the
// wall-mounted CASINO/ARCADE neon and out of the dark tunnel mouth above
// it) down to the image's own bottom edge, now that CROP covers the whole
// picture instead of stopping partway down the floor. No per-object
// collision against the chip stacks/blackjack tables/arcade cabinets (same
// limitation the single-line version already had for anything not the 777
// machine) - this only keeps the player on the visible floor.
const WALK = { x0: CROP.x0 + 40, x1: CROP.x1 - 40, y0: 700, y1: CROP.y1 - 40 }
const WALK_SPEED = 720 // native px/sec, matches UnderworldMapScene.jsx, along either axis

// The 777 machine's own x/y range (a bit wider than its exact cabinet - see
// UnderworldMapScene.jsx's ROOMS comment on the same choice - so the "near"
// zone reads as generous, not pixel-hunt-precise) plus its full cabinet
// rect for the visual highlight box. Both in native image coords. Now a
// real 2D rect (not just an x-range) since the player can approach it from
// any direction on the open floor.
const HOTSPOT = { x0: 800, x1: 1250, y0: 850, y1: 1000 }
const HOTSPOT_BOX = { x0: 860, y0: 895, x1: 1185, y1: 1350 }

function clamp(min, max, v) {
  return Math.min(max, Math.max(min, v))
}

// See UnderworldMapScene.jsx's own copy of this function for why a plain
// Math.round isn't enough - a whole CSS pixel still isn't a whole DEVICE
// pixel on Windows' common 125%/150% display-scaling presets, and this
// pixelated sprite shimmers on that sub-device-pixel remainder even when
// its CSS position is already integer.
function snapToDevicePixel(v) {
  const dpr = (typeof window !== 'undefined' && window.devicePixelRatio) || 1
  return Math.round(v * dpr) / dpr
}

const SPRITE_FACING_ROW = { left: 2, right: 3 }
const SPRITE_TARGET_H = 56
const SPRITE_SCALE = SPRITE_TARGET_H / PLAYER_REAL_SPRITE.cellH
const SPRITE_W = Math.round(PLAYER_REAL_SPRITE.cellW * SPRITE_SCALE)
const SPRITE_H = Math.round(PLAYER_REAL_SPRITE.cellH * SPRITE_SCALE)
const SPRITE_SHEET_W = SPRITE_W * 2
const SPRITE_SHEET_H = SPRITE_H * 4
// Only the sheet's first walk-step column - see UnderworldMapScene.jsx's own
// WALK_FRAME comment for why alternating it here reads as shaking in place
// rather than walking. No up/down-facing art either (see that file's own
// comment) - vertical-only movement keeps whichever left/right pose was
// last faced.
const WALK_FRAME = 0

function spriteBackgroundPosition(facing) {
  return `-${WALK_FRAME * SPRITE_W}px -${SPRITE_FACING_ROW[facing] * SPRITE_H}px`
}

// `onEnter()` fires once, when the player reaches the 777 machine and
// presses Enter/E (or clicks it directly) - CasinoModal.jsx swaps from this
// scene to its existing tab bar in response, same shape as
// UnderworldMapScene.jsx's onEnter(tabId) except there's only one
// destination here, so it takes no argument.
export default function CasinoMapScene({ onEnter }) {
  // Position lives in a ref, not React state - see paint()'s own comment
  // for why a 60fps setState was a real, independent source of the
  // "walking here looks laggy" complaint, on top of the Phaser-side fix
  // OverworldScene.js's heavySimSuspended already covers.
  const posRef = useRef({ x: 1000, y: WALK.y1, facing: 'right' })
  const [isNear, setIsNear] = useState(false)
  // Same first-decode-hitch guard as UnderworldMapScene.jsx - this is a real
  // ~7.8MB illustration, and its first decode is real main-thread work that
  // can stall the player's first few movement frames if it overlaps with
  // them. See that file's own header comment for the full reasoning.
  const [bgReady, setBgReady] = useState(false)
  const keysRef = useRef(new Set())
  const rafRef = useRef(null)
  const lastAtRef = useRef(performance.now())
  const wasNearRef = useRef(false)
  const prevEnterHeldRef = useRef(false)
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
      img.decode().then(markReady).catch(markReady)
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
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Enter', 'KeyA', 'KeyD', 'KeyW', 'KeyS', 'KeyE'].includes(e.code)) {
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

  // Paints the current posRef position/facing straight onto the DOM nodes,
  // bypassing React entirely for the 60fps hot path - see this ref's own
  // declaration comment above for why that matters here specifically.
  const paint = useCallback(() => {
    const p = posRef.current
    if (wrapElRef.current) {
      wrapElRef.current.style.transform = `translate3d(${snapToDevicePixel((p.x - CROP.x0) * SCALE - SPRITE_W / 2)}px, ${snapToDevicePixel((p.y - CROP.y0) * SCALE - SPRITE_H)}px, 0)`
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
        // Real 2D movement across the open floor, not a single fixed line -
        // normalized so a diagonal hold isn't sqrt(2) faster than straight.
        const mag = Math.hypot(inputX, inputY) || 1
        p.x = clamp(WALK.x0, WALK.x1, p.x + (inputX / mag) * WALK_SPEED * dt)
        p.y = clamp(WALK.y0, WALK.y1, p.y + (inputY / mag) * WALK_SPEED * dt)
        if (inputX !== 0) p.facing = inputX > 0 ? 'right' : 'left'
      }

      const nowNear = p.x >= HOTSPOT.x0 && p.x <= HOTSPOT.x1 && p.y >= HOTSPOT.y0 && p.y <= HOTSPOT.y1
      if (nowNear !== wasNearRef.current) {
        if (nowNear) playClickSound()
        wasNearRef.current = nowNear
        setIsNear(nowNear) // the only per-transition (not per-frame) React update
      }

      const enterHeld = keysRef.current.has('Enter') || keysRef.current.has('KeyE')
      if (enterHeld && !prevEnterHeldRef.current && nowNear) {
        playDoorSound()
        onEnter()
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

  const bg = NATIVE_SIZE * SCALE

  return (
    <div className="flex flex-col items-center gap-2">
      <div
        className="relative mx-auto overflow-hidden border-2 border-gray-700 bg-black"
        style={{ width: DISPLAY_W, height: DISPLAY_H, maxWidth: '100%' }}
      >
        <div
          className="pointer-events-none absolute left-0 top-0"
          style={{
            width: DISPLAY_W,
            height: DISPLAY_H,
            backgroundImage: `url(${IMAGE_URL})`,
            backgroundSize: `${bg}px ${bg}px`,
            backgroundPosition: `${-(CROP.x0 * SCALE)}px ${-(CROP.y0 * SCALE)}px`,
            backgroundRepeat: 'no-repeat',
            imageRendering: 'pixelated',
          }}
        />

        {!bgReady && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/70 text-xs uppercase tracking-widest text-gray-400">
            Loading...
          </div>
        )}

        {bgReady && (
          <button
            onClick={() => {
              playDoorSound()
              onEnter()
            }}
            title="Play"
            className={`absolute border-2 transition-colors ${
              isNear ? 'border-yellow-400 bg-yellow-400/10' : 'border-transparent hover:border-white/40 hover:bg-white/5'
            }`}
            style={{
              left: (HOTSPOT_BOX.x0 - CROP.x0) * SCALE,
              top: (HOTSPOT_BOX.y0 - CROP.y0) * SCALE,
              width: (HOTSPOT_BOX.x1 - HOTSPOT_BOX.x0) * SCALE,
              height: (HOTSPOT_BOX.y1 - HOTSPOT_BOX.y0) * SCALE,
            }}
          />
        )}

        {/* transform/backgroundPosition written imperatively via
            wrapElRef/spriteElRef in paint() above, not as React style props
            - see that ref's own comment for why (and UnderworldMapScene.jsx
            for the shake-fix reasoning behind translate3d+snapToDevicePixel
            in the first place). */}
        {bgReady && (
          <div ref={wrapElRef} className="pointer-events-none absolute left-0 top-0" style={{ willChange: 'transform' }}>
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
          </div>
        )}

        {bgReady && isNear && (
          <div
            className="pointer-events-none absolute -translate-x-1/2 whitespace-nowrap rounded border border-yellow-400 bg-black/80 px-2 py-1 text-xs font-bold text-yellow-300"
            style={{
              left: ((HOTSPOT_BOX.x0 + HOTSPOT_BOX.x1) / 2 - CROP.x0) * SCALE,
              top: (HOTSPOT_BOX.y0 - CROP.y0) * SCALE - 26,
            }}
          >
            [Enter] Play
          </div>
        )}
      </div>
      <p className="text-center text-[10px] text-gray-500">
        Arrow keys / WASD to walk, Enter or click the 777 machine to see every game on the floor.
      </p>
    </div>
  )
}
