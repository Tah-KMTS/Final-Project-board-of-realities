import { useGameStore } from '../../store/useGameStore'
import { getProfession } from './professions'

const STAT_KEYS = ['STR', 'AGI', 'INT', 'VIT', 'PER']

export default function HunterHQModal({ onClose, onBeginFinalRaid }) {
  const player = useGameStore((s) => s.player)
  const world1 = useGameStore((s) => s.world1)
  const cash = useGameStore((s) => s.cash)
  const allocateStat = useGameStore((s) => s.allocateStat)
  const finalRaidConditionsMet = useGameStore((s) => s.finalRaidConditionsMet)

  const profession = getProfession(player.professionId)
  const conditionsMet = finalRaidConditionsMet()

  const conditions = [
    { label: 'S-Rank Hunter Rating', done: world1.hunterRank === 'S' },
    { label: 'Married', done: world1.married },
    { label: '$1,000,000 cash', done: cash >= 1000000 },
    { label: 'At least 1 child', done: world1.children >= 1 },
    { label: 'Spring of Nazarick', done: world1.hasSpringOfNazarick },
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="w-[460px] border-4 border-blue-400 bg-[#1c1d3a] p-6 font-mono text-white">
        <h2 className="mb-3 text-xl font-bold text-blue-300">Hunter Association HQ</h2>

        <div className="mb-4 border-2 border-gray-600 bg-[#0f1020] p-3 text-sm">
          <p>
            Rank: <span className="font-bold text-yellow-300">{world1.hunterRank}</span> &nbsp;|&nbsp;
            Profession: <span className="font-bold text-yellow-300">{profession?.name || 'Unassigned'}</span>
          </p>
          <p className="mt-1 text-xs text-gray-400">Level {player.level} • {player.exp} EXP</p>
        </div>

        <div className="mb-4 border-2 border-gray-600 bg-[#0f1020] p-3">
          <p className="mb-2 text-sm">
            Unallocated Points: <span className="font-bold text-green-400">{player.unallocatedPoints}</span>
          </p>
          <div className="grid grid-cols-5 gap-2 text-center text-xs">
            {STAT_KEYS.map((key) => (
              <div key={key} className="flex flex-col items-center gap-1">
                <span className="text-gray-400">{key}</span>
                <span className="font-bold">{player.stats[key]}</span>
                <button
                  onClick={() => allocateStat(key)}
                  disabled={player.unallocatedPoints <= 0}
                  className="w-full border border-green-400 text-green-400 hover:bg-green-400 hover:text-black disabled:opacity-30"
                >
                  +
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="mb-4 border-2 border-gray-600 bg-[#0f1020] p-3">
          <p className="mb-2 text-sm font-bold text-red-400">Final Raid Requirements</p>
          <ul className="space-y-1 text-xs">
            {conditions.map((c) => (
              <li key={c.label} className={c.done ? 'text-green-400' : 'text-gray-500'}>
                {c.done ? '✔' : '✘'} {c.label}
              </li>
            ))}
          </ul>
        </div>

        {conditionsMet && (
          <button
            onClick={onBeginFinalRaid}
            className="mb-3 w-full border-4 border-red-500 bg-red-600 py-2 font-bold hover:bg-red-500"
          >
            Begin the Final Raid
          </button>
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
