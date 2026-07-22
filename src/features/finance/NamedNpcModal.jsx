import { useState } from 'react'
import { useGameStore } from '../../store/useGameStore'
import { getFinanceNpc } from './financeNpcs'
import DialogueBox from '../../components/Dialogue/DialogueBox'
import { FINANCE_NPC_LINES } from '../../data/financeDialogue'

export default function NamedNpcModal({ npcId, onClose, onAttack }) {
  const world2 = useGameStore((s) => s.world2)
  const financeNpcAction = useGameStore((s) => s.financeNpcAction)
  const npc = getFinanceNpc(npcId)
  const isDead = world2.npcStatus[npcId] === 'dead'
  const [dialogueDone, setDialogueDone] = useState(false)
  const npcLines = FINANCE_NPC_LINES[npcId]

  if (!npc) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="w-[440px] border-4 border-gray-400 bg-[#1c1d3a] p-6 font-mono text-white">
        <h2 className="mb-1 text-xl font-bold text-gray-200">{npc.name}</h2>
        <p className="mb-4 text-xs text-gray-400">"{npc.title}" • Net worth: ${npc.netWorth.toLocaleString()}</p>

        {!isDead && npcLines && !dialogueDone && (
          <DialogueBox speaker={npc.name} portrait="💼" lines={npcLines} onDone={() => setDialogueDone(true)} />
        )}

        {isDead ? (
          <p className="mb-4 text-sm text-red-400">This person is no longer among the living.</p>
        ) : (
          <div className="mb-4 flex flex-col gap-2">
            <button
              onClick={() => financeNpcAction(npcId, 'workFor')}
              className="border-2 border-blue-400 py-1 text-sm hover:bg-blue-400 hover:text-black"
            >
              Work For Them (+$300, no risk)
            </button>
            <button
              onClick={() => financeNpcAction(npcId, 'collude')}
              className="border-2 border-yellow-400 py-1 text-sm hover:bg-yellow-400 hover:text-black"
            >
              Collude on Insider Trading (+$2,000, Wanted +1)
            </button>
            <button
              onClick={() => financeNpcAction(npcId, 'mug')}
              className="border-2 border-orange-400 py-1 text-sm hover:bg-orange-400 hover:text-black"
            >
              Mug Them (+$1,500, Wanted +2)
            </button>
            <button
              onClick={() => financeNpcAction(npcId, 'extort')}
              className="border-2 border-red-400 py-1 text-sm hover:bg-red-400 hover:text-black"
            >
              Extort Them (+$5,000, Wanted +3)
            </button>
            <button
              onClick={onAttack}
              className="border-2 border-red-600 bg-red-700 py-1 text-sm font-bold hover:bg-red-600"
            >
              Attempt to Kill Them (fight their bodyguards)
            </button>
          </div>
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
