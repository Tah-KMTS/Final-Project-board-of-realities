import { useState } from 'react'
import { useGameStore } from '../../store/useGameStore'
import { NARCOTICS_DATABASE, calculateCartelResale } from './narcoticsEngine'
import { getCharacterPortrait } from '../../data/characterPortraits'

export default function NarcoticsTradeModal({ onClose }) {
  const [selectedItem, setSelectedItem] = useState(NARCOTICS_DATABASE[0])
  const [tradeQuantity, setTradeQuantity] = useState(1)
  const [feedbackMsg, setFeedbackMsg] = useState(null)

  const cash = useGameStore((s) => s.cash)
  const addCash = useGameStore((s) => s.addCash)
  const addWantedLevel = useGameStore((s) => s.addWantedLevel)
  const healPlayer = useGameStore((s) => s.healPlayer || (() => {}))

  const handleBuyWholesale = () => {
    const cost = selectedItem.wholesalePrice * tradeQuantity
    if (cash < cost) {
      setFeedbackMsg(`Insufficient cash! Needed $${cost.toLocaleString()} for wholesale cartel trade.`)
      return
    }

    addCash(-cost)
    setFeedbackMsg(`🌿 CARTEL TRADE: Purchased ${tradeQuantity}x ${selectedItem.name} wholesale from Pablo Escobar! (${selectedItem.profitMargin})`)
  }

  const handleFenceResale = () => {
    const result = calculateCartelResale(selectedItem.id, tradeQuantity)
    if (result.deaBusted) {
      addWantedLevel(2)
      setFeedbackMsg(`🚨 DEA / FBI NARCOTICS RAID: DEA intercepted the consignment! Narcotics confiscated & Wanted Level +2!`)
      return
    }

    addCash(result.payout)
    setFeedbackMsg(`💰 CARTEL RESALE SUCCESS: Fenced ${tradeQuantity}x ${selectedItem.name} for $${result.payout.toLocaleString()}! Net Profit: +$${result.profit.toLocaleString()}!`)
  }

  const handleConsumeSubstance = () => {
    if (selectedItem.type === 'pharmaceutical') {
      healPlayer(40)
      setFeedbackMsg(`💊 CONSUMED: Took ${selectedItem.name}! Restored +40 HP!`)
    } else {
      setFeedbackMsg(`⚡ SUBSTANCE CONSUMED: Consumed ${selectedItem.name}! (${selectedItem.buff})`)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 font-mono text-white">
      <div className="w-full max-w-3xl border-4 border-red-600/80 bg-[#19080b] p-6 shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-red-600/40 pb-3">
          <div className="flex items-center gap-3">
            <img src={getCharacterPortrait('escobar', 'Pablo Escobar', 'Crime')} alt="Escobar" className="h-14 w-14 rounded border-2 border-red-500" />
            <div>
              <span className="rounded bg-red-950 px-2 py-0.5 text-xs font-bold text-red-300 uppercase tracking-wider">MEDELLIN CARTEL & SYNDICATE CONTRABAND</span>
              <h2 className="text-2xl font-bold text-red-400 mt-1">🌿 CARTEL NARCOTICS TRADE</h2>
              <p className="text-xs text-gray-300">Brokered by Pablo Escobar & Griselda Blanco (The Black Widow).</p>
            </div>
          </div>
        </div>

        {/* Feedback Alert */}
        {feedbackMsg && (
          <div className="my-3 rounded border border-red-500 bg-red-950/90 p-3 text-center text-xs font-bold text-red-200">
            {feedbackMsg}
          </div>
        )}

        {/* Substances Selection */}
        <div className="my-4 grid grid-cols-1 md:grid-cols-2 gap-3">
          {NARCOTICS_DATABASE.map((item) => (
            <div
              key={item.id}
              onClick={() => setSelectedItem(item)}
              className={`cursor-pointer rounded border p-3 text-xs transition-all ${
                selectedItem.id === item.id ? 'border-red-400 bg-red-950/60 shadow-lg' : 'border-red-900/40 bg-[#261014] hover:bg-[#33151b]'
              }`}
            >
              <div className="font-bold text-red-300 text-sm">{item.name}</div>
              <div className="text-[11px] text-gray-300 mt-1">Supplier: {item.supplier}</div>
              <div className="text-[11px] text-emerald-400 font-semibold mt-1">
                Wholesale: ${item.wholesalePrice.toLocaleString()} ➔ Resale: ${item.resalePrice.toLocaleString()}
              </div>
              <div className="text-[10px] text-yellow-300 mt-1 italic">Buff: {item.buff}</div>
            </div>
          ))}
        </div>

        {/* Quantity & Actions Bar */}
        <div className="my-3 rounded border border-red-800 bg-[#210c0f] p-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-xs">
              <span className="text-gray-300 font-bold">Quantity Bricks/Batches:</span>
              <input
                type="number"
                min="1"
                max="50"
                value={tradeQuantity}
                onChange={(e) => setTradeQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-20 rounded border border-red-500 bg-black/60 px-2 py-1 text-xs text-white font-mono text-center"
              />
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleBuyWholesale}
                className="rounded border border-red-500 bg-red-950 px-4 py-2 text-xs font-bold text-red-300 hover:bg-red-600 hover:text-white transition-all"
              >
                🌿 Buy Wholesale (${(selectedItem.wholesalePrice * tradeQuantity).toLocaleString()})
              </button>
              <button
                onClick={handleFenceResale}
                className="rounded border border-emerald-500 bg-emerald-950 px-4 py-2 text-xs font-bold text-emerald-300 hover:bg-emerald-500 hover:text-black transition-all"
              >
                💰 Resale Payout (${(selectedItem.resalePrice * tradeQuantity).toLocaleString()})
              </button>
              <button
                onClick={handleConsumeSubstance}
                className="rounded border border-yellow-500 bg-yellow-950 px-4 py-2 text-xs font-bold text-yellow-300 hover:bg-yellow-500 hover:text-black transition-all"
              >
                ⚡ Consume
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-gray-800 bg-[#120507] p-3 text-right">
          <button
            onClick={onClose}
            className="border border-gray-600 bg-gray-800 px-6 py-2 text-xs font-bold text-white hover:bg-gray-700 transition-colors"
          >
            Close Narcotics Trade
          </button>
        </div>
      </div>
    </div>
  )
}
