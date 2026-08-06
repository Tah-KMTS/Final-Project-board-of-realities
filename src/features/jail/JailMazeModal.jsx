// Resolution screen for a single jailMaze checkpoint (see OverworldScene.js's
// buildJailMazeZone and useGameStore.js's attemptMazeSegment). Deliberately
// much smaller than JailEscapeModal - each checkpoint is a single roll shown
// once, not a multi-round sitting with its own local state. WorldScreen.jsx
// owns all of the branching on what happens next (advance/bounce/open the
// Underworld modal); this component only renders the one result it's given.
//
// Tone: bureaucratic indignity, not dread - matches FbiInterrogationModal.jsx's
// deadpan register at lower stakes, per the jail lore spec. Guard/inmate stay
// generic and unnamed, so the flavor lines live inline here rather than in a
// roster data file.
const SEGMENT_FLAVOR = [
  'A stack of paperwork rests on a service cart, propping a fire door open.',
  'A loading dock, half-lit. A forklift beeps somewhere out of sight.',
  'A guard walks the line on a fifteen-minute smoke break, timed to the second.',
  'A door marked "AUTHORIZED PERSONNEL" that has never once stopped anyone.',
]

export default function JailMazeModal({ result, onContinue }) {
  const { segmentIndex = 0, success, final } = result

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
      <div className="w-[420px] border-4 border-gray-400 bg-[#1c1d3a] p-6 font-mono text-white">
        <h2 className="mb-2 text-xl font-bold text-gray-300">
          Service Corridor - Checkpoint {segmentIndex + 1}/4
        </h2>
        <p className="mb-4 text-xs text-gray-400">{SEGMENT_FLAVOR[segmentIndex] || SEGMENT_FLAVOR[0]}</p>

        <div className="mb-4 border-2 border-gray-600 bg-[#0f1020] p-3 text-sm">
          {success && final && (
            <>
              <p className="mb-1 font-bold text-green-400">You emerge through a service tunnel into a back room that feels... familiar.</p>
              <p className="text-yellow-300">Found on the way out: ${result.cashReward?.toLocaleString() ?? 0}</p>
            </>
          )}
          {success && !final && (
            <p className="text-green-400">Clear. The corridor keeps going.</p>
          )}
          {!success && (
            <>
              <p className="mb-1 font-bold text-red-500">Caught. The desk sergeant is not amused.</p>
              <p className="mb-2 text-xs text-gray-400">+1 day sentence, +8 Notoriety, +1 Wanted Level.</p>
              <p className="text-xs text-gray-500">
                The corridor's done for today - too many eyes on it now. Press <span className="text-gray-300">End Day</span> to
                serve a day and get another run, or pay/bribe your way out at the Booking Desk instead.
              </p>
            </>
          )}
        </div>

        <button
          onClick={onContinue}
          className={
            success
              ? 'w-full border-4 border-green-400 bg-green-500 py-2 font-bold text-black hover:bg-green-400'
              : 'w-full border-4 border-gray-500 py-2 font-bold hover:bg-gray-500'
          }
        >
          Continue
        </button>
      </div>
    </div>
  )
}
