import { useEffect, useRef } from 'react'
import Phaser from 'phaser'
import OverworldScene from './scenes/OverworldScene'
import DominoWorldScene from './scenes/DominoWorldScene'
import { createEventBridge } from './eventBridge'

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
      width: 640,
      height: 480,
      // Render at the display's real pixel density so sprites/tiles stay
      // crisp on Retina/high-DPI screens instead of the browser upscaling
      // a lower-resolution backing canvas (pixelArt keeps nearest-neighbor
      // scaling, so this sharpens without softening the pixel-art look).
      resolution: window.devicePixelRatio || 1,
      parent: containerRef.current,
      backgroundColor: '#0f1020',
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

    return () => {
      unsubResume()
      gameRef.current?.destroy(true)
      gameRef.current = null
    }
  }, [mode, bridge])

  return <div ref={containerRef} className="border-4 border-yellow-300" />
}

export { createEventBridge }
