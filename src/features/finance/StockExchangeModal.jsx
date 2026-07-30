import { useGameStore } from '../../store/useGameStore'
import { NET_WORTH_WIN_TARGET } from './marketData'
import TradeMeter from './TradeMeter'

export default function StockExchangeModal({ onClose, onDeclareVictory }) {
  const cash = useGameStore((s) => s.cash)
  const world2 = useGameStore((s) => s.world2)
  const computeNetWorth = useGameStore((s) => s.computeNetWorth)

  const netWorth = computeNetWorth()
  const winMet = netWorth >= NET_WORTH_WIN_TARGET

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="w-[520px] border-4 border-green-400 bg-[#1c1d3a] p-6 font-mono text-white">
        <h2 className="mb-2 text-xl font-bold text-green-300">Stock Exchange</h2>
        <p className="mb-3 text-xs text-gray-400">
          Prices drift every few seconds. Time your Buy/Sell to hit the green zone for a better price.
        </p>

        <div className="mb-3 border-2 border-gray-600 bg-[#0f1020] p-3 text-sm">
          <p>Cash: <span className="text-green-400">${Math.round(cash).toLocaleString()}</span></p>
          <p>Net Worth: <span className="text-yellow-300">${Math.round(netWorth).toLocaleString()}</span> / ${NET_WORTH_WIN_TARGET.toLocaleString()}</p>
        </div>

        <div className="mb-4 max-h-64 overflow-y-auto border-2 border-gray-600 bg-[#0f1020] p-3">
          {world2.stocks.map((stock) => (
            <TradeMeter
              key={stock.ticker}
              stock={stock}
              holding={world2.portfolio[stock.ticker]}
              shortHolding={world2.shortPositions?.[stock.ticker]}
            />
          ))}
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
