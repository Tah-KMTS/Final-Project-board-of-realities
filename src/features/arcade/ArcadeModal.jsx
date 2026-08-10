import { useState } from 'react'
import { useGameStore } from '../../store/useGameStore'
import ClawMachine from './ClawMachine'
import FerrumWingsModal from './FerrumWingsModal'

// Entry fee for one sortie - deducted up front here (same "cost charged the
// instant you commit to playing" convention every other minigame in this
// codebase uses, e.g. ClawMachine.jsx's PLAY_COST), not inside the iframe
// game itself, which has no concept of this app's economy at all. The
// payout for actually finishing a run (score-scaled, see
// FerrumWingsModal.jsx's own header comment) is credited separately, once
// the game reports a result back out.
const FERRUM_WINGS_ENTRY_FEE = 50

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
  // Ferrum Wings is a full-page game (its own title/pause/gameover screens),
  // so it always gets its own top-level overlay - rendered as a sibling
  // below, outside the `embedded` split, regardless of whether THIS modal
  // is itself embedded inside CasinoModal's Arcade tab.
  const [showFerrumWings, setShowFerrumWings] = useState(false)

  const launchFerrumWings = () => {
    if (cash < FERRUM_WINGS_ENTRY_FEE) return
    addCash(-FERRUM_WINGS_ENTRY_FEE)
    setShowFerrumWings(true)
  }

  const body = (
    <>
        <p className="mb-1 text-xs uppercase tracking-widest text-gray-500">Commercial District</p>
        <h2 className="mb-2 text-xl font-bold text-cyan-300">Pixel Palace Arcade</h2>
        <p className="mb-4 text-xs text-gray-400">
          Retro cabinets hum next to VR pods. Locals come here to be seen as much as to play.
        </p>

        <div className="mb-4 border-2 border-purple-500/60 bg-[#0f1020] p-3">
          <h3 className="mb-1 text-sm font-bold text-purple-300">Capital Syndicate: Operation Ferrum Wings</h3>
          <p className="mb-2 text-xs text-gray-400">
            A full arcade cabinet install - a 4-sector shmup with its own briefing, bosses, and a super laser. Every
            enemy you clear pays out on the way to the payout terminal - the further you get and the higher your
            score, the bigger the cut.
          </p>
          <button
            onClick={launchFerrumWings}
            disabled={cash < FERRUM_WINGS_ENTRY_FEE}
            className="w-full border-2 border-purple-400 py-1.5 text-sm font-bold text-purple-300 hover:bg-purple-400 hover:text-black disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent"
          >
            Launch Sortie (${FERRUM_WINGS_ENTRY_FEE})
          </button>
        </div>

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

  return (
    <>
      {showFerrumWings && <FerrumWingsModal onClose={() => setShowFerrumWings(false)} />}
      {embedded ? (
        body
      ) : (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
          {/* w-[580px] (was 460px) + max-h-[92vh] overflow-y-auto - the claw
              machine's real cabinet art (ClawMachine.jsx) shows the FULL
              480x480 photo uncropped now, which no longer fits the old 460px
              panel width, and the taller content needs the same "whole modal
              scrolls as one unit instead of silently clipping on a short
              screen" fix UnderworldModal.jsx/CasinoModal.jsx already got -
              see either of those files' own comments for why. */}
          <div className="glass-panel max-h-[92vh] w-[580px] overflow-y-auto overflow-x-hidden border-4 border-cyan-400 bg-[#1c1d3a] p-6 font-mono text-white">
            {body}
          </div>
        </div>
      )}
    </>
  )
}
