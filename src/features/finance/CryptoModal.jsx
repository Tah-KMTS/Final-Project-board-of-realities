import { useEffect, useRef, useState } from 'react'
import { useGameStore } from '../../store/useGameStore'
import { CRYPTO_NAME, CRYPTO_TICKER } from './marketData'

const PUMP_ENERGY_COST = 15

// Fisher-Yates shuffle, returns a new array.
function shuffle(arr) {
  const out = [...arr]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

// Deck composition scales with how hyped the market already is (more hype at
// session start = more Whale Dump cards seeded in) and is discounted by one
// at high Reputation (a well-regarded player gets slightly cleaner intel).
// hypeAtStart/reputation are both snapshotted once at session start by the
// caller - this function is pure given those two numbers.
function buildDeck(hypeAtStart, reputation) {
  const extraWhaleDumps = Math.min(3, Math.floor(hypeAtStart / 0.25))
  const repDiscount = reputation >= 70 ? 1 : 0
  const whaleDumpCount = Math.max(1, Math.min(4, 1 + extraWhaleDumps - repDiscount))
  return shuffle([
    ...Array(9).fill('pump'),
    ...Array(3).fill('bigpump'),
    ...Array(whaleDumpCount).fill('whale'),
  ])
}

const CARD_LABEL = { pump: 'Pump', bigpump: 'Big Pump', whale: 'Whale Dump' }

// `embedded`: default false keeps every existing standalone call site (none
// left directly in WorldScreen.jsx any more, but this stays the general
// pattern used by every modal folded into a hub tab) untouched. When true
// (StockExchangeModal's Crypto tab), skip the outer fixed-overlay wrapper
// and the bottom "Leave" button - the wrapping hub modal supplies both.
export default function CryptoModal({ onClose, embedded = false }) {
  const cash = useGameStore((s) => s.cash)
  const player = useGameStore((s) => s.player)
  const world2 = useGameStore((s) => s.world2)
  const buyCrypto = useGameStore((s) => s.buyCrypto)
  const sellCrypto = useGameStore((s) => s.sellCrypto)
  const spendEnergy = useGameStore((s) => s.spendEnergy)
  const setPumpSessionActive = useGameStore((s) => s.setPumpSessionActive)
  const applyCryptoPumpCard = useGameStore((s) => s.applyCryptoPumpCard)
  const applyCryptoWhaleDump = useGameStore((s) => s.applyCryptoWhaleDump)
  const executeCrime = useGameStore((s) => s.executeCrime)
  const [amount, setAmount] = useState(100)
  const [feedbackMsg, setFeedbackMsg] = useState(null)

  // Hype Deck mini-game session state - all local, same convention as
  // VaultCrackModal's per-run puzzle state. `pumpScreen` is null while the
  // normal Crypto HQ view is showing.
  const [pumpScreen, setPumpScreen] = useState(null) // null | 'brief' | 'drawing' | 'results'
  const [deck, setDeck] = useState([])
  const [drawHistory, setDrawHistory] = useState([])
  const [sessionResult, setSessionResult] = useState(null)

  const holdingsValue = world2.cryptoHoldings * world2.cryptoPrice

  // Safety net: if this modal unmounts (e.g. StockExchangeModal's tab switch,
  // while embedded) mid-session, without ever reaching a bust/cash-out, make
  // sure pumpSessionActive doesn't get stuck true forever and permanently
  // suppress the ambient crash roll.
  const pumpScreenRef = useRef(pumpScreen)
  useEffect(() => {
    pumpScreenRef.current = pumpScreen
  }, [pumpScreen])
  useEffect(() => {
    return () => {
      if (pumpScreenRef.current === 'drawing') {
        useGameStore.getState().setPumpSessionActive(false)
      }
    }
  }, [])

  const startPumpSession = () => {
    if (!spendEnergy(PUMP_ENERGY_COST)) return
    // Locked in once, at session start, via getState() (not the reactive
    // hook values above) - the deck composition doesn't change mid-session
    // even if hype/reputation move afterward.
    const snapshot = useGameStore.getState()
    const hypeAtStart = snapshot.world2.cryptoHype
    const reputation = snapshot.reputation
    setPumpSessionActive(true)
    setDeck(buildDeck(hypeAtStart, reputation))
    setDrawHistory([])
    setSessionResult(null)
    setPumpScreen('drawing')
  }

  const cancelBrief = () => setPumpScreen(null)

  const drawCard = () => {
    if (deck.length === 0) return
    const [card, ...rest] = deck
    setDeck(rest)
    setDrawHistory((prev) => [...prev, card])

    if (card === 'pump') {
      applyCryptoPumpCard({ priceMultiplier: 1.15, hypeDelta: 0.05 })
    } else if (card === 'bigpump') {
      applyCryptoPumpCard({ priceMultiplier: 1.40, hypeDelta: 0.12 })
    } else {
      // Whale Dump: instant bust. applyCryptoWhaleDump handles the shared
      // crash-reset + reputation hit + clearing pumpSessionActive.
      applyCryptoWhaleDump()
      setSessionResult({ outcome: 'bust' })
      setPumpScreen('results')
    }
  }

  const cashOutSession = () => {
    const snapshot = useGameStore.getState()
    const realized = snapshot.world2.cryptoHoldings * snapshot.world2.cryptoPrice
    sellCrypto(snapshot.world2.cryptoHoldings)
    setPumpSessionActive(false)
    setSessionResult({ outcome: 'cashout', amount: realized })
    setPumpScreen('results')
  }

  const tally = deck.reduce(
    (acc, c) => ({ ...acc, [c]: acc[c] + 1 }),
    { pump: 0, bigpump: 0, whale: 0 }
  )

  const pumpBody = (
    <>
      {pumpScreen === 'brief' && (
        <div className="flex flex-col gap-3">
          <h2 className="text-xl font-bold text-orange-300">Hype Deck</h2>
          <div className="border-2 border-gray-600 bg-[#0f1020] p-3 text-sm">
            <p>Price: <span className="text-yellow-300">${world2.cryptoPrice.toFixed(4)}</span></p>
            <p>Hype Meter: <span className="text-red-400">{Math.round(world2.cryptoHype * 100)}%</span></p>
          </div>
          <p className="text-xs text-gray-400">
            Draw cards from a known 12+ card deck to pump {CRYPTO_NAME}'s price. Most cards are safe Pumps - but the
            deck also hides one or more Whale Dump cards that crash the market instantly and bust the session. The
            deck's exact composition (and how many Whale Dumps are left) is always shown to you - the only unknown is
            draw order. Cash out any time once you're holding {CRYPTO_TICKER} to lock in your gains.
          </p>
          <p className="text-xs text-gray-400">Entry cost: <span className="text-yellow-300">{PUMP_ENERGY_COST} energy</span></p>
          <div className="flex gap-2">
            <button
              onClick={startPumpSession}
              disabled={player.energy < PUMP_ENERGY_COST}
              className="flex-1 border-2 border-orange-400 bg-orange-500 py-1.5 text-sm font-bold text-black hover:bg-orange-400 disabled:opacity-30"
            >
              {player.energy < PUMP_ENERGY_COST ? 'Not Enough Energy' : 'Start Shilling'}
            </button>
            <button
              onClick={cancelBrief}
              className="flex-1 border-2 border-gray-500 py-1.5 text-sm text-gray-300 hover:bg-gray-700"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {pumpScreen === 'drawing' && (
        <div className="flex flex-col gap-3">
          <h2 className="text-xl font-bold text-orange-300">Hype Deck — Drawing</h2>
          <div className="border-2 border-gray-600 bg-[#0f1020] p-3 text-sm">
            <p>Price: <span className="text-yellow-300">${world2.cryptoPrice.toFixed(4)}</span></p>
            <p>Hype Meter: <span className="text-red-400">{Math.round(world2.cryptoHype * 100)}%</span></p>
            <p>Your Holdings: {world2.cryptoHoldings.toFixed(2)} {CRYPTO_TICKER} (${holdingsValue.toFixed(2)})</p>
          </div>
          <p className="text-xs text-gray-400">
            {deck.length} left: {tally.pump} Pump / {tally.bigpump} Big Pump / {tally.whale} Whale Dump
          </p>
          <div className="flex gap-2">
            <button
              onClick={drawCard}
              disabled={deck.length === 0}
              className="flex-1 border-2 border-orange-400 bg-orange-500 py-1.5 text-sm font-bold text-black hover:bg-orange-400 disabled:opacity-30"
            >
              Draw & Shill
            </button>
            <button
              onClick={cashOutSession}
              disabled={world2.cryptoHoldings <= 0}
              className="flex-1 border-2 border-green-400 py-1.5 text-sm font-bold text-green-400 hover:bg-green-400 hover:text-black disabled:opacity-30"
            >
              Cash Out Now
            </button>
          </div>
          {drawHistory.length > 0 && (
            <div className="border-2 border-gray-700 bg-[#0a0a16] p-2">
              <p className="mb-1 text-xs font-bold text-gray-400">Cards Drawn</p>
              <p className="text-xs text-gray-300">
                {drawHistory.map((c, i) => CARD_LABEL[c] + (i < drawHistory.length - 1 ? ', ' : ''))}
              </p>
            </div>
          )}
        </div>
      )}

      {pumpScreen === 'results' && sessionResult && (
        <div className="flex flex-col gap-3">
          <h2 className="text-xl font-bold text-orange-300">Hype Deck — Results</h2>
          {sessionResult.outcome === 'bust' ? (
            <div className="border-2 border-red-500 bg-[#0f1020] p-3 text-center">
              <p className="text-lg font-bold text-red-400">Busted!</p>
              <p className="text-xs text-gray-400">
                A Whale Dump crashed the market back to baseline. Reputation -5.
              </p>
            </div>
          ) : (
            <div className="border-2 border-green-500 bg-[#0f1020] p-3 text-center">
              <p className="text-lg font-bold text-green-400">Cashed Out</p>
              <p className="text-base font-bold text-green-300">+${sessionResult.amount.toFixed(2)}</p>
            </div>
          )}
          <div className="flex gap-2">
            <button
              onClick={() => setPumpScreen('brief')}
              className="flex-1 border-2 border-orange-400 py-1.5 text-sm font-bold text-orange-300 hover:bg-orange-400 hover:text-black"
            >
              Play Again
            </button>
            <button
              onClick={() => setPumpScreen(null)}
              className="flex-1 border-2 border-gray-500 py-1.5 text-sm text-gray-300 hover:bg-gray-700"
            >
              Back
            </button>
          </div>
        </div>
      )}
    </>
  )

  const body = (
    <>
      {pumpScreen ? (
        pumpBody
      ) : (
        <>
          <h2 className="mb-2 text-xl font-bold text-orange-300">Crypto HQ</h2>
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
            onClick={() => setPumpScreen('brief')}
            className="mb-4 w-full border-4 border-orange-400 bg-orange-500 py-2 font-bold text-black hover:bg-orange-400"
          >
            Start Pump Session
          </button>

          <button
            onClick={() => {
              const res = executeCrime({
                type: 'hack',
                baseSuccessChance: 0.6, // 60% base
                payout: 5000,
                notorietyIncreaseOnFail: 15,
                wantedIncreaseOnFail: 2,
                energyCost: 20,
                assetSeizureOnFail: 0.1, // lose 10% of cash
                jailChanceOnFail: 0.15,
              })
              setFeedbackMsg(res.message || res.reason)
            }}
            className="mb-4 w-full border-4 border-fuchsia-400 bg-fuchsia-900 py-2 font-bold text-white hover:bg-fuchsia-700"
          >
            Hack Exchange Wallet (20 Energy)
          </button>

          {feedbackMsg && <p className="mb-4 text-xs italic text-orange-300">{feedbackMsg}</p>}
        </>
      )}

      {!embedded && !pumpScreen && (
        <button
          onClick={onClose}
          className="w-full border-4 border-gray-500 py-2 font-bold hover:bg-gray-500"
        >
          Leave
        </button>
      )}
    </>
  )

  if (embedded) return body

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="w-[440px] border-4 border-orange-400 bg-[#1c1d3a] p-6 font-mono text-white">
        {body}
      </div>
    </div>
  )
}
