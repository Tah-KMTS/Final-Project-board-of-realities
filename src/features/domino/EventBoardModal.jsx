import { useGameStore } from '../../store/useGameStore'
import { NPC_ROSTER } from './npcRoster'

const DAY_NAMES = ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
const BLOCK_NAMES = ['', 'Morning', 'Afternoon', 'Evening', 'Night']

export default function EventBoardModal({ onClose }) {
  const isWeekend = useGameStore((s) => s.isDominoWeekend())
  const tournamentPassOwned = useGameStore((s) => s.world4.tournamentPassOwned)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="w-[460px] border-4 border-gray-400 bg-[#161522] p-6 font-mono text-white">
        <h2 className="mb-1 text-xl font-bold text-gray-200">Event Board</h2>
        <p className="mb-3 text-xs text-gray-400">
          {isWeekend ? 'It is the weekend - the KC Tower Arena is open.' : 'The KC Tower Arena only opens on weekends.'}
          {isWeekend && !tournamentPassOwned && ' You still need a Tournament Pass to enter.'}
        </p>
        <div className="max-h-72 overflow-y-auto border-2 border-gray-600 bg-black/30 p-2 text-xs">
          {NPC_ROSTER.filter((n) => n.Tier >= 4).map((npc) => (
            <div key={npc.NPC_ID} className="mb-2 border-b border-gray-700 pb-2">
              <p className="font-bold text-yellow-300">{npc.Name} (Tier {npc.Tier})</p>
              <p className="text-gray-400">{npc.Deck_Archetype}</p>
              <p className="text-gray-500">
                {npc.Active_Schedule.map((s) => `${DAY_NAMES[s.day]} (${s.blocks.map((b) => BLOCK_NAMES[b]).join('/')})`).join(', ')}
              </p>
            </div>
          ))}
        </div>
        <button onClick={onClose} className="mt-4 w-full border-4 border-gray-500 py-2 font-bold hover:bg-gray-500">
          Leave
        </button>
      </div>
    </div>
  )
}
