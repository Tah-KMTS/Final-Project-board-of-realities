import { useState } from 'react'
import { useGameStore } from '../../store/useGameStore'
import ClawMachine from './ClawMachine'

// Pixel Palace Arcade keeps its walk-in interior on the shared `amenity`
// Phaser room template (see BUILDING_INTERIOR_TEMPLATE in OverworldScene.js)
// - it only needed its own React modal, not a bespoke Phaser zone, since the
// claw machine is the one new mechanic here (contrast with Casino, which
// got a bespoke interior for four different minigames).
// `embedded` (default false): standalone call sites are unaffected. When
// true (CasinoModal's Arcade tab), skip the outer overlay + Leave button -
// the wrapping Casino modal supplies both.
export default function ArcadeModal({ onClose, embedded = false }) {
  const cash = useGameStore((s) => s.cash)
  const addCash = useGameStore((s) => s.addCash)
  const addReputation = useGameStore((s) => s.addReputation)
  const [result, setResult] = useState(null)

  const playAndMingle = () => {
    if (cash < 10) return
    addCash(-10)
    addReputation(2)
    setResult('You rack up a high score. People notice.')
  }

  const body = (
    <>
        <p className="mb-1 text-xs uppercase tracking-widest text-gray-500">Commercial District</p>
        <h2 className="mb-2 text-xl font-bold text-cyan-300">Pixel Palace Arcade</h2>
        <p className="mb-4 text-xs text-gray-400">
          Retro cabinets hum next to VR pods. Locals come here to be seen as much as to play.
        </p>

        <div className="mb-4 flex flex-col gap-2">
          <button
            onClick={playAndMingle}
            disabled={cash < 10}
            className="border-2 border-cyan-400 py-1.5 text-sm font-bold hover:bg-white/10 disabled:opacity-30"
          >
            Play a Round & Mingle ($10)
          </button>
        </div>

        {result && <p className="mb-4 text-xs italic text-gray-300">{result}</p>}

        <div className="mb-4">
          <h3 className="mb-2 text-sm font-bold text-cyan-300">Labubu-Style Claw Machine</h3>
          <ClawMachine />
        </div>

        {!embedded && (
          <button onClick={onClose} className="w-full border-4 border-gray-500 py-2 font-bold hover:bg-gray-500">
            Leave
          </button>
        )}
    </>
  )

  if (embedded) return body

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="glass-panel w-[460px] border-4 border-cyan-400 bg-[#1c1d3a] p-6 font-mono text-white">
        {body}
      </div>
    </div>
  )
}
