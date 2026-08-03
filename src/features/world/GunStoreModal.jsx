import { useState } from 'react'
import { useGameStore } from '../../store/useGameStore'
import { getPresidentialGunPolicy, canPurchaseLegalFirearm } from './firearmLegislationEngine'
import { WEAPONS_DATABASE } from './toolsWeaponsCatalog'
import { THEFT_ITEM } from '../../game/vehicleGen'

export default function GunStoreModal({ onClose }) {
  const [activeTab, setActiveTab] = useState('legal') // 'legal' | 'black_market'
  const [feedbackMsg, setFeedbackMsg] = useState(null)

  const cash = useGameStore((s) => s.cash)
  const addCash = useGameStore((s) => s.addCash)
  const addItem = useGameStore((s) => s.addItem)
  const world2 = useGameStore((s) => s.world2)
  const hasFfl = useGameStore((s) => s.hasFfl || false)
  const buyFflLicense = useGameStore((s) => s.buyFflLicense || (() => ({ success: true })))

  const president = (world2.governmentState || {}).president || { name: 'Reagan' }
  const policy = getPresidentialGunPolicy(president)

  const handleLegalBuy = (weapon) => {
    const check = canPurchaseLegalFirearm(policy, hasFfl)
    if (!check.allowed) {
      setFeedbackMsg(check.reason)
      return
    }

    const price = weapon.value * (1 + policy.legalTax)
    if (cash < price) {
      setFeedbackMsg(`Insufficient cash! Needed $${price.toFixed(2)}.`)
      return
    }

    addCash(-price)
    // Weapons here are flavor purchases (no inventory effect) except the
    // theft tool, which the Vehicle Theft flow actually checks for by id.
    if (weapon.id === THEFT_ITEM.id) addItem(THEFT_ITEM)
    setFeedbackMsg(`🔫 LEGAL PURCHASE: Bought 1x ${weapon.name} for $${price.toFixed(2)} under ${policy.title}!`)
  }

  const handleBlackMarketBuy = (weapon) => {
    const blackMarketPrice = weapon.value * 1.5 // 50% markup, no questions asked!
    if (cash < blackMarketPrice) {
      setFeedbackMsg(`Insufficient cash! Needed $${blackMarketPrice.toFixed(2)} for Black Market arms.`)
      return
    }

    addCash(-blackMarketPrice)
    if (weapon.id === THEFT_ITEM.id) addItem(THEFT_ITEM)
    setFeedbackMsg(`🕵️ BLACK MARKET ARMS: Bought untraceable 1x ${weapon.name} for $${blackMarketPrice.toFixed(2)} from Sal! No background check required.`)
  }

  const handleBuyFfl = () => {
    if (cash < 5000) {
      setFeedbackMsg('Insufficient cash for Federal Firearm License (FFL $5,000)!')
      return
    }
    buyFflLicense()
    setFeedbackMsg('📜 LICENSING AUTHORIZED: Acquired Federal Firearm License (FFL)! Legal gun purchases unlocked.')
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 font-mono text-white">
      <div className="w-full max-w-3xl border-4 border-yellow-500/80 bg-[#140e06] p-6 shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-yellow-500/40 pb-3">
          <div>
            <span className="rounded bg-yellow-950 px-2 py-0.5 text-xs font-bold text-yellow-300 uppercase tracking-wider">FIREARM & AMMUNITION EMPORIUM</span>
            <h2 className="text-2xl font-bold text-yellow-300 mt-1">🔫 ARMS & AMMUNITION SUPPLY</h2>
            <p className="text-xs text-gray-300 mt-1">{policy.title}: {policy.description}</p>
          </div>
          <div className="text-right">
            <div className="text-xs text-gray-400">FFL License Status</div>
            <div className={`text-sm font-bold ${hasFfl ? 'text-emerald-400' : 'text-red-400'}`}>
              {hasFfl ? '✓ FFL LICENSED' : '❌ UNLICENSED'}
            </div>
            {!hasFfl && policy.requiresFfl && (
              <button
                onClick={handleBuyFfl}
                className="mt-1 rounded border border-yellow-400 bg-yellow-950 px-2 py-0.5 text-xs font-bold text-yellow-300 hover:bg-yellow-500 hover:text-black transition-all"
              >
                Buy FFL ($5,000)
              </button>
            )}
          </div>
        </div>

        {/* Tab Selection: Legal vs Black Market */}
        <div className="flex border-b border-gray-800 bg-[#21160a] text-xs font-bold my-3">
          <button
            onClick={() => setActiveTab('legal')}
            className={`flex-1 py-2.5 ${activeTab === 'legal' ? 'bg-yellow-500 text-black font-extrabold' : 'text-gray-400 hover:text-white'}`}
          >
            🏪 Legal Retail Store ({policy.legalOpen ? 'OPEN' : 'BANNED'})
          </button>
          <button
            onClick={() => setActiveTab('black_market')}
            className={`flex-1 py-2.5 ${activeTab === 'black_market' ? 'bg-red-600 text-white font-extrabold' : 'text-gray-400 hover:text-white'}`}
          >
            🕵️ Underground Black Market Dealer (ALWAYS ACCESSIBLE)
          </button>
        </div>

        {/* Feedback Alert */}
        {feedbackMsg && (
          <div className="my-2 rounded border border-yellow-400 bg-yellow-950/80 p-2.5 text-center text-xs font-bold text-yellow-200">
            {feedbackMsg}
          </div>
        )}

        {/* Weapons List */}
        <div className="my-3 space-y-2.5 max-h-[45vh] overflow-y-auto pr-1">
          {WEAPONS_DATABASE.map((weapon) => {
            const price = activeTab === 'legal' ? weapon.value * (1 + policy.legalTax) : weapon.value * 1.5
            return (
              <div key={weapon.id} className="flex items-center justify-between rounded border border-yellow-500/30 bg-[#24170b] p-3 text-xs">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-yellow-300 text-sm">{weapon.name}</span>
                    <span className="rounded bg-yellow-950 px-1.5 py-0.5 text-xs text-yellow-300 uppercase">{weapon.category}</span>
                  </div>
                  <div className="text-xs text-gray-300 mt-0.5">
                    Damage/Stats: <b className="text-cyan-300">{weapon.damage || weapon.defense || 'Utility'}</b> • Price: <b className="text-emerald-400">${price.toFixed(2)}</b>
                  </div>
                </div>

                {activeTab === 'legal' ? (
                  <button
                    onClick={() => handleLegalBuy(weapon)}
                    className="rounded border border-emerald-500 bg-emerald-950 px-3 py-1.5 text-xs font-bold text-emerald-300 hover:bg-emerald-500 hover:text-black transition-all"
                  >
                    💵 Buy Legal
                  </button>
                ) : (
                  <button
                    onClick={() => handleBlackMarketBuy(weapon)}
                    className="rounded border border-red-500 bg-red-950 px-3 py-1.5 text-xs font-bold text-red-300 hover:bg-red-600 hover:text-white transition-all"
                  >
                    🕵️ Buy Untraceable
                  </button>
                )}
              </div>
            )
          })}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-800 bg-[#120b04] p-3 text-right">
          <button
            onClick={onClose}
            className="border border-gray-600 bg-gray-800 px-6 py-2 text-xs font-bold text-white hover:bg-gray-700 transition-colors"
          >
            Close Gun Store
          </button>
        </div>
      </div>
    </div>
  )
}
