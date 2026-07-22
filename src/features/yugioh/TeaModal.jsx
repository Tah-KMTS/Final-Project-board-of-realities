import { useGameStore } from '../../store/useGameStore'
import DialogueBox from '../../components/Dialogue/DialogueBox'
import { TEA_LINES } from '../../data/yugiohDialogue'

export default function TeaModal({ onClose }) {
  const teaRelationship = useGameStore((s) => s.world3.teaRelationship)
  const teaMarried = useGameStore((s) => s.world3.teaMarried)
  const advanceTeaRelationship = useGameStore((s) => s.advanceTeaRelationship)
  const marryTea = useGameStore((s) => s.marryTea)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="w-[420px] border-4 border-pink-400 bg-[#1c1d3a] p-6 font-mono text-white">
        <h2 className="mb-2 text-xl font-bold text-pink-300">Téa Gardner</h2>

        {teaMarried ? (
          <p className="mb-4 text-sm text-green-400">
            You two are married. Yugi has not been the same since — his Heart of the Cards feels a little quieter now.
          </p>
        ) : (
          <>
            <DialogueBox
              speaker="Téa Gardner"
              portrait="💗"
              lines={TEA_LINES}
              onDone={() => {}}
              npcId="tea"
              relationshipTier={teaRelationship}
            />
            <div className="mb-3 border-2 border-gray-600 bg-[#0f1020] p-3">
              <p className="mb-1 text-xs text-gray-400">Relationship</p>
              <div className="h-3 w-full bg-gray-800">
                <div className="h-3 bg-pink-400" style={{ width: `${teaRelationship}%` }} />
              </div>
            </div>
            <button
              onClick={() => advanceTeaRelationship(15 + Math.floor(Math.random() * 10))}
              className="mb-3 w-full border-2 border-pink-400 py-1 text-sm hover:bg-pink-400 hover:text-black"
            >
              Spend Time Together
            </button>
            {teaRelationship >= 100 && (
              <button
                onClick={marryTea}
                className="mb-3 w-full border-4 border-pink-400 bg-pink-500 py-2 font-bold text-black hover:bg-pink-400"
              >
                Propose Marriage
              </button>
            )}
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
