import { useState } from 'react'
import { useGameStore } from '../../store/useGameStore'
import { CRYPTO_NAME, CRYPTO_TICKER } from './marketData'

export default function CryptoModal({ onClose }) {
  const cash = useGameStore((s) => s.cash)
  const world2 = useGameStore((s) => s.world2)
  const buyCrypto = useGameStore((s) => s.buyCrypto)
  const sellCrypto = useGameStore((s) => s.sellCrypto)
  const shillCrypto = useGameStore((s) => s.shillCrypto)
  const [amount, setAmount] = useState(100)

  const holdingsValue = world2.cryptoHoldings * world2.cryptoPrice

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="w-[440px] border-4 border-orange-400 bg-[#1c1d3a] p-6 font-mono text-white">
        <h2 className="mb-2 text-xl font-bold text-orange-300">Crypto Exchange</h2>
        <p className="mb-3 text-xs text-gray-400">
          {CRYPTO_NAME} ({CRYPTO_TICKER}) — pump it, then dump it before it crashes.
        </p>

        <div className="mb-3 border-2 border-gray-600 bg-[#0f1020] p-3 text-sm">
          <p>Price: <span className="text-yellow-300">${world2.cryptoPrice.toFixed(4)}</span></p>
          <p>Hype Meter: <span className="text-red-400">{Math.round(world2.cryptoHype * 100)}%</span> (higher = more crash risk)</p>
          <p>Your Holdings: {world2.cryptoHoldings.toFixed(2)} {CRYPTO_TICKER} (${holdingsValue.toFixed(2)})</p>
        </div>

        <div className="mb-3 flex items-center gap-2">
          <input
            type="number"
            min="1"
            value={amount}
            onChange={(e) => setAmount(Math.max(1, Number(e.target.value) || 1))}
            className="w-24 border border-gray-600 bg-black px-2 py-1 text-white"
          />
          <button
            onClick={() => buyCrypto(amount)}
            disabled={cash < amount}
            className="border-2 border-green-400 px-3 py-1 text-sm font-bold text-green-400 hover:bg-green-400 hover:text-black disabled:opacity-30"
          >
            Buy $
          </button>
          <button
            onClick={() => sellCrypto(world2.cryptoHoldings)}
            disabled={world2.cryptoHoldings <= 0}
            className="border-2 border-red-400 px-3 py-1 text-sm font-bold text-red-400 hover:bg-red-400 hover:text-black disabled:opacity-30"
          >
            Sell All
          </button>
        </div>

        <button
          onClick={shillCrypto}
          className="mb-4 w-full border-4 border-orange-400 bg-orange-500 py-2 font-bold text-black hover:bg-orange-400"
        >
          Shill It On Social Media (Pump)
        </button>

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
