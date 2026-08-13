import { useState } from 'react'
import { useGameStore } from '../../store/useGameStore'
import FerrumWingsModal from './FerrumWingsModal'

// Walk-up gate for the Game Center's Ferrum Wings cabinet: charges the
// entry fee up front (same "pay to start" convention every other minigame
// here uses, e.g. ClawMachine.jsx's PLAY_COST) before handing off to the
// actual game (FerrumWingsModal - a full-page iframe takeover, see its own
// header for why it's a separate component). This used to be
// ArcadeModal.jsx's `launchFerrumWings` (reached only via Casino's Pixel
// Palace Arcade tab, now removed); moved out to the cabinet already
// standing in the Game Center's walk-in room (buildArcadeInteriorZone in
// OverworldScene.js) so walking up and pressing E launches it directly,
// same pattern as that room's Turbo Racer/Air Hockey cabinets - those are
// free to play so they skip straight to their modal, this one still needs
// its own small gate screen since it isn't.
const ENTRY_FEE = 50

export default function SortieCabinetModal({ onClose }) {
  const cash = useGameStore((s) => s.cash)
  const addCash = useGameStore((s) => s.addCash)
  const [launched, setLaunched] = useState(false)

  if (launched) return <FerrumWingsModal onClose={onClose} />

  const launch = () => {
    if (cash < ENTRY_FEE) return
    addCash(-ENTRY_FEE)
    setLaunched(true)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="glass-panel w-[440px] max-w-[95vw] border-4 border-purple-400 bg-[#1c1d3a] p-6 font-mono text-white">
        <p className="mb-1 text-xs uppercase tracking-widest text-gray-500">Game Center</p>
        <h2 className="mb-2 text-xl font-bold text-purple-300">Capital Syndicate: Operation Ferrum Wings</h2>
        <p className="mb-4 text-xs text-gray-400">
          A full arcade cabinet install - a 4-sector shmup with its own briefing, bosses, and a super laser. Every
          enemy you clear pays out on the way to the payout terminal - the further you get and the higher your
          score, the bigger the cut.
        </p>
        <button
          onClick={launch}
          disabled={cash < ENTRY_FEE}
          className="mb-3 w-full border-2 border-purple-400 py-1.5 text-sm font-bold text-purple-300 hover:bg-purple-400 hover:text-black disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent"
        >
          Launch Sortie (${ENTRY_FEE})
        </button>
        <button onClick={onClose} className="w-full border-4 border-gray-500 py-2 font-bold hover:bg-gray-500">
          Leave
        </button>
      </div>
    </div>
  )
}
