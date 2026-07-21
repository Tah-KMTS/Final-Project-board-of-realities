import { useState } from 'react'
import { useGameStore } from '../../store/useGameStore'
import { NET_WORTH_WIN_TARGET } from './marketData'

export default function StockExchangeModal({ onClose, onDeclareVictory }) {
  const cash = useGameStore((s) => s.cash)
  const world2 = useGameStore((s) => s.world2)
  const buyStock = useGameStore((s) => s.buyStock)
  const sellStock = useGameStore((s) => s.sellStock)
  const computeNetWorth = useGameStore((s) => s.computeNetWorth)
  const [qty, setQty] = useState({})

  const netWorth = computeNetWorth()
  const winMet = netWorth >= NET_WORTH_WIN_TARGET

  const getQty = (ticker) => qty[ticker] ?? 1
  const setQtyFor = (ticker, v) => setQty((prev) => ({ ...prev, [ticker]: Math.max(1, Math.floor(v) || 1) }))

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="w-[520px] border-4 border-green-400 bg-[#1c1d3a] p-6 font-mono text-white">
        <h2 className="mb-2 text-xl font-bold text-green-300">Stock Exchange</h2>
        <p className="mb-3 text-xs text-gray-400">Simulated market. Prices drift every few seconds.</p>

        <div className="mb-3 border-2 border-gray-600 bg-[#0f1020] p-3 text-sm">
          <p>Cash: <span className="text-green-400">${cash.toLocaleString()}</span></p>
          <p>Net Worth: <span className="text-yellow-300">${Math.round(netWorth).toLocaleString()}</span> / ${NET_WORTH_WIN_TARGET.toLocaleString()}</p>
        </div>

        <div className="mb-4 max-h-64 overflow-y-auto border-2 border-gray-600 bg-[#0f1020] p-3">
          {world2.stocks.map((stock) => {
            const holding = world2.portfolio[stock.ticker]
            return (
              <div key={stock.ticker} className="mb-2 flex items-center justify-between border-b border-gray-700 pb-2 text-xs">
                <div>
                  <p className="font-bold">{stock.name} ({stock.ticker})</p>
                  <p className="text-gray-400">
                    ${stock.price.toFixed(2)}/share
                    {holding ? ` • You own ${holding.shares.toFixed(2)}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    min="1"
                    value={getQty(stock.ticker)}
                    onChange={(e) => setQtyFor(stock.ticker, Number(e.target.value))}
                    className="w-14 border border-gray-600 bg-black px-1 py-0.5 text-white"
                  />
                  <button
                    onClick={() => buyStock(stock.ticker, getQty(stock.ticker))}
                    className="border border-green-400 px-2 py-1 text-green-400 hover:bg-green-400 hover:text-black"
                  >
                    Buy
                  </button>
                  <button
                    onClick={() => sellStock(stock.ticker, getQty(stock.ticker))}
                    disabled={!holding || holding.shares <= 0}
                    className="border border-red-400 px-2 py-1 text-red-400 hover:bg-red-400 hover:text-black disabled:opacity-30"
                  >
                    Sell
                  </button>
                </div>
              </div>
            )
          })}
        </div>

        {winMet && (
          <button
            onClick={onDeclareVictory}
            className="mb-3 w-full border-4 border-yellow-400 bg-yellow-500 py-2 font-bold text-black hover:bg-yellow-400"
          >
            Declare Yourself the Richest Person Alive
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
