import ClawMachine from './ClawMachine'

// Thin standalone-modal shell around ClawMachine.jsx (a plain embedded
// panel with no overlay/close button of its own - see that file's header)
// for the Game Center's claw machine cabinet. Used to live only as a tab
// inside Casino's Pixel Palace Arcade (ArcadeModal.jsx, now removed); moved
// out to the actual claw machine prop already standing in the Game Center's
// walk-in room (buildArcadeInteriorZone in OverworldScene.js) so walking up
// to it and pressing E plays it directly, same pattern as that room's Turbo
// Racer/Air Hockey cabinets (TurboRacerModal.jsx/AirHockeyModal.jsx).
export default function ClawMachineModal({ onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="glass-panel max-h-[92vh] w-[520px] max-w-[95vw] overflow-y-auto overflow-x-hidden border-4 border-cyan-400 bg-[#1c1d3a] p-6 font-mono text-white">
        <p className="mb-1 text-xs uppercase tracking-widest text-gray-500">Game Center</p>
        <h2 className="mb-4 text-xl font-bold text-cyan-300">Labubu-Style Claw Machine</h2>
        <ClawMachine />
        <button onClick={onClose} className="mt-4 w-full border-4 border-gray-500 py-2 font-bold hover:bg-gray-500">
          Leave
        </button>
      </div>
    </div>
  )
}
