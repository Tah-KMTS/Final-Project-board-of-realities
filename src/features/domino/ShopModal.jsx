import { useGameStore } from '../../store/useGameStore'
import { CARD_DATABASE } from './cardDatabase'

const PACKS = [
  { id: 'beginner', name: 'Beginner Pack', cost: 150, pool: CARD_DATABASE.filter((c) => (c.Base_ATK ?? 0) <= 1700 || c.Primary_Type !== 'Monster') },
  { id: 'advanced', name: 'Advanced Pack', cost: 300, pool: CARD_DATABASE.filter((c) => (c.Base_ATK ?? 1000) >= 1400) },
  { id: 'expert', name: 'Expert Pack', cost: 500, pool: CARD_DATABASE.filter((c) => (c.Base_ATK ?? 0) >= 2000 || c.Primary_Type === 'Trap') },
]
const PACK_SIZE = 5

function drawPack(pool) {
  const cards = []
  for (let i = 0; i < PACK_SIZE; i++) cards.push(pool[Math.floor(Math.random() * pool.length)].Card_ID)
  return cards
}

export default function ShopModal({ onClose }) {
  const dp = useGameStore((s) => s.world4.dp)
  const getPackUnlocks = useGameStore((s) => s.getPackUnlocks)
  const buyDominoPack = useGameStore((s) => s.buyDominoPack)
  const buyTournamentPass = useGameStore((s) => s.buyTournamentPass)
  const tournamentPassOwned = useGameStore((s) => s.world4.tournamentPassOwned)
  const totalWins = useGameStore((s) => s.world4.totalWins)

  const unlocks = getPackUnlocks()

  const handleBuy = (pack) => {
    const cards = drawPack(pack.pool)
    buyDominoPack(pack.cost, cards)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      {/* Clean infographic-style panel: crisp white/light-purple accents on
          dark, per the GDD's shop art direction note. */}
      <div className="w-[440px] border-4 border-purple-300 bg-[#161522] p-6 font-mono text-white">
        <h2 className="mb-1 text-xl font-bold text-purple-200">Kame Game Shop</h2>
        <p className="mb-3 text-xs text-purple-300">DP: {dp}</p>

        <div className="mb-4 flex flex-col gap-2">
          {PACKS.map((pack) => {
            const unlocked = unlocks[pack.id]
            return (
              <div key={pack.id} className="border border-purple-300/40 bg-white/5 p-2">
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span className="font-bold text-white">{pack.name}</span>
                  <span className="text-purple-300">{pack.cost} DP</span>
                </div>
                {unlocked ? (
                  <button
                    onClick={() => handleBuy(pack)}
                    disabled={dp < pack.cost}
                    className="w-full border border-purple-300 py-1 text-xs text-purple-200 hover:bg-purple-300 hover:text-black disabled:opacity-30"
                  >
                    Buy ({PACK_SIZE} cards)
                  </button>
                ) : (
                  <p className="text-[10px] text-gray-500">
                    {pack.id === 'advanced' && `Locked - reach 10 total wins (${totalWins}/10).`}
                    {pack.id === 'expert' && 'Locked - defeat three different Tier 4 duelists.'}
                  </p>
                )}
              </div>
            )
          })}
        </div>

        <div className="border border-purple-300/40 bg-white/5 p-2 text-sm">
          <p className="mb-1 font-bold text-white">Tournament Pass</p>
          {tournamentPassOwned ? (
            <p className="text-xs text-green-400">Owned - the KC Tower elevator is open on weekends.</p>
          ) : unlocks.tournamentPass ? (
            <button
              onClick={buyTournamentPass}
              disabled={dp < 1000}
              className="w-full border border-purple-300 py-1 text-xs text-purple-200 hover:bg-purple-300 hover:text-black disabled:opacity-30"
            >
              Buy (1000 DP)
            </button>
          ) : (
            <p className="text-[10px] text-gray-500">Locked - reach 15 total wins ({totalWins}/15).</p>
          )}
        </div>

        <button
          onClick={onClose}
          className="mt-4 w-full border-4 border-gray-500 py-2 font-bold hover:bg-gray-500"
        >
          Leave
        </button>
      </div>
    </div>
  )
}
