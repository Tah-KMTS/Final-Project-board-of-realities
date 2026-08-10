import { useEffect, useRef, useState } from 'react'
import { playDoorSound, playClickSound } from '../../audio/sfx'
import { PLAYER_REAL_SPRITE } from '../../game/packs/playerRealSprite'

// Walkable floor for the Casino - the actual reference illustration
// (public/assets/packs/casino-interior/casino_interior.png, a 2048x2048
// casino+arcade floor) replaces the old flat pink "Casino Floor" Phaser prop
// (buildCasinoInteriorZone in OverworldScene.js, now unreachable/deleted -
// see that file's own header comment) - same "real image + a small React/CSS
// walker" technique UnderworldMapScene.jsx already established, at the
// user's explicit request to walk up to the 777 slot machine instead of a
// plain building box. Unlike Underworld (4 former buildings merged into
// tabs, one walkable room per tab), Casino was always ONE building with
// EVERY game mode already living in CasinoModal.jsx's tab bar - so this
// scene has exactly one interactable (the 777 machine, the picture's own
// most recognizable prop and literal center) rather than a room per tab.
// Walking up and pressing Enter/E opens the SAME full tab bar as before,
// it's just reached by walking instead of an instant building click.
//
// The source image is square (2048x2048) and top-heavy with signage (CASINO/
// ARCADE neon, a monster-mouth tunnel) that isn't part of a walkable floor -
// this crops to just the playable band (the chip stacks/blackjack table/777
// machine/arcade cabinets row) via the same background-position crop
// technique CasinoModal.jsx's own CasinoBanner and UnderworldModal.jsx's
// RoomBanner use, rather than showing the whole tall image letterboxed.
// Measured by hand against a coordinate-grid overlay of the source art (see
// production/ for how), not guessed.
export const IMAGE_URL = '/assets/packs/casino-interior/casino_interior.png'
const NATIVE_SIZE = 2048
const CROP = { x0: 0, y0: 580, x1: 2048, y1: 1420 }

const DISPLAY_W = 1040
const SCALE = DISPLAY_W / (CROP.x1 - CROP.x0)
const DISPLAY_H = Math.round((CROP.y1 - CROP.y0) * SCALE)

// Single walk lane (native image coords, full-picture space - same space
// CROP/the hotspot rect below are measured in). No upper/lower lane split
// like Underworld's two-level cutaway - this crop is one floor row.
const LANE_Y = 1360
const PLAYER_MIN_X = CROP.x0 + 40
const PLAYER_MAX_X = CROP.x1 - 40

// The 777 machine's own x-range (a bit wider than its exact cabinet - see
// UnderworldMapScene.jsx's ROOMS comment on the same choice - so the "near"
// zone reads as generous, not pixel-hunt-precise) plus its full cabinet
// rect for the visual highlight box. Both in native image coords.
const HOTSPOT = { x0: 800, x1: 1250 }
const HOTSPOT_BOX = { x0: 860, y0: 895, x1: 1185, y1: 1350 }

function clamp(min, max, v) {
  return Math.min(max, Math.max(min, v))
}

// See UnderworldMapScene.jsx's own copy of this function for why a plain
// Math.round isn't enough - a whole CSS pixel still isn't a whole DEVICE
// pixel on Windows' common 125%/150% display-scaling presets, and this
// pixelated sprite shimmers on that sub-device-pixel remainder otherwise.
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
// rather than walking.
const WALK_FRAME = 0

const WALK_SPEED = 720 // native px/sec, matches UnderworldMapScene.jsx

// `onEnter()` fires once, when the player reaches the 777 machine and
// presses Enter/E (or clicks it directly) - CasinoModal.jsx swaps from this
// scene to its existing tab bar in response, same shape as
// UnderworldMapScene.jsx's onEnter(tabId) except there's only one
// destination here, so it takes no argument.
export default function CasinoMapScene({ onEnter }) {
  const [player, setPlayer] = useState({ x: 1000, facing: 'right' })
  // Same first-decode-hitch guard as UnderworldMapScene.jsx - this is a real
  // ~7.8MB illustration, and its first decode is real main-thread work that
  // can stall the player's first few movement frames if it overlaps with
  // them. See that file's own header comment for the full reasoning.
  const [bgReady, setBgReady] = useState(false)
  const playerRef = useRef(player)
  const keysRef = useRef(new Set())
  const rafRef = useRef(null)
  const lastAtRef = useRef(performance.now())
  const wasNearRef = useRef(false)
  const prevEnterHeldRef = useRef(false)

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
    playerRef.current = player
  }, [player])

  useEffect(() => {
    const onKeyDown = (e) => {
      if (['ArrowLeft', 'ArrowRight', 'Enter', 'KeyA', 'KeyD', 'KeyE'].includes(e.code)) {
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
      const inputX = (right ? 1 : 0) - (left ? 1 : 0)
      if (inputX !== 0) {
        p.x = clamp(PLAYER_MIN_X, PLAYER_MAX_X, p.x + inputX * WALK_SPEED * dt)
        p.facing = inputX > 0 ? 'right' : 'left'
      }

      const isNear = p.x >= HOTSPOT.x0 && p.x <= HOTSPOT.x1
      if (isNear && !wasNearRef.current) playClickSound()
      wasNearRef.current = isNear

      const enterHeld = keysRef.current.has('Enter') || keysRef.current.has('KeyE')
      if (enterHeld && !prevEnterHeldRef.current && isNear) {
        playDoorSound()
        onEnter()
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

  const isNear = player.x >= HOTSPOT.x0 && player.x <= HOTSPOT.x1
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

        {/* transform:translate3d + snapToDevicePixel, not left/top - same
            shake fix as UnderworldMapScene.jsx, see its own comment. */}
        {bgReady && (
          <div
            className="pointer-events-none absolute left-0 top-0"
            style={{
              transform: `translate3d(${snapToDevicePixel((player.x - CROP.x0) * SCALE - SPRITE_W / 2)}px, ${snapToDevicePixel((LANE_Y - CROP.y0) * SCALE - SPRITE_H)}px, 0)`,
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
          </div>
        )}

        {bgReady && isNear && (
          <div
            className="pointer-events-none absolute -translate-x-1/2 whitespace-nowrap rounded border border-yellow-400 bg-black/80 px-2 py-1 text-xs font-bold text-yellow-300"
            style={{
              left: ((HOTSPOT_BOX.x0 + HOTSPOT_BOX.x1) / 2 - CROP.x0) * SCALE,
              top: (LANE_Y - CROP.y0) * SCALE - SPRITE_H - 26,
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
