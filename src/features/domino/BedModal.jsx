import { useGameStore } from '../../store/useGameStore'

const BLOCK_NAMES = ['', 'Morning', 'Afternoon', 'Evening', 'Night']
const DAY_NAMES = ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

export default function BedModal({ onClose }) {
  const calendar = useGameStore((s) => s.world4.calendar)
  const restUntilTimeBlock = useGameStore((s) => s.restUntilTimeBlock)

  const handleRest = (targetBlock) => {
    restUntilTimeBlock(targetBlock)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="w-[400px] border-4 border-indigo-400 bg-[#1c1d3a] p-6 font-mono text-white">
        <h2 className="mb-2 text-xl font-bold text-indigo-300">Rest</h2>
        <p className="mb-4 text-xs text-gray-400">
          Currently: {DAY_NAMES[calendar.day]}, {BLOCK_NAMES[calendar.timeBlock]} (Week {calendar.week})
        </p>
        <div className="flex flex-col gap-2">
          {[1, 2, 3, 4].map((block) => (
            <button
              key={block}
              onClick={() => handleRest(block)}
              className="border-2 border-indigo-400 py-2 text-sm hover:bg-indigo-400 hover:text-black"
            >
              Sleep until {BLOCK_NAMES[block]}
            </button>
          ))}
        </div>
        <button
          onClick={onClose}
          className="mt-4 w-full border-4 border-gray-500 py-2 font-bold hover:bg-gray-500"
        >
          Stay Awake
        </button>
      </div>
    </div>
  )
}
