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
  overworld: TokyoScene,
  tokyo: TokyoScene,
  kyoto: KyotoScene,
  osaka: OsakaScene,
  sapporo: SapporoScene,
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
  }, [mode, bridge, spawnOverride])

  return (
    <div className="w-full h-full flex items-center justify-center bg-[#070a14]">
      <div ref={containerRef} className="w-full h-[500px] md:h-[560px] max-w-5xl border-4 border-yellow-400/90 rounded-xl shadow-2xl overflow-hidden relative" />
    </div>
  )
}

export { createEventBridge }
