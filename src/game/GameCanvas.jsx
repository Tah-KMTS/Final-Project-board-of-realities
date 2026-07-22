import { useEffect, useRef } from 'react'
import Phaser from 'phaser'
import WorldScene from './scenes/WorldScene'
import HunterWorldScene from './scenes/HunterWorldScene'
import FinanceWorldScene from './scenes/FinanceWorldScene'
import YugiohWorldScene from './scenes/YugiohWorldScene'
import DominoWorldScene from './scenes/DominoWorldScene'
import { createEventBridge } from './eventBridge'

const SCENES_BY_BLOCK = {
  hunter: HunterWorldScene,
  finance: FinanceWorldScene,
  yugioh: YugiohWorldScene,
  domino: DominoWorldScene,
}

export default function GameCanvas({ blockId, bridge }) {
  const containerRef = useRef(null)
  const gameRef = useRef(null)
  const sceneRef = useRef(null)

  useEffect(() => {
    const SceneClass = SCENES_BY_BLOCK[blockId] || WorldScene
    const scene = new SceneClass()
    scene.bridge = bridge
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
  }, [blockId, bridge])

  return <div ref={containerRef} className="border-4 border-yellow-300" />
}

export { createEventBridge }
