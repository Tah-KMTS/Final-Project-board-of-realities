import { useEffect, useRef, useState } from 'react'
import { useGameStore } from '../../store/useGameStore'
import { rollCollectible } from './collectibles'
import { playClickSound, playGoodHitSound, playBadHitSound, playVictorySound } from '../../audio/sfx'

// Real 2D claw machine (left/right movement, a drop-and-grab sequence with
// its own success/fail roll, and a basic "physics" slip chance on the way
// back) - replaces the old "stop a sweeping meter in a zone" timing minigame
// (see git history) at the user's explicit request for an actual claw you
// drive around, not an abstract meter, referencing a real claw-machine
// Pygame spec. This project's usual rule still applies though: Phaser is
// reserved for the persistent overworld map only, every minigame (this one
// included) is a plain React+CSS+rAF component, not a new engine.
//
// Art: the real cabinet photo (public/assets/packs/claw-machine/
// labubu_claw_case.png) is shown FULL, uncropped, at the user's explicit
// request - an earlier pass cropped it to dodge an earlier version of this
// same photo's painted claw prop (a static decoration permanently parked
// over one prize). The user then supplied real claw + figure sprites
// (labubusprite.png, auto-extracted via a connected-component pass over
// its alpha channel - see production/) for the interactive claw/prize, AND
// separately replaced the cabinet photo itself with a version that has no
// claw prop baked in at all - all 9 shelf columns show a clean, unobscured
// toy now, so there's nothing left to dodge or hide. claw_open.png/
// claw_closed.png are real art, not a CSS shape, and the prize the claw
// carries/drops is a real figure sprite (one per rarity tier - gold+cape
// for legendary, red+cape for rare, plain for common/uncommon, echoing the
// sheet's own "fancier outfit = fancier tier" visual logic) instead of a
// plain colored dot.
const IMAGE_URL = '/assets/packs/claw-machine/labubu_claw_case.png'
const NATIVE_FULL = 2048
const DISPLAY_W = 480
const SCALE = DISPLAY_W / NATIVE_FULL

const CLAW_SPRITES = {
  open: '/assets/packs/claw-machine/claw_open.png',
  closed: '/assets/packs/claw-machine/claw_closed.png',
}
const CLAW_DISPLAY_H = 74
const PRIZE_SPRITES = {
  common: '/assets/packs/claw-machine/prize_common.png',
  uncommon: '/assets/packs/claw-machine/prize_uncommon.png',
  rare: '/assets/packs/claw-machine/prize_rare.png',
  legendary: '/assets/packs/claw-machine/prize_legendary.png',
}
const PRIZE_DISPLAY_H = 34

// Row-1 toy head x centers, native image coords - all 9 shelf columns
// (see header comment on why there's no gap to skip now), measured by hand
// against a coordinate-grid overlay of the source art (see production/),
// not guessed.
const COLUMN_NATIVE_X = [470, 600, 730, 860, 990, 1110, 1240, 1370, 1490]
const COLUMNS = COLUMN_NATIVE_X.map((x) => x * SCALE)
const CLAW_MIN_X = COLUMNS[0]
const CLAW_MAX_X = COLUMNS[COLUMNS.length - 1]
const COLUMN_HALF_SPACING = (COLUMNS[1] - COLUMNS[0]) / 2

const HOME_Y = 600 * SCALE // claw rail height, at rest
const DROP_Y = 770 * SCALE // reaches down to row-1 toy height

const MOVE_SPEED = 170 // display px/sec, held-key free movement while idle
const DESCEND_MS = 420
const GRAB_PAUSE_MS = 220
const RISE_MS = 380
const CARRY_MS = 480
const DROP_FALL_MS = 360
const RESULT_HOLD_MS = 900

const PLAY_COST = 8
// Classic claw-machine honesty: even landing dead-center on a toy is far
// from a guaranteed grab. grabQuality (0..1, how close the claw stopped to
// the nearest column's exact center) both raises this base success chance
// AND - reused unchanged from collectibles.js's original meter version -
// reweights which rarity you get IF the grab (and the carry below) holds.
const BASE_GRAB_CHANCE = 0.45
const MAX_GRAB_BONUS = 0.4
// A grab that only barely succeeded can still slip and drop the prize
// while the claw carries it back - the "basic physics" beat: a shaky,
// poorly-centered grab is fragile, a dead-center one is secure.
const MAX_SLIP_CHANCE = 0.25

const RARITY_COLOR = {
  common: 'text-gray-300',
  uncommon: 'text-green-300',
  rare: 'text-cyan-300',
  legendary: 'text-yellow-300',
}

function clamp(min, max, v) {
  return Math.min(max, Math.max(min, v))
}

export default function ClawMachine() {
  const cash = useGameStore((s) => s.cash)
  const addCash = useGameStore((s) => s.addCash)
  const addItem = useGameStore((s) => s.addItem)

  // 'idle' (free left/right movement, Down/Space/click to drop) ->
  // 'descending' -> 'grabbing' (the binary success roll happens here) ->
  // 'rising' -> 'carrying' (only if it grabbed something - the slip roll
  // happens here) -> 'dropping' (prize falls into the chute) -> back to
  // 'idle'. A failed grab or a mid-carry slip both short-circuit straight
  // back toward 'idle' after a brief result message instead of continuing
  // the happy path.
  const [phase, setPhase] = useState('idle')
  const [clawX, setClawX] = useState((CLAW_MIN_X + CLAW_MAX_X) / 2)
  const [clawY, setClawY] = useState(HOME_Y)
  const [transitionMs, setTransitionMs] = useState(0)
  const [gripOpen, setGripOpen] = useState(true)
  const [carried, setCarried] = useState(null) // rolled collectible while being carried/held, or null
  const [prizesWon, setPrizesWon] = useState(0)
  const [message, setMessage] = useState(null)

  const clawXRef = useRef(clawX)
  const phaseRef = useRef('idle')
  const keysRef = useRef(new Set())
  const rafRef = useRef(null)
  const lastAtRef = useRef(0)

  useEffect(() => {
    clawXRef.current = clawX
  }, [clawX])
  useEffect(() => {
    phaseRef.current = phase
  }, [phase])

  // Free movement only runs while idle - the scripted drop/grab/carry
  // sequence below drives clawX/clawY itself via timed state changes (each
  // paired with a matching CSS transition duration) instead of this loop.
  useEffect(() => {
    const onKeyDown = (e) => {
      if (['ArrowLeft', 'ArrowRight', 'ArrowDown', 'KeyA', 'KeyD', 'Space'].includes(e.code)) {
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
    lastAtRef.current = performance.now()
    const tick = (now) => {
      const dt = Math.min(0.05, (now - lastAtRef.current) / 1000)
      lastAtRef.current = now
      if (phaseRef.current === 'idle') {
        const left = keysRef.current.has('ArrowLeft') || keysRef.current.has('KeyA')
        const right = keysRef.current.has('ArrowRight') || keysRef.current.has('KeyD')
        const inputX = (right ? 1 : 0) - (left ? 1 : 0)
        if (inputX !== 0) {
          const next = clamp(CLAW_MIN_X, CLAW_MAX_X, clawXRef.current + inputX * MOVE_SPEED * dt)
          clawXRef.current = next
          setClawX(next)
          setTransitionMs(0)
        }
        if (keysRef.current.has('ArrowDown') || keysRef.current.has('Space')) {
          beginDrop()
        }
      }
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const beginDrop = () => {
    if (phaseRef.current !== 'idle' || cash < PLAY_COST) return
    addCash(-PLAY_COST)
    setMessage(null)
    playClickSound()

    setPhase('descending')
    setTransitionMs(DESCEND_MS)
    setClawY(DROP_Y)

    setTimeout(() => {
      // Grab roll: how close the claw stopped to the nearest column decides
      // both this binary success chance and (if it holds all the way
      // through carrying below) the prize's rarity odds.
      const nearestDist = Math.min(...COLUMNS.map((c) => Math.abs(c - clawXRef.current)))
      const grabQuality = clamp(0, 1, 1 - nearestDist / COLUMN_HALF_SPACING)
      const grabbed = Math.random() < BASE_GRAB_CHANCE + MAX_GRAB_BONUS * grabQuality

      setPhase('grabbing')
      setGripOpen(false)

      setTimeout(() => {
        if (!grabbed) {
          playBadHitSound()
          setMessage({ text: 'The claw closes on nothing.', good: false })
          setGripOpen(true)
          setPhase('rising')
          setTransitionMs(RISE_MS)
          setClawY(HOME_Y)
          setTimeout(() => finishRun(), RISE_MS + RESULT_HOLD_MS)
          return
        }

        playGoodHitSound()
        const item = rollCollectible(grabQuality)
        setCarried(item)
        setPhase('rising')
        setTransitionMs(RISE_MS)
        setClawY(HOME_Y)

        setTimeout(() => {
          // Slip roll: a shaky grab (low grabQuality) can still lose the
          // prize on the way to the chute even though it "succeeded" above.
          const slipChance = MAX_SLIP_CHANCE * (1 - grabQuality)
          const slipped = Math.random() < slipChance

          setPhase('carrying')
          setTransitionMs(CARRY_MS)
          setClawX(CLAW_MIN_X - COLUMN_HALF_SPACING)

          setTimeout(() => {
            if (slipped) {
              playBadHitSound()
              setMessage({ text: `${item.name} slips loose before it reaches the chute...`, good: false })
              setCarried(null)
              setPhase('rising')
              setTransitionMs(0)
              setClawX((CLAW_MIN_X + CLAW_MAX_X) / 2)
              setTimeout(() => finishRun(), RESULT_HOLD_MS)
              return
            }

            setPhase('dropping')
            setGripOpen(true)
            setTimeout(() => {
              playVictorySound()
              addItem(item)
              setPrizesWon((n) => n + 1)
              setMessage({ text: item.name, good: true, rarity: item.rarity, sellValue: item.sellValue })
              setCarried(null)
              setTransitionMs(0)
              setClawX((CLAW_MIN_X + CLAW_MAX_X) / 2)
              setTimeout(() => finishRun(), RESULT_HOLD_MS)
            }, DROP_FALL_MS)
          }, CARRY_MS)
        }, RISE_MS)
      }, GRAB_PAUSE_MS)
    }, DESCEND_MS)
  }

  const finishRun = () => {
    setPhase('idle')
    setGripOpen(true)
    setClawY(HOME_Y)
  }

  return (
    <div className="border-2 border-cyan-400 bg-[#0a1622] p-3 text-sm">
      <div className="mb-2 flex items-center justify-between text-xs">
        <span className="text-gray-400">Arrows/A-D to move, Down or Space to drop. ${PLAY_COST}/play.</span>
        <span className="font-bold text-pink-300">Prizes: {prizesWon}</span>
      </div>

      <div
        className="relative mx-auto overflow-hidden border-2 border-gray-700"
        style={{ width: DISPLAY_W, height: DISPLAY_W }}
      >
        <img
          src={IMAGE_URL}
          alt="Labubu Claw cabinet"
          draggable={false}
          className="pointer-events-none absolute left-0 top-0 select-none"
          style={{ width: DISPLAY_W, height: DISPLAY_W, imageRendering: 'pixelated' }}
        />

        {/* The claw: a real open/closed sprite pair (see header comment),
            positioned by its own top-left corner (not centered via
            translate) so its motor-housing top edge - identical in both
            crops - lines up exactly at clawY regardless of which state is
            showing. */}
        <div
          className="absolute top-0 flex flex-col items-center"
          style={{
            left: clawX,
            transform: 'translateX(-50%)',
            transition: transitionMs ? `left ${transitionMs}ms ease-in-out, top ${transitionMs}ms ease-in-out` : 'none',
            top: clawY,
          }}
        >
          <img
            src={gripOpen ? CLAW_SPRITES.open : CLAW_SPRITES.closed}
            alt=""
            draggable={false}
            className="select-none"
            style={{ height: CLAW_DISPLAY_H, width: 'auto', imageRendering: 'pixelated' }}
          />
          {carried && (
            <img
              src={PRIZE_SPRITES[carried.rarity]}
              alt=""
              draggable={false}
              className="-mt-2 select-none"
              style={{ height: PRIZE_DISPLAY_H, width: 'auto', imageRendering: 'pixelated' }}
            />
          )}
        </div>
      </div>

      <div className="mt-2 flex items-center gap-2">
        <button
          onClick={() => {
            keysRef.current.add('ArrowLeft')
            setTimeout(() => keysRef.current.delete('ArrowLeft'), 120)
          }}
          disabled={phase !== 'idle'}
          className="border-2 border-cyan-400 px-3 py-1 font-bold text-cyan-300 hover:bg-cyan-400 hover:text-black disabled:opacity-30"
        >
          ◄
        </button>
        <button
          onClick={beginDrop}
          disabled={phase !== 'idle' || cash < PLAY_COST}
          className="flex-1 border-2 border-yellow-300 px-3 py-1 font-bold text-yellow-300 hover:bg-yellow-300 hover:text-black disabled:opacity-30"
        >
          {phase === 'idle' ? `Drop Claw ($${PLAY_COST})` : 'Working...'}
        </button>
        <button
          onClick={() => {
            keysRef.current.add('ArrowRight')
            setTimeout(() => keysRef.current.delete('ArrowRight'), 120)
          }}
          disabled={phase !== 'idle'}
          className="border-2 border-cyan-400 px-3 py-1 font-bold text-cyan-300 hover:bg-cyan-400 hover:text-black disabled:opacity-30"
        >
          ►
        </button>
      </div>

      {message && (
        <p className={`mt-2 text-xs ${message.good ? 'text-green-400' : 'text-gray-400'}`}>
          {message.good ? (
            <>
              You won: <span className={`font-bold ${RARITY_COLOR[message.rarity]}`}>{message.text}</span>{' '}
              <span className="text-gray-500">({message.rarity}, est. ${message.sellValue})</span>
            </>
          ) : (
            message.text
          )}
        </p>
      )}
    </div>
  )
}
