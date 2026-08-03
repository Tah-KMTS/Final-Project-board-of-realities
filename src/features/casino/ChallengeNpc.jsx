import { useState } from 'react'
import { useGameStore } from '../../store/useGameStore'
import { CASINO_NPCS } from './casinoNpcs'
import Blackjack from './Blackjack'
import Poker from './Poker'

const BIG_WIN_REPUTATION_THRESHOLD = 300

// Fallback cash-equivalent for inventory items with no explicit value field
// (e.g. gear pulled from a rift rather than a claw-machine collectible).
function estimateItemValue(item) {
  return item.sellValue ?? item.value ?? 150
}

// Same blackjack/poker engines as the flat casino tables, but the stake is a
// specific opponent's cash or an inventory item instead of a fixed house
// bet. Simplification: NPCs here don't have a persistent inventory of their
// own, so an item-for-item stake pays out the item's cash-equivalent value
// on a win rather than a matching physical item back - documented rather
// than silently hand-waved.
export default function ChallengeNpc() {
  const cash = useGameStore((s) => s.cash)
  const inventory = useGameStore((s) => s.inventory)
  const addCash = useGameStore((s) => s.addCash)
  const removeItem = useGameStore((s) => s.removeItem)
  const addReputation = useGameStore((s) => s.addReputation)

  const [step, setStep] = useState('pick') // pick | stake | playing | result
  const [opponent, setOpponent] = useState(null)
  const [gameType, setGameType] = useState('blackjack')
  const [stakeType, setStakeType] = useState('cash')
  const [cashAmount, setCashAmount] = useState(100)
  const [selectedItemId, setSelectedItemId] = useState('')
  const [stakeConfig, setStakeConfig] = useState(null)
  const [resultMessage, setResultMessage] = useState('')

  const selectedItem = inventory.find((i) => i.id === selectedItemId)
  const stakeValue = stakeType === 'cash' ? cashAmount : selectedItem ? estimateItemValue(selectedItem) : 0

  const pickOpponent = (npc) => {
    setOpponent(npc)
    setStep('stake')
  }

  const confirmStake = () => {
    if (stakeType === 'cash') {
      if (cashAmount <= 0 || cashAmount > cash) return
      setStakeConfig({ type: 'cash', amount: cashAmount })
    } else {
      if (!selectedItem) return
      setStakeConfig({ type: 'item', item: selectedItem })
    }
    setStep('playing')
  }

  const handleResolve = (outcome) => {
    let netCash = 0
    let msg = ''
    if (stakeConfig.type === 'cash') {
      if (outcome === 'win') {
        netCash = stakeConfig.amount
        msg = `You win $${stakeConfig.amount.toLocaleString()} off ${opponent.name}.`
      } else if (outcome === 'lose') {
        netCash = -stakeConfig.amount
        msg = `You lose $${stakeConfig.amount.toLocaleString()} to ${opponent.name}.`
      } else {
        msg = `Push - your $${stakeConfig.amount.toLocaleString()} stake is safe.`
      }
      if (netCash !== 0) addCash(netCash)
    } else {
      const value = estimateItemValue(stakeConfig.item)
      if (outcome === 'win') {
        netCash = value
        addCash(value)
        msg = `${opponent.name} can't match your ${stakeConfig.item.name}, so they pay out its street value: $${value.toLocaleString()}.`
      } else if (outcome === 'lose') {
        removeItem(stakeConfig.item.id)
        msg = `You lose your ${stakeConfig.item.name} to ${opponent.name}.`
      } else {
        msg = `Push - you keep your ${stakeConfig.item.name}.`
      }
    }
    if (netCash >= BIG_WIN_REPUTATION_THRESHOLD) addReputation(2)
    setResultMessage(msg)
    setStep('result')
  }

  const startOver = () => {
    setStep('pick')
    setOpponent(null)
    setStakeConfig(null)
    setResultMessage('')
    setSelectedItemId('')
  }

  return (
    <div className="border-2 border-pink-400 bg-[#12071c] p-4 text-sm">
      {step === 'pick' && (
        <>
          <p className="mb-3 text-xs text-gray-400">Pick a regular to challenge. Winner takes whatever gets staked.</p>
          <div className="grid grid-cols-2 gap-2">
            {CASINO_NPCS.map((n) => (
              <button
                key={n.id}
                onClick={() => pickOpponent(n)}
                className="flex flex-col items-start gap-1 border-2 border-gray-600 p-2 text-left hover:border-pink-400"
              >
                <div className="flex items-center gap-2">
                  <span className="h-4 w-4 rounded-full border border-white/40" style={{ backgroundColor: n.avatarColor }} />
                  <span className="font-bold text-pink-300">{n.name}</span>
                </div>
                <span className="text-xs text-gray-500">{n.title}</span>
                <span className="text-xs italic text-gray-400">{n.flavor}</span>
              </button>
            ))}
          </div>
        </>
      )}

      {step === 'stake' && opponent && (
        <>
          <p className="mb-2 text-xs text-gray-400">
            Challenging <span className="text-pink-300">{opponent.name}</span> - {opponent.flavor}
          </p>

          <div className="mb-3 flex gap-2">
            <button
              onClick={() => setGameType('blackjack')}
              className={`border-2 px-3 py-1 font-bold ${gameType === 'blackjack' ? 'border-pink-400 text-pink-300' : 'border-gray-600 text-gray-400'}`}
            >
              Blackjack
            </button>
            <button
              onClick={() => setGameType('poker')}
              className={`border-2 px-3 py-1 font-bold ${gameType === 'poker' ? 'border-pink-400 text-pink-300' : 'border-gray-600 text-gray-400'}`}
            >
              5-Card Draw Poker
            </button>
          </div>

          <div className="mb-3 flex gap-2">
            <button
              onClick={() => setStakeType('cash')}
              className={`border-2 px-3 py-1 font-bold ${stakeType === 'cash' ? 'border-cyan-400 text-cyan-300' : 'border-gray-600 text-gray-400'}`}
            >
              Stake Cash
            </button>
            <button
              onClick={() => setStakeType('item')}
              disabled={inventory.length === 0}
              className={`border-2 px-3 py-1 font-bold disabled:opacity-30 ${stakeType === 'item' ? 'border-cyan-400 text-cyan-300' : 'border-gray-600 text-gray-400'}`}
            >
              Stake an Item
            </button>
          </div>

          {stakeType === 'cash' ? (
            <div className="mb-3 flex items-center gap-2">
              <label className="text-xs text-gray-400">Amount ($)</label>
              <input
                type="number"
                min={10}
                value={cashAmount}
                onChange={(e) => setCashAmount(Math.max(10, Math.floor(Number(e.target.value)) || 10))}
                className="w-28 border border-gray-600 bg-black px-1 py-1 text-white"
              />
              <span className="text-xs text-gray-500">You have ${Math.round(cash).toLocaleString()}</span>
            </div>
          ) : (
            <div className="mb-3">
              <select
                value={selectedItemId}
                onChange={(e) => setSelectedItemId(e.target.value)}
                className="w-full border border-gray-600 bg-black px-1 py-1 text-white"
              >
                <option value="">Select an item to stake...</option>
                {inventory.map((item, i) => (
                  <option key={`${item.id}-${i}`} value={item.id}>
                    {item.name} {item.rarity ? `(${item.rarity})` : ''} - est. ${estimateItemValue(item).toLocaleString()}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="flex gap-2">
            <button
              onClick={confirmStake}
              disabled={stakeType === 'cash' ? cashAmount <= 0 || cashAmount > cash : !selectedItem}
              className="border-2 border-pink-400 px-3 py-1 font-bold text-pink-300 hover:bg-pink-400 hover:text-black disabled:opacity-30"
            >
              Sit Down (stake ${stakeValue.toLocaleString()})
            </button>
            <button onClick={startOver} className="border-2 border-gray-500 px-3 py-1 font-bold text-gray-300 hover:bg-gray-500 hover:text-black">
              Back
            </button>
          </div>
        </>
      )}

      {step === 'playing' && opponent && stakeConfig && gameType === 'blackjack' && (
        <Blackjack variant="challenge" dealerName={opponent.name} fixedBet={stakeValue} onResolve={handleResolve} />
      )}
      {step === 'playing' && opponent && stakeConfig && gameType === 'poker' && (
        <Poker variant="challenge" npc={opponent} fixedStake={stakeValue} onResolve={handleResolve} />
      )}

      {step === 'result' && (
        <div>
          <p className="mb-3 font-bold text-yellow-300">{resultMessage}</p>
          <button onClick={startOver} className="border-2 border-pink-400 px-3 py-1 font-bold text-pink-300 hover:bg-pink-400 hover:text-black">
            Challenge Someone Else
          </button>
        </div>
      )}
    </div>
  )
}
