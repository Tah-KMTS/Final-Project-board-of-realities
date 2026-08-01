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
    // Only Tokyo is a live, reachable map right now - Kyoto/Osaka/Sapporo
    // (and the currentCityId-driven switching that used to pick between
    // them) are kept in the codebase as dormant data/scenes, not deleted,
    // in case they get wired back in later. Overworld mode always resolves
    // to Tokyo regardless of currentCityId.
    const activeKey = mode === 'overworld' ? 'tokyo' : mode
    const SceneClass = SCENES_BY_MODE[activeKey] || SCENES_BY_MODE[mode] || OverworldScene
    const scene = new SceneClass()
    scene.bridge = bridge
    // Lets the overworld scene spawn the player at a specific location
    // (e.g. the Domino Gate, when returning from Domino City) instead of
    // its normal currentBlockId-based default. Ignored by scenes that don't
    // look at it.
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
    const unsubEnterJailUnderworld = bridge.on('enterJailUnderworld', () => {
      sceneRef.current?.loadZone?.('jailUnderworld')
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

    return () => {
      unsubResume()
      unsubEnterJail()
      unsubExitJail()
      unsubEnterJailUnderworld()
      unsubCityTravel()
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
