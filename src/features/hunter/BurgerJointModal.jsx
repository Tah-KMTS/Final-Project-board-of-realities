import { useGameStore } from '../../store/useGameStore'
import DialogueBox from '../../components/Dialogue/DialogueBox'
import { BURGER_JOINT_GREETING_LINES } from '../../data/hunterDialogue'
import { playPurchaseSound } from '../../audio/sfx'

const HEAL_AMOUNT = 30
const COST = 10

export default function BurgerJointModal({ onClose }) {
  const player = useGameStore((s) => s.player)
  const cash = useGameStore((s) => s.cash)
  const addCash = useGameStore((s) => s.addCash)
  const updatePlayer = useGameStore((s) => s.updatePlayer)

  const canBuy = cash >= COST && player.hp < player.maxHp

  const handleBuy = () => {
    if (!canBuy) return
    addCash(-COST)
    updatePlayer({ hp: Math.min(player.maxHp, player.hp + HEAL_AMOUNT) })
    playPurchaseSound()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="w-[400px] border-4 border-orange-400 bg-[#1c1d3a] p-6 font-mono text-white">
        <h2 className="mb-3 text-xl font-bold text-orange-300">Burger Joint</h2>
        <DialogueBox speaker="Cook" portrait="🍔" lines={BURGER_JOINT_GREETING_LINES} onDone={() => {}} />
        <div className="mb-4 flex items-center justify-between border-2 border-gray-600 bg-[#0f1020] p-3">
          <div>
            <p className="font-bold">Hunter's Combo Meal</p>
            <p className="text-xs text-gray-400">Restores {HEAL_AMOUNT} HP</p>
          </div>
          <button
            onClick={handleBuy}
            disabled={!canBuy}
            className="border-2 border-green-400 bg-green-500 px-3 py-1 text-xs font-bold text-black hover:bg-green-400 disabled:opacity-40"
          >
            Buy ${COST}
          </button>
        </div>
        <p className="mb-4 text-xs text-gray-500">HP: {player.hp}/{player.maxHp}</p>
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
