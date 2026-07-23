import { useState } from 'react'
import { useGameStore } from '../../store/useGameStore'
import { TOWN_AMENITIES_CATALOG } from './townAmenitiesCatalog'

export default function AmenityStoreModal({ amenityId = 'tokyo_supermarket', onClose }) {
  const amenity = TOWN_AMENITIES_CATALOG.find((a) => a.id === amenityId) || TOWN_AMENITIES_CATALOG[0]
  const cash = useGameStore((s) => s.cash)
  const addCash = useGameStore((s) => s.addCash)
  const addWantedLevel = useGameStore((s) => s.addWantedLevel)
  const playerHp = useGameStore((s) => s.playerHp || 100)
  const healPlayer = useGameStore((s) => s.healPlayer || (() => {}))

  const [feedbackMsg, setFeedbackMsg] = useState(null)
  const [items, setItems] = useState(amenity.items)

  const handleBuy = (item) => {
    if (cash < item.price) {
      setFeedbackMsg(`Insufficient cash! Needed $${item.price.toFixed(2)}.`)
      return
    }
    if (item.stock <= 0) {
      setFeedbackMsg(`Item "${item.name}" is out of stock!`)
      return
    }

    addCash(-item.price)
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, stock: i.stock - 1 } : i)))
    setFeedbackMsg(`💵 Bought 1x ${item.name} from ${amenity.npc.name} for $${item.price.toFixed(2)}!`)
  }

  const handleShoplift = (item) => {
    if (item.stock <= 0) {
      setFeedbackMsg(`Item "${item.name}" is out of stock!`)
      return
    }

    // Stealth roll vs NPC awareness
    const stealthRoll = Math.floor(Math.random() * 100)
    if (stealthRoll > amenity.npc.awareness) {
      setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, stock: i.stock - 1 } : i)))
      setFeedbackMsg(`🥷 SHOPLIFT SUCCESS: You quietly pocketed 1x ${item.name} off the shelf without ${amenity.npc.name} noticing!`)
    } else {
      addWantedLevel(1)
      setFeedbackMsg(`🚨 SHOPLIFT FAILED: ${amenity.npc.name} spotted you shoplifting ${item.name}! Police alerted (Wanted +1)!`)
    }
  }

  const handleBreakDestroy = (item) => {
    if (item.stock <= 0) {
      setFeedbackMsg(`Shelf display for "${item.name}" is already destroyed!`)
      return
    }

    addWantedLevel(1)
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, stock: 0 } : i)))
    setFeedbackMsg(`💥 VANDALISM & DESTRUCTION: Smashed store shelf display! Destroyed all remaining ${item.name}! ${amenity.npc.name} fled in terror! (Wanted +1)`)
  }

  const handleConsume = (item) => {
    if (item.type === 'food' || item.type === 'drink') {
      healPlayer(item.healHp || 20)
      setFeedbackMsg(`🍕 CONSUMED: Ate/drank ${item.name}! Restored +${item.healHp} HP & Energy!`)
    } else if (item.type === 'luxury') {
      setFeedbackMsg(`💎 EQUIPPED: Wearing ${item.name}! (${item.perk})`)
    } else {
      setFeedbackMsg(`🛠️ READY: Equipped ${item.name}! (${item.perk})`)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 font-mono text-white">
      <div className="w-full max-w-3xl border-4 border-cyan-500/80 bg-[#0b1021] p-6 shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-cyan-500/40 pb-3">
          <div>
            <span className="rounded bg-cyan-900/60 px-2 py-0.5 text-xs font-bold text-cyan-300 uppercase tracking-wider">{amenity.city} • {amenity.district}</span>
            <h2 className="text-2xl font-bold text-cyan-300 mt-1">{amenity.name}</h2>
            <p className="text-xs text-gray-300 mt-1">{amenity.description}</p>
          </div>
          <div className="text-right">
            <div className="text-xs text-gray-400">Running NPC Operator</div>
            <div className="text-sm font-bold text-yellow-300">{amenity.npc.name} ({amenity.npc.title})</div>
            <div className="text-[10px] text-gray-400">NPC Stealth Awareness: {amenity.npc.awareness}%</div>
          </div>
        </div>

        {/* Feedback Alert */}
        {feedbackMsg && (
          <div className="my-3 rounded border border-cyan-400 bg-cyan-950/80 p-3 text-center text-xs font-bold text-cyan-200">
            {feedbackMsg}
          </div>
        )}

        {/* Inventory Item Grid with 4 Verbs */}
        <div className="my-4 space-y-3 max-h-[50vh] overflow-y-auto pr-1">
          {items.map((item) => (
            <div key={item.id} className="flex items-center justify-between rounded border border-cyan-500/30 bg-[#121833] p-3 text-xs">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-yellow-300 text-sm">{item.name}</span>
                  <span className="rounded bg-cyan-950 px-1.5 py-0.5 text-[10px] text-cyan-300 uppercase">{item.type}</span>
                </div>
                <div className="text-xs text-gray-300 mt-0.5">
                  Price: <b className="text-emerald-400">${item.price.toFixed(2)}</b> • Stock Remaining: <b className="text-cyan-300">{item.stock}</b>
                  {item.perk && <span className="ml-2 text-fuchsia-300">({item.perk})</span>}
                </div>
              </div>

              {/* 4 Interactive Verbs: Buy, Shoplifting, Vandalize, Consume */}
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => handleBuy(item)}
                  disabled={item.stock <= 0}
                  className="rounded border border-emerald-500 bg-emerald-950 px-2.5 py-1.5 text-[11px] font-bold text-emerald-300 hover:bg-emerald-500 hover:text-black transition-all disabled:opacity-40"
                  title="Pay cash to buy legally"
                >
                  💵 Buy
                </button>
                <button
                  onClick={() => handleShoplift(item)}
                  disabled={item.stock <= 0}
                  className="rounded border border-purple-500 bg-purple-950 px-2.5 py-1.5 text-[11px] font-bold text-purple-300 hover:bg-purple-500 hover:text-black transition-all disabled:opacity-40"
                  title="Attempt stealth shoplifting"
                >
                  🥷 Steal
                </button>
                <button
                  onClick={() => handleBreakDestroy(item)}
                  disabled={item.stock <= 0}
                  className="rounded border border-red-500 bg-red-950 px-2.5 py-1.5 text-[11px] font-bold text-red-300 hover:bg-red-500 hover:text-white transition-all disabled:opacity-40"
                  title="Smash store display & destroy shelf inventory"
                >
                  💥 Break
                </button>
                <button
                  onClick={() => handleConsume(item)}
                  className="rounded border border-yellow-500 bg-yellow-950 px-2.5 py-1.5 text-[11px] font-bold text-yellow-300 hover:bg-yellow-500 hover:text-black transition-all"
                  title="Eat food or use tool"
                >
                  🍕 Consume
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-800 bg-[#0d1124] p-3 text-right">
          <button
            onClick={onClose}
            className="border border-gray-600 bg-gray-800 px-6 py-2 text-xs font-bold text-white hover:bg-gray-700 transition-colors"
          >
            Leave Store
          </button>
        </div>
      </div>
    </div>
  )
}
