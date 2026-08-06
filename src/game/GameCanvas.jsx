import { useEffect, useRef } from 'react'
import Phaser from 'phaser'
import OverworldScene from './scenes/OverworldScene'
import DominoWorldScene from './scenes/DominoWorldScene'
import TokyoScene from './scenes/TokyoScene'
import KyotoScene from './scenes/KyotoScene'
import OsakaScene from './scenes/OsakaScene'
import SapporoScene from './scenes/SapporoScene'
import { createEventBridge } from './eventBridge'

import { useGameStore } from '../store/useGameStore'

const SCENES_BY_MODE = {
  overworld: OverworldScene,
  tokyo: OverworldScene,
  kyoto: OverworldScene,
  osaka: OverworldScene,
  sapporo: OverworldScene,
  domino: DominoWorldScene,
}

export default function GameCanvas({ mode = 'overworld', bridge, spawnOverride }) {
  const containerRef = useRef(null)
  const gameRef = useRef(null)
  const sceneRef = useRef(null)

  useEffect(() => {
    // Phaser.Game's constructor defers to Phaser.DOM.DOMContentLoaded(),
    // which - whenever document.readyState is already 'complete'/
    // 'interactive' (true for essentially every mount of this component,
    // since it only ever happens well after the page's first paint) - calls
    // Game.boot() SYNCHRONOUSLY, immediately, inside the `new Phaser.Game()`
    // call itself. boot() unconditionally inserts the game's canvas into
    // `parent` (AddToDOM) with no check for a pending destroy. Meanwhile
    // Game.destroy() is itself deferred: it only flips a `pendingDestroy`
    // flag, and the real teardown (which actually removes the canvas from
    // the DOM) only runs on THAT instance's own next internal step().
    //
    // Under React 18/19 StrictMode's dev-only synchronous
    // mount -> cleanup -> mount double-invoke, that combination is a real
    // race: the "fake" first mount's Phaser.Game already has its canvas
    // inserted into the DOM (synchronously, per the above) by the time its
    // "fake" cleanup calls destroy() - but destroy() doesn't remove that
    // canvas right away, so the very next (real) mount's brand new
    // Phaser.Game constructs and inserts a SECOND canvas into the same
    // container before the first one has actually cleaned itself up. Both
    // canvases can then coexist for a stretch of real frames until the
    // dying instance's own render loop finally ticks and self-removes -
    // and if that dying canvas happens to paint on top, the user sees solid
    // black (an un-rendered/mid-teardown canvas) over a perfectly healthy
    // one underneath.
    //
    // Fix: defer the actual `new Phaser.Game()` construction by one
    // animation frame, and cancel that pending construction in cleanup if
    // it hasn't fired yet. StrictMode's double-invoke is entirely
    // synchronous (no frame boundary crossed between the fake mount and its
    // cleanup), so the fake mount's scheduled construction gets cancelled
    // before it ever runs - a real Phaser.Game is only ever actually built
    // once, by whichever mount survives past the next paint. This adds an
    // imperceptible ~16ms delay before the canvas first appears, on every
    // mount, in exchange for making construction/teardown never overlap.
    let cancelled = false
    let rafId = null

    const buildGame = () => {
      if (cancelled) return

      // Only Tokyo is a live, reachable map right now - Kyoto/Osaka/Sapporo
      // (and the currentCityId-driven switching that used to pick between
      // them) are kept in the codebase as dormant data/scenes, not deleted,
      // in case they get wired back in later. Overworld mode always
      // resolves to Tokyo regardless of currentCityId.
      const activeKey = mode === 'overworld' ? 'tokyo' : mode
      const SceneClass = SCENES_BY_MODE[activeKey] || SCENES_BY_MODE[mode] || OverworldScene
      const scene = new SceneClass()
      scene.bridge = bridge
      // Lets the overworld scene spawn the player at a specific location
      // (e.g. the Domino Gate, when returning from Domino City) instead of
      // its normal currentBlockId-based default. Ignored by scenes that
      // don't look at it.
      scene.spawnOverride = spawnOverride
      sceneRef.current = scene

      const config = {
        type: Phaser.AUTO,
        width: 1200,
        height: 600,
        scale: {
          mode: Phaser.Scale.FIT,
          autoCenter: Phaser.Scale.CENTER_BOTH,
        },
        resolution: window.devicePixelRatio || 1,
        parent: containerRef.current,
        backgroundColor: '#0a0d18',
        pixelArt: true,
        physics: {
          default: 'arcade',
          arcade: { gravity: { y: 0 }, debug: false },
        },
        scene: [scene],
      }

      gameRef.current = new Phaser.Game(config)
    }

    rafId = requestAnimationFrame(buildGame)

    const unsubResume = bridge.on('resumeScene', () => {
      sceneRef.current?.resumeFromModal?.()
    })

    // Jail mini-map: arrest/exit/maze-clear are scene-zone swaps rather than
    // a forced full-screen modal (see WorldScreen.jsx's jail?.inJail effect
    // and JailEscapeModal/JailMazeModal's continue handlers) - same
    // "React emits, GameCanvas drives the scene directly" shape as
    // cityTravel below.
    const unsubEnterJail = bridge.on('enterJail', () => {
      sceneRef.current?.loadZone?.('jailCell')
    })
    const unsubExitJail = bridge.on('exitJail', () => {
      sceneRef.current?.loadZone?.('overworld')
    })
    // Lands the player in the REAL, persistent Underworld hub (same room a
    // normal front-door visit reaches), not a disposable one-scene backdrop -
    // see OverworldScene.js's enterUnderworldFromJail for why.
    const unsubEnterJailUnderworld = bridge.on('enterJailUnderworld', () => {
      sceneRef.current?.enterUnderworldFromJail?.()
    })

    const unsubCityTravel = bridge.on('cityTravel', ({ cityId }) => {
      useGameStore.getState().switchCity(cityId)
      if (sceneRef.current) {
        if (typeof sceneRef.current.teleportToCity === 'function') {
          sceneRef.current.teleportToCity(cityId)
        }
        if (typeof sceneRef.current.loadZone === 'function') {
          sceneRef.current.loadZone('overworld', false)
        } else if (sceneRef.current.scene) {
          sceneRef.current.scene.restart()
        }
      }
    })

    // Phaser's keyboard plugin listens on `window` and calls preventDefault()
    // on every captured key (WASD/E/R here, plus Space/arrows via
    // createCursorKeys()) regardless of DOM focus - it never checks
    // document.activeElement. Without this, typing in ANY text field on top
    // of the canvas (NPC chat, Guide app, etc.) either eats WASD/Space
    // keystrokes or fires the game's movement/interact logic underneath.
    // Toggling the whole plugin off while a text field is focused fixes it
    // for every current and future input, not just one modal.
    const isTextField = (el) => el?.matches?.('input, textarea, [contenteditable="true"]')
    const handleFocusIn = (e) => {
      if (!isTextField(e.target)) return
      const kb = sceneRef.current?.input?.keyboard
      if (kb) {
        kb.enabled = false
        kb.disableGlobalCapture?.()
      }
    }
    const handleFocusOut = (e) => {
      if (!isTextField(e.target)) return
      const kb = sceneRef.current?.input?.keyboard
      if (kb) {
        kb.enabled = true
        kb.enableGlobalCapture?.()
      }
    }
    document.addEventListener('focusin', handleFocusIn)
    document.addEventListener('focusout', handleFocusOut)

    return () => {
      cancelled = true
      if (rafId !== null) cancelAnimationFrame(rafId)
      unsubResume()
      unsubEnterJail()
      unsubExitJail()
      unsubEnterJailUnderworld()
      unsubCityTravel()
      document.removeEventListener('focusin', handleFocusIn)
      document.removeEventListener('focusout', handleFocusOut)
      gameRef.current?.destroy(true)
      gameRef.current = null
    }
  }, [mode, bridge, spawnOverride])

  return (
    <div className="w-full h-full flex items-center justify-center bg-[#070a14]">
      {/* max-w-5xl (1024px) here used to bottleneck the canvas back down
          even after WorldScreen.jsx's outer wrapper was widened to
          max-w-7xl (1280px) for the 1200x600 logical resolution - Phaser's
          Scale.FIT preserves the 2:1 aspect ratio regardless, but a
          narrower box than the resolution's own aspect just meant more
          unused letterbox space. max-w-[1200px] matches the configured
          resolution 1:1 (no forced upscaling) while actually using the
          width the outer wrapper now provides; height bumped to 600px to
          match the same 2:1 ratio at the md breakpoint. */}
      <div ref={containerRef} className="w-full h-[500px] md:h-[600px] max-w-[1200px] border-4 border-yellow-400/90 rounded-xl shadow-2xl overflow-hidden relative" />
    </div>
  )
}

export { createEventBridge }
