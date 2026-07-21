import { useEffect, useRef, useState } from 'react'
import { useGameStore } from '../../store/useGameStore'
import { themeSong } from '../../audio/themeSong'

export default function WelcomeScreen() {
  const setScreen = useGameStore((s) => s.setScreen)
  const loadGame = useGameStore((s) => s.loadGame)
  const hasSaveGame = useGameStore((s) => s.hasSaveGame)
  const [isPlaying, setIsPlaying] = useState(false)
  const [volume, setVolume] = useState(0.3)
  const saveExists = useRef(hasSaveGame())

  useEffect(() => {
    return () => themeSong.pause()
  }, [])

  const toggleMusic = () => {
    if (isPlaying) {
      themeSong.pause()
      setIsPlaying(false)
    } else {
      themeSong.play()
      setIsPlaying(true)
    }
  }

  const handleVolumeChange = (e) => {
    const v = Number(e.target.value)
    setVolume(v)
    themeSong.setVolume(v)
  }

  const handleLoad = () => {
    if (loadGame()) {
      setScreen('world')
    }
  }

  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-8 bg-[#0f1020] font-mono text-white"
      style={{ imageRendering: 'pixelated' }}>
      <div className="text-center">
        <h1 className="text-5xl font-bold tracking-widest text-yellow-300 drop-shadow-[3px_3px_0_#7a2f00]">
          BOARD OF REALITIES
        </h1>
        <p className="mt-2 text-sm text-gray-400">Welcome to the Game</p>
      </div>

      <div className="flex flex-col gap-3 w-64">
        <button
          onClick={() => setScreen('characterCreator')}
          className="border-4 border-yellow-300 bg-[#1c1d3a] px-4 py-3 text-lg font-bold hover:bg-yellow-300 hover:text-black transition-colors"
        >
          New Game
        </button>
        <button
          onClick={handleLoad}
          disabled={!saveExists.current}
          className="border-4 border-blue-300 bg-[#1c1d3a] px-4 py-3 text-lg font-bold hover:bg-blue-300 hover:text-black transition-colors disabled:opacity-30 disabled:hover:bg-[#1c1d3a] disabled:hover:text-white"
        >
          Load Game
        </button>
        <button
          disabled
          className="border-4 border-gray-600 bg-[#1c1d3a] px-4 py-3 text-lg font-bold opacity-30"
          title="Save from within the game"
        >
          Save Game
        </button>
      </div>

      <div className="flex items-center gap-4 border-2 border-gray-600 bg-[#1c1d3a] px-4 py-2">
        <button onClick={toggleMusic} className="text-xl">
          {isPlaying ? '⏸' : '▶'}
        </button>
        <span className="text-xs text-gray-400">8-BIT THEME</span>
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={volume}
          onChange={handleVolumeChange}
          className="w-24"
        />
      </div>
    </div>
  )
}
