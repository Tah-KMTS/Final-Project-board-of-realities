import { useRef } from 'react'
import { useGameStore } from '../../store/useGameStore'
import { playClickSound } from '../../audio/sfx'
import WelcomeSkyline from './WelcomeSkyline'
import { DEVELOPERS } from '../../features/cutscene/CreditsRoll'

export default function WelcomeScreen() {
  const setScreen = useGameStore((s) => s.setScreen)
  const startNewGame = useGameStore((s) => s.startNewGame)
  const loadGame = useGameStore((s) => s.loadGame)
  const hasSaveGame = useGameStore((s) => s.hasSaveGame)
  const saveExists = useRef(hasSaveGame())

  const handleLoad = () => {
    if (loadGame()) {
      setScreen('world')
    }
  }

  return (
    <div className="relative flex h-full w-full flex-col items-center justify-center gap-8 overflow-hidden bg-[#0f1020] font-mono text-white"
      style={{ imageRendering: 'pixelated' }}>
      {/* Procedural skyline backdrop, sits behind the starfield::before/
          after layers (index.css) attach to this same 0f1020 background and
          the content below (relative z-10 wrapper) via z-index, not DOM
          order - see WelcomeSkyline.jsx's own header for why. */}
      <WelcomeSkyline />

      <div className="relative z-10 flex flex-col items-center gap-8">
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
      </div>

      {/* Dev credit footer - same roster CreditsRoll.jsx lists at the end
          of a completed run, just condensed to one line since this is a
          title-screen footer, not a movie-style scroll. */}
      <p className="absolute bottom-3 left-0 right-0 z-10 px-4 text-center text-[10px] tracking-[0.15em] text-gray-600">
        Made by {DEVELOPERS.join(' · ')}
      </p>
    </div>
  )
}
