import { useGameStore } from '../../store/useGameStore'

const STAT_KEYS = ['STR', 'AGI', 'INT', 'VIT', 'PER']

function StatLine({ stats }) {
  const parts = []
  for (const key of STAT_KEYS) {
    if (typeof stats[key] === 'number' && stats[key] !== 0) parts.push(`+${stats[key]} ${key}`)
  }
  if (typeof stats.lifeSteal === 'number') parts.push(`${Math.round(stats.lifeSteal * 100)}% Life Steal`)
  if (stats.aura) parts.push('Damage Aura')
  return parts.length > 0 ? parts.join(' • ') : null
}

export default function InventoryModal({ onClose }) {
  const inventory = useGameStore((s) => s.inventory)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="w-[440px] border-4 border-purple-400 bg-[#1c1d3a] p-6 font-mono text-white">
        <h2 className="mb-3 text-xl font-bold text-purple-300">Inventory</h2>

        {inventory.length === 0 ? (
          <p className="mb-4 text-sm text-gray-500">Empty. Rifts and quests will fill this up.</p>
        ) : (
          <div className="mb-4 flex max-h-80 flex-col gap-2 overflow-y-auto">
            {inventory.map((item, i) => {
              const statLine = item.stats ? StatLine({ stats: item.stats }) : null
              return (
                <div key={`${item.id}-${i}`} className="border-2 border-gray-600 bg-[#0f1020] p-2">
                  <p className="text-sm font-bold text-yellow-300">{item.name}</p>
                  {item.description && <p className="text-xs text-gray-400">{item.description}</p>}
                  {statLine && <p className="mt-1 text-xs text-green-400">{statLine}</p>}
                  {item.ability && (
                    <p className="mt-1 text-xs text-cyan-400">Usable in a rift encounter: {item.ability.replace(/_/g, ' ')}</p>
                  )}
                </div>
              )
            })}
          </div>
        )}

        <button
          onClick={onClose}
          className="w-full border-4 border-gray-500 py-2 font-bold hover:bg-gray-500"
        >
          Close
        </button>
      </div>
    </div>
  )
}
