import { useState } from 'react'
import { useGameStore } from '../../store/useGameStore'
import { generateNpcLoot } from './npcLootingEngine'

export default function NpcLootModal({ victimNpc = { name: 'Defeated Target', role: 'mobster' }, onClose }) {
  const [lootData] = useState(() => generateNpcLoot(victimNpc))
  const [remainingItems, setRemainingItems] = useState(lootData.lootItems)
  const [feedbackMsg, setFeedbackMsg] = useState(null)

  const addCash = useGameStore((s) => s.addCash)

  const handleLootItem = (item) => {
    if (item.category === 'cash') {
      addCash(item.value)
      setFeedbackMsg(`💰 LOOTED CASH: Took $${item.value.toLocaleString()} from ${lootData.victimName}'s wallet!`)
    } else {
      setFeedbackMsg(`🎒 LOOTED ITEM: Took ${item.name} ($${item.value.toLocaleString()}) into inventory!`)
    }
    setRemainingItems((prev) => prev.filter((i) => i.id !== item.id))
  }

  const handleLootAll = () => {
    let totalCash = 0
    remainingItems.forEach((i) => {
      if (i.category === 'cash') totalCash += i.value
    })
    if (totalCash > 0) addCash(totalCash)
    setRemainingItems([])
    setFeedbackMsg(`🎒 LOOTED ALL: Pocketed all carried weapons, cash ($${totalCash.toLocaleString()}), armor & belongings!`)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 font-mono text-white">
      <div className="w-full max-w-xl border-4 border-yellow-500/80 bg-[#161209] p-6 shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-yellow-500/40 pb-3">
          <div>
            <span className="rounded bg-yellow-950 px-2 py-0.5 text-xs font-bold text-yellow-300 uppercase tracking-wider">VICTIM BELONGINGS LOOTING</span>
            <h2 className="text-2xl font-bold text-yellow-300 mt-1">💀 {lootData.victimName}</h2>
            <p className="text-xs text-gray-300 mt-1">Inspect and loot carried weapons, armor, cash wallet, and accessories.</p>
          </div>
          <button
            onClick={handleLootAll}
            disabled={remainingItems.length === 0}
            className="rounded border border-yellow-400 bg-yellow-600 px-3 py-1.5 text-xs font-bold text-black hover:bg-yellow-400 transition-all disabled:opacity-40"
          >
            🎒 Loot All Items
          </button>
        </div>

        {/* Feedback Alert */}
        {feedbackMsg && (
          <div className="my-3 rounded border border-yellow-400 bg-yellow-950/80 p-3 text-center text-xs font-bold text-yellow-200">
            {feedbackMsg}
          </div>
        )}

        {/* Loot Inventory List */}
        <div className="my-4 space-y-2.5 max-h-[45vh] overflow-y-auto pr-1">
          {remainingItems.length === 0 ? (
            <div className="p-8 text-center text-xs text-gray-500 italic border border-dashed border-gray-700 rounded">
              Body has been completely looted clean.
            </div>
          ) : (
            remainingItems.map((item) => (
              <div key={item.id} className="flex items-center justify-between rounded border border-yellow-500/30 bg-[#241c0e] p-3 text-xs">
                <div>
                  <div className="font-bold text-yellow-300 text-sm">{item.name}</div>
                  <div className="text-[11px] text-gray-300 mt-0.5">Category: <span className="text-yellow-400 uppercase">{item.category}</span> • Value: ${item.value.toLocaleString()}</div>
                </div>
                <button
                  onClick={() => handleLootItem(item)}
                  className="rounded border border-yellow-400 bg-yellow-950 px-3 py-1.5 text-xs font-bold text-yellow-300 hover:bg-yellow-500 hover:text-black transition-all"
                >
                  Loot Item
                </button>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-800 bg-[#140e06] p-3 text-right">
          <button
            onClick={onClose}
            className="border border-gray-600 bg-gray-800 px-6 py-2 text-xs font-bold text-white hover:bg-gray-700 transition-colors"
          >
            Leave Body
          </button>
        </div>
      </div>
    </div>
  )
}
