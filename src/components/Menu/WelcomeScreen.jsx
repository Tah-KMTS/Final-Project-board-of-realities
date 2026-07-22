import { useEffect, useRef, useState } from 'react'
import { useGameStore } from '../../store/useGameStore'
import { themeSong } from '../../audio/themeSong'
import { playClickSound } from '../../audio/sfx'

// Focus mode: only Financial Anarchy is in play right now. The other 3
// worlds' entries are commented out, not deleted, so restoring them later
// is a one-line uncomment rather than re-authoring this list.
const DEV_WORLDS = [
  // { id: 'hunter', name: "The Hunter's Rift", accent: 'border-red-400 hover:bg-red-400', icon: '⚔️' },
  { id: 'finance', name: 'Capital Syndicate', accent: 'border-fuchsia-400 hover:bg-fuchsia-400', icon: '💰' },
  // { id: 'yugioh', name: 'King of Games', accent: 'border-purple-400 hover:bg-purple-400', icon: '🃏' },
  // { id: 'domino', name: 'Domino City', accent: 'border-cyan-400 hover:bg-cyan-400', icon: '🏙️' },
]

export default function WelcomeScreen() {
  const setScreen = useGameStore((s) => s.setScreen)
  const startNewGame = useGameStore((s) => s.startNewGame)
  const loadGame = useGameStore((s) => s.loadGame)
  const hasSaveGame = useGameStore((s) => s.hasSaveGame)
  const devJumpToWorld = useGameStore((s) => s.devJumpToWorld)
  const [isPlaying, setIsPlaying] = useState(false)
  const [volume, setVolume] = useState(0.3)
  const saveExists = useRef(hasSaveGame())
  const isDev = import.meta.env.DEV

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

  const handleDevJump = (blockId) => {
    playClickSound()
    devJumpToWorld(blockId)
  }

  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-8 bg-[#0f1020] font-mono text-white"
      style={{ imageRendering: 'pixelated' }}>
      <div className="text-center">
        <h1 className="title-glow text-5xl font-bold tracking-widest sm:text-6xl">
          CAPITAL SYNDICATE
        </h1>
        <p className="mt-2 text-sm tracking-[0.35em] text-fuchsia-400/80">FINANCIAL REALITY ENGINE</p>
        <p className="mt-3 text-sm tracking-[0.3em] text-gray-500">— WELCOME TO THE GAME —</p>
      </div>

      <div className="flex flex-col gap-3 w-64">
        <button
          onClick={() => {
            playClickSound()
            startNewGame()
          }}
          className="btn-sheen border-4 border-yellow-300 bg-[#1c1d3a] px-4 py-3 text-lg font-bold hover:bg-yellow-300 hover:text-black transition-colors"
        >
          New Game
        </button>
        <button
          onClick={handleLoad}
          disabled={!saveExists.current}
          className="btn-sheen border-4 border-blue-300 bg-[#1c1d3a] px-4 py-3 text-lg font-bold hover:bg-blue-300 hover:text-black transition-colors disabled:opacity-30 disabled:hover:bg-[#1c1d3a] disabled:hover:text-white"
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

      {isDev && (
        <div className="w-64 border-2 border-dashed border-cyan-400/60 bg-cyan-950/20 px-4 py-3">
          <p className="mb-2 text-center text-[10px] font-bold uppercase tracking-widest text-cyan-300">
            🛠 Dev Test Access — jump to world
          </p>
          <div className="flex flex-col gap-2">
            {DEV_WORLDS.map((w) => (
              <button
                key={w.id}
                onClick={() => handleDevJump(w.id)}
                className={`border-2 ${w.accent} bg-[#0f1020] px-3 py-1.5 text-left text-xs font-bold hover:text-black transition-colors`}
              >
                {w.icon} {w.name}
              </button>
            ))}
          </div>
          <p className="mt-2 text-center text-[9px] text-cyan-500/70">
            Dev builds only — skips dice roll &amp; unlock conditions
          </p>
        </div>
      )}
    </div>
  )
}
