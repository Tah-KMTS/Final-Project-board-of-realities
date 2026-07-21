import { useGameStore } from '../../store/useGameStore'
import { getYugiohNpc } from './yugiohNpcs'

export default function KidnappableNpcModal({ npcId, onClose }) {
  const npc = getYugiohNpc(npcId)
  const kidnappedNpcs = useGameStore((s) => s.world3.kidnappedNpcs)
  const toggleKidnapNpc = useGameStore((s) => s.toggleKidnapNpc)
  const addWantedLevel = useGameStore((s) => s.addWantedLevel)

  const isKidnapped = kidnappedNpcs.includes(npcId)

  const handleKidnap = () => {
    toggleKidnapNpc(npcId, true)
    addWantedLevel(3)
  }

  const handleRelease = () => {
    toggleKidnapNpc(npcId, false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="w-[400px] border-4 border-gray-400 bg-[#1c1d3a] p-6 font-mono text-white">
        <h2 className="mb-3 text-xl font-bold text-gray-200">{npc.name}</h2>

        {isKidnapped ? (
          <>
            <p className="mb-4 text-sm text-red-400">
              You're holding {npc.name} hostage. You can use this as leverage against Yugi.
            </p>
            <button
              onClick={handleRelease}
              className="mb-3 w-full border-2 border-green-400 py-1 text-sm hover:bg-green-400 hover:text-black"
            >
              Let Them Go
            </button>
          </>
        ) : (
          <>
            <p className="mb-4 text-sm text-gray-300">"Hey! You're that Duelist everyone's talking about."</p>
            <button
              onClick={handleKidnap}
              className="mb-3 w-full border-2 border-red-500 py-1 text-sm hover:bg-red-500 hover:text-black"
            >
              Kidnap Them (Wanted +3)
            </button>
          </>
        )}

        <button
          onClick={onClose}
          className="w-full border-4 border-gray-500 py-2 font-bold hover:bg-gray-500"
        >
          Leave
        </button>
      </div>
    </div>
  )
}
