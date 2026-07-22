import { useGameStore } from '../../store/useGameStore'
import DialogueBox from '../../components/Dialogue/DialogueBox'
import { YUGI_LINES } from '../../data/yugiohDialogue'

const BRIBE_PRICE = 2000000

export default function YugiEncounterModal({ onClose, onDirectCombat, onRescueDuel, onChallenge }) {
  const cash = useGameStore((s) => s.cash)
  const world3 = useGameStore((s) => s.world3)
  const addCash = useGameStore((s) => s.addCash)
  const clearWorld3 = useGameStore((s) => s.clearWorld3)

  const hasHostage = world3.kidnappedNpcs.length > 0

  const handleBribe = () => {
    addCash(-BRIBE_PRICE)
    clearWorld3()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="w-[480px] border-4 border-yellow-400 bg-[#1c1d3a] p-6 font-mono text-white">
        <h2 className="mb-2 text-xl font-bold text-yellow-300">Muto Yugi</h2>
        <DialogueBox
          speaker="Muto Yugi"
          portrait="🂡"
          lines={YUGI_LINES}
          onDone={() => {}}
          npcId="yugi"
          relationshipTier={20}
        />

        {world3.yugiBrokenHeart && (
          <p className="mb-3 text-xs text-pink-400">
            His Heart of the Cards feels off ever since Téa married you. He's not at full strength.
          </p>
        )}
        {world3.ownsKaibaCorp && (
          <p className="mb-3 text-xs text-blue-300">You own KaibaCorp — you'll have the option to cheat mid-duel.</p>
        )}

        <div className="mb-4 flex flex-col gap-2">
          <button
            onClick={onDirectCombat}
            className="border-2 border-red-500 py-2 text-sm hover:bg-red-500 hover:text-black"
          >
            Direct Combat (Shadow Game)
          </button>

          {hasHostage && (
            <button
              onClick={onRescueDuel}
              className="border-2 border-orange-500 py-2 text-sm hover:bg-orange-500 hover:text-black"
            >
              Threaten Him With Your Hostage (Rescue Duel)
            </button>
          )}

          <button
            onClick={handleBribe}
            disabled={cash < BRIBE_PRICE}
            className="border-2 border-green-500 py-2 text-sm hover:bg-green-500 hover:text-black disabled:opacity-30"
          >
            Bribe Him to Forfeit (${BRIBE_PRICE.toLocaleString()})
          </button>

          <button
            onClick={onChallenge}
            className="border-2 border-cyan-400 py-2 text-sm hover:bg-cyan-400 hover:text-black"
          >
            Challenge Him to Something Else
          </button>
        </div>

        <button
          onClick={onClose}
          className="w-full border-4 border-gray-500 py-2 font-bold hover:bg-gray-500"
        >
          Walk Away
        </button>
      </div>
    </div>
  )
}
