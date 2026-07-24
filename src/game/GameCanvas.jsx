import { useEffect, useRef } from 'react'
import Phaser from 'phaser'
import OverworldScene from './scenes/OverworldScene'
import DominoWorldScene from './scenes/DominoWorldScene'
import { createEventBridge } from './eventBridge'

import { useGameStore } from '../store/useGameStore'

// Hunter's Rift, Financial Anarchy and King of Games are no longer separate
// mounted scenes - they're all regions of one continuous OverworldScene.
// Domino City keeps its own star-topology scene (entered/exited like a big
// building via a gate on the overworld map), so it's the only other mode.
const SCENES_BY_MODE = {
  overworld: OverworldScene,
  domino: DominoWorldScene,
}

export default function GameCanvas({ mode = 'overworld', bridge, spawnOverride }) {
  const containerRef = useRef(null)
  const gameRef = useRef(null)
  const sceneRef = useRef(null)

  useEffect(() => {
    const SceneClass = SCENES_BY_MODE[mode] || OverworldScene
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
      width: 800,
      height: 500,
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

    const unsubCityTravel = bridge.on('cityTravel', ({ cityId }) => {
      useGameStore.getState().switchCity(cityId)
      if (sceneRef.current) {
        if (typeof sceneRef.current.loadZone === 'function') {
          sceneRef.current.loadZone('overworld', false)
        } else if (sceneRef.current.scene) {
          sceneRef.current.scene.restart()
        }
      }
    })

    return () => {
      unsubResume()
      unsubCityTravel()
      gameRef.current?.destroy(true)
      gameRef.current = null
    }
  }, [mode, bridge])

  return (
    <div className="w-full h-full flex items-center justify-center bg-[#070a14]">
      <div ref={containerRef} className="w-full h-[500px] md:h-[560px] max-w-5xl border-4 border-yellow-400/90 rounded-xl shadow-2xl overflow-hidden relative" />
    </div>
  )
}

export { createEventBridge }
