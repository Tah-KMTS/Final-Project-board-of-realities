import { useGameStore } from '../../store/useGameStore'
import CellBlockCorridor from './CellBlockCorridor'
import ExerciseYard from './ExerciseYard'
import FenceLine from './FenceLine'
import FinalStretch from './FinalStretch'

const SEGMENT_COMPONENTS = [CellBlockCorridor, ExerciseYard, FenceLine, FinalStretch]

const SEGMENT_TITLES = ['Cell Block Corridor', 'Exercise Yard', 'Fence Line', 'Final Stretch']

// Tone matches JailMazeModal.jsx's SEGMENT_FLAVOR (bureaucratic indignity,
// not dread) - written fresh per-segment here since these play out while
// the challenge is live, not after the fact.
const SEGMENT_INSTRUCTIONS = [
  "A stack of paperwork props a fire door open on its sweep cycle. Time your move.",
  "Follow the count. Match every step or fall out of line.",
  "Vault the fence at the right moment - too soft and you stall, too hard and you're caught on the wire.",
  'Sprint the last stretch. Keep your feet moving, left-right-left, until you clear the line.',
]

// Single entry point every jailMaze checkpoint modal renders through (see
// WorldScreen.jsx's 'jailMazeMinigame' activeModal branch, wired from
// OverworldScene.js's jailMazeCheckpoint interact event). Four genuinely
// different input challenges live behind here on purpose - per the design
// spec, Court & Prison is a location players will replay a lot now that
// losing a police encounter routes into it, so one skill test reused four
// times would go stale fast.
//
// The inversion that matters: `difficulty` (0..1, from
// getMazeSegmentDifficulty in useGameStore.js - the OLD evadeChance coin
// flip's inputs, just relabeled) only ever shapes each minigame's own knobs
// (sweep speed, sequence length, band width, alternation target) via
// difficultyToParams(). It is never compared against Math.random()
// anywhere in this flow. The minigame's own pass/fail is what decides the
// checkpoint, and attemptMazeSegment (called here, exactly once, right
// after the minigame concludes) is what applies the untouched consequence
// table. If you're tempted to shortcut a segment back to a dice roll on
// `difficulty` - don't; that's the exact bug this whole feature replaced.
export default function JailMazeMinigame({ segmentIndex, difficulty, onResolved }) {
  const attemptMazeSegment = useGameStore((s) => s.attemptMazeSegment)

  const handleComplete = (success) => {
    const result = attemptMazeSegment(segmentIndex, success)
    onResolved({ ...result, segmentIndex })
  }

  // Free exit only before the challenge's first input registers (mirrors
  // VaultCrackModal's Walk Away convention) - every segment component
  // routes any exit AFTER that point through handleComplete(false) instead
  // of this, so backing out mid-attempt always counts as the checkpoint's
  // one failure. No cost-free retries.
  const handleWalkAway = () => onResolved(null)

  const Segment = SEGMENT_COMPONENTS[segmentIndex] || CellBlockCorridor

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
      <div className="w-[440px] border-4 border-gray-400 bg-[#1c1d3a] p-6 font-mono text-white">
        <h2 className="mb-1 text-xl font-bold uppercase tracking-widest text-gray-300">
          {SEGMENT_TITLES[segmentIndex] || SEGMENT_TITLES[0]}{' '}
          <span className="text-gray-500">- Checkpoint {segmentIndex + 1}/4</span>
        </h2>
        <p className="mb-4 text-xs text-gray-400">
          {SEGMENT_INSTRUCTIONS[segmentIndex] || SEGMENT_INSTRUCTIONS[0]}
        </p>
        <Segment difficulty={difficulty} onComplete={handleComplete} onWalkAway={handleWalkAway} />
      </div>
    </div>
  )
}
